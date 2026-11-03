import { expect, test, type Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createProject, makeSkill } from '../packages/core/src/fixtures';
import { parseProject, type Project } from '../packages/core/src/schema';
import { openPrintHost } from './print-host';

async function openProject(page: Page, project: Project) {
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'header.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
}
function geometry() {
  const page = document.querySelector('.cv-first-page')!,
    origin = page.getBoundingClientRect(),
    mm = origin.height / 297;
  const rect = (selector: string) => {
    const element = page.querySelector(selector);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return {
      top: (box.top - origin.top) / mm,
      bottom: (box.bottom - origin.top) / mm,
      left: (box.left - origin.left) / mm,
      width: box.width / mm,
      height: box.height / mm,
    };
  };
  return {
    viewport: rect('.cv-header-viewport')!,
    shell: rect('.cv-header-shell')!,
    background: rect('.cv-header-background')!,
    image: rect('.cv-header-image'),
    name: rect('h1')!,
    text: rect('.cv-header-text')!,
    photo: rect('.cv-photo'),
    intro: rect('.cv-intro-row')!,
    firstBlocks: [...page.querySelectorAll<HTMLElement>('.cv-block')].map(
      (block) => block.dataset.blockId,
    ),
    color: getComputedStyle(page.querySelector('h1')!).color,
  };
}

