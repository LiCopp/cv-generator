import { openPrintHost } from './print-host';
import { expect, test } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { writeFile } from 'node:fs/promises';
import { createProject } from '../packages/core/src/fixtures';
import type { Page, TestInfo } from '@playwright/test';

async function inspectPdf(page: Page, testInfo: TestInfo) {
  await page.emulateMedia({ media: 'print' });
  const geometry = await page
    .locator('.cv-page')
    .first()
    .evaluate((element) => {
      const page = element.getBoundingClientRect();
      const header = element.querySelector('.cv-header')!.getBoundingClientRect();
      return { pageWidth: page.width, headerWidth: header.width, headerHeight: header.height };
    });
  const bytes = await page.pdf({
    path: testInfo.outputPath('export.pdf'),
    format: 'A4',
    preferCSSPageSize: true,
    printBackground: true,
  });
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
  const pdf = await task.promise;
  try {
    const firstPage = await pdf.getPage(1);
    expect(firstPage.view[2] - firstPage.view[0]).toBeCloseTo((210 * 72) / 25.4, 0);
    expect(firstPage.view[3] - firstPage.view[1]).toBeCloseTo((297 * 72) / 25.4, 0);
    const viewport = firstPage.getViewport({ scale: 2 });
    const factory = pdf.canvasFactory as {
      create(
        width: number,
        height: number,
      ): {
        canvas: HTMLCanvasElement & { toBuffer(type: string): Buffer };
        context: CanvasRenderingContext2D;
      };
    };
    const { canvas, context } = factory.create(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
    await firstPage.render({ canvas, canvasContext: context, viewport }).promise;
    await writeFile(testInfo.outputPath('export.png'), canvas.toBuffer('image/png'));
    const pixel = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data].slice(0, 3);
    expect(geometry.pageWidth).toBeCloseTo((210 * 96) / 25.4, 1);
    expect(geometry.headerWidth).toBeCloseTo(geometry.pageWidth, 1);
    for (const x of [1, canvas.width - 2])
      expect(pixel(x, 35).every((value) => value < 220)).toBe(true);
    // The old coloured rectangle left a grey hairline here, underneath the wave.
    const band = context.getImageData(
      0,
      Math.floor(geometry.headerHeight * 1.5) - 1,
      canvas.width,
      4,
    ).data;
    expect([...band].every((value, i) => i % 4 === 3 || value >= 250)).toBe(true);
    const texts: string[] = [];
    const positions: { text: string; x: number }[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      texts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
      if (i === 1)
        positions.push(
          ...content.items.flatMap((item) =>
            'str' in item ? [{ text: item.str, x: item.transform[4] }] : [],
          ),
        );
    }
    return { count: pdf.numPages, text: texts.join(' '), positions };
  } finally {
    await task.destroy();
  }
}

test('PDF fills A4 and has no rectangular header edge when exporting with a tooltip open', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'PDF exportieren', exact: true }).hover();
  await expect(page.getByRole('tooltip', { name: /^Druckdialog öffnen/ })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.MuiTooltip-popper')).toHaveCSS('display', 'none');
  const result = await inspectPdf(page, testInfo);
  expect(result.text).not.toContain('Druckdialog öffnen');
});

