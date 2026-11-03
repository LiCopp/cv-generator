import { expect, test, type Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createProject } from '../packages/core/src/fixtures';
import { parseProject, type Project } from '../packages/core/src/schema';
import { openPrintHost } from './print-host';

async function projectWithPhoto(page: Page, side: 'left' | 'right', overlap: number) {
  await page.goto('/');
  const [photo, background] = await page.evaluate(() =>
    ['#b4588e', '#d6e4f0'].map((color, index) => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 240;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 200, 240);
      if (index) {
        ctx.fillStyle = '#9aafbd';
        for (let y = 0; y < 240; y += 30) ctx.fillRect(0, y, 200, 10);
      }
      return canvas.toDataURL('image/png');
    }),
  );
  const project = createProject(overlap ? 'adult' : 'student');
  project.cv.title = `Fotoversatz ${side} ${overlap}`;
  project.cv.contact.photoAssetId = 'photo';
  project.assets.photo = { mediaType: 'image/png', data: photo };
  project.assets.background = { mediaType: 'image/png', data: background };
  Object.assign(project.layout.appearance, {
    showPhoto: true,
    photoSide: side,
    photoOverlapMm: overlap,
    photoWidthMm: 34,
    photoShape: overlap ? 'rectangle' : 'circle',
    photoBorderWidthMm: 1,
    photoBorderColor: '#123456',
    headerNameLayout: 'inline',
    headerImageAssetId: 'background',
    headerEdge: 'diagonal',
    headerEdgeDepthMm: 16,
    headerShiftUpMm: side === 'right' ? 20 : 0,
    headerTextOffsetMm: 2,
  });
  return project;
}

async function openProject(page: Page, project: Project) {
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'photo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
  await page
    .locator('.cv-page .cv-photo')
    .evaluate((image) => (image as HTMLImageElement).decode());
}

function geometry() {
  const page = document.querySelector('.cv-first-page')!,
    origin = page.getBoundingClientRect(),
    mm = origin.width / 210;
  const rect = (selector: string) => {
    const box = page.querySelector(selector)!.getBoundingClientRect();
    return {
      top: (box.top - origin.top) / mm,
      bottom: (box.bottom - origin.top) / mm,
      left: (box.left - origin.left) / mm,
      width: box.width / mm,
      height: box.height / mm,
    };
  };
  const image = page.querySelector('.cv-photo')!,
    css = getComputedStyle(image);
  return {
    header: rect('.cv-header'),
    background: rect('.cv-header-image'),
    name: rect('h1'),
    photo: rect('.cv-photo'),
    viewport: rect('.cv-header-viewport'),
    intro: rect('.cv-intro-row'),
    crop: css.objectPosition,
    fit: css.objectFit,
  };
}

