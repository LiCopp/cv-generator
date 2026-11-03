import { openPrintHost } from './print-host';
import { expect, test, type Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createProject } from '../packages/core/src/fixtures';
import { headerEdges, parseProject } from '../packages/core/src/schema';

// Deliberately synthetic raster fixtures; never copy photos or artwork from sample CVs.
async function raster(page: Page, color: string, width = 300, height = 100) {
  return page.evaluate(
    ({ color, width, height }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d')!;
      context.fillStyle = color;
      context.fillRect(0, 0, width, height);
      return canvas.toDataURL('image/png');
    },
    { color, width, height },
  );
}
function upload(data: string) {
  return {
    name: 'synthetic.png',
    mimeType: 'image/png',
    buffer: Buffer.from(data.split(',')[1], 'base64'),
  };
}

test('header and portrait uploads remain independent through replacement, removal, save and reload', async ({
  page,
}, info) => {
  await page.goto('/');
  const background = await raster(page, '#246a9a');
  const photo = await raster(page, '#d54888', 100, 100);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await page.getByLabel('Headerbild hochladen').setInputFiles(upload(background));
  await expect(page.locator('.cv-page .cv-header-image')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Inhalt', exact: true }).click();
  await page.getByLabel('Profilfoto hochladen').setInputFiles(upload(photo));
  await expect(page.locator('.cv-page .cv-photo')).toHaveCount(1);
  await expect(page.locator('.cv-page .cv-header-image')).toHaveCount(1);
  await page.getByLabel('Profilfoto hochladen').setInputFiles(upload(photo));
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  const position = page.getByRole('group', { name: 'Position des Profilfotos', exact: true });
  await position.getByRole('button', { name: 'Links', exact: true }).click();
  const overlap = page.getByRole('slider', { name: 'Überlappung der Headergrenze', exact: true });
  await overlap.focus();
  await overlap.press('End');
  await page.getByRole('slider', { name: 'Fotogrösse (Breite)', exact: true }).press('End');
  await page.getByRole('slider', { name: 'Rahmenbreite', exact: true }).press('End');
  await page.getByLabel('Rahmenfarbe', { exact: true }).fill('#ffc040');
  await page.getByRole('combobox', { name: /^Bildausschnitt/ }).click();
  await page.getByRole('option', { name: 'Einpassen (mehr vom Bild)', exact: true }).click();
  await page.getByRole('slider', { name: 'Bildausschnitt horizontal', exact: true }).press('End');
  await page.getByRole('slider', { name: 'Bildausschnitt vertikal', exact: true }).press('Home');
  const dim = page.getByRole('slider', { name: 'Bild abdunkeln', exact: true });
  await dim.focus();
  await dim.press('End');
  const transparency = page.getByRole('slider', { name: 'Bildtransparenz', exact: true });
  await transparency.press('Home');
  await transparency.press('ArrowRight');
  await page.getByLabel('Headerbild hochladen').setInputFiles(upload(background));
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const path = info.outputPath('header-project.json');
  await (await downloadPromise).saveAs(path);
  const saved = parseProject(await readFile(path, 'utf8'));
  expect(Object.keys(saved.assets)).toHaveLength(2);
  expect(saved.layout.appearance).toMatchObject({
    photoSide: 'left',
    photoOverlapMm: 20,
    headerImageDimPercent: 80,
    headerImageTransparencyPercent: 5,
    photoWidthMm: 60,
    photoBorderWidthMm: 4,
    photoBorderColor: '#ffc040',
    photoFit: 'contain',
    photoPositionX: 100,
    photoPositionY: 0,
  });
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await expect(page.locator('.cv-page .cv-header-image')).toHaveCount(1);
  await expect(page.locator('.cv-page .cv-photo')).toHaveCount(1);
  await expect(page.locator('.cv-page .cv-header-shell')).toHaveClass(
    /cv-photo-side-left.*cv-photo-overlap/,
  );
  await expect(page.locator('.cv-page .cv-photo')).toHaveCSS('object-fit', 'contain');
  await expect(page.locator('.cv-page .cv-photo')).toHaveCSS(
    'border-top-color',
    'rgb(255, 192, 64)',
  );
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Bildtransparenz', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '5',
  );
  await page
    .getByRole('slider', { name: 'Überlappung der Headergrenze', exact: true })
    .press('Home');
  await expect(page.locator('.cv-page .cv-header > .cv-photo')).toHaveCount(1);
  const contained = await page.locator('.cv-measure').evaluate((root) => {
    const photo = root.querySelector('.cv-photo')!.getBoundingClientRect();
    const header = root.querySelector('.cv-header')!.getBoundingClientRect();
    const text = root.querySelector('.cv-header-text')!.getBoundingClientRect();
    return photo.top >= header.top && photo.bottom <= header.bottom && photo.right < text.left;
  });
  expect(contained).toBe(true);
  await page.getByRole('tab', { name: 'Inhalt', exact: true }).click();
  await page.getByRole('button', { name: 'Foto entfernen', exact: true }).click();
  await expect(page.locator('.cv-page .cv-photo')).toHaveCount(0);
  await expect(page.locator('.cv-page .cv-header-image')).toHaveCount(1);
  await expect(page.locator('.cv-page .cv-header-shell')).not.toHaveClass(/cv-photo-overlap/);
  await expect(page.locator('.cv-page .cv-header-text')).toHaveCSS('text-align', 'left');
  await page.getByLabel('Profilfoto hochladen').setInputFiles(upload(photo));
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await page.getByRole('button', { name: 'Headerbild entfernen', exact: true }).click();
  await expect(page.locator('.cv-page .cv-header-image')).toHaveCount(0);
  await expect(page.locator('.cv-page .cv-photo')).toHaveCount(1);
  await page.getByLabel('Headerbild hochladen').setInputFiles({
    name: 'invalid.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await expect(page.getByRole('alert')).toContainText('PNG- oder JPEG');
  await expect(page.locator('.cv-page .cv-header-image')).toHaveCount(0);
});

for (const [index, edge] of headerEdges.entries()) {
  test(`header image and overlapping portrait stay consistent in preview and PDF: ${edge}`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    await page.goto('/');
    const project = createProject(index % 2 ? 'adult' : 'student');
    project.assets.background = { mediaType: 'image/png', data: await raster(page, '#246a9a') };
    project.assets.portrait = {
      mediaType: 'image/png',
      data: await raster(page, '#d54888', 100, index === 2 ? 180 : 100),
    };
    project.cv.contact.photoAssetId = 'portrait';
    Object.assign(project.layout.appearance, {
      showPhoto: true,
      headerImageAssetId: 'background',
      headerEdge: edge,
      headerImageDimPercent: 25,
      photoSide: index % 2 ? 'right' : 'left',
      photoOverlapMm: [12, 20, 12, 1, 12][index],
      photoShape: index % 2 ? 'rectangle' : 'circle',
      sidebarSide: index % 2 ? 'right' : 'left',
      photoWidthMm: [60, 24, 48, 60, 24][index],
      photoBorderWidthMm: index % 2 ? 0 : 4,
      photoBorderColor: '#ffc040',
      photoFit: index === 2 ? 'contain' : 'cover',
    });
    await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
      name: 'project.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
    await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
    const geometry = await page.locator('.cv-measure').evaluate((root) => {
      const box = (selector: string) => {
        const rect = root.querySelector(selector)!.getBoundingClientRect(),
          origin = root.querySelector('.cv-header-shell')!.getBoundingClientRect();
        return {
          left: rect.left - origin.left,
          right: rect.right - origin.left,
          top: rect.top - origin.top,
          bottom: rect.bottom - origin.top,
        };
      };
      const name = document.createRange();
      name.selectNode(root.querySelector('h1')!.firstChild!);
      const origin = root.querySelector('.cv-header-shell')!.getBoundingClientRect();
      return {
        header: box('.cv-header'),
        shell: box('.cv-header-shell'),
        photo: box('.cv-photo'),
        text: box('.cv-header-text'),
        headline: box('.cv-headline'),
        columns: box('.cv-columns'),
        alignment: getComputedStyle(root.querySelector('.cv-header-text')!).textAlign,
        nameLeft: name.getBoundingClientRect().left - origin.left,
      };
    });
    const mm = 96 / 25.4;
    expect(geometry.photo.right - geometry.photo.left).toBeCloseTo(
      project.layout.appearance.photoWidthMm * mm,
      1,
    );
    expect(geometry.photo.bottom - geometry.photo.top).toBeCloseTo(
      project.layout.appearance.photoWidthMm * (index % 2 ? 40 / 34 : 1) * mm,
      1,
    );
    expect(geometry.photo.bottom - geometry.header.bottom).toBeCloseTo(
      project.layout.appearance.photoOverlapMm * mm,
      1,
    );
    expect(geometry.photo.top).toBeLessThan(geometry.header.bottom);
    expect(geometry.photo.top).toBeGreaterThanOrEqual(10 * mm - 0.1);
    expect(geometry.shell.bottom).toBeCloseTo(geometry.photo.bottom, 1);
    expect(geometry.columns.top).toBeGreaterThanOrEqual(geometry.photo.bottom - 0.1);
    if (project.layout.appearance.photoSide === 'left') {
      expect(geometry.photo.left).toBeCloseTo(project.layout.page.marginMm * mm, 1);
      expect(geometry.text.left).toBeGreaterThan(geometry.photo.right);
      expect(geometry.alignment).toBe('right');
      expect(geometry.text.right).toBeCloseTo((210 - project.layout.page.marginMm) * mm, 1);
      expect(geometry.headline.right).toBeCloseTo(geometry.text.right, 1);
    } else {
      expect(geometry.photo.right).toBeCloseTo((210 - project.layout.page.marginMm) * mm, 1);
      expect(geometry.text.right).toBeLessThan(geometry.photo.left);
      expect(geometry.alignment).toBe('left');
    }
    const count = await page.locator('.cv-page').count();
    if (index % 2) expect(count).toBeGreaterThanOrEqual(4);
    await expect(page.locator('.cv-page .cv-header-image')).toHaveCount(1);
    await expect(page.locator('.cv-page .cv-photo')).toHaveCount(1);
    await page.getByRole('button', { name: 'PDF exportieren', exact: true }).click();
    await expect(page.frameLocator('iframe[data-cv-print]').locator('html')).toHaveAttribute(
      'data-print-requested',
      'true',
    );
    const frame = (await (await page
      .locator('iframe[data-cv-print]')
      .elementHandle())!.contentFrame())!;
    const printPage = await context.newPage();
    try {
      await openPrintHost(printPage, page.url());
      await printPage.setContent(await frame.content());
      await printPage.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((image) => image.decode()));
      });
      await printPage.emulateMedia({ media: 'print' });
      const printPhoto = await printPage.locator('.cv-page .cv-photo').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
      for (const key of ['left', 'right', 'top', 'bottom'] as const)
        expect(printPhoto[key]).toBeCloseTo(geometry.photo[key], 1);
      const bytes = await printPage.pdf({
        path: info.outputPath('header.pdf'),
        format: 'A4',
        preferCSSPageSize: true,
        printBackground: true,
      });
      const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
      try {
        const pdf = await task.promise;
        expect(pdf.numPages).toBe(count);
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          text += (await (await pdf.getPage(i)).getTextContent()).items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ');
        }
        for (const entry of project.cv.experience)
          expect(text.replace(/\s/g, '')).toContain(entry.organization.replace(/\s/g, ''));
        expect(text).toContain(project.cv.contact.firstName);
        const first = await pdf.getPage(1),
          viewport = first.getViewport({ scale: 96 / 72 });
        if (project.layout.appearance.photoSide === 'left') {
          const name = (await first.getTextContent()).items.find(
            (item) => 'str' in item && item.str === project.cv.contact.firstName,
          );
          expect(name && 'str' in name).toBe(true);
          // PDF text widths omit trailing CSS letter spacing; compare the text origin instead.
          if (name && 'str' in name)
            expect(Math.abs(name.transform[4] - (geometry.nameLeft * 72) / 96)).toBeLessThan(0.5);
        }
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
        await first.render({ canvas, canvasContext: drawing, viewport }).promise;
        await writeFile(info.outputPath('header.png'), canvas.toBuffer('image/png'));
        const background = drawing.getImageData(5, 5, 1, 1).data;
        for (const [channel, expected] of [27, 80, 116].entries())
          expect(Math.abs(background[channel] - expected)).toBeLessThan(5);
        // This pixel is below the header and would be white if the portrait were clipped.
        const portrait = drawing.getImageData(
          Math.round((printPhoto.left + printPhoto.right) / 2),
          Math.round(geometry.header.bottom + (project.layout.appearance.photoOverlapMm * mm) / 2),
          1,
          1,
        ).data;
        for (const [channel, expected] of [213, 72, 136].entries())
          expect(Math.abs(portrait[channel] - expected)).toBeLessThan(5);
        if (project.layout.appearance.photoBorderWidthMm > 0) {
          const border = drawing.getImageData(
            Math.round((printPhoto.left + printPhoto.right) / 2),
            Math.round(printPhoto.top + (project.layout.appearance.photoBorderWidthMm * mm) / 2),
            1,
            1,
          ).data;
          for (const [channel, expected] of [255, 192, 64].entries())
            expect(Math.abs(border[channel] - expected)).toBeLessThan(5);
        }
        if (project.layout.appearance.photoFit === 'contain') {
          const inset = drawing.getImageData(
            Math.round(printPhoto.left + 6 * mm),
            Math.round((printPhoto.top + printPhoto.bottom) / 2),
            1,
            1,
          ).data;
          expect([...inset].slice(0, 3)).toEqual([255, 255, 255]);
        }
      } finally {
        await task.destroy();
      }
    } finally {
      await printPage.close();
    }
    await page.evaluate(() =>
      document
        .querySelector<HTMLIFrameElement>('iframe[data-cv-print]')!
        .contentWindow!.dispatchEvent(new Event('afterprint')),
    );
  });
}
