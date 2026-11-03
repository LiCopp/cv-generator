import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createProject, makeSkill } from '../packages/core/src/fixtures';
import { openPrintHost } from './print-host';

async function rightPdfText(
  page: Page,
  context: BrowserContext,
  sidebarSide: 'left' | 'right',
  path: string,
) {
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
    const areas = await printed.evaluate(
      (side) =>
        [...document.querySelectorAll('.cv-page')].map((sheet) => {
          const origin = sheet.getBoundingClientRect(),
            scale = (297 * 72) / 25.4 / origin.height;
          const region = sheet
            .querySelector(`.cv-body-row ${side === 'left' ? '.cv-main' : '.cv-sidebar'}`)!
            .getBoundingClientRect();
          return {
            left: (region.left - origin.left) * scale,
            top: (region.top - origin.top) * scale,
            bottom: (region.bottom - origin.top) * scale,
          };
        }),
      sidebarSide,
    );
    const bytes = await printed.pdf({
      path,
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
    });
    const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
    try {
      const pdf = await task.promise;
      const result: { text: string; page: number; x: number; y: number }[] = [];
      for (let index = 0; index < pdf.numPages; index++) {
        const sheet = await pdf.getPage(index + 1),
          height = sheet.getViewport({ scale: 1 }).height;
        const content = await sheet.getTextContent(),
          area = areas[index];
        if (index === 0) {
          const headings = content.items.filter(
            (item) => 'str' in item && ['ERFAHRUNG', 'KENNTNISSE'].includes(item.str.trim()),
          );
          expect(headings).toHaveLength(2);
          const baselines = headings.map((item) => ('transform' in item ? item.transform[5] : NaN));
          expect(
            Math.abs(baselines[0] - baselines[1]),
            'section heading baselines in actual PDF',
          ).toBeLessThan(0.01);
        }
        for (const item of content.items)
          if ('str' in item && item.str.trim()) {
            const x = item.transform[4],
              y = height - item.transform[5];
            if (x >= area.left - 0.5 && y >= area.top && y < area.bottom)
              result.push({ text: item.str, page: index, x, y });
          }
      }
      return result;
    } finally {
      await task.destroy();
    }
  } finally {
    await printed.close();
    await page.evaluate(() =>
      document
        .querySelector<HTMLIFrameElement>('iframe[data-cv-print]')!
        .contentWindow!.dispatchEvent(new Event('afterprint')),
    );
  }
}

async function rightGeometry(page: Page, sidebarSide: 'left' | 'right') {
  return page.evaluate((side) => {
    const right = side === 'left' ? '.cv-main' : '.cv-sidebar';
    const viewport = document.querySelector('.preview-viewport')!;
    return {
      scrollTop: viewport.scrollTop,
      blocks: [...document.querySelectorAll('.cv-page')].flatMap((sheet, index) => {
        const origin = sheet.getBoundingClientRect(),
          mm = origin.height / 297;
        return [...sheet.querySelectorAll<HTMLElement>(`.cv-body-row ${right} .cv-block`)].map(
          (block) => {
            const box = block.getBoundingClientRect();
            return {
              id: block.dataset.blockId,
              page: index,
              top: (box.top - origin.top) / mm,
              height: box.height / mm,
              screenTop: box.top,
            };
          },
        );
      }),
    };
  }, sidebarSide);
}

for (const sidebarSide of ['left', 'right'] as const)
  for (const sectionDividers of [false, true]) {
    test(`right PDF text keeps its coordinates when left spacing changes: sidebar ${sidebarSide}, dividers ${sectionDividers}`, async ({
      page,
      context,
    }, info) => {
      await page.addInitScript(() => {
        window.print = () => {
          document.documentElement.dataset.printRequested = 'true';
        };
      });
      const project = createProject('adult');
      project.cv.title = `PDF Spalten ${sidebarSide} ${sectionDividers}`;
      Object.assign(project.layout.appearance, {
        sidebarSide,
        sectionDividers,
        leftColumnLineHeight: 1,
        fontId: 'source-sans',
        fontSizePt: 11,
        lineHeight: 1.4,
        spacingMm: 8,
        sidebarPercent: 27,
      });
      project.layout.appearance.sectionHeadings.experience.fontSizePt = 11;
      project.layout.appearance.sectionHeadings.skills.fontSizePt = 11;
      project.layout.page.marginMm = 12;
      await page.goto('/');
      await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
        name: 'columns.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(project)),
      });
      await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
      await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
      const before = await rightPdfText(page, context, sidebarSide, info.outputPath('before.pdf'));
      await page.getByRole('tab', { name: 'Design', exact: true }).click();
      await page
        .getByRole('slider', { name: 'Zeilenabstand linke Spalte', exact: true })
        .press('End');
      await expect(page.locator('.cv-document')).toHaveCSS('--cv-left-line-height', '2.4');
      await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
      const after = await rightPdfText(page, context, sidebarSide, info.outputPath('after.pdf'));
      expect(before.length).toBeGreaterThan(10);
      expect(after.map((item) => [item.text, item.page])).toEqual(
        before.map((item) => [item.text, item.page]),
      );
      for (const [index, item] of after.entries()) {
        expect(Math.abs(item.x - before[index].x), item.text).toBeLessThan(0.01);
        expect(Math.abs(item.y - before[index].y), item.text).toBeLessThan(0.01);
      }
    });
  }

