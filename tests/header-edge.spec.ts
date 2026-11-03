import { openPrintHost } from './print-host';
import { expect, test } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { writeFile } from 'node:fs/promises';
import { createProject } from '../packages/core/src/fixtures';
import type { HeaderEdge } from '../packages/core/src/schema';

test.use({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 3 });
const cases: { edge: HeaderEdge; depth: number; mirrored: boolean }[] = [
  ...[4, 16].flatMap((depth) =>
    [false, true].map((mirrored) => ({ edge: 'diagonal' as const, depth, mirrored })),
  ),
  ...[4, 16].map((depth) => ({ edge: 'chevron' as const, depth, mirrored: false })),
  ...[false, true].map((mirrored) => ({ edge: 'wave' as const, depth: 16, mirrored })),
];
for (const [index, { edge, depth, mirrored }] of cases.entries()) {
  test(`complete ${edge} contour at ${depth} mm, mirrored ${mirrored}, image ${index % 2 === 1}`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    await page.goto('/');
    const project = createProject('student');
    Object.assign(project.layout.appearance, {
      headerEdge: edge,
      headerEdgeDepthMm: depth,
      headerEdgeMirrored: mirrored,
      headerStyle: 'solid',
      headerImageDimPercent: 0,
    });
    if (index % 2) {
      const data = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 2;
        const drawing = canvas.getContext('2d')!;
        drawing.fillStyle = '#246a9a';
        drawing.fillRect(0, 0, 2, 2);
        return canvas.toDataURL('image/png');
      });
      project.assets.background = { mediaType: 'image/png', data };
      project.layout.appearance.headerImageAssetId = 'background';
      if (index === 3) project.layout.appearance.headerImageTransparencyPercent = 50;
    }
    await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
      name: 'project.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
    await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('.preview-scale')!.style.zoom = '1';
    });
    const x =
      edge === 'chevron'
        ? 105 - (105 * 0.2) / depth
        : mirrored
          ? 210 - (210 * 0.2) / depth
          : (210 * 0.2) / depth;
    const probes =
      edge === 'wave'
        ? [
            { xMm: 1, bottomMm: depth * 0.5, colored: !mirrored },
            { xMm: 209, bottomMm: depth * 0.5, colored: mirrored },
          ]
        : [
            { xMm: x, bottomMm: 0.38, colored: true },
            { xMm: x, bottomMm: 0.06, colored: false },
          ];
    const box = (await page.locator('.cv-page .cv-header').boundingBox())!;
    const clip = {
      x: Math.floor(box.x),
      y: Math.floor(box.y),
      width: Math.ceil(box.width + 1),
      height: Math.ceil(box.height + 1),
    };
    const screenshot = await page.screenshot({ clip, path: info.outputPath('preview-header.png') });
    const screenPixels = await page.evaluate(
      async ({ png, probes, box, clip }) => {
        const bytes = Uint8Array.from(atob(png), (character) => character.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const drawing = canvas.getContext('2d')!;
        drawing.drawImage(bitmap, 0, 0);
        const pixels = probes.map((probe) =>
          [
            ...drawing.getImageData(
              Math.round((box.x - clip.x + (probe.xMm * 96) / 25.4) * 3),
              Math.round((box.y - clip.y + box.height - (probe.bottomMm * 96) / 25.4) * 3),
              1,
              1,
            ).data,
          ].slice(0, 3),
        );
        bitmap.close();
        return pixels;
      },
      { png: screenshot.toString('base64'), probes, box, clip },
    );
    for (const [i, probe] of probes.entries())
      expect(
        screenPixels[i].every((value) => (probe.colored ? value < 220 : value >= 250)),
        `Preview contour probe ${i}: ${screenPixels[i]}`,
      ).toBe(true);

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
      const height = await printPage
        .locator('.cv-page .cv-header')
        .evaluate((element) => element.getBoundingClientRect().height);
      const data = await printPage.pdf({
        path: info.outputPath('header-edge.pdf'),
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      });
      const task = getDocument({ data: new Uint8Array(data), useSystemFonts: false });
      try {
        const pdf = await task.promise;
        expect(pdf.numPages).toBe(1);
        const first = await pdf.getPage(1),
          viewport = first.getViewport({ scale: 4 });
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
        await writeFile(info.outputPath('pdf-header.png'), canvas.toBuffer('image/png'));
        for (const probe of probes) {
          const pixel = [
            ...drawing.getImageData(
              Math.round(((probe.xMm * 72) / 25.4) * 4),
              Math.round(height * 3 - ((probe.bottomMm * 72) / 25.4) * 4),
              1,
              1,
            ).data,
          ].slice(0, 3);
          expect(
            pixel.every((value) => (probe.colored ? value < 220 : value >= 250)),
            `PDF contour probe: ${pixel}`,
          ).toBe(true);
        }
        // No rectangular hairline below the actual shape, even at its deepest point.
        const band = drawing.getImageData(1, Math.ceil(height * 3) + 1, canvas.width - 2, 2).data;
        expect([...band].every((value, i) => i % 4 === 3 || value >= 250)).toBe(true);
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
  });
}
