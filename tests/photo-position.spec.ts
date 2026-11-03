import { openPrintHost } from './print-host';
import { expect, test } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createProject } from '../packages/core/src/fixtures';

for (const scenario of [
  { name: 'portrait contain vertical', width: 624, height: 800, fit: 'contain', axis: 'vertical' },
  {
    name: 'landscape contain horizontal',
    width: 800,
    height: 624,
    fit: 'contain',
    axis: 'horizontal',
  },
  { name: 'square cover vertical', width: 400, height: 400, fit: 'cover', axis: 'vertical' },
  { name: 'landscape cover vertical', width: 800, height: 624, fit: 'cover', axis: 'vertical' },
] as const) {
  test(`photo movement changes visible pixels in preview and PDF: ${scenario.name}`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    await page.goto('/');
    const image = await page.evaluate(({ width, height, axis }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const drawing = canvas.getContext('2d')!;
      for (const [index, color] of ['#e04a4a', '#246a9a', '#48a06e'].entries()) {
        drawing.fillStyle = color;
        if (axis === 'vertical') drawing.fillRect(0, (height * index) / 3, width, height / 3);
        else drawing.fillRect((width * index) / 3, 0, width / 3, height);
      }
      return canvas.toDataURL('image/png');
    }, scenario);
    const project = createProject('student');
    project.cv.contact.photoAssetId = 'synthetic-photo';
    project.assets['synthetic-photo'] = { mediaType: 'image/png', data: image };
    Object.assign(project.layout.appearance, {
      showPhoto: true,
      photoSide: 'left',
      photoWidthMm: 40,
      photoOverlapMm: 11,
      photoBorderWidthMm: 0.6,
      photoFit: scenario.fit,
      photoPositionX: 50,
      photoPositionY: 50,
    });
    await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
      name: 'project.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
    await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
    await page
      .locator('.cv-page .cv-photo')
      .evaluate((image) => (image as HTMLImageElement).decode());
    const centered = await page.locator('.cv-page .cv-photo').screenshot();
    const photoBox = await page.locator('.cv-measure .cv-photo').evaluate((image) => {
      const box = image.getBoundingClientRect(),
        root = image.closest('.cv-header-shell')!.getBoundingClientRect();
      return {
        left: box.left - root.left,
        top: box.top - root.top,
        width: box.width,
        height: box.height,
      };
    });
    await page.getByRole('tab', { name: 'Design', exact: true }).click();
    const sliderName = `Bildausschnitt ${scenario.axis === 'vertical' ? 'vertikal' : 'horizontal'}`;
    const slider = page.getByRole('slider', { name: sliderName, exact: true });
    for (const [key, value, color] of [
      ['Home', 0, [72, 160, 110]],
      ['End', 100, [255, 255, 255]],
    ] as const) {
      await slider.press(key);
      await expect(slider).toHaveAttribute('aria-valuenow', String(value));
      const shifted = await page
        .locator('.cv-page .cv-photo')
        .screenshot({ path: info.outputPath(`preview-${value}.png`) });
      expect(
        shifted.equals(centered),
        'Moving a fully fitted image must change visible pixels',
      ).toBe(false);
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
        const data = await printPage.pdf({
          path: info.outputPath(`position-${value}.pdf`),
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
        });
        const task = getDocument({ data: new Uint8Array(data), useSystemFonts: false });
        try {
          const pdf = await task.promise;
          expect(pdf.numPages).toBe(1);
          const first = await pdf.getPage(1),
            viewport = first.getViewport({ scale: 96 / 72 });
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
          const border = (0.6 * 96) / 25.4;
          const x =
            photoBox.left +
            border +
            (photoBox.width - border * 2) * (scenario.axis === 'horizontal' ? 0.35 : 0.5);
          const y =
            photoBox.top +
            border +
            (photoBox.height - border * 2) * (scenario.axis === 'vertical' ? 0.35 : 0.5);
          const pixel = drawing.getImageData(Math.round(x), Math.round(y), 1, 1).data;
          for (let channel = 0; channel < 3; channel++)
            expect(Math.abs(pixel[channel] - color[channel])).toBeLessThan(5);
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
    await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
    await page.reload();
    await page.getByRole('tab', { name: 'Design', exact: true }).click();
    await expect(page.getByRole('slider', { name: sliderName, exact: true })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });
}
