import { expect, test, type Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { writeFile } from 'node:fs/promises';
import { createProject } from '../packages/core/src/fixtures';
import type { Project } from '../packages/core/src/schema';
import { openPrintHost } from './print-host';

async function openProject(page: Page, project: Project) {
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'summary.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
}

for (const region of ['main', 'sidebar'] as const)
  for (const fontId of ['dm-sans', 'source-sans', 'lora'] as const) {
    test(`a long summary remains one naturally wrapped paragraph: ${region}, ${fontId}`, async ({
      page,
    }) => {
      const project = createProject('student');
      project.cv.title = `Zusammenhängender Text ${region} ${fontId}`;
      project.cv.summary = Array.from(
        { length: region === 'main' ? 18 : 8 },
        () => 'Gemeinsam planen wir verständliche Lösungen für unterschiedliche Aufgaben.',
      ).join(' ');
      project.layout.sections.find((section) => section.id === 'summary')!.region = region;
      project.layout.appearance.fontId = fontId;
      await openProject(page, project);
      const paragraphs = page.locator(
        '.cv-page [data-section="summary"] p, .cv-page .cv-summary-paragraph',
      );
      await expect(paragraphs).toHaveCount(1);
      const text = await paragraphs.textContent();
      expect(text).toBe(project.cv.summary);
      const lines = await paragraphs.evaluate((paragraph) => {
        const page = paragraph.closest('.cv-page')!.getBoundingClientRect();
        const zoom = page.width / ((210 * 96) / 25.4);
        const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        const positions: number[] = [];
        while (walker.nextNode()) {
          range.selectNodeContents(walker.currentNode);
          for (const rect of range.getClientRects())
            if (rect.width && !positions.some((top) => Math.abs(top - rect.top) < 0.1))
              positions.push(rect.top);
        }
        const css = getComputedStyle(paragraph);
        return { tops: positions.map((top) => top / zoom), pitch: parseFloat(css.lineHeight) };
      });
      expect(lines.tops.length).toBeGreaterThan(6);
      const naturalLineCount = await page
        .locator(`.cv-measure .cv-intro-row .cv-${region} [data-section="summary"] p`)
        .evaluate((paragraph) => {
          const range = document.createRange();
          range.selectNodeContents(paragraph);
          return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top * 64))).size;
        });
      expect(lines.tops).toHaveLength(naturalLineCount);
      const indentation = await page.evaluate((region) => {
        const source = document.querySelector<HTMLElement>(
          `.cv-measure .cv-${region} [data-section="summary"] p`,
        )!;
        const paragraph = document.querySelector<HTMLElement>('.cv-page .cv-summary-paragraph')!;
        const zoom =
          paragraph.closest('.cv-page')!.getBoundingClientRect().width / ((210 * 96) / 25.4);
        return {
          source:
            source.getBoundingClientRect().left -
            source.closest(`.cv-${region}`)!.getBoundingClientRect().left,
          preview:
            (paragraph.getBoundingClientRect().left -
              paragraph.closest(`.cv-${region}`)!.getBoundingClientRect().left) /
            zoom,
        };
      }, region);
      expect(Math.abs(indentation.preview - indentation.source)).toBeLessThan(0.1);
      for (let index = 1; index < lines.tops.length; index++)
        expect(Math.abs(lines.tops[index] - lines.tops[index - 1] - lines.pitch)).toBeLessThan(0.1);
    });
  }

test('only user-entered paragraphs add spacing, and long unbroken Unicode text remains complete', async ({
  page,
}) => {
  const project = createProject('student');
  for (const summary of [
    'Erster Absatz mit bewusster Trennung.\nZweiter Absatz mit eigenem Abstand.',
    'Einzelwort😀'.repeat(90),
    'Text mit  mehreren   Leerzeichen und einem Ende.   ',
  ]) {
    project.cv.title = `Absatzprüfung ${summary.length}`;
    project.cv.summary = summary;
    await openProject(page, project);
    const paragraphs = page.locator('.cv-page .cv-summary-paragraph');
    expect((await paragraphs.allTextContents()).join('')).toBe(summary.replace(/\n/g, ''));
    await expect(paragraphs).toHaveCount(summary.includes('\n') ? 2 : 1);
    const ends = await page
      .locator('.cv-page .cv-summary-fragment:not(.cv-summary-continues)')
      .evaluateAll((blocks) =>
        blocks.map((block) => parseFloat(getComputedStyle(block).paddingBottom)),
      );
    for (const padding of ends) expect(padding).toBeCloseTo((1.8 * 96) / 25.4, 1);
  }
});

test('editing and clearing a long summary replaces measured fragments without stale text', async ({
  page,
}) => {
  await openProject(page, createProject('student'));
  await page.getByRole('button', { name: 'Über mich', exact: true }).click();
  for (const text of [
    'Gemeinsam verständliche Lösungen entwickeln. '.repeat(35),
    'Ein kurzer Absatz.',
    '',
  ]) {
    await page.getByLabel('Über mich', { exact: true }).fill(text);
    await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
    expect((await page.locator('.cv-page .cv-summary-paragraph').allTextContents()).join('')).toBe(
      text,
    );
  }
  await expect(page.locator('.cv-page .cv-summary-paragraph')).toHaveCount(0);
});

