import { expect, test, type Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { writeFile } from 'node:fs/promises';
import { createProject } from '../packages/core/src/fixtures';
import type { Project } from '../packages/core/src/schema';
import { openPrintHost } from './print-host';

async function openProject(page: Page, project: Project) {
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'sidebar.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
}

function sidebarGeometry() {
  const zoomText = getComputedStyle(document.querySelector('.preview-scale') ?? document.body).zoom;
  const zoom = zoomText.endsWith('%') ? parseFloat(zoomText) / 100 : parseFloat(zoomText) || 1;
  return [...document.querySelectorAll('.cv-page')].flatMap((page, index) => {
    const origin = page.getBoundingClientRect();
    return [
      ...page.querySelectorAll<HTMLElement>(
        '.cv-sidebar .cv-station, .cv-sidebar .cv-station-heading, .cv-sidebar .cv-section-divider',
      ),
    ].map((block) => {
      const column = block.closest<HTMLElement>('.cv-sidebar')!;
      const style = getComputedStyle(block);
      const before = getComputedStyle(block, '::before');
      const rect = block.getBoundingClientRect();
      const contentLeft =
        column.getBoundingClientRect().left +
        parseFloat(getComputedStyle(column).paddingLeft) * zoom;
      return {
        id: block.dataset.blockId!,
        page: index,
        x: (rect.left - origin.left) / zoom,
        top: (rect.top - origin.top) / zoom,
        indent: (rect.left - contentLeft) / zoom,
        padding: parseFloat(style.paddingLeft),
        margin: parseFloat(style.marginLeft),
        line: before.display !== 'none' && before.content !== 'none',
      };
    });
  });
}

async function expectPlainSidebar(page: Page) {
  await expect(
    page.locator(
      '.cv-page .cv-sidebar :is(.cv-station-dot, .cv-timeline-tail, [data-timeline-from-previous], [data-timeline-to-next], .cv-station-connected)',
    ),
  ).toHaveCount(0);
  const blocks = await page.evaluate(sidebarGeometry);
  expect(blocks.length).toBeGreaterThan(0);
  for (const block of blocks) {
    expect(Math.abs(block.indent), block.id).toBeLessThan(0.1);
    expect(block.padding, block.id).toBe(0);
    expect(block.margin, block.id).toBe(0);
    expect(block.line, block.id).toBe(false);
  }
  return blocks;
}

for (const sidebarSide of ['left', 'right'] as const) {
  test(`moving stations into sidebar ${sidebarSide} removes markers and indents for every timeline style`, async ({
    page,
  }) => {
    const project = createProject('student');
    project.cv.title = `Stationen verschieben ${sidebarSide}`;
    project.layout.appearance.sidebarSide = sidebarSide;
    await openProject(page, project);
    await page.getByRole('tab', { name: 'Design', exact: true }).click();
    for (const name of ['Punkte mit Verbindungslinie', 'Nur Punkte', 'Ohne Markierung']) {
      await page.getByRole('combobox', { name: /^Stationen markieren/ }).click();
      await page.getByRole('option', { name, exact: true }).click();
      for (const section of ['Ausbildung', 'Erfahrung', 'Projekte & Engagement']) {
        const placement = page.getByRole('combobox', {
          name: `Bereich für ${section}`,
          exact: true,
        });
        await placement.selectOption('sidebar');
        await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
        const before = await expectPlainSidebar(page);
        if (name !== 'Ohne Markierung') {
          const offset = page.getByRole('slider', { name: 'Position der Zeitachse', exact: true });
          const gap = page.getByRole('slider', { name: 'Abstand Zeitachse zum Text', exact: true });
          await offset.press('End');
          await gap.press('End');
          const after = await expectPlainSidebar(page);
          expect(after).toEqual(before);
          await expect(page.locator('.cv-page .cv-main .cv-station-dot')).toHaveCount(2);
        }
        await placement.selectOption('main');
        await expect(page.locator('.cv-page .cv-main .cv-station-dot')).toHaveCount(
          name === 'Ohne Markierung' ? 0 : 3,
        );
      }
    }
  });

  for (const timelineStyle of ['dots', 'line'] as const)
    test(`sidebar ${sidebarSide} has no timeline in multipage preview and PDF with ${timelineStyle}`, async ({
      page,
      context,
    }, info) => {
      await page.addInitScript(() => {
        window.print = () => {
          document.documentElement.dataset.printRequested = 'true';
        };
      });
      const project = createProject('student');
      project.cv.title = `Seitenleiste ohne Zeitachse ${sidebarSide} ${timelineStyle}`;
      for (const section of project.layout.sections)
        if (section.id === 'education' || section.id === 'projects') section.region = 'sidebar';
      project.cv.education[0].description = Array.from(
        { length: 32 },
        (_, i) =>
          `Lernabschnitt ${i + 1}: Zusammenarbeit und verständliche Kommunikation. Selbständige Planung und Gestaltung digitaler Anwendungen.`,
      ).join('\n');
      Object.assign(project.layout.appearance, {
        sidebarSide,
        timelineStyle,
        sectionDividers: true,
        sidebarPercent: 25,
        timelineOffsetMm: 12,
        timelineTextGapMm: 14,
        fontId: sidebarSide === 'left' ? 'source-sans' : 'lora',
        compactWithoutSummary: true,
      });
      project.layout.sections.find((section) => section.id === 'summary')!.enabled = false;
      await openProject(page, project);
      const preview = await expectPlainSidebar(page);
      const count = await page.locator('.cv-page').count();
      expect(count).toBeGreaterThan(1);
      await expect(page.locator('.cv-page .cv-main .cv-station-dot')).toHaveCount(1);
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
        const printBlocks = await expectPlainSidebar(printed);
        expect(printBlocks.map((block) => [block.id, block.page])).toEqual(
          preview.map((block) => [block.id, block.page]),
        );
        for (const [i, block] of printBlocks.entries()) {
          expect(Math.abs(block.x - preview[i].x), block.id).toBeLessThan(1);
          expect(Math.abs(block.top - preview[i].top), block.id).toBeLessThan(1.5);
        }
        const bytes = await printed.pdf({
          path: info.outputPath('sidebar.pdf'),
          format: 'A4',
          preferCSSPageSize: true,
          printBackground: true,
        });
        const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
        try {
          const pdf = await task.promise;
          expect(pdf.numPages).toBe(count);
          const texts: string[] = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const text = await (await pdf.getPage(i)).getTextContent();
            texts.push(text.items.flatMap((item) => ('str' in item ? [item.str] : [])).join(''));
          }
          const normalized = texts.join('').replace(/\s/g, '');
          for (let i = 1; i <= 32; i++) expect(normalized).toContain(`Lernabschnitt${i}:`);
          for (const section of ['education', 'experience', 'projects'] as const)
            for (const entry of project.cv[section])
              expect(normalized).toContain(entry.organization.replace(/\s/g, ''));
          const sheet = await pdf.getPage(1);
          const viewport = sheet.getViewport({ scale: 1.5 });
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
          await writeFile(info.outputPath('sidebar-pdf.png'), canvas.toBuffer('image/png'));
        } finally {
          await task.destroy();
        }
      } finally {
        await printed.close();
      }
    });
}
