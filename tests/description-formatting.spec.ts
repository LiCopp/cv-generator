import { withoutNewReferences } from '../packages/core/src/legacy-test-fixtures';
import { expect, test, type Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createProject } from '../packages/core/src/fixtures';
import { escapeDescription, parseProject, type Project } from '../packages/core/src';
import { openPrintHost } from './print-host';

async function openProject(page: Page, project: unknown, title: string) {
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'description.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
}

for (const section of [
  { id: 'experience', label: 'Erfahrung' },
  { id: 'education', label: 'Ausbildung' },
  { id: 'projects', label: 'Projekte & Engagement' },
] as const) {
  test(`description toolbar, keyboard and JSON persistence: ${section.id}`, async ({
    page,
  }, info) => {
    const project = createProject('blank');
    project.cv.title = `Formatierung ${section.id}`;
    await openProject(page, project, project.cv.title);
    await page.getByRole('button', { name: section.label, exact: true }).click();
    await page.getByRole('button', { name: 'Eintrag hinzufügen', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Beschreibung (optional)', exact: true });
    await input.fill('Planung im Team\nUmsetzung mit Erfolg');
    await input.evaluate((element: HTMLTextAreaElement) => {
      element.focus();
      element.setSelectionRange(0, 7);
    });
    await page.getByRole('button', { name: 'Fett', exact: true }).click();
    await expect(input).toHaveValue('**Planung** im Team\nUmsetzung mit Erfolg');
    await input.evaluate((element: HTMLTextAreaElement) => {
      element.focus();
      element.select();
    });
    await page.getByRole('button', { name: 'Aufzählung', exact: true }).click();
    await expect(input).toHaveValue('- **Planung** im Team\n- Umsetzung mit Erfolg');
    await expect(page.locator('.cv-page ul.cv-description-list > li')).toHaveCount(2);
    await expect(page.locator('.cv-page strong')).toHaveText('Planung');
    await input.evaluate((element: HTMLTextAreaElement) => {
      element.focus();
      const start = element.value.indexOf('Erfolg');
      element.setSelectionRange(start, start + 6);
    });
    await input.press('Control+b');
    await expect(page.locator('.cv-page strong')).toHaveText(['Planung', 'Erfolg']);
    await input.evaluate((element: HTMLTextAreaElement) => {
      element.focus();
      element.setSelectionRange(element.value.length, element.value.length);
    });
    await input.press('Enter');
    await expect(input).toHaveValue('- **Planung** im Team\n- Umsetzung mit **Erfolg**\n- ');
    await input.press('Enter');
    await expect(input).toHaveValue('- **Planung** im Team\n- Umsetzung mit **Erfolg**\n');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
    const file = info.outputPath('formatted.json');
    await (await download).saveAs(file);
    const saved = parseProject(await readFile(file, 'utf8'));
    expect(saved.cv.schemaVersion).toBe(8);
    expect(saved.manifest.rendererVersion).toBe('1.28.0');
    expect(saved.cv[section.id][0].description).toBe(
      '- **Planung** im Team\n- Umsetzung mit **Erfolg**\n',
    );
    await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
    await page.reload();
    await expect(page.locator('.cv-page ul.cv-description-list > li')).toHaveCount(2);
    saved.cv.title += ' importiert';
    await openProject(page, saved, saved.cv.title);
    await expect(page.locator('.cv-page strong')).toHaveText(['Planung', 'Erfolg']);
    await expect(page.locator('.cv-page strong').first()).toHaveCSS('font-weight', '700');
  });
}

test('v4 descriptions keep literal punctuation and HTML text when migrated', async ({ page }) => {
  const project = createProject('student');
  project.cv.title = 'Wörtlicher alter Text';
  const description =
    '**Sternchen**\n- Bindestrich\n• Zeichen\n<script>window.descriptionInjected = true</script> C:\\Tools\\CV';
  project.cv.experience[0].description = description;
  const legacy = withoutNewReferences({ ...project, cv: { ...project.cv, schemaVersion: 4 } });
  await openProject(page, legacy, project.cv.title);
  const station = page.locator('.cv-page [data-block-id^="experience-experience-1-p"]');
  await expect(station).toHaveText(description.split('\n'));
  await expect(station.locator('strong, ul, script, img')).toHaveCount(0);
  expect(await page.evaluate(() => 'descriptionInjected' in window)).toBe(false);
  await page.getByRole('button', { name: 'Erfahrung', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: 'Beschreibung (optional)', exact: true }),
  ).toHaveValue(escapeDescription(description));
});

function geometry() {
  return [...document.querySelectorAll('.cv-page')].map((page) => {
    const sheet = page.getBoundingClientRect(),
      mm = sheet.height / 297;
    const columns = page.querySelector('.cv-columns')!.getBoundingClientRect();
    return [...page.querySelectorAll<HTMLElement>('.cv-block')].map((block) => {
      const rect = block.getBoundingClientRect();
      return {
        id: block.dataset.blockId,
        top: (rect.top - sheet.top) / mm,
        bottom: (rect.bottom - sheet.top) / mm,
        limit: (columns.bottom - sheet.top) / mm,
      };
    });
  });
}

for (const region of ['main', 'sidebar'] as const) {
  test(`long bold bullet crosses pages in ${region} with matching selectable PDF text`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    const project: Project = createProject('adult');
    project.cv.title = `Lange Aufzählung ${region}`;
    const section = region === 'main' ? 'experience' : 'projects';
    project.layout.sections.find((item) => item.id === section)!.region = region;
    Object.assign(project.layout.appearance, {
      sidebarSide: region === 'main' ? 'left' : 'right',
      fontId: region === 'main' ? 'dm-sans' : 'lora',
      showRunningHeader: false,
      showFooter: false,
    });
    const phrases = Array.from(
      { length: 65 },
      (_, i) => `Projektaufgabe${String(i + 1).padStart(3, '0')} gemeinsam erfolgreich umgesetzt.`,
    );
    project.cv[section][0].description =
      `Einleitung **Schwerpunkt**.\n- **FETTANFANG ${phrases.join(' ')} FETTENDE**\n- LISTENPUNKTZWEI mit **Ergebnis**\nAbschluss <img src=x onerror=alert(1)>`;
    await openProject(page, project, project.cv.title);
    const preview = await page.evaluate(geometry),
      count = preview.length;
    expect(count).toBeGreaterThanOrEqual(4);
    await expect(
      page.locator('.cv-page ul.cv-description-list > li:not(.cv-description-continuation)'),
    ).toHaveCount(2);
    expect(
      await page.locator('.cv-page li.cv-description-continuation strong').count(),
    ).toBeGreaterThan(5);
    const listPages = await page
      .locator('.cv-page')
      .evaluateAll(
        (pages) =>
          pages.filter((page) => page.querySelector('li.cv-description-continuation')).length,
      );
    expect(listPages).toBeGreaterThan(1);
    await expect(page.locator('.cv-page .cv-block img, .cv-page .cv-block script')).toHaveCount(0);
    for (const blocks of preview)
      for (const block of blocks) expect(block.bottom).toBeLessThanOrEqual(block.limit + 0.1);
    const markers = await page
      .locator('.cv-page li')
      .evaluateAll((items) =>
        items.map(
          (item) => getComputedStyle(item.querySelector('.cv-bullet-text')!, '::before').content,
        ),
      );
    expect(markers.filter((marker) => marker === '"•"')).toHaveLength(2);
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
      for (const [i, blocks] of actual.entries()) {
        expect(blocks.map((block) => block.id)).toEqual(preview[i].map((block) => block.id));
        for (const [j, block] of blocks.entries()) {
          expect(Math.abs(block.top - preview[i][j].top)).toBeLessThan(0.6);
          expect(block.bottom).toBeLessThanOrEqual(block.limit + 0.1);
        }
      }
      const bytes = await printed.pdf({
        path: info.outputPath('formatted.pdf'),
        format: 'A4',
        preferCSSPageSize: true,
        printBackground: true,
      });
      const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
      try {
        const pdf = await task.promise;
        expect(pdf.numPages).toBe(count);
        let text = '',
          normalFont = '',
          firstBoldFont = '',
          lastBoldFont = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          for (const item of (await (await pdf.getPage(i)).getTextContent()).items) {
            if (!('str' in item)) continue;
            text += item.str + ' ';
            if (item.str.includes('Einleitung')) normalFont = item.fontName;
            if (item.str.includes('FETTANFANG')) firstBoldFont = item.fontName;
            if (item.str.includes('FETTENDE')) lastBoldFont = item.fontName;
          }
        }
        expect(firstBoldFont).not.toBe('');
        expect(firstBoldFont).toBe(lastBoldFont);
        expect(firstBoldFont).not.toBe(normalFont);
        for (let i = 1; i <= phrases.length; i++)
          expect(text.split(`Projektaufgabe${String(i).padStart(3, '0')}`).length - 1).toBe(1);
        expect(text).toContain('LISTENPUNKTZWEI');
        expect(text).toContain('Abschluss <img src=x onerror=alert(1)>');
        expect(text).not.toContain('**');
        for (const id of ['education', 'experience', 'projects'] as const)
          for (const entry of project.cv[id])
            expect(text.replace(/\s/g, '')).toContain(entry.organization.replace(/\s/g, ''));
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
        await writeFile(info.outputPath('formatted.png'), canvas.toBuffer('image/png'));
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
}