test('header shift and free text color survive save, reload and import independently of other colors and gaps', async ({
  page,
}, info) => {
  const project = createProject('student');
  project.cv.title = 'Header verschieben und einfärben';
  await openProject(page, project);
  const baseline = await page.evaluate(geometry);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  const shift = page.getByRole('slider', { name: 'Header nach oben verschieben', exact: true });
  await expect(shift).toHaveAttribute('aria-valuenow', '0');
  await shift.press('End');
  await expect(shift).toHaveAttribute('aria-valuenow', '20');
  for (let i = 0; i < 24; i++) await shift.press('ArrowLeft');
  await expect(shift).toHaveAttribute('aria-valuenow', '8');
  const color = page.getByLabel('Schriftfarbe im Header', { exact: true });
  await color.fill('#e8d5b0');
  await expect(page.locator('.cv-page h1')).toHaveCSS('color', 'rgb(232, 213, 176)');
  const moved = await page.evaluate(geometry);
  expect(baseline.intro.top - moved.intro.top).toBeCloseTo(8, 1);
  expect(moved.text.top).toBeGreaterThanOrEqual(-0.05);
  const textOffset = page.getByRole('slider', {
    name: 'Name im Header vertikal verschieben',
    exact: true,
  });
  await textOffset.press('End');
  await expect(textOffset).toHaveAttribute('aria-valuenow', '15');
  expect((await page.evaluate(geometry)).name.top).toBeGreaterThan(moved.name.top);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('header.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.layout.schemaVersion).toBe(23);
  expect(saved.manifest.rendererVersion).toBe('1.28.0');
  expect(saved.cv).toEqual(project.cv);
  expect(saved.layout.appearance).toEqual({
    ...project.layout.appearance,
    headerShiftUpMm: 8,
    headerTextOffsetMm: 15,
    headerTextColor: '#e8d5b0',
  });
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await expect(page.locator('.cv-page h1')).toHaveCSS('color', 'rgb(232, 213, 176)');
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(shift).toHaveAttribute('aria-valuenow', '8');
  await expect(textOffset).toHaveAttribute('aria-valuenow', '15');
  saved.cv.title += ' importiert';
  await openProject(page, saved);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(
    page.getByRole('slider', { name: 'Name im Header vertikal verschieben', exact: true }),
  ).toHaveAttribute('aria-valuenow', '15');
  await textOffset.press('Home');
  await expect(textOffset).toHaveAttribute('aria-valuenow', '-15');
  const raised = await page.evaluate(geometry);
  expect(raised.name.top).toBeLessThan(moved.name.top);
  expect(raised.text.top).toBeGreaterThanOrEqual(-0.05);
});

for (const { scenario, shift, offset, inline } of [
  { scenario: 'no-photo', shift: 10, offset: 0, inline: false },
  { scenario: 'overlap-image-left', shift: 10, offset: 0, inline: false },
  { scenario: 'inside-right', shift: 10, offset: 0, inline: false },
  { scenario: 'no-photo', shift: 20, offset: 0, inline: true },
  { scenario: 'overlap-image-left', shift: 20, offset: 15, inline: true },
  { scenario: 'inside-right', shift: 20, offset: -15, inline: true },
  { scenario: 'overlap-image-left', shift: 0, offset: -15, inline: true },
] as const) {
  test(`header and name position match PDF: ${scenario}, shift ${shift}, text ${offset}`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    await page.goto('/');
    const [portrait, background] = await page.evaluate(() =>
      ['#b4588e', '#eef3f8'].map((color, index) => {
        const canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 200;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 150, 200);
        if (index === 1) {
          ctx.fillStyle = '#a2b4c0';
          for (let y = 0; y < 200; y += 25) ctx.fillRect(0, y, 150, 10);
        }
        return canvas.toDataURL('image/png');
      }),
    );
    const project = createProject(scenario === 'overlap-image-left' ? 'adult' : 'student');
    project.cv.title = `Header ${scenario}`;
    project.cv.skills = Array.from({ length: 60 }, (_, i) =>
      makeSkill({ id: `skill-${i}`, name: `Kenntnis ${i + 1}` }),
    );
    Object.assign(project.layout.appearance, {
      headerTextColor: '#e86a21',
      headerNameLayout: inline ? 'inline' : 'stacked',
      headerEdge:
        scenario === 'inside-right'
          ? 'arc'
          : scenario === 'overlap-image-left'
            ? 'diagonal'
            : 'wave',
      headerEdgeMirrored: scenario === 'overlap-image-left',
    });
    if (scenario === 'inside-right' && offset < 0) {
      project.cv.contact.firstName = 'Alexandra mit mehreren Vornamen';
      project.cv.contact.lastName = 'Beispiel mit langem Nachnamen';
    }
    if (scenario !== 'no-photo') {
      project.assets.portrait = { mediaType: 'image/png', data: portrait };
      project.cv.contact.photoAssetId = 'portrait';
      Object.assign(project.layout.appearance, {
        showPhoto: true,
        photoSide: scenario === 'inside-right' ? 'right' : 'left',
        photoOverlapMm: scenario === 'inside-right' ? 0 : 15,
        photoWidthMm: scenario === 'inside-right' ? 34 : 50,
        photoShape: scenario === 'inside-right' ? 'circle' : 'rectangle',
      });
    }
    if (scenario === 'overlap-image-left') {
      project.assets.background = { mediaType: 'image/png', data: background };
      Object.assign(project.layout.appearance, {
        headerImageAssetId: 'background',
        headerImageTransparencyPercent: 30,
      });
    }
    await openProject(page, project);
    const baseline = await page.evaluate(geometry);
    project.layout.appearance.headerShiftUpMm = shift;
    project.cv.title += ' verschoben';
    await openProject(page, project);
    const fixed = await page.evaluate(geometry),
      fixedCount = await page.locator('.cv-page').count();
    if (offset !== 0) {
      await page.getByRole('tab', { name: 'Design', exact: true }).click();
      const slider = page.getByRole('slider', {
        name: 'Name im Header vertikal verschieben',
        exact: true,
      });
      for (const value of [-15, 15, offset]) {
        await slider.press(value < 0 ? 'Home' : 'End');
        await expect(page.locator('.cv-document')).toHaveCSS(
          '--cv-header-text-offset',
          `${value}mm`,
        );
        await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
        const moved = await page.evaluate(geometry);
        for (const key of ['viewport', 'shell', 'background', 'image', 'photo', 'intro'] as const) {
          if (!fixed[key]) {
            expect(moved[key]).toBeNull();
            continue;
          }
          for (const axis of ['top', 'bottom', 'left', 'width', 'height'] as const)
            expect(
              Math.abs(moved[key]![axis] - fixed[key]![axis]),
              `${key} ${axis} at offset ${value}`,
            ).toBeLessThan(0.05);
        }
        expect(moved.firstBlocks).toEqual(fixed.firstBlocks);
        expect(await page.locator('.cv-page').count()).toBe(fixedCount);
        expect(moved.text.top).toBeGreaterThanOrEqual(-0.05);
        expect(moved.text.bottom).toBeLessThanOrEqual(
          moved.background.bottom - project.layout.appearance.headerEdgeDepthMm + 0.1,
        );
        if (value > 0) expect(moved.name.top).toBeGreaterThan(fixed.name.top);
        if (value < 0 && shift === 0) expect(moved.name.top).toBeLessThan(fixed.name.top);
      }
    }
    const preview = await page.evaluate(geometry),
      count = await page.locator('.cv-page').count();
    expect(preview.viewport.top).toBeCloseTo(0, 1);
    expect(baseline.shell.top - preview.shell.top).toBeCloseTo(shift, 1);
    if (shift === 10) {
      expect(preview.viewport.height).toBeCloseTo(baseline.viewport.height - 10, 1);
      for (const key of ['name', 'text', 'photo', 'intro'] as const)
        if (baseline[key] && preview[key])
          expect(baseline[key]!.top - preview[key]!.top, key).toBeCloseTo(10, 1);
    }
    if (scenario === 'no-photo' && inline) {
      const gained = baseline.viewport.height - preview.viewport.height;
      expect(gained).toBeGreaterThan(10);
      expect(gained).toBeLessThanOrEqual(20.1);
    }
    expect(preview.name.top).toBeGreaterThanOrEqual(-0.05);
    expect(preview.text.top).toBeGreaterThanOrEqual(-0.05);
    if (preview.photo) {
      expect(preview.photo.top).toBeGreaterThanOrEqual(-0.05);
      expect(preview.photo.bottom).toBeLessThanOrEqual(preview.viewport.bottom + 0.1);
    }
    const overlap =
      scenario === 'overlap-image-left' ? project.layout.appearance.photoOverlapMm : 0;
    expect(preview.text.bottom).toBeLessThanOrEqual(
      preview.viewport.bottom - overlap - project.layout.appearance.headerEdgeDepthMm + 0.1,
    );
    if (shift === 10)
      expect(preview.firstBlocks.length).toBeGreaterThan(baseline.firstBlocks.length);
    await expect(page.locator('.cv-page .cv-header-text h1')).toHaveCSS(
      'color',
      'rgb(232, 106, 33)',
    );
    const overflows = await page.locator('.cv-page').evaluateAll((pages) =>
      pages.flatMap((page) => {
        const limit = page.querySelector('.cv-columns')!.getBoundingClientRect().bottom;
        return [...page.querySelectorAll<HTMLElement>('.cv-block')]
          .filter((block) => block.getBoundingClientRect().bottom > limit + 0.5)
          .map((block) => block.dataset.blockId);
      }),
    );
    expect(overflows).toEqual([]);
    await page.getByRole('button', { name: 'PDF exportieren', exact: true }).click();
    await expect(page.frameLocator('iframe[data-cv-print]').locator('html')).toHaveAttribute(
      'data-print-requested',
      'true',
    );
    const frame = (await (await page
      .locator('iframe[data-cv-print]')
      .elementHandle())!.contentFrame())!;
    const printed = await context.newPage();
    try {
      await openPrintHost(printed, page.url());
      await printed.setContent(await frame.content());
      await printed.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((image) => image.decode()));
      });
      await printed.emulateMedia({ media: 'print' });
      const actual = await printed.evaluate(geometry);
      expect(actual.firstBlocks).toEqual(preview.firstBlocks);
      expect(actual.color).toBe(preview.color);
      for (const key of ['viewport', 'background', 'image', 'name', 'photo', 'intro'] as const)
        if (actual[key] && preview[key])
          for (const axis of ['top', 'bottom', 'left', 'width'] as const)
            expect(
              Math.abs(actual[key]![axis] - preview[key]![axis]),
              `${key} ${axis}`,
            ).toBeLessThan(0.5);
      const bytes = await printed.pdf({
        path: info.outputPath('shifted-header.pdf'),
        format: 'A4',
        preferCSSPageSize: true,
        printBackground: true,
      });
      const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
      try {
        const pdf = await task.promise;
        expect(pdf.numPages).toBe(count);
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++)
          text += (await (await pdf.getPage(i)).getTextContent()).items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ');
        const normalized = text.replace(/\s/g, '');
        expect(normalized).toContain(project.cv.contact.firstName.replace(/\s/g, ''));
        expect(normalized).toContain(project.cv.contact.lastName.replace(/\s/g, ''));
        expect(normalized).toContain(project.cv.contact.headline.replace(/\s/g, ''));
        for (const skill of project.cv.skills)
          expect(normalized).toContain(skill.name.replace(/\s/g, ''));
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
          area = actual.name;
        const pixels = drawing.getImageData(
          Math.floor(area.left * scale),
          Math.max(0, Math.floor(area.top * scale)),
          Math.floor(area.width * scale),
          Math.floor(area.height * scale),
        ).data;
        let colored = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (
            Math.abs(pixels[i] - 232) < 6 &&
            Math.abs(pixels[i + 1] - 106) < 6 &&
            Math.abs(pixels[i + 2] - 33) < 6
          )
            colored++;
        expect(colored).toBeGreaterThan(100);
        await writeFile(info.outputPath('shifted-header.png'), canvas.toBuffer('image/png'));
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
