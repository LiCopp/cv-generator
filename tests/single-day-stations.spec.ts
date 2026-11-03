import { expect, test } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFile } from 'node:fs/promises';
import { createProject, makeEntry } from '../packages/core/src/fixtures';
import { parseProject } from '../packages/core/src/schema';
import { openPrintHost } from './print-host';

test('single-day stations allow clearing the end date and survive save, reload, import and PDF', async ({
  page,
  context,
}, info) => {
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = 'true';
    };
  });
  const project = createProject('blank');
  project.cv.title = 'Einzelne Veranstaltungstage';
  const sections = [
    { id: 'education', label: 'Ausbildung', title: 'Informationsveranstaltung', day: 12 },
    { id: 'experience', label: 'Erfahrung', title: 'Schnuppertag', day: 13 },
    { id: 'projects', label: 'Projekte & Engagement', title: 'Projektworkshop', day: 14 },
  ] as const;
  for (const section of sections)
    project.cv[section.id] = [
      makeEntry({
        title: section.title,
        start: { year: 2026, month: 10, day: section.day },
        end: { year: 2026, month: 10, day: section.day },
      }),
    ];
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'single-days.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  for (const section of sections) {
    await page.getByRole('button', { name: section.label, exact: true }).click();
    const end = page.getByLabel('Bis', { exact: true });
    const clear = page.getByRole('button', { name: 'Enddatum entfernen', exact: true });
    await clear.click();
    await expect(end).toHaveValue('');
    await expect(
      page.getByText('Optional. Für einen einzelnen Tag leer lassen.', { exact: true }),
    ).toBeVisible();
    const date = page.locator(`.cv-page [data-section="${section.id}"] .cv-date`);
    await expect(date).toHaveText(`${section.day}.10.2026`);
    const ongoing = page.getByLabel('Bis heute / noch laufend', { exact: true });
    await expect(ongoing).not.toBeChecked();
    await ongoing.check();
    await expect(clear).toBeDisabled();
    await expect(date).toHaveText(`${section.day}.10.2026 – Heute`);
    await ongoing.uncheck();
    await expect(end).toHaveValue('');
    // Native backspace clears only one segment. The explicit action must also
    // remove an unfinished draft whose model value is already null.
    await end.focus();
    for (let i = 0; i < 3; i++) await end.press('ArrowLeft');
    await end.press('1');
    expect(await end.evaluate((input: HTMLInputElement) => input.validity.badInput)).toBe(true);
    await clear.click();
    expect(await end.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(true);
    await expect(date).toHaveText(`${section.day}.10.2026`);
  }
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('single-days.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  for (const section of sections) {
    expect(saved.cv[section.id][0].end).toBeNull();
    expect(saved.cv[section.id][0].current).toBe(false);
  }
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  for (const section of sections) {
    await page.getByRole('button', { name: section.label, exact: true }).click();
    await expect(page.getByLabel('Bis', { exact: true })).toHaveValue('');
  }
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles(file);
  for (const section of sections)
    await expect(page.locator(`.cv-page [data-section="${section.id}"] .cv-date`)).toHaveText(
      `${section.day}.10.2026`,
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
    const bytes = await printed.pdf({
      path: info.outputPath('single-days.pdf'),
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
    });
    const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
    try {
      const pdf = await task.promise;
      const text = (await (await pdf.getPage(1)).getTextContent()).items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      for (const section of sections) {
        expect(text).toContain(section.title);
        expect(text).toContain(`${section.day}.10.2026`);
      }
      expect(text).not.toContain('Heute');
      expect(text).not.toContain(' – ');
    } finally {
      await task.destroy();
    }
  } finally {
    await printed.close();
  }
});
