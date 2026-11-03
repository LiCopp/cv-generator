import { expect, test, type Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createProject } from '../packages/core/src/fixtures';
import { parseProject, type Project } from '../packages/core/src/schema';
import { openPrintHost } from './print-host';

async function openProject(page: Page, project: Project) {
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
}

// Physical geometry also works in the zoomed live preview and the unzoomed print frame.
function geometry() {
  return [...document.querySelectorAll<HTMLElement>('.cv-page')].map((page) => {
    const box = page.getBoundingClientRect(),
      mm = box.height / 297;
    const columns = page.querySelector<HTMLElement>(':scope > .cv-columns')!,
      bounds = columns.getBoundingClientRect();
    const topPadding = (parseFloat(getComputedStyle(columns).paddingTop) * 25.4) / 96;
    const blocks = [...page.querySelectorAll<HTMLElement>('.cv-block')].map((block) => ({
      id: block.dataset.blockId!,
      top: (block.getBoundingClientRect().top - box.top) / mm,
      bottom: (block.getBoundingClientRect().bottom - box.top) / mm,
    }));
    return {
      top: (bounds.top - box.top) / mm + topPadding,
      bottom: (bounds.bottom - box.top) / mm,
      blocks,
      tails: [...page.querySelectorAll('.cv-timeline-tail')].map(
        (tail) => (tail.getBoundingClientRect().bottom - box.top) / mm,
      ),
    };
  });
}

