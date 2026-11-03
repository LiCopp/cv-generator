import { expect, test, type Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createProject } from '../packages/core/src/fixtures';
import {
  contactFieldIds,
  contactFieldLabels,
  parseProject,
  type Project,
} from '../packages/core/src/schema';
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
function withContacts(project: Project) {
  Object.assign(project.cv.contact, {
    birthDate: { year: 1984, month: 2, day: 29 },
    maritalStatus: 'Verheiratet',
    website: 'portfolio.example.com',
  });
}

test('independent controls and all contact positions survive saving, reload and import', async ({
  page,
}, info) => {
  const project = createProject('student');
  project.cv.title = 'Unabhängige Abstände';
  withContacts(project);
  project.cv.contact.website = '';
  await openProject(page, project);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  const desired = [...contactFieldIds].reverse(),
    current = [...contactFieldIds];
  for (const [index, id] of desired.entries()) {
    let position = current.indexOf(id);
    while (position > index) {
      await page
        .getByRole('button', { name: `${contactFieldLabels[id]} nach oben`, exact: true })
        .click();
      [current[position - 1], current[position]] = [current[position], current[position - 1]];
      position--;
    }
  }
  await expect(page.getByRole('button', { name: 'Website nach oben', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Geburtsdatum nach unten', exact: true }),
  ).toBeDisabled();
  expect(
    await page
      .locator('.cv-page [data-contact]')
      .evaluateAll((lines) => lines.map((line) => line.getAttribute('data-contact'))),
  ).toEqual(desired.filter((id) => id !== 'website'));
  await page.getByRole('switch', { name: 'Horizontale Trennlinien', exact: true }).check();
  const sliders = [
    ['Abstand oberhalb der Headerlinie', 'Home', '0'],
    ['Abstand unterhalb der Headerlinie', 'End', '15'],
    ['Abstand oberhalb der Trennlinien', 'End', '15'],
    ['Abstand unterhalb der Trennlinien', 'Home', '0'],
    ['Zeilenabstand Kontaktangaben', 'End', '2.4'],
    ['Abstand zwischen Kontaktangaben', 'End', '8'],
  ] as const;
  for (const [label, key, value] of sliders) {
    const control = page.getByRole('slider', { name: label, exact: true });
    await control.press(key);
    await expect(control).toHaveAttribute('aria-valuenow', value);
  }
  await page.getByText('Stationskopf: Datum, Titel & Arbeitgeber', { exact: true }).click();
  for (const [label, key, value] of [
    ['Zeilenabstand Datum', 'End', '2.4'],
    ['Zeilenabstand Stationstitel', 'Home', '1'],
    ['Zeilenabstand Arbeitgeber / Institution', 'End', '2.4'],
    ['Abstand nach Datum', 'End', '8'],
    ['Abstand vor Arbeitgeber / Institution', 'Home', '0'],
  ] as const) {
    const control = page.getByRole('slider', { name: label, exact: true });
    await control.press(key);
    await expect(control).toHaveAttribute('aria-valuenow', value);
  }
  await page.getByRole('slider', { name: 'Zeilenabstand', exact: true }).press('End');
  await expect(page.locator('.cv-page [data-contact="birth-date"] svg')).toHaveClass(/lucide-cake/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('independent-spacing.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.layout.schemaVersion).toBe(23);
  expect(saved.manifest.rendererVersion).toBe('1.28.0');
  expect(saved.cv).toEqual(project.cv);
  expect(saved.layout.appearance).toMatchObject({
    contactOrder: desired,
    contactLineHeight: 2.4,
    contactSpacingMm: 8,
    introDividerSpacingBeforeMm: 0,
    introDividerSpacingAfterMm: 15,
    dividerSpacingBeforeMm: 15,
    dividerSpacingAfterMm: 0,
    lineHeight: 1.8,
    stationDateLineHeight: 2.4,
    stationTitleLineHeight: 1,
    stationOrganizationLineHeight: 2.4,
    stationDateTitleGapMm: 8,
    stationTitleOrganizationGapMm: 0,
    stationSpacingMm: 1.5,
  });
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(
    page.getByRole('slider', { name: 'Zeilenabstand Kontaktangaben', exact: true }),
  ).toHaveAttribute('aria-valuenow', '2.4');
  expect(
    await page
      .getByRole('list', { name: 'Reihenfolge der Kontaktangaben', exact: true })
      .locator('li > span')
      .allTextContents(),
  ).toEqual(desired.map((id) => contactFieldLabels[id]));
  saved.cv.title += ' importiert';
  await openProject(page, saved);
  await page
    .getByLabel('Website oder Portfolio (optional)', { exact: true })
    .fill('portfolio.example.com');
  expect(
    await page
      .locator('.cv-page [data-contact]')
      .evaluateAll((lines) => lines.map((line) => line.getAttribute('data-contact'))),
  ).toEqual(desired);
});

function geometry() {
  return [...document.querySelectorAll('.cv-page')].map((page) => {
    const sheet = page.getBoundingClientRect(),
      mm = sheet.height / 297;
    const columns = page.querySelector('.cv-columns')!.getBoundingClientRect();
    return [...page.querySelectorAll<HTMLElement>('.cv-block, .cv-wide-divider')].map((block) => {
      const box = block.getBoundingClientRect();
      return {
        id: block.dataset.blockId ?? 'wide-divider',
        top: (box.top - sheet.top) / mm,
        left: (box.left - sheet.left) / mm,
        bottom: (box.bottom - sheet.top) / mm,
        limit: (columns.bottom - sheet.top) / mm,
      };
    });
  });
}

for (const kind of ['student', 'adult'] as const) {
  test(`independent header/contact/station spacing matches actual PDF: ${kind}`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    const project = createProject(kind);
    project.cv.title = `Getrennte Abstände ${kind}`;
    withContacts(project);
    Object.assign(project.layout.appearance, {
      sectionDividers: true,
      introDividerSpacingBeforeMm: 1,
      introDividerSpacingAfterMm: 11,
      dividerSpacingBeforeMm: 12,
      dividerSpacingAfterMm: 0,
      contactOrder: ['phone', 'birth-date', 'email', 'website', 'address', 'marital-status'],
      contactLineHeight: 2.1,
      contactSpacingMm: 3.3,
      stationDateLineHeight: 1.9,
      stationTitleLineHeight: 1.8,
      stationOrganizationLineHeight: 1.7,
      stationDateTitleGapMm: 2.5,
      stationTitleOrganizationGapMm: 3,
      sidebarSide: kind === 'adult' ? 'right' : 'left',
      fontId: kind === 'adult' ? 'lora' : 'dm-sans',
    });
    if (kind === 'adult') {
      project.layout.sections.find((section) => section.id === 'education')!.region = 'sidebar';
      project.cv.education[0].title =
        'Weiterbildung in Gestaltung, Organisation und digitaler Zusammenarbeit';
      project.cv.education[0].organization =
        'Beispiel-Fachhochschule für interdisziplinäre Weiterbildung';
    }
    await openProject(page, project);
    const preview = await page.evaluate(geometry),
      count = preview.length;
    if (kind === 'adult') expect(count).toBeGreaterThanOrEqual(4);
    for (const blocks of preview)
      for (const block of blocks) expect(block.bottom).toBeLessThanOrEqual(block.limit + 0.1);
    const styles = await page.locator('.cv-measure').evaluate((root) => {
      const style = (selector: string) => getComputedStyle(root.querySelector(selector)!);
      const ratio = (selector: string) =>
        parseFloat(style(selector).lineHeight) / parseFloat(style(selector).fontSize);
      return {
        headerBefore: parseFloat(style('.cv-wide-divider').paddingTop),
        headerAfter: parseFloat(style('.cv-wide-divider').paddingBottom),
        localBefore: parseFloat(style('.cv-section-divider').paddingTop),
        localAfter: parseFloat(style('.cv-section-divider').paddingBottom),
        contact: ratio('.cv-contact-line'),
        date: ratio('.cv-date'),
        title: ratio('.cv-entry-title h3'),
        organization: ratio('.cv-organization'),
        dateGap: parseFloat(style('.cv-date').marginBottom),
        titleGap: parseFloat(style('.cv-organization').paddingTop),
      };
    });
    for (const [key, value] of Object.entries({
      headerBefore: 1,
      headerAfter: 11,
      localBefore: 12,
      localAfter: 0,
      dateGap: 2.5,
      titleGap: 3,
    }))
      expect(styles[key as keyof typeof styles]).toBeCloseTo((value * 96) / 25.4, 1);
    for (const [key, value] of Object.entries({
      contact: 2.1,
      date: 1.9,
      title: 1.8,
      organization: 1.7,
    }))
      expect(styles[key as keyof typeof styles]).toBeCloseTo(value, 2);
    expect(
      await page
        .locator('.cv-page [data-contact]')
        .evaluateAll((lines) => lines.map((line) => line.getAttribute('data-contact'))),
    ).toEqual(project.layout.appearance.contactOrder);
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
      await expect(printed.locator('[data-contact="birth-date"] svg')).toHaveClass(/lucide-cake/);
      const bytes = await printed.pdf({
        path: info.outputPath('independent-spacing.pdf'),
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
        const contactValues = [
          project.cv.contact.phone,
          '29.02.1984',
          project.cv.contact.email,
          project.cv.contact.website,
          project.cv.contact.address,
          project.cv.contact.maritalStatus,
        ];
        const positions = contactValues.map((value) =>
          normalized.indexOf(value.replace(/\s/g, '')),
        );
        expect(positions.every((position) => position >= 0)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        for (const section of ['education', 'experience', 'projects'] as const)
          for (const entry of project.cv[section])
            expect(normalized).toContain(entry.organization.replace(/\s/g, ''));
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
        await writeFile(info.outputPath('independent-spacing.png'), canvas.toBuffer('image/png'));
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
