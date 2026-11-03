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

function contactGeometry() {
  const zoomText = getComputedStyle(document.querySelector('.preview-scale') ?? document.body).zoom;
  const zoom = zoomText.endsWith('%') ? parseFloat(zoomText) / 100 : parseFloat(zoomText) || 1;
  const page = document.querySelector('.cv-page')!,
    origin = page.getBoundingClientRect();
  const box = (selector: string) => {
    const rect = page.querySelector(selector)!.getBoundingClientRect();
    return {
      top: (rect.top - origin.top) / zoom,
      left: (rect.left - origin.left) / zoom,
      height: rect.height / zoom,
    };
  };
  return {
    contact: box('.cv-contact-line'),
    summary: box('[data-block-id="heading-summary"] h2'),
    main: box('.cv-body-row .cv-main h2'),
    sidebar: box('.cv-body-row .cv-sidebar h2'),
  };
}

function contactIconGeometry() {
  return [...document.querySelectorAll('.cv-page .cv-contact-line')].map((line) => {
    const sheet = line.closest('.cv-page')!.getBoundingClientRect();
    const zoom = sheet.width / ((210 * 96) / 25.4);
    const svg = line.querySelector<SVGSVGElement>('.cv-contact-icon')!;
    const icon = svg.getBoundingClientRect();
    const text = line.querySelector('span')!;
    const box = text.getBoundingClientRect();
    const height = parseFloat(getComputedStyle(text).lineHeight) * zoom;
    let inkOffset: number | null = null;
    if (line.matches('[data-contact="birth-date"]')) {
      // An inline marker gives the actual baseline; canvas metrics describe the
      // visible digits rather than the line box's unused ascender/descender space.
      const marker = document.createElement('i');
      marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
      text.append(marker);
      const baseline = marker.getBoundingClientRect().top;
      marker.remove();
      const style = getComputedStyle(text);
      const context = document.createElement('canvas').getContext('2d')!;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = context.measureText(text.textContent!);
      const textCenter =
        baseline +
        ((metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) * zoom) / 2;
      const ink = svg.getBBox();
      const iconCenter =
        icon.top + ((ink.y + ink.height / 2) / svg.viewBox.baseVal.height) * icon.height;
      inkOffset = (iconCenter - textCenter) / zoom;
    }
    return {
      field: line.closest<HTMLElement>('[data-contact]')!.dataset.contact,
      offset: (icon.top + icon.height / 2 - (box.top + height / 2)) / zoom,
      inkOffset,
      wrapped: box.height > height * 1.5,
    };
  });
}

function expectContactAlignment(contacts: ReturnType<typeof contactIconGeometry>) {
  for (const contact of contacts)
    if (contact.field === 'birth-date')
      expect(Math.abs(contact.inkOffset!), 'birthday: visible digit and icon centres').toBeLessThan(
        0.5,
      );
    else expect(Math.abs(contact.offset), contact.field).toBeLessThan(0.1);
}

test('contact icons align with the first text line and birthday digits across fonts and line heights', async ({
  page,
}) => {
  const project = createProject('student');
  project.cv.contact.birthDate = { year: 2000, month: 2, day: 29 };
  for (const fontId of ['dm-sans', 'source-sans', 'lora'] as const)
    for (const lineHeight of [1, 2.4]) {
      project.cv.title = `Kontaktsymbole ${fontId} ${lineHeight}`;
      Object.assign(project.layout.appearance, {
        fontId,
        contactLineHeight: lineHeight,
        sidebarSide: lineHeight === 1 ? 'left' : 'right',
      });
      await openProject(page, project);
      const contacts = await page.evaluate(contactIconGeometry);
      expect(contacts.some((contact) => contact.field === 'birth-date')).toBe(true);
      expect(contacts.find((contact) => contact.field === 'address')!.wrapped).toBe(true);
      expectContactAlignment(contacts);
    }
});

