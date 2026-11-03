import { expect, test, type Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createProject } from '../packages/core/src/fixtures';
import { openPrintHost } from './print-host';

async function previewColor(page: Page) {
  const png = await page.locator('.cv-page .cv-header').screenshot();
  return page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(
      new Blob([Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))], {
        type: 'image/png',
      }),
    );
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const drawing = canvas.getContext('2d')!;
    drawing.drawImage(bitmap, 0, 0);
    const pixel = [
      ...drawing.getImageData(
        Math.round((bitmap.width * 5) / 210),
        Math.round((bitmap.width * 5) / 210),
        1,
        1,
      ).data,
    ].slice(0, 3);
    bitmap.close();
    return pixel;
  }, png.toString('base64'));
}

for (const headerStyle of ['solid', 'gradient'] as const) {
  test(`header image transparency stays neutral with stored ${headerStyle} in preview and PDF`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    await page.goto('/');
    const images = await page.evaluate(() =>
      ['#246a9a', '#d54888'].map((color) => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const drawing = canvas.getContext('2d')!;
        drawing.fillStyle = color;
        drawing.fillRect(0, 0, 100, 100);
        return canvas.toDataURL('image/png');
      }),
    );
    const project = createProject('student');
    project.assets.background = { mediaType: 'image/png', data: images[0] };
    project.assets.portrait = { mediaType: 'image/png', data: images[1] };
    project.cv.contact.photoAssetId = 'portrait';
    Object.assign(project.layout.appearance, {
      headerStyle,
      headerImageAssetId: 'background',
      headerImageTransparencyPercent: 100,
      headerImageDimPercent: 40,
      showPhoto: true,
      photoSide: 'left',
      photoOverlapMm: 11,
    });
    await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
      name: 'project.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
    await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
    const baseColor = await previewColor(page);
    expect(baseColor).toEqual([255, 255, 255]);
    await expect(page.locator('.cv-page .cv-header-background')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    await expect(page.locator('.cv-page .cv-header-background')).toHaveCSS(
      'background-image',
      'none',
    );
    await page.getByRole('tab', { name: 'Design', exact: true }).click();
    await expect(page.getByRole('combobox', { name: /^Kopfbereich/ })).toBeDisabled();
    await page.getByRole('button', { name: 'Farbe #78573c', exact: true }).click();
    await expect(page.locator('.cv-page .cv-main h2').first()).toHaveCSS(
      'color',
      'rgb(120, 87, 60)',
    );
    expect(await previewColor(page)).toEqual([255, 255, 255]);
    const slider = page.getByRole('slider', { name: 'Bildtransparenz', exact: true });
    for (const transparency of [0, 50, 100]) {
      if (transparency === 0) await slider.press('Home');
      else if (transparency === 100) await slider.press('End');
      else for (let step = 0; step < 10; step++) await slider.press('ArrowRight');
      await expect(slider).toHaveAttribute('aria-valuenow', String(transparency));
      const expected = [36, 106, 154].map((channel, i) =>
        Math.round(channel * 0.6 * (1 - transparency / 100) + (baseColor[i] * transparency) / 100),
      );
      const screenColor = await previewColor(page);
      for (let channel = 0; channel < 3; channel++)
        expect(Math.abs(screenColor[channel] - expected[channel])).toBeLessThan(4);
      await expect(page.locator('.cv-page .cv-header-text')).toHaveCSS('opacity', '1');
      await expect(page.locator('.cv-page .cv-photo')).toHaveCSS('opacity', '1');
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
        const portrait = await printPage.locator('.cv-photo').evaluate((image) => {
          const box = image.getBoundingClientRect();
          return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
        });
        const data = await printPage.pdf({
          path: info.outputPath(`transparency-${transparency}.pdf`),
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
        });
        const task = getDocument({ data: new Uint8Array(data), useSystemFonts: false });
        try {
          const pdf = await task.promise;
          expect(pdf.numPages).toBe(1);
          const first = await pdf.getPage(1),
            viewport = first.getViewport({ scale: 2 });
          const factory = pdf.canvasFactory as {
            create(
              width: number,
              height: number,
            ): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };
          };
          const { canvas, context: drawing } = factory.create(
            Math.ceil(viewport.width),
            Math.ceil(viewport.height),
          );
          await first.render({ canvas, canvasContext: drawing, viewport }).promise;
          const pixel = drawing.getImageData(
            Math.round(((5 * 72) / 25.4) * 2),
            Math.round(((5 * 72) / 25.4) * 2),
            1,
            1,
          ).data;
          for (let channel = 0; channel < 3; channel++)
            expect(Math.abs(pixel[channel] - expected[channel])).toBeLessThan(4);
          const photoPixel = drawing.getImageData(
            Math.round(portrait.x * 1.5),
            Math.round(portrait.y * 1.5),
            1,
            1,
          ).data;
          for (const [channel, expected] of [213, 72, 136].entries())
            expect(Math.abs(photoPixel[channel] - expected)).toBeLessThan(4);
          const text = (await first.getTextContent()).items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ');
          expect(text).toContain('Lena');
          expect(text).toContain('Sekundarschule');
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
    }
    await page.getByRole('button', { name: 'Headerbild entfernen', exact: true }).click();
    await expect(page.getByRole('combobox', { name: /^Kopfbereich/ })).toBeEnabled();
    await expect(page.locator('.cv-page .cv-header')).toHaveClass(
      new RegExp(`cv-header-${headerStyle}`),
    );
    expect((await previewColor(page)).every((channel) => channel < 160)).toBe(true);
  });
}
