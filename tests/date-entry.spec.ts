import { expect, test, type Locator, type Page } from '@playwright/test';
import { createProject, makeEntry } from '../packages/core/src/fixtures';
import { parseProject, type Project } from '../packages/core/src/schema';
import { readFile } from 'node:fs/promises';

test.use({ locale: 'de-CH' });

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

async function typeDay(input: Locator, year: string) {
  await input.focus();
  for (let i = 0; i < 3; i++) await input.press('ArrowLeft');
  // The German document uses day/month/year segments; the year is typed last.
  await input.pressSequentially(`1502${year}`);
}

test('a birthday can be typed once from empty placeholders without losing day or month', async ({
  page,
}, info) => {
  await openProject(page, createProject('student'));
  const birthday = page.getByLabel('Geburtsdatum (optional)', { exact: true });
  await typeDay(birthday, '2000');
  await expect(birthday).toHaveValue('2000-02-15');
  await expect(page.locator('.cv-page [data-contact="birth-date"]')).toHaveText('15.02.2000');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('typed-birthday.json');
  await (await download).saveAs(file);
  expect(parseProject(await readFile(file, 'utf8')).cv.contact.birthDate).toEqual({
    year: 2000,
    month: 2,
    day: 15,
  });
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await expect(birthday).toHaveValue('2000-02-15');
  await birthday.fill('');
  await expect(page.locator('.cv-page [data-contact="birth-date"]')).toHaveCount(0);
});

test('station day and month inputs retain typed components while entering the year', async ({
  page,
}) => {
  const project = createProject('student');
  project.cv.experience = [makeEntry({ title: 'Datumeingabe' })];
  await openProject(page, project);
  await page.getByRole('button', { name: 'Erfahrung', exact: true }).click();
  const from = page.getByLabel('Von', { exact: true });
  await typeDay(from, '2024');
  await expect(from).toHaveValue('2024-02-15');
  await expect(page.locator('.cv-page [data-section="experience"] .cv-date')).toHaveText(
    '15.02.2024',
  );
  await page.getByLabel('Genauigkeit Bis', { exact: true }).selectOption('month');
  const until = page.getByLabel('Bis', { exact: true });
  await until.focus();
  await until.press('ArrowLeft');
  await until.pressSequentially('03');
  await until.press('ArrowRight');
  await until.pressSequentially('2025');
  await expect(until).toHaveValue('2025-03');
});

test('a partial year survives unrelated edits, blocks export, and completes without retyping other segments', async ({
  page,
}) => {
  const project = createProject('student');
  project.cv.contact.birthDate = { year: 1984, month: 2, day: 15 };
  await openProject(page, project);
  const birthday = page.getByLabel('Geburtsdatum (optional)', { exact: true });
  await birthday.focus();
  for (let i = 0; i < 3; i++) await birthday.press('ArrowLeft');
  for (let i = 0; i < 2; i++) await birthday.press('ArrowRight');
  await birthday.press('2');
  await expect(birthday).toHaveValue('0002-02-15');
  await page.getByLabel('Vorname', { exact: true }).fill('Mara');
  await expect(birthday).toHaveValue('0002-02-15');
  await expect(birthday).toHaveAttribute('data-calendar-date', '');
  expect(await birthday.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  await expect(birthday).toBeFocused();
  expect(downloads).toBe(0);
  await page.getByRole('button', { name: 'PDF exportieren', exact: true }).click();
  await expect(birthday).toBeFocused();
  await expect(page.locator('iframe[data-cv-print]')).toHaveCount(0);
  await birthday.focus();
  for (let i = 0; i < 2; i++) await birthday.press('ArrowRight');
  await birthday.pressSequentially('2000');
  await expect(birthday).toHaveValue('2000-02-15');
  await expect(page.locator('.cv-page [data-contact="birth-date"]')).toHaveText('15.02.2000');
});

test('import replaces an unfinished native date even when the stored date is still empty', async ({
  page,
}) => {
  const project = createProject('student');
  await openProject(page, project);
  const birthday = page.getByLabel('Geburtsdatum (optional)', { exact: true });
  await birthday.focus();
  for (let i = 0; i < 3; i++) await birthday.press('ArrowLeft');
  await birthday.pressSequentially('1502');
  expect(await birthday.evaluate((input: HTMLInputElement) => input.validity.badInput)).toBe(true);
  project.cv.title = 'Neues Projekt ohne Geburtsdatum';
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'empty-birthday.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(birthday).toHaveValue('');
  expect(await birthday.evaluate((input: HTMLInputElement) => input.validity.badInput)).toBe(false);
  project.cv.contact.birthDate = { year: 1990, month: 5, day: 19 };
  project.cv.title = 'Projekt mit Geburtsdatum';
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'birthday.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(birthday).toHaveValue('1990-05-19');
});
