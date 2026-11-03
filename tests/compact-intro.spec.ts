import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createProject } from '../packages/core/src/fixtures';
import { parseProject, type Project } from '../packages/core/src/schema';
import { openPrintHost } from './print-host';

const compactLabel = 'Freien Platz bei ausgeblendetem Über mich nutzen';

async function openProject(page: Page, project: Project) {
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'compact.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
}

function geometry() {
  const zoomText = getComputedStyle(document.querySelector('.preview-scale') ?? document.body).zoom;
  const zoom = zoomText.endsWith('%') ? parseFloat(zoomText) / 100 : parseFloat(zoomText) || 1;
  return [...document.querySelectorAll('.cv-page')].map((page) => {
    const origin = page.getBoundingClientRect();
    const rect = (element: Element) => {
      const box = element.getBoundingClientRect();
      return { top: (box.top - origin.top) / zoom, bottom: (box.bottom - origin.top) / zoom };
    };
    return {
      blocks: [...page.querySelectorAll<HTMLElement>('.cv-block')].map((block) => ({
        id: block.dataset.blockId!,
        ...rect(block),
      })),
      footer: rect(page.querySelector('.cv-footer')!),
      header: rect(page.querySelector('.cv-header-shell, .cv-running-header')!),
    };
  });
}

test('optional compact flow updates immediately, survives save/import and yields to a visible summary', async ({
  page,
}, info) => {
  const project = createProject('student');
  project.cv.title = 'Optionaler freier Platz';
  await openProject(page, project);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  const compact = page.getByRole('switch', { name: compactLabel, exact: true });
  await expect(compact).not.toBeChecked();
  const summary = page.getByRole('switch', { name: 'Über mich', exact: true });
  await summary.uncheck();
  await expect(page.locator('.cv-page [data-section="summary"]')).toHaveCount(0);
  const before = await page.evaluate(geometry);
  const initialEducation = before[0].blocks.find((block) => block.id === 'heading-education')!;
  await compact.check();
  await expect(page.locator('.cv-page .cv-intro-row')).toHaveCount(0);
  await expect
    .poll(async () => {
      const first = (await page.evaluate(geometry))[0];
      return first.blocks.find((block) => block.id === 'heading-education')!.top;
    })
    .toBeLessThan(initialEducation.top - 20);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('compact.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.layout.appearance.compactWithoutSummary).toBe(true);
  expect(saved.cv).toEqual(project.cv);
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(compact).toBeChecked();
  await expect(page.locator('.cv-page .cv-intro-row')).toHaveCount(0);
  saved.cv.title = 'Kompaktes Layout importiert';
  await openProject(page, saved);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(compact).toBeChecked();
  await compact.uncheck();
  await expect(page.locator('.cv-page .cv-intro-row')).toHaveCount(1);
  await expect
    .poll(
      async () =>
        (await page.evaluate(geometry))[0].blocks.find((block) => block.id === 'heading-education')!
          .top,
    )
    .toBeCloseTo(initialEducation.top, 1);
  await compact.check();
  await summary.check();
  await expect(page.locator('.cv-page .cv-intro-row [data-section="summary"]')).not.toHaveCount(0);
  await page
    .getByRole('combobox', { name: 'Bereich für Über mich', exact: true })
    .selectOption('sidebar');
  await expect(
    page.locator('.cv-page .cv-intro-row .cv-sidebar [data-section="summary"]'),
  ).not.toHaveCount(0);
});

test('compact flow handles empty summary/contact, contact-only documents and a sidebar starting on a later page', async ({
  page,
}) => {
  for (const scenario of ['empty-summary', 'no-contact', 'contact-only', 'sidebar-continuation']) {
    const project = createProject(scenario === 'no-contact' ? 'blank' : 'student');
    project.cv.title = `Kompakter Einstieg ${scenario}`;
    project.cv.summary = '';
    project.layout.appearance.compactWithoutSummary = true;
    if (scenario === 'no-contact') project.cv.education = createProject('student').cv.education;
    if (scenario === 'contact-only')
      project.layout.sections.forEach((section) => {
        section.enabled = false;
      });
    if (scenario === 'sidebar-continuation') {
      project.layout.sections.forEach((section) => {
        section.enabled = section.id === 'education' || section.id === 'experience';
        if (section.id === 'education') section.region = 'sidebar';
      });
      Object.assign(project.layout.appearance, {
        sidebarPercent: 25,
        headerContentGapMm: 30,
        introBodyGapMm: 30,
        contactSpacingMm: 8,
        contactLineHeight: 2.4,
        sectionDividers: true,
        introDividerSpacingBeforeMm: 15,
        introDividerSpacingAfterMm: 15,
      });
      project.cv.contact.website = 'portfolio.example';
      project.cv.contact.maritalStatus = 'ledig';
    }
    await openProject(page, project);
    await expect(page.locator('.cv-page .cv-intro-row')).toHaveCount(0);
    const pages = await page.evaluate(geometry);
    for (const physicalPage of pages)
      for (const block of physicalPage.blocks)
        expect(block.bottom, `${scenario}: ${block.id}`).toBeLessThanOrEqual(
          physicalPage.footer.top + 0.5,
        );
    if (
      scenario === 'no-contact' ||
      scenario === 'contact-only' ||
      scenario === 'sidebar-continuation'
    )
      await expect(page.locator('.cv-page .cv-local-intro-transition')).toHaveCount(0);
    if (scenario === 'sidebar-continuation') {
      expect(pages[0].blocks.some((block) => block.id === 'heading-experience')).toBe(true);
      expect(
        pages.findIndex((physicalPage) =>
          physicalPage.blocks.some((block) => block.id === 'heading-education'),
        ),
      ).toBeGreaterThan(0);
    }
  }
});

for (const kind of ['student', 'adult'] as const)
  for (const sidebarSide of ['left', 'right'] as const)
    for (const sectionDividers of [false, true])
      test(`compact ${kind}, sidebar ${sidebarSide}, dividers ${sectionDividers}: preview and actual PDF`, async ({
        page,
        context,
      }, info) => {
        await page.addInitScript(() => {
          window.print = () => {
            document.documentElement.dataset.printRequested = 'true';
          };
        });
        const project = createProject(kind);
        if (kind === 'student') {
          project.cv.skills = project.cv.skills.slice(0, 2);
          project.cv.interests = project.cv.interests.slice(0, 1);
        }
        project.cv.title = `Kompakt ${kind} ${sidebarSide} ${sectionDividers}`;
        project.layout.sections.find((section) => section.id === 'summary')!.enabled = false;
        Object.assign(project.layout.appearance, {
          compactWithoutSummary: true,
          sidebarSide,
          sectionDividers,
          fontId: kind === 'student' ? 'dm-sans' : 'lora',
        });
        await openProject(page, project);
        await expect(
          page.locator('.cv-page .cv-intro-row, .cv-page .cv-intro-transition'),
        ).toHaveCount(0);
        const preview = await page.evaluate(geometry);
        const mainHeading = kind === 'adult' ? 'heading-experience' : 'heading-education';
        const mainTop = preview[0].blocks.find((block) => block.id === mainHeading)!.top;
        const contactTop = preview[0].blocks.find((block) => block.id === 'contact-heading')!.top;
        expect(mainTop).toBeCloseTo(contactTop, 1);
        expect(mainTop - preview[0].header.bottom).toBeCloseTo(
          (project.layout.appearance.headerContentGapMm * 96) / 25.4,
          1,
        );
        for (const physicalPage of preview)
          for (const block of physicalPage.blocks)
            expect(block.bottom, block.id).toBeLessThanOrEqual(physicalPage.footer.top + 0.5);
        if (kind === 'student') expect(preview).toHaveLength(1);
        if (kind === 'adult') expect(preview.length).toBeGreaterThanOrEqual(4);
        await expect(
          page.locator('.cv-page .cv-local-intro-transition .cv-wide-divider'),
        ).toHaveCount(sectionDividers ? 1 : 0);
        await page.getByRole('button', { name: 'PDF exportieren', exact: true }).click();
        const frameLocator = page.frameLocator('iframe[data-cv-print]');
        await expect(frameLocator.locator('html')).toHaveAttribute('data-print-requested', 'true');
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
          const printGeometry = await printed.evaluate(geometry);
          expect(printGeometry).toHaveLength(preview.length);
          for (const [i, physicalPage] of printGeometry.entries()) {
            expect(physicalPage.blocks.map((block) => block.id)).toEqual(
              preview[i].blocks.map((block) => block.id),
            );
            for (const [j, block] of physicalPage.blocks.entries())
              expect(Math.abs(block.top - preview[i].blocks[j].top), block.id).toBeLessThan(1.5);
          }
          const bytes = await printed.pdf({
            path: info.outputPath('compact.pdf'),
            format: 'A4',
            preferCSSPageSize: true,
            printBackground: true,
          });
          const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
          try {
            const pdf = await task.promise;
            expect(pdf.numPages).toBe(preview.length);
            const pageTexts: string[] = [];
            for (let i = 1; i <= pdf.numPages; i++)
              pageTexts.push(
                (await (await pdf.getPage(i)).getTextContent()).items
                  .flatMap((item) => ('str' in item ? [item.str] : []))
                  .join(''),
              );
            const text = pageTexts.join('').replace(/\s/g, '');
            for (const section of ['education', 'experience', 'projects'] as const)
              for (const entry of project.cv[section]) {
                expect(text).toContain(entry.title.replace(/\s/g, ''));
                expect(text).toContain(entry.organization.replace(/\s/g, ''));
              }
            expect(text).not.toContain(project.cv.summary.replace(/\s/g, ''));
            expect(text).toContain(project.cv.contact.email);
            await printed.screenshot({
              path: info.outputPath('compact-print.png'),
              fullPage: true,
            });
          } finally {
            await task.destroy();
          }
        } finally {
          await printed.close();
        }
      });
