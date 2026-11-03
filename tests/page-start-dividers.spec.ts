import { expect, test } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { writeFile } from 'node:fs/promises';
import { createProject } from '../packages/core/src/fixtures';
import { openPrintHost } from './print-host';

test('new sections start a continuation page without a divider or its spacing in preview and PDF', async ({
  page,
  context,
}, info) => {
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = 'true';
    };
  });
  const project = createProject('student');
  project.cv.title = 'Abschnitt am Seitenanfang';
  Object.assign(project.layout.appearance, {
    sectionDividers: true,
    dividerSpacingBeforeMm: 15,
    dividerSpacingAfterMm: 15,
    stationSpacingMm: 0,
  });
  project.cv.education[0].description = Array.from(
    { length: 42 },
    (_, i) => `Lernabschnitt ${i + 1}: Planung, Gestaltung und Zusammenarbeit.`,
  ).join('\n');
  project.cv.experience[0].description =
    'Gemeinsame Planung und Umsetzung digitaler Projekte. '.repeat(9);
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
  const boundaries = await page.locator('.cv-page').evaluateAll((pages) =>
    pages.flatMap((page, i) => {
      if (!i) return [];
      return [...page.querySelectorAll<HTMLElement>('main.cv-main, aside.cv-sidebar')].flatMap(
        (column) => {
          const first = column.querySelector<HTMLElement>(':scope > .cv-block');
          if (!first?.querySelector('h2')) return [];
          return [
            {
              page: i,
              heading: first.dataset.blockId,
              delta: first.getBoundingClientRect().top - column.getBoundingClientRect().top,
            },
          ];
        },
      );
    }),
  );
  expect(boundaries.some((boundary) => boundary.heading === 'heading-experience')).toBe(true);
  for (const boundary of boundaries) expect(boundary.delta).toBeCloseTo(0, 1);
  await expect(page.locator('.cv-page .cv-section-divider:first-child')).toHaveCount(0);
  expect(await page.locator('.cv-page .cv-section-divider').count()).toBeGreaterThan(0);
  const count = await page.locator('.cv-page').count();
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
    });
    await printed.emulateMedia({ media: 'print' });
    await expect(printed.locator('.cv-page .cv-section-divider:first-child')).toHaveCount(0);
    const boundary = boundaries.find((boundary) => boundary.heading === 'heading-experience')!;
    const top = await printed
      .locator('.cv-page')
      .nth(boundary.page)
      .locator('[data-block-id="heading-experience"]')
      .evaluate((heading) => {
        const origin = heading.closest('.cv-page')!.getBoundingClientRect(),
          column = heading.parentElement!.getBoundingClientRect(),
          box = heading.getBoundingClientRect();
        return {
          y: box.top - origin.top,
          left: column.left - origin.left,
          right: column.right - origin.left,
          delta: box.top - column.top,
        };
      });
    expect(top.delta).toBeCloseTo(0, 1);
    const bytes = await printed.pdf({
      path: info.outputPath('page-start.pdf'),
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
      for (let i = 1; i <= 42; i++) expect(normalized).toContain(`Lernabschnitt${i}:`);
      for (const section of ['education', 'experience', 'projects'] as const)
        for (const entry of project.cv[section])
          expect(normalized).toContain(entry.organization.replace(/\s/g, ''));
      const pdfPage = await pdf.getPage(boundary.page + 1),
        viewport = pdfPage.getViewport({ scale: 2 });
      const factory = pdf.canvasFactory as {
        create(
          width: number,
          height: number,
        ): {
          canvas: HTMLCanvasElement & { toBuffer(type: string): Buffer };
          context: CanvasRenderingContext2D;
        };
      };
      const { canvas, context: canvasContext } = factory.create(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      await pdfPage.render({ canvas, canvasContext, viewport }).promise;
      const pixels = canvasContext.getImageData(
        Math.ceil((top.left + 5) * 1.5),
        Math.floor((top.y - 2) * 1.5),
        Math.floor((top.right - top.left - 10) * 1.5),
        1,
      ).data;
      expect([...pixels].every((value, i) => i % 4 === 3 || value > 250)).toBe(true);
      await writeFile(info.outputPath('page-start.png'), canvas.toBuffer('image/png'));
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