function summaryGeometry() {
  return [...document.querySelectorAll('.cv-page')].map((sheet) => {
    const origin = sheet.getBoundingClientRect(),
      scale = origin.width / 210;
    const limit = sheet.querySelector('.cv-columns')!.getBoundingClientRect().bottom;
    return [...sheet.querySelectorAll<HTMLElement>('.cv-block')].map((block) => {
      const box = block.getBoundingClientRect();
      return {
        id: block.dataset.blockId,
        top: (box.top - origin.top) / scale,
        left: (box.left - origin.left) / scale,
        bottom: (box.bottom - origin.top) / scale,
        limit: (limit - origin.top) / scale,
      };
    });
  });
}

for (const scenario of [
  { kind: 'student', region: 'main', fontId: 'dm-sans', words: 18 },
  { kind: 'adult', region: 'main', fontId: 'lora', words: 160 },
  { kind: 'adult', region: 'sidebar', fontId: 'source-sans', words: 100 },
] as const) {
  test(`continuous summary matches PDF and retains its text: ${scenario.kind}, ${scenario.region}`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    const project = createProject(scenario.kind);
    project.cv.summary = Array.from(
      { length: scenario.words },
      (_, index) =>
        `Profil ${index + 1}: Überlegte Planung und verständliche Zusammenarbeit für gute Ergebnisse.`,
    ).join(' ');
    project.layout.sections.find((section) => section.id === 'summary')!.region = scenario.region;
    Object.assign(project.layout.appearance, {
      fontId: scenario.fontId,
      sidebarSide: scenario.region === 'main' ? 'left' : 'right',
      lineHeight: scenario.kind === 'student' ? 0.9 : 1.5,
    });
    await openProject(page, project);
    const preview = await page.evaluate(summaryGeometry);
    if (scenario.kind === 'adult') expect(preview.length).toBeGreaterThanOrEqual(4);
    for (const blocks of preview)
      for (const block of blocks)
        expect(block.bottom, block.id).toBeLessThanOrEqual(block.limit + 0.1);
    expect((await page.locator('.cv-page .cv-summary-paragraph').allTextContents()).join('')).toBe(
      project.cv.summary,
    );
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
      await printed.evaluate(() => document.fonts.ready);
      await printed.emulateMedia({ media: 'print' });
      const actual = await printed.evaluate(summaryGeometry);
      expect(actual).toHaveLength(preview.length);
      for (const [index, blocks] of actual.entries()) {
        expect(blocks.map((block) => block.id)).toEqual(preview[index].map((block) => block.id));
        for (const [position, block] of blocks.entries()) {
          expect(block.bottom, block.id).toBeLessThanOrEqual(block.limit + 0.1);
          for (const key of ['top', 'left', 'bottom'] as const)
            expect(
              Math.abs(block[key] - preview[index][position][key]),
              `${block.id}: ${key}`,
            ).toBeLessThan(0.6);
        }
      }
      const bytes = await printed.pdf({
        path: info.outputPath('summary.pdf'),
        format: 'A4',
        preferCSSPageSize: true,
        printBackground: true,
      });
      const areas = await printed.evaluate(() =>
        [...document.querySelectorAll('.cv-page')].map((sheet) => {
          const origin = sheet.getBoundingClientRect(),
            scale = (210 * 72) / 25.4 / origin.width;
          return [...sheet.querySelectorAll('.cv-summary-paragraph')].map((paragraph) => {
            const box = paragraph.getBoundingClientRect();
            return {
              left: (box.left - origin.left) * scale,
              right: (box.right - origin.left) * scale,
              top: (box.top - origin.top) * scale,
              bottom: (box.bottom - origin.top) * scale,
            };
          });
        }),
      );
      const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
      try {
        const pdf = await task.promise;
        expect(pdf.numPages).toBe(preview.length);
        let text = '';
        let summary = '';
        for (let index = 1; index <= pdf.numPages; index++) {
          const sheet = await pdf.getPage(index);
          const height = sheet.getViewport({ scale: 1 }).height;
          const items = (await sheet.getTextContent()).items;
          text += items.map((item) => ('str' in item ? item.str : '')).join(' ');
          for (const item of items)
            if (
              'str' in item &&
              areas[index - 1].some(
                (area) =>
                  item.transform[4] >= area.left - 0.5 &&
                  item.transform[4] < area.right &&
                  height - item.transform[5] >= area.top - 0.5 &&
                  height - item.transform[5] < area.bottom,
              )
            )
              summary += item.str;
        }
        const normalized = text.replace(/\s/g, '');
        expect(
          summary.replace(/\s/g, '') === project.cv.summary.replace(/\s/g, ''),
          'complete summary text in page order, excluding running headers and footers',
        ).toBe(true);
        for (const section of ['education', 'experience', 'projects'] as const)
          for (const entry of project.cv[section])
            expect(normalized).toContain(entry.organization.replace(/\s/g, ''));
        const first = await pdf.getPage(1),
          viewport = first.getViewport({ scale: 1.5 });
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
        await writeFile(info.outputPath('summary.png'), canvas.toBuffer('image/png'));
      } finally {
        await task.destroy();
      }
    } finally {
      await printed.close();
    }
  });
}
