import { expect, test, type Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createProject, makeEntry, makeSkill } from '../packages/core/src/fixtures';
import { parseProject, type Project } from '../packages/core/src/schema';
import { openPrintHost } from './print-host';

async function openProject(page: Page, project: Project) {
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'layout.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
}

test('name layout, independent left spacing and station order survive UI editing, reload and import', async ({
  page,
}, info) => {
  const project = createProject('student');
  project.cv.title = 'Name und Stationskopf';
  await openProject(page, project);
  await expect(page.locator('.cv-page h1 br')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await page.getByRole('combobox', { name: /^Namensdarstellung im Header/ }).click();
  await page
    .getByRole('option', { name: 'Vorname und Nachname nebeneinander', exact: true })
    .click();
  await expect(page.locator('.cv-page h1')).toHaveText('Lena Berger');
  await expect(page.locator('.cv-page h1 br')).toHaveCount(0);
  await page
    .getByRole('switch', { name: 'Eigener Zeilenabstand für die linke Spalte', exact: true })
    .check();
  const spacing = page.getByRole('slider', { name: 'Zeilenabstand linke Spalte', exact: true });
  await spacing.press('End');
  await page.getByRole('slider', { name: 'Zeilenabstand', exact: true }).press('Home');
  await expect(spacing).toHaveAttribute('aria-valuenow', '2.4');
  await page.getByText('Stationskopf: Datum, Titel & Arbeitgeber', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Jobtitel im Stationskopf nach oben', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Arbeitgeber / Institution im Stationskopf nach oben',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('button', { name: 'Jobtitel im Stationskopf nach oben', exact: true }),
  ).toBeDisabled();
  expect(
    await page
      .locator('.cv-page .cv-entry-title')
      .first()
      .locator(':scope > *')
      .evaluateAll((fields) => fields.map((field) => field.getAttribute('data-station-field'))),
  ).toEqual(['title', 'organization', 'date']);
  await expect(page.locator('.cv-page .cv-entry-title h3').first()).toHaveCSS('font-weight', '600');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('layout.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.layout.schemaVersion).toBe(23);
  expect(saved.manifest.rendererVersion).toBe('1.28.0');
  expect(saved.cv).toEqual(project.cv);
  expect(saved.layout.appearance).toMatchObject({
    headerNameLayout: 'inline',
    leftColumnLineHeight: 2.4,
    lineHeight: 0.9,
    stationHeadingOrder: ['title', 'organization', 'date'],
  });
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await expect(page.locator('.cv-page h1')).toHaveText('Lena Berger');
  saved.cv.title += ' importiert';
  await openProject(page, saved);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(spacing).toHaveAttribute('aria-valuenow', '2.4');
  await page
    .getByRole('switch', { name: 'Eigener Zeilenabstand für die linke Spalte', exact: true })
    .uncheck();
  await expect(page.locator('.cv-document')).toHaveCSS('--cv-left-line-height', '0.9');
});

test('all station orders apply to each station section and omit empty metadata without losing title emphasis', async ({
  page,
}) => {
  const project = createProject('student');
  const orders = [
    ['date', 'title', 'organization'],
    ['date', 'organization', 'title'],
    ['title', 'date', 'organization'],
    ['title', 'organization', 'date'],
    ['organization', 'date', 'title'],
    ['organization', 'title', 'date'],
  ] as const;
  for (const [index, order] of orders.entries()) {
    project.cv.title = `Stationsreihenfolge ${index}`;
    project.layout.appearance.stationHeadingOrder = [...order];
    await openProject(page, project);
    const rendered = await page
      .locator('.cv-page .cv-entry-title')
      .evaluateAll((heads) =>
        heads.map((head) =>
          [...head.children].map((field) => field.getAttribute('data-station-field')),
        ),
      );
    expect(rendered).toEqual([order, order, order]);
    for (const title of await page.locator('.cv-page .cv-entry-title h3').all())
      await expect(title).toHaveCSS('font-weight', '600');
  }
  project.cv.title = 'Station ohne Metadaten';
  project.cv.experience = [makeEntry({ title: 'Sichtbarer Jobtitel' })];
  await openProject(page, project);
  await expect(page.locator('.cv-page [data-section="experience"] .cv-entry-title')).toHaveText(
    'Sichtbarer Jobtitel',
  );
  await expect(
    page.locator(
      '.cv-page [data-section="experience"] .cv-date, .cv-page [data-section="experience"] .cv-organization',
    ),
  ).toHaveCount(0);
});

function geometry() {
  return [...document.querySelectorAll('.cv-page')].map((page) => {
    const box = page.getBoundingClientRect(),
      mm = box.height / 297;
    const limit = page.querySelector('.cv-columns')!.getBoundingClientRect().bottom;
    return [...page.querySelectorAll<HTMLElement>('.cv-block')].map((block) => ({
      id: block.dataset.blockId,
      top: (block.getBoundingClientRect().top - box.top) / mm,
      bottom: (block.getBoundingClientRect().bottom - box.top) / mm,
      limit: (limit - box.top) / mm,
    }));
  });
}

function introGeometry() {
  const page = document.querySelector('.cv-page')!,
    box = page.getBoundingClientRect(),
    mm = box.height / 297;
  return [...page.querySelectorAll('.cv-intro-row, .cv-intro-row .cv-block')].map((element) => {
    const rect = element.getBoundingClientRect();
    return { top: (rect.top - box.top) / mm, height: rect.height / mm };
  });
}

for (const sidebarSide of ['left', 'right'] as const) {
  test(`one-line name, physical left spacing and reordered stations match PDF with sidebar ${sidebarSide}`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    const project = createProject('adult');
    project.cv.title = `Linke Spalte ${sidebarSide}`;
    Object.assign(project.layout.appearance, {
      sidebarSide,
      headerNameLayout: 'inline',
      leftColumnLineHeight: null,
      lineHeight: 1.3,
      stationHeadingOrder: ['organization', 'title', 'date'],
      headerShiftUpMm: 5,
    });
    project.cv.skills = [
      makeSkill({
        id: 'skill-column',
        name: 'Zusammenarbeit',
        level: 'Gute Kenntnisse',
        description: 'Gemeinsam verständliche Lösungen entwickeln und Erfahrungen weitergeben.',
      }),
    ];
    project.layout.skills.showDescription = true;
    project.layout.sections.find((section) => section.id === 'education')!.region = 'sidebar';
    await openProject(page, project);
    const baselineIntro = await page.evaluate(introGeometry);
    project.layout.appearance.leftColumnLineHeight = 2.2;
    project.cv.title += ' angepasst';
    await openProject(page, project);
    const intro = await page.evaluate(introGeometry);
    expect(intro).toHaveLength(baselineIntro.length);
    for (const [i, block] of intro.entries()) {
      expect(Math.abs(block.top - baselineIntro[i].top)).toBeLessThan(0.01);
      expect(Math.abs(block.height - baselineIntro[i].height)).toBeLessThan(0.01);
    }
    const preview = await page.evaluate(geometry),
      count = preview.length;
    expect(count).toBeGreaterThanOrEqual(4);
    const ratios = await page
      .locator('.cv-page')
      .first()
      .evaluate((page) => {
        const ratio = (selector: string) => {
          const css = getComputedStyle(page.querySelector(selector)!);
          return parseFloat(css.lineHeight) / parseFloat(css.fontSize);
        };
        return {
          main: ratio('.cv-body-row .cv-main .cv-station > p'),
          summary: ratio('.cv-intro-row .cv-main p'),
          sidebar: ratio('.cv-skill-description'),
          contact: ratio('.cv-contact-line'),
          title: ratio('.cv-entry-title h3'),
          date: ratio('.cv-date'),
          organization: ratio('.cv-organization'),
        };
      });
    expect(ratios.summary).toBeCloseTo(1.3, 2);
    expect(ratios.main).toBeCloseTo(sidebarSide === 'right' ? 2.2 : 1.3, 2);
    expect(ratios.sidebar).toBeCloseTo(sidebarSide === 'left' ? 2.2 : 1.3, 2);
    expect(ratios.contact).toBeCloseTo(project.layout.appearance.contactLineHeight, 2);
    expect(ratios.title).toBeCloseTo(project.layout.appearance.stationTitleLineHeight, 2);
    await expect(page.locator('.cv-page h1 br')).toHaveCount(0);
    await expect(page.locator('.cv-page h1')).toHaveText('Alex Sommer');
    const name = await page.locator('.cv-page h1').evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      line: parseFloat(getComputedStyle(element).lineHeight),
      zoom: parseFloat(getComputedStyle(document.querySelector('.preview-scale')!).zoom),
    }));
    expect(Math.abs(name.height / name.zoom - name.line)).toBeLessThan(1);
    for (const blocks of preview)
      for (const block of blocks) expect(block.bottom).toBeLessThanOrEqual(block.limit + 0.1);
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
      const printedIntro = await printed.evaluate(introGeometry);
      expect(printedIntro).toHaveLength(intro.length);
      for (const [i, block] of printedIntro.entries()) {
        expect(Math.abs(block.top - intro[i].top)).toBeLessThan(0.6);
        expect(Math.abs(block.height - intro[i].height)).toBeLessThan(0.6);
      }
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
        path: info.outputPath('name-column-station.pdf'),
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
        expect(normalized).toContain('AlexSommer');
        for (const section of ['experience', 'education', 'projects'] as const)
          for (const entry of project.cv[section])
            expect(normalized).toContain(entry.organization.replace(/\s/g, ''));
        const first = project.cv.experience[0];
        expect(normalized.indexOf(first.organization.replace(/\s/g, ''))).toBeLessThan(
          normalized.indexOf(first.title.replace(/\s/g, '')),
        );
        expect(normalized.indexOf(first.title.replace(/\s/g, ''))).toBeLessThan(
          normalized.indexOf('01.01.2024'),
        );
        const sheet = await pdf.getPage(1),
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
        await writeFile(info.outputPath('name-column-station.png'), canvas.toBuffer('image/png'));
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

test('long inline names wrap safely with an overlapping photo instead of overflowing the page', async ({
  page,
}) => {
  await page.goto('/');
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    return canvas.toDataURL('image/png');
  });
  const project = createProject('student');
  project.cv.title = 'Langer Name mit Foto';
  project.cv.contact.firstName = 'Alexandra mit einem langen Vornamen';
  project.cv.contact.lastName = 'Beispiel mit einem langen Nachnamen';
  project.assets.photo = { mediaType: 'image/png', data };
  project.cv.contact.photoAssetId = 'photo';
  Object.assign(project.layout.appearance, {
    headerNameLayout: 'inline',
    showPhoto: true,
    photoSide: 'left',
    photoWidthMm: 60,
    photoOverlapMm: 20,
  });
  await openProject(page, project);
  const errors = await page.locator('.cv-page h1').evaluate((name) => {
    const box = name.getBoundingClientRect(),
      page = name.closest('.cv-page')!.getBoundingClientRect(),
      photo = name.closest('.cv-header-shell')!.querySelector('.cv-photo')!.getBoundingClientRect();
    return {
      overflow: name.scrollWidth > name.clientWidth + 1 || box.right > page.right + 1,
      intersects: box.left < photo.right && box.right > photo.left,
    };
  });
  expect(errors).toEqual({ overflow: false, intersects: false });
});