test('photo offset remains independent of overlap and survives save, reload and import', async ({
  page,
}, info) => {
  const project = await projectWithPhoto(page, 'left', 12);
  await openProject(page, project);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  const offset = page.getByRole('slider', {
    name: 'Foto im Header vertikal verschieben',
    exact: true,
  });
  const overlap = page.getByRole('slider', { name: 'Überlappung der Headergrenze', exact: true });
  await expect(offset).toHaveAttribute('aria-valuenow', '0');
  await offset.press('Home');
  for (let i = 0; i < 10; i++) await offset.press('ArrowRight');
  await expect(offset).toHaveAttribute('aria-valuenow', '-10');
  await expect(overlap).toHaveAttribute('aria-valuenow', '12');
  await overlap.press('Home');
  await expect(offset).toHaveAttribute('aria-valuenow', '-10');
  for (let i = 0; i < 12; i++) await overlap.press('ArrowRight');
  await page.getByRole('checkbox', { name: 'Foto im Lebenslauf anzeigen', exact: true }).uncheck();
  await expect(offset).toBeDisabled();
  await expect(page.locator('.cv-page .cv-photo')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Foto im Lebenslauf anzeigen', exact: true }).check();
  await expect(offset).toBeEnabled();
  await expect(offset).toHaveAttribute('aria-valuenow', '-10');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('photo.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.layout.schemaVersion).toBe(23);
  expect(saved.manifest.rendererVersion).toBe('1.28.0');
  expect(saved.cv).toEqual(project.cv);
  expect(saved.layout.appearance).toEqual({ ...project.layout.appearance, photoOffsetMm: -10 });
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(offset).toHaveAttribute('aria-valuenow', '-10');
  saved.cv.title += ' importiert';
  await openProject(page, saved);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(offset).toHaveAttribute('aria-valuenow', '-10');
  await expect(overlap).toHaveAttribute('aria-valuenow', '12');
});

for (const side of ['left', 'right'] as const)
  for (const overlap of [0, 12]) {
    test(`photo moves independently and matches actual PDF: side ${side}, overlap ${overlap}`, async ({
      page,
      context,
    }, info) => {
      await page.addInitScript(() => {
        window.print = () => {
          document.documentElement.dataset.printRequested = 'true';
        };
      });
      const project = await projectWithPhoto(page, side, overlap);
      await openProject(page, project);
      const baseline = await page.evaluate(geometry);
      await page.getByRole('tab', { name: 'Design', exact: true }).click();
      const slider = page.getByRole('slider', {
        name: 'Foto im Header vertikal verschieben',
        exact: true,
      });
      for (const value of [-15, 15]) {
        await slider.press(value < 0 ? 'Home' : 'End');
        await expect(page.locator('.cv-document')).toHaveCSS('--cv-photo-offset', `${value}mm`);
        await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
        const moved = await page.evaluate(geometry);
        for (const key of ['header', 'background', 'name'] as const)
          for (const axis of ['top', 'bottom', 'left', 'width', 'height'] as const)
            expect(Math.abs(moved[key][axis] - baseline[key][axis]), `${key} ${axis}`).toBeLessThan(
              0.05,
            );
        expect(moved.crop).toBe(baseline.crop);
        expect(moved.fit).toBe(baseline.fit);
        expect(moved.photo.left).toBeCloseTo(baseline.photo.left, 1);
        expect(moved.photo.height).toBeCloseTo(baseline.photo.height, 1);
        expect(moved.photo.top).toBeGreaterThanOrEqual(-0.05);
        expect(moved.photo.bottom).toBeLessThanOrEqual(moved.viewport.bottom + 0.05);
        const extraSpace = overlap && value > 0 ? value : 0;
        expect(moved.intro.top - baseline.intro.top).toBeCloseTo(extraSpace, 1);
        expect(moved.viewport.height - baseline.viewport.height).toBeCloseTo(extraSpace, 1);
        if (overlap) expect(moved.photo.top - baseline.photo.top).toBeCloseTo(value, 1);
        else {
          expect(moved.photo.bottom).toBeLessThanOrEqual(moved.header.bottom - 16 + 0.05);
          if (value > 0) expect(moved.photo.top).toBeGreaterThan(baseline.photo.top);
          if (value < 0 && side === 'left')
            expect(moved.photo.top).toBeLessThan(baseline.photo.top);
        }
        await expect(
          page.getByRole('slider', { name: 'Überlappung der Headergrenze', exact: true }),
        ).toHaveAttribute('aria-valuenow', String(overlap));
      }
      const preview = await page.evaluate(geometry),
        count = await page.locator('.cv-page').count();
      await page.getByRole('button', { name: 'PDF exportieren', exact: true }).click();
      await expect(page.frameLocator('iframe[data-cv-print]').locator('html')).toHaveAttribute(
        'data-print-requested',
        'true',
      );
      const frame = (await (await page
          .locator('iframe[data-cv-print]')
          .elementHandle())!.contentFrame())!,
        printed = await context.newPage();
      try {
        await openPrintHost(printed, page.url());
        await printed.setContent(await frame.content());
        await printed.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all([...document.images].map((image) => image.decode()));
        });
        await printed.emulateMedia({ media: 'print' });
        const actual = await printed.evaluate(geometry);
        for (const key of ['header', 'background', 'name', 'photo', 'intro'] as const)
          for (const axis of ['top', 'bottom', 'left', 'width'] as const)
            expect(
              Math.abs(actual[key][axis] - preview[key][axis]),
              `${key} ${axis} print`,
            ).toBeLessThan(0.5);
        const bytes = await printed.pdf({
          path: info.outputPath('photo-offset.pdf'),
          format: 'A4',
          preferCSSPageSize: true,
          printBackground: true,
        });
        const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
        try {
          const pdf = await task.promise;
          expect(pdf.numPages).toBe(count);
          let text = '';
          for (let index = 1; index <= pdf.numPages; index++)
            text += (await (await pdf.getPage(index)).getTextContent()).items
              .map((item) => ('str' in item ? item.str : ''))
              .join(' ');
          const normalized = text.replace(/\s/g, '');
          expect(normalized).toContain(
            `${project.cv.contact.firstName}${project.cv.contact.lastName}`,
          );
          for (const entry of project.cv.experience)
            expect(normalized).toContain(entry.organization.replace(/\s/g, ''));
          const sheet = await pdf.getPage(1),
            viewport = sheet.getViewport({ scale: 1.5 });
          const factory = pdf.canvasFactory as {
            create(
              width: number,
              height: number,
            ): {
              canvas: HTMLCanvasElement & { toBuffer(type: string): Buffer };
              context: CanvasRenderingContext2D;
            };
          };
          const { canvas, context: drawing } = factory.create(
            Math.ceil(viewport.width),
            Math.ceil(viewport.height),
          );
          await sheet.render({ canvas, canvasContext: drawing, viewport }).promise;
          const scale = viewport.width / 210,
            photo = actual.photo;
          for (const [x, color] of [
            [photo.left + photo.width / 2, [180, 88, 142]],
            [photo.left + 0.5, [18, 52, 86]],
          ] as const) {
            const pixel = drawing.getImageData(
              Math.round(x * scale),
              Math.round((photo.top + photo.height / 2) * scale),
              1,
              1,
            ).data;
            for (let channel = 0; channel < 3; channel++)
              expect(
                Math.abs(pixel[channel] - color[channel]),
                'PDF photo/frame location',
              ).toBeLessThan(8);
          }
          await writeFile(info.outputPath('photo-offset.png'), canvas.toBuffer('image/png'));
        } finally {
          await task.destroy();
        }
      } finally {
        await printed.close();
      }
      await page.evaluate(() =>
        document
          .querySelector<HTMLIFrameElement>('iframe[data-cv-print]')!
          .contentWindow!.dispatchEvent(new Event('afterprint')),
      );
    });
  }