test('running header and footer switches save, reload, import and re-enable independently', async ({
  page,
}, info) => {
  const project = createProject('adult');
  project.cv.title = 'Optionale Kopf- und Fusszeile';
  await openProject(page, project);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  const header = page.getByRole('switch', {
    name: 'Kopfzeile auf Folgeseiten anzeigen',
    exact: true,
  });
  const footer = page.getByRole('switch', { name: 'Fusszeile anzeigen', exact: true });
  await expect(header).toBeChecked();
  await expect(footer).toBeChecked();
  await header.uncheck();
  await expect(page.locator('.cv-page .cv-running-header')).toHaveCount(0);
  expect(await page.locator('.cv-page .cv-footer').count()).toBeGreaterThan(0);
  await footer.uncheck();
  await expect(page.locator('.cv-page .cv-footer')).toHaveCount(0);
  await expect(page.locator('.cv-page .cv-header-shell')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('page-furniture.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.layout.schemaVersion).toBe(23);
  expect(saved.manifest.rendererVersion).toBe('1.28.0');
  expect(saved.layout.appearance).toEqual({
    ...project.layout.appearance,
    showRunningHeader: false,
    showFooter: false,
  });
  expect(saved.cv).toEqual(project.cv);
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(header).not.toBeChecked();
  await expect(footer).not.toBeChecked();
  await header.check();
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
  expect(await page.locator('.cv-page .cv-running-header').count()).toBeGreaterThan(0);
  await expect(page.locator('.cv-page .cv-footer')).toHaveCount(0);
  await footer.check();
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
  expect(await page.locator('.cv-page .cv-footer').count()).toBe(
    await page.locator('.cv-page').count(),
  );
  saved.cv.title = 'Import ohne Kopf- und Fusszeile';
  await openProject(page, saved);
  await expect(page.locator('.cv-page .cv-running-header, .cv-page .cv-footer')).toHaveCount(0);
});

for (const showRunningHeader of [true, false])
  for (const showFooter of [true, false]) {
    test(`physical space is reused in preview and text PDF: header ${showRunningHeader}, footer ${showFooter}`, async ({
      page,
      context,
    }, info) => {
      await page.addInitScript(() => {
        window.print = () => {
          document.documentElement.dataset.printRequested = 'true';
        };
      });
      const project = createProject('adult');
      project.cv.title = `Zeilen ${showRunningHeader} ${showFooter}`;
      project.cv.skills = Array.from({ length: 80 }, (_, i) => ({
        id: `skill-${i}`,
        name: `Zusatzkenntnis ${i + 1}`,
        level: '',
        description: '',
        category: '',
        proficiency: null,
      }));
      project.layout.appearance.sidebarSide = showFooter ? 'left' : 'right';
      project.layout.appearance.fontId = showRunningHeader ? 'dm-sans' : 'lora';
      await openProject(page, project);
      const baseline = await page.evaluate(geometry);
      Object.assign(project.layout.appearance, { showRunningHeader, showFooter });
      project.cv.title += ' angepasst';
      await openProject(page, project);
      const preview = await page.evaluate(geometry),
        count = preview.length;
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(baseline.length);
      await expect(page.locator('.cv-page .cv-header-shell')).toHaveCount(1);
      await expect(page.locator('.cv-page .cv-running-header')).toHaveCount(
        showRunningHeader ? count - 1 : 0,
      );
      await expect(page.locator('.cv-page .cv-footer')).toHaveCount(showFooter ? count : 0);
      expect(preview[0].top).toBeCloseTo(baseline[0].top, 1);
      for (const [i, current] of preview.entries()) {
        expect(current.bottom).toBeCloseTo(
          297 - project.layout.page.marginMm - (showFooter ? 8 : 0),
          1,
        );
        if (i > 0)
          expect(current.top).toBeCloseTo(
            project.layout.page.marginMm + (showRunningHeader ? 15 : 0),
            1,
          );
        for (const block of current.blocks) {
          expect(block.top).toBeGreaterThanOrEqual(current.top - 0.1);
          expect(block.bottom).toBeLessThanOrEqual(current.bottom + 0.1);
        }
        for (const bottom of current.tails) expect(bottom).toBeCloseTo(current.bottom, 1);
      }
      expect(preview.flatMap((p) => p.blocks.map((b) => b.id)).sort()).toEqual(
        baseline.flatMap((p) => p.blocks.map((b) => b.id)).sort(),
      );
      if (!showRunningHeader || !showFooter) {
        const firstTwoCount = (pages: typeof preview) =>
          pages.slice(0, 2).flatMap((p) => p.blocks).length;
        expect(firstTwoCount(preview)).toBeGreaterThan(firstTwoCount(baseline));
      }
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
        const actual = await printed.evaluate(geometry);
        expect(actual.length).toBe(count);
        for (const [i, sheet] of actual.entries()) {
          expect(sheet.top).toBeCloseTo(preview[i].top, 1);
          expect(sheet.bottom).toBeCloseTo(preview[i].bottom, 1);
          expect(sheet.blocks.map((b) => b.id)).toEqual(preview[i].blocks.map((b) => b.id));
          for (const [j, block] of sheet.blocks.entries())
            expect(Math.abs(block.bottom - preview[i].blocks[j].bottom)).toBeLessThan(0.5);
        }
        const bytes = await printed.pdf({
          path: info.outputPath('optional-lines.pdf'),
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
            const sheet = await pdf.getPage(i),
              content = await sheet.getTextContent();
            const items = content.items.filter(
              (item): item is typeof item & { str: string; transform: number[] } => 'str' in item,
            );
            text += items.map((item) => item.str).join(' ');
            const height = sheet.getViewport({ scale: 1 }).height;
            const atTop = items
              .filter((item) => item.transform[5] > height - (15 * 72) / 25.4)
              .map((item) => item.str)
              .join(' ');
            const atBottom = items
              .filter((item) => item.transform[5] < (15 * 72) / 25.4)
              .map((item) => item.str)
              .join(' ');
            if (i > 1) {
              if (showRunningHeader) expect(atTop).toContain('Lebenslauf');
              else expect(atTop.trim()).toBe('');
            }
            if (showFooter)
              expect(atBottom).toContain(
                `${String(i).padStart(2, '0')} / ${String(count).padStart(2, '0')}`,
              );
            else expect(atBottom.trim()).toBe('');
          }
          for (const section of ['education', 'experience', 'projects'] as const)
            for (const entry of project.cv[section])
              expect(text.replace(/\s/g, '')).toContain(entry.organization.replace(/\s/g, ''));
          for (const skill of project.cv.skills) expect(text).toContain(skill.name);
          const sheet = await pdf.getPage(2),
            viewport = sheet.getViewport({ scale: 1.25 });
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
          await sheet.render({ canvas, canvasContext, viewport }).promise;
          await writeFile(info.outputPath('continuation.png'), canvas.toBuffer('image/png'));
        } finally {
          await task.destroy();
        }
      } finally {
        await printed.close();
      }
      await page.evaluate(() =>
        document
          .querySelector<HTMLIFrameElement>('iframe[data-cv-print]')
          ?.contentWindow?.dispatchEvent(new Event('afterprint')),
      );
    });
  }
