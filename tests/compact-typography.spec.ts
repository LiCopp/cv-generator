import { expect, test, type Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createProject } from '../packages/core/src/fixtures';
import { parseProject, type Project } from '../packages/core/src/schema';
import { openPrintHost } from './print-host';

async function openProject(page: Page, project: Project) {
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'typography.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
}

test('both typography sliders reach 0.9 and retain their values through saving, reload and import', async ({
  page,
}, info) => {
  const project = createProject('student');
  await openProject(page, project);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await page
    .getByRole('switch', { name: 'Eigener Zeilenabstand für die linke Spalte', exact: true })
    .check();
  for (const label of ['Zeilenabstand', 'Zeilenabstand linke Spalte']) {
    const slider = page.getByRole('slider', { name: label, exact: true });
    await slider.press('Home');
    await expect(slider).toHaveAttribute('aria-valuenow', '0.9');
    await slider.press('ArrowRight');
    expect(Number(await slider.getAttribute('aria-valuenow'))).toBeCloseTo(0.95, 10);
    await slider.press('Home');
  }
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('compact-typography.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.cv).toEqual(project.cv);
  expect(saved.layout.appearance).toMatchObject({ lineHeight: 0.9, leftColumnLineHeight: 0.9 });
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await expect(page.locator('.cv-document')).toHaveCSS('--cv-line-height', '0.9');
  await expect(page.locator('.cv-document')).toHaveCSS('--cv-left-line-height', '0.9');
  saved.cv.title = 'Kompakte Typografie importiert';
  await openProject(page, saved);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  for (const label of ['Zeilenabstand', 'Zeilenabstand linke Spalte'])
    await expect(page.getByRole('slider', { name: label, exact: true })).toHaveAttribute(
      'aria-valuenow',
      '0.9',
    );
});

function geometry() {
  return [...document.querySelectorAll('.cv-page')].map((sheet) => {
    const origin = sheet.getBoundingClientRect(),
      scale = origin.width / 210;
    const limit = sheet.querySelector('.cv-columns')!.getBoundingClientRect().bottom;
    return [...sheet.querySelectorAll<HTMLElement>('.cv-block')].map((block) => {
      const box = block.getBoundingClientRect();
      return {
        id: block.dataset.blockId,
        top: (box.top - origin.top) / scale,
        bottom: (box.bottom - origin.top) / scale,
        limit: (limit - origin.top) / scale,
      };
    });
  });
}

for (const scenario of [
  { kind: 'student', fontId: 'dm-sans', sidebarSide: 'left' },
  { kind: 'adult', fontId: 'source-sans', sidebarSide: 'left' },
  { kind: 'adult', fontId: 'lora', sidebarSide: 'right' },
] as const) {
  test(`minimum typography keeps preview and PDF complete: ${scenario.kind}, ${scenario.fontId}`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    const project = createProject(scenario.kind);
    Object.assign(project.layout.appearance, {
      lineHeight: 0.9,
      leftColumnLineHeight: scenario.fontId === 'source-sans' ? null : 0.9,
      fontId: scenario.fontId,
      sidebarSide: scenario.sidebarSide,
      fontSizePt: scenario.kind === 'adult' ? 12 : 10,
    });
    await openProject(page, project);
    const preview = await page.evaluate(geometry);
    if (scenario.kind === 'student') expect(preview).toHaveLength(1);
    else expect(preview.length).toBeGreaterThanOrEqual(4);
    for (const blocks of preview)
      for (const block of blocks)
        expect(block.bottom, block.id).toBeLessThanOrEqual(block.limit + 0.1);
    const ratios = await page.locator('.cv-measure .cv-station > p').evaluateAll((paragraphs) =>
      paragraphs.map((element) => {
        const style = getComputedStyle(element);
        return parseFloat(style.lineHeight) / parseFloat(style.fontSize);
      }),
    );
    expect(ratios.length).toBeGreaterThan(0);
    for (const ratio of ratios) expect(ratio).toBeCloseTo(0.9, 2);
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
      const actual = await printed.evaluate(geometry);
      expect(actual).toHaveLength(preview.length);
      for (const [index, blocks] of actual.entries()) {
        expect(blocks.map((block) => block.id)).toEqual(preview[index].map((block) => block.id));
        for (const [position, block] of blocks.entries()) {
          expect(block.bottom, block.id).toBeLessThanOrEqual(block.limit + 0.1);
          expect(Math.abs(block.top - preview[index][position].top), block.id).toBeLessThan(0.6);
        }
      }
      const bytes = await printed.pdf({
        path: info.outputPath('compact-typography.pdf'),
        format: 'A4',
        preferCSSPageSize: true,
        printBackground: true,
      });
      const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
      try {
        const pdf = await task.promise;
        expect(pdf.numPages).toBe(preview.length);
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++)
          text += (await (await pdf.getPage(i)).getTextContent()).items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ');
        const normalized = text.replace(/\s/g, '');
        expect(normalized).toContain(project.cv.summary.replace(/\s/g, ''));
        for (const section of ['education', 'experience', 'projects'] as const)
          for (const entry of project.cv[section]) {
            expect(normalized).toContain(entry.title.replace(/\s/g, ''));
            expect(normalized).toContain(entry.organization.replace(/\s/g, ''));
            for (const paragraph of entry.description.split(/\n+/).filter(Boolean))
              expect(normalized).toContain(paragraph.replace(/\s/g, ''));
          }
        const first = await pdf.getPage(1),
          viewport = first.getViewport({ scale: 2 });
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
        await writeFile(info.outputPath('compact-typography.png'), canvas.toBuffer('image/png'));
      } finally {
        await task.destroy();
      }
    } finally {
      await printed.close();
    }
  });
}