test('optional birthday and hidden heading survive save, reload and import without losing heading settings', async ({
  page,
}, info) => {
  const project = createProject('student');
  project.cv.title = 'Geburtsdatum und Kontaktüberschrift';
  await openProject(page, project);
  const birthday = page.getByLabel('Geburtsdatum (optional)', { exact: true });
  await expect(birthday).toHaveValue('');
  await expect(page.locator('.cv-page [data-contact="birth-date"]')).toHaveCount(0);
  await birthday.fill('2000-02-29');
  await expect(page.locator('.cv-page [data-contact="birth-date"]')).toHaveText('29.02.2000');
  await expect(page.locator('.cv-page [data-contact="birth-date"] time')).toHaveAttribute(
    'datetime',
    '2000-02-29',
  );
  await expect(page.locator('.cv-page [data-contact="birth-date"] .cv-contact-icon')).toHaveCount(
    1,
  );
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  const title = page.getByRole('textbox', { name: 'Überschrift für Kontakt', exact: true });
  const size = page.getByRole('slider', { name: 'Schriftgrösse für Kontakt', exact: true });
  const toggle = page.getByRole('switch', { name: 'Kontaktüberschrift anzeigen', exact: true });
  await title.fill('Persönliche Angaben');
  await size.press('End');
  await toggle.uncheck();
  await expect(page.locator('.cv-page [data-block-id="contact-heading"]')).toHaveCount(0);
  await expect(title).toBeDisabled();
  await expect(size).toBeDisabled();
  const geometry = await page.evaluate(contactGeometry);
  expect(geometry.contact.top).toBeCloseTo(geometry.summary.top, 1);
  expect(geometry.main.top).toBeCloseTo(geometry.sidebar.top, 1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('birthday.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.cv.contact.birthDate).toEqual({ year: 2000, month: 2, day: 29 });
  expect(saved.layout.appearance.showContactHeading).toBe(false);
  expect(saved.layout.appearance.sectionHeadings.contact).toEqual({
    title: 'Persönliche Angaben',
    fontSizePt: 20,
  });
  expect(saved.cv).toEqual({
    ...project.cv,
    contact: { ...project.cv.contact, birthDate: { year: 2000, month: 2, day: 29 } },
  });
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await expect(birthday).toHaveValue('2000-02-29');
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(page.locator('.cv-page [data-block-id="contact-heading"] h2')).toHaveText(
    'Persönliche Angaben',
  );
  await expect(size).toHaveAttribute('aria-valuenow', '20');
  await page.getByRole('tab', { name: 'Inhalt', exact: true }).click();
  await birthday.fill('');
  await expect(page.locator('.cv-page [data-contact="birth-date"]')).toHaveCount(0);
  saved.cv.title = 'Geburtsdatum importiert';
  await openProject(page, saved);
  await expect(page.locator('.cv-page [data-block-id="contact-heading"]')).toHaveCount(0);
  await expect(page.locator('.cv-page [data-contact="birth-date"]')).toHaveText('29.02.2000');
});

for (const side of ['left', 'right'] as const) {
  test(`hidden contact heading aligns with summary and birthday remains readable in PDF: ${side}`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    const project = createProject(side === 'left' ? 'student' : 'adult');
    project.cv.title = `Kontakt ohne Titel ${side}`;
    project.cv.contact.birthDate = { year: 1984, month: 2, day: 29 };
    Object.assign(project.layout.appearance, {
      showContactHeading: false,
      sectionDividers: side === 'right',
      sidebarSide: side,
      fontId: side === 'left' ? 'dm-sans' : 'lora',
      contactLineHeight: side === 'left' ? 1 : 2.4,
    });
    project.layout.appearance.sectionHeadings.contact = {
      title: 'Ausgeblendete Überschrift',
      fontSizePt: 20,
    };
    project.layout.appearance.sectionHeadings.summary.fontSizePt = 14;
    await openProject(page, project);
    const preview = await page.evaluate(contactGeometry),
      count = await page.locator('.cv-page').count();
    const previewIcons = await page.evaluate(contactIconGeometry);
    expectContactAlignment(previewIcons);
    expect(preview.contact.top).toBeCloseTo(preview.summary.top, 1);
    expect(preview.main.top).toBeCloseTo(preview.sidebar.top, 1);
    await expect(page.locator('.cv-page [data-block-id="contact-heading"]')).toHaveCount(0);
    if (side === 'right') expect(count).toBeGreaterThanOrEqual(4);
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
      const printGeometry = await printed.evaluate(contactGeometry);
      const printIcons = await printed.evaluate(contactIconGeometry);
      expect(printIcons.map((icon) => icon.field)).toEqual(previewIcons.map((icon) => icon.field));
      // At this small font size, canvas ink metrics round differently at preview
      // zoom and in print. Compare physical icon placement for print parity.
      for (const [index, icon] of printIcons.entries())
        expect(Math.abs(icon.offset - previewIcons[index].offset), icon.field).toBeLessThan(0.1);
      for (const key of ['contact', 'summary', 'main', 'sidebar'] as const)
        for (const value of ['top', 'left', 'height'] as const)
          expect(
            Math.abs(printGeometry[key][value] - preview[key][value]),
            `${key} ${value}`,
          ).toBeLessThan(1.5);
      expect(printGeometry.contact.top).toBeCloseTo(printGeometry.summary.top, 1);
      const bytes = await printed.pdf({
        path: info.outputPath('contact-birthday.pdf'),
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
        expect(text).toContain('29.02.1984');
        expect(text.toUpperCase()).not.toContain('AUSGEBLENDETE ÜBERSCHRIFT');
        for (const section of ['education', 'experience', 'projects'] as const)
          for (const entry of project.cv[section])
            expect(text.replace(/\s/g, '')).toContain(entry.organization.replace(/\s/g, ''));
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
        const { canvas, context: canvasContext } = factory.create(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height),
        );
        await first.render({ canvas, canvasContext, viewport }).promise;
        await writeFile(info.outputPath('contact-birthday.png'), canvas.toBuffer('image/png'));
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

test('a birthday-only contact renders without a heading and an empty contact stays absent', async ({
  page,
}) => {
  const project = createProject('blank');
  project.cv.title = 'Nur Geburtsdatum';
  project.cv.contact.birthDate = { year: 2000, month: 1, day: 1 };
  project.layout.appearance.showContactHeading = false;
  await openProject(page, project);
  await expect(page.locator('.cv-page .cv-contact-line')).toHaveCount(1);
  await expect(page.locator('.cv-page [data-contact="birth-date"]')).toHaveText('01.01.2000');
  await expect(page.locator('.cv-page [data-block-id="contact-heading"]')).toHaveCount(0);
  project.cv.contact.birthDate = null;
  project.layout.appearance.showContactHeading = true;
  project.cv.title = 'Keine Kontaktangaben';
  await openProject(page, project);
  await expect(page.locator('.cv-page [data-section="contact"]')).toHaveCount(0);
});
