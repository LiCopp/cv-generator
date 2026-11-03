import { expect, test, type Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createProject, makeReference } from '../packages/core/src/fixtures';
import { parseProject, type Project } from '../packages/core/src/schema';
import { openPrintHost } from './print-host';

async function openProject(page: Page, project: Project) {
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'references.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
}

test('reference persons can be edited, sorted, validated, moved, hidden and restored from JSON', async ({
  page,
}, info) => {
  const project = createProject('student');
  project.cv.title = 'Referenzen bearbeiten';
  await openProject(page, project);
  await expect(page.locator('.cv-page [data-block-id="heading-references"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Referenzen', exact: true }).click();
  await page.getByRole('button', { name: 'Referenzperson hinzufügen', exact: true }).click();
  await expect(page.locator('.cv-page [data-block-id="heading-references"]')).toHaveCount(0);
  await page.getByLabel('Name der Referenzperson', { exact: true }).fill('Robin Beispiel');
  await page.getByLabel('Funktion (optional)', { exact: true }).fill('Teamleitung');
  await page.getByLabel('Organisation (optional)', { exact: true }).fill('Beispiel AG');
  const email = page.getByLabel('E-Mail der Referenzperson', { exact: true });
  await email.fill('ungültig');
  await expect(page.getByRole('button', { name: 'PDF exportieren', exact: true })).toBeDisabled();
  await email.fill('robin@example.com');
  await page.getByLabel('Telefon der Referenzperson', { exact: true }).fill('+41 44 555 00 11');
  await page.getByLabel('Strasse und Hausnummer (optional)', { exact: true }).fill('Musterweg 8');
  await page.getByLabel('PLZ und Ort (optional)', { exact: true }).fill('8000 Zürich');
  await expect(
    page.locator('.cv-page .cv-sidebar [data-block-id="heading-references"]'),
  ).toHaveCount(1);
  await expect(page.locator('.cv-page .cv-reference-name')).toHaveText('Robin Beispiel');
  await expect(page.locator('.cv-page [data-section="references"] svg')).toHaveCount(3);
  await page.getByRole('button', { name: 'Referenzperson hinzufügen', exact: true }).click();
  await page.getByLabel('Name der Referenzperson', { exact: true }).nth(1).fill('Sam Muster');
  await page
    .getByLabel('Telefon der Referenzperson', { exact: true })
    .nth(1)
    .fill('+41 31 555 00 22');
  await page.getByRole('button', { name: 'Referenzperson 2 nach oben', exact: true }).click();
  await expect(page.locator('.cv-page .cv-reference-name')).toHaveText([
    'Sam Muster',
    'Robin Beispiel',
  ]);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Überschrift für Referenzen', exact: true })
    .fill('Kontaktpersonen');
  await page
    .getByRole('slider', { name: 'Schriftgrösse für Referenzen', exact: true })
    .press('End');
  await page.getByRole('button', { name: 'Referenzen nach oben', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Bereich für Referenzen', exact: true })
    .selectOption('main');
  await expect(
    page.locator('.cv-page .cv-main [data-block-id="heading-references"] h2'),
  ).toHaveText('Kontaktpersonen');
  await page
    .getByRole('combobox', { name: 'Bereich für Referenzen', exact: true })
    .selectOption('sidebar');
  const toggle = page.getByRole('switch', { name: 'Referenzen', exact: true });
  await toggle.uncheck();
  await expect(page.locator('.cv-page [data-section="references"]')).toHaveCount(0);
  await toggle.check();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('references.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.cv.schemaVersion).toBe(8);
  expect(saved.layout.schemaVersion).toBe(23);
  expect(saved.template.schemaVersion).toBe(2);
  expect(saved.cv.references.map((person) => person.name)).toEqual([
    'Sam Muster',
    'Robin Beispiel',
  ]);
  expect(saved.cv.references[1]).toMatchObject({
    role: 'Teamleitung',
    organization: 'Beispiel AG',
    email: 'robin@example.com',
    phone: '+41 44 555 00 11',
    address: 'Musterweg 8',
    city: '8000 Zürich',
  });
  expect(new Set(saved.cv.references.map((person) => person.id)).size).toBe(2);
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await expect(page.locator('.cv-page .cv-reference-name')).toHaveText([
    'Sam Muster',
    'Robin Beispiel',
  ]);
  saved.cv.title += ' importiert';
  await openProject(page, saved);
  await expect(
    page.locator('.cv-page .cv-sidebar [data-block-id="heading-references"] h2'),
  ).toHaveText('Kontaktpersonen');
  await page.getByRole('button', { name: 'Referenzen', exact: true }).click();
  await page.getByRole('button', { name: 'Referenzperson 1 löschen', exact: true }).click();
  await expect(page.locator('.cv-page .cv-reference-name')).toHaveText('Robin Beispiel');
});

for (const region of ['sidebar', 'main'] as const) {
  test(`references paginate in ${region} and preserve complete selectable PDF text`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    const project = createProject('adult');
    project.cv.title = `Referenzen PDF ${region}`;
    Object.assign(project.layout.appearance, {
      sidebarSide: region === 'sidebar' ? 'left' : 'right',
      sidebarPercent: 25,
      sectionDividers: true,
      fontId: region === 'sidebar' ? 'source-sans' : 'lora',
    });
    project.layout.sections.find((section) => section.id === 'references')!.region = region;
    project.cv.references = Array.from({ length: 20 }, (_, i) =>
      makeReference({
        id: `person-${i}`,
        name: `Referenzperson ${i + 1}`,
        role: 'Leitung Zusammenarbeit',
        organization: `Referenzunternehmen ${i + 1}`,
        email: `person${i + 1}@example.com`,
        phone: `+41 44 555 ${String(i).padStart(4, '0')}`,
        address: 'Musterstrasse 12',
        city: '8000 Zürich',
      }),
    );
    project.cv.references.push(
      makeReference({
        id: 'long-person',
        name: 'Lange Referenzperson',
        role: 'Erfahrung und Zusammenarbeit '.repeat(10),
        organization: 'Interdisziplinäre Beispielorganisation '.repeat(7),
        address: 'Musteradresse für Rückfragen '.repeat(10),
        email: 'lange.person@example.com',
        phone: '+41 79 555 99 99',
      }),
      makeReference({ id: 'phone-only', phone: '+41 31 555 88 77' }),
      makeReference({ id: 'empty' }),
    );
    await openProject(page, project);
    const count = await page.locator('.cv-page').count();
    expect(count).toBeGreaterThanOrEqual(4);
    await expect(
      page.locator(`.cv-page .cv-${region} [data-block-id="heading-references"]`),
    ).toHaveCount(1);
    await expect(page.locator('.cv-page [data-block-id^="references-empty-"]')).toHaveCount(0);
    await expect(
      page.locator('.cv-page [data-block-id="references-phone-only-phone-0"]'),
    ).toContainText('+41 31 555 88 77');
    const ids = await page
      .locator('.cv-page [data-section="references"]')
      .evaluateAll((blocks) => blocks.map((block) => block.getAttribute('data-block-id')));
    const errors = await page.locator('.cv-page').evaluateAll((pages) =>
      pages.flatMap((page) => {
        const footer = page.querySelector('.cv-footer')!.getBoundingClientRect();
        return [...page.querySelectorAll<HTMLElement>('[data-section="references"]')]
          .filter(
            (block) =>
              block.getBoundingClientRect().bottom >= footer.top ||
              block.scrollWidth > block.clientWidth + 1,
          )
          .map((block) => block.dataset.blockId);
      }),
    );
    expect(errors).toEqual([]);
    // Normal contact cards stay on one page; very long cards can flow by field/chunk.
    const cardPages = await page
      .locator('.cv-page')
      .evaluateAll((pages) =>
        pages.map((page) =>
          [...page.querySelectorAll('[data-block-id^="references-person-"]')].map((block) =>
            block.getAttribute('data-block-id')!,
          ),
        ),
      );
    for (let i = 0; i < 20; i++)
      expect(
        cardPages.filter((ids) => ids.some((id) => id.startsWith(`references-person-${i}-`)))
          .length,
      ).toBe(1);
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
      expect(
        await printed
          .locator('.cv-page [data-section="references"]')
          .evaluateAll((blocks) => blocks.map((block) => block.getAttribute('data-block-id'))),
      ).toEqual(ids);
      const bytes = await printed.pdf({
        path: info.outputPath('references.pdf'),
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
        for (const person of project.cv.references)
          for (const value of [person.name, person.email, person.phone])
            if (value) expect(normalized).toContain(value.replace(/\s/g, ''));
        for (const section of ['education', 'experience', 'projects'] as const)
          for (const entry of project.cv[section])
            expect(normalized).toContain(entry.organization.replace(/\s/g, ''));
        const headingPage = await printed
          .locator('.cv-page')
          .evaluateAll((pages) =>
            pages.findIndex((page) => page.querySelector('[data-block-id="heading-references"]')),
          );
        const sheet = await pdf.getPage(headingPage + 1),
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
        await writeFile(info.outputPath('references.png'), canvas.toBuffer('image/png'));
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