for (const sidebarSide of ['left', 'right'] as const)
  for (const sectionDividers of [false, true])
    for (const fontId of ['dm-sans', 'source-sans'] as const) {
      test(`left line spacing leaves right content in place: sidebar ${sidebarSide}, dividers ${sectionDividers}, font ${fontId}`, async ({
        page,
      }) => {
        const project = createProject('adult');
        project.cv.title = `Unabhängige Spalten ${sidebarSide} ${sectionDividers}`;
        project.cv.skills = Array.from({ length: 24 }, (_, index) =>
          makeSkill({
            id: `skill-${index}`,
            name: `Kompetenz ${index + 1}`,
            level: 'Gute Kenntnisse',
            description:
              'Praktische Erfahrung in der gemeinsamen Planung und Umsetzung verständlicher Lösungen.',
          }),
        );
        project.layout.skills.showDescription = true;
        Object.assign(project.layout.appearance, {
          sidebarSide,
          sectionDividers,
          leftColumnLineHeight: 1,
          fontId,
          fontSizePt: 11,
          lineHeight: 1.4,
          spacingMm: 8,
          sidebarPercent: 27,
        });
        project.layout.page.marginMm = 12;
        await page.goto('/');
        await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
          name: 'columns.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(project)),
        });
        await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
        await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
        await page.getByRole('tab', { name: 'Design', exact: true }).click();
        const slider = page.getByRole('slider', {
          name: 'Zeilenabstand linke Spalte',
          exact: true,
        });
        for (const scrollTop of [0, 350, 650, 950, 1400]) {
          await slider.press('Home');
          await expect(page.locator('.cv-document')).toHaveCSS('--cv-left-line-height', '0.9');
          await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
          await page.locator('.preview-viewport').evaluate((element, value) => {
            element.scrollTop = value;
          }, scrollTop);
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
              ),
          );
          const before = await rightGeometry(page, sidebarSide);
          const headingBefore = await page
            .locator('.cv-page')
            .first()
            .locator('.cv-body-row h2')
            .evaluateAll((headings) =>
              headings.map((heading) => ({
                height: heading.getBoundingClientRect().height,
                lineHeight: getComputedStyle(heading).lineHeight,
              })),
            );
          await slider.press('End');
          await expect(page.locator('.cv-document')).toHaveCSS('--cv-left-line-height', '2.4');
          await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
              ),
          );
          const after = await rightGeometry(page, sidebarSide);
          const headingAfter = await page
            .locator('.cv-page')
            .first()
            .locator('.cv-body-row h2')
            .evaluateAll((headings) =>
              headings.map((heading) => ({
                height: heading.getBoundingClientRect().height,
                lineHeight: getComputedStyle(heading).lineHeight,
              })),
            );
          expect(headingAfter).toEqual(headingBefore);
          expect(after.blocks.map((block) => block.id)).toEqual(
            before.blocks.map((block) => block.id),
          );
          for (const [i, block] of after.blocks.entries()) {
            expect(block.page, block.id).toBe(before.blocks[i].page);
            expect(
              Math.abs(block.top - before.blocks[i].top),
              `${block.id} page position`,
            ).toBeLessThan(0.001);
            expect(
              Math.abs(block.height - before.blocks[i].height),
              `${block.id} height`,
            ).toBeLessThan(0.001);
            expect(
              Math.abs(block.screenTop - before.blocks[i].screenTop),
              `${block.id} screen position`,
            ).toBeLessThan(0.05);
          }
          expect(after.scrollTop, `preview scroll at ${scrollTop}`).toBeCloseTo(
            before.scrollTop,
            1,
          );
        }
      });
    }