for (const scenario of [
  { kind: 'student', width: 1440, zoom: 'minimum', photo: false, margin: 10 },
  { kind: 'student', width: 1440, zoom: 'maximum', photo: true, margin: 22 },
  { kind: 'student', width: 1440, zoom: 'calibrated', photo: false, margin: 15 },
  { kind: 'adult', width: 390, zoom: 'mobile editor', photo: false, margin: 15 },
] as const) {
  test(`export button prepares full A4 at ${scenario.zoom} zoom with ${scenario.kind}`, async ({
    page,
    context,
  }, testInfo) => {
    // Keep the actual prepared frame available for assertions, without opening a native dialog.
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    await page.setViewportSize({ width: scenario.width, height: 1000 });
    const project = createProject(scenario.kind);
    project.cv.title = `Drucktest ${scenario.kind} ${scenario.zoom}`;
    project.layout.page.marginMm = scenario.margin;
    if (scenario.photo) {
      project.layout.appearance.showPhoto = true;
      project.cv.contact.photoAssetId = 'test-photo';
      project.assets['test-photo'] = {
        mediaType: 'image/png',
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=',
      };
    }
    if (scenario.kind === 'adult') project.layout.appearance.fontId = 'lora';
    await page.goto('/');
    await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
      name: 'project.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
    await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
    await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
    if (scenario.zoom === 'calibrated') {
      await page
        .getByRole('button', { name: 'A4 in Originalgrösse anzeigen', exact: true })
        .click();
      await page
        .getByRole('spinbutton', { name: 'Gemessene Linienlänge (mm)', exact: true })
        .fill('40');
      await page.getByRole('button', { name: 'A4 1:1 anzeigen', exact: true }).click();
      await expect(page.locator('.preview-scale')).toHaveCSS('zoom', '1.25');
    } else if (scenario.width > 720) {
      const zoom = page.getByRole('button', {
        name: scenario.zoom === 'minimum' ? 'Vorschau verkleinern' : 'Vorschau vergrössern',
        exact: true,
      });
      while (await zoom.isEnabled()) await zoom.click();
    } else await expect(page.locator('.preview-panel')).toBeHidden();
    const expectedCount = await page.locator('.cv-page').count();
    if (scenario.kind === 'adult') expect(expectedCount).toBeGreaterThanOrEqual(4);
    const previewZoom = await page
      .locator('.preview-scale')
      .evaluate((element) => (element as HTMLElement).style.zoom);
    const previewPadding = await page
      .locator('.cv-page .cv-columns')
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return { left: style.paddingLeft, right: style.paddingRight, top: style.paddingTop };
      });
    const previewHeadingX = await page.locator('.cv-measure').evaluate((root) => {
      const left = root.getBoundingClientRect().left;
      return [...root.querySelectorAll('h2')]
        .filter((element) =>
          ['Kontakt', 'Über mich', 'Erfahrung'].includes(element.textContent ?? ''),
        )
        .map((element) => ({
          text: element.textContent!.toUpperCase(),
          x: ((element.getBoundingClientRect().left - left) * 72) / 96,
        }));
    });
    await page.getByRole('button', { name: 'PDF exportieren', exact: true }).hover();
    await expect(page.getByRole('tooltip', { name: /^Druckdialog öffnen/ })).toBeVisible();
    await page.getByRole('button', { name: 'PDF exportieren', exact: true }).click();
    const frameLocator = page.frameLocator('iframe[data-cv-print]');
    await expect(frameLocator.locator('html')).toHaveAttribute('data-print-requested', 'true');
    const frame = (await page.locator('iframe[data-cv-print]').elementHandle())!;
    const contentFrame = (await frame.contentFrame())!;
    const prepared = await contentFrame.evaluate(() => ({
      width: document.querySelector('.cv-document')!.getBoundingClientRect().width,
      bodyChildren: document.body.children.length,
      fonts: document.fonts.status,
      unwanted: document.querySelectorAll('.cv-measure, .app-shell, .MuiTooltip-popper').length,
      photosLoaded: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
    }));
    expect(prepared.width).toBeCloseTo((210 * 96) / 25.4, 1);
    expect(prepared).toMatchObject({
      bodyChildren: 1,
      fonts: 'loaded',
      unwanted: 0,
      photosLoaded: true,
    });
    const printPadding = await frameLocator
      .locator('.cv-page .cv-columns')
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return { left: style.paddingLeft, right: style.paddingRight, top: style.paddingTop };
      });
    expect(printPadding).toEqual(previewPadding);
    await expect(frameLocator.locator('.cv-page')).toHaveCount(expectedCount);
    const printPage = await context.newPage();
    try {
      // Match the print iframe's origin so production CSS/font links retain their CORS access.
      await openPrintHost(printPage, page.url());
      await printPage.setContent(await contentFrame.content());
      await printPage.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((image) => image.decode()));
      });
      const result = await inspectPdf(printPage, testInfo);
      expect(result.count).toBe(expectedCount);
      expect(result.text).toContain(project.cv.contact.firstName);
      expect(result.text).toContain(project.cv.contact.lastName);
      for (const entry of project.cv.experience)
        expect(result.text.replace(/\s/g, '')).toContain(entry.organization.replace(/\s/g, ''));
      expect(result.text).not.toContain('Druckdialog öffnen');
      for (const expected of previewHeadingX) {
        const printed = result.positions.find((item) => item.text.trim() === expected.text);
        expect(printed, `PDF position of ${expected.text}`).toBeDefined();
        expect(Math.abs(printed!.x - expected.x)).toBeLessThan(0.5);
      }
      await page.evaluate(() =>
        document
          .querySelector<HTMLIFrameElement>('iframe[data-cv-print]')
          ?.contentWindow?.dispatchEvent(new Event('afterprint')),
      );
      await expect(page.locator('iframe[data-cv-print]')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'PDF exportieren', exact: true }),
      ).toBeFocused();
      expect(
        await page
          .locator('.preview-scale')
          .evaluate((element) => (element as HTMLElement).style.zoom),
      ).toBe(previewZoom);
    } finally {
      await printPage.close();
    }
  });
}
