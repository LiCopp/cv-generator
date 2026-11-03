import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createProject } from '../packages/core/src/fixtures';
import { parseProject } from '../packages/core/src/schema';

async function openDesigner(page: Page) {
  const project = createProject('student');
  project.cv.title = 'Navigation im Designer';
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'designer.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  return project;
}

test('design groups collapse independently and together without changing the document or losing inputs', async ({
  page,
}, info) => {
  const project = await openDesigner(page);
  await expect(page.locator('.design-group[open]')).toHaveCount(5);
  const originalPreview = await page.locator('.cv-document').innerHTML();
  await page.getByRole('button', { name: 'Alle einklappen', exact: true }).click();
  await expect(page.locator('.design-group[open]')).toHaveCount(0);
  await expect(page.locator('.design-toggle-status')).toHaveText('0 von 5 Bereichen geöffnet');
  await expect(page.getByLabel('Eigene Akzentfarbe', { exact: true })).not.toBeVisible();
  expect(await page.locator('.cv-document').innerHTML()).toBe(originalPreview);
  const header = page.getByRole('button', { name: 'Header', exact: true });
  await header.focus();
  await header.press('Enter');
  await expect(page.locator('.design-group[open]')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Header', exact: true })).toBeVisible();
  await page.getByLabel('Eigene Akzentfarbe', { exact: true }).fill('#317b86');
  await expect(page.locator('.cv-document')).toHaveCSS('--cv-accent', '#317b86');
  await header.focus();
  await header.press('Space');
  await expect(page.locator('.design-group[open]')).toHaveCount(0);
  await header.press('Tab');
  await expect(page.locator('#design-typography-summary')).toBeFocused();
  await page.getByRole('button', { name: 'Alle ausklappen', exact: true }).click();
  await expect(page.locator('.design-group[open]')).toHaveCount(5);
  await expect(page.getByLabel('Eigene Akzentfarbe', { exact: true })).toHaveValue('#317b86');
  const editedPreview = await page.locator('.cv-document').innerHTML();
  await page.getByRole('button', { name: 'Alle einklappen', exact: true }).click();
  await expect(page.locator('.design-group[open]')).toHaveCount(0);
  expect(await page.locator('.cv-document').innerHTML()).toBe(editedPreview);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('designer.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved).toEqual({
    ...project,
    layout: { ...project.layout, appearance: { ...project.layout.appearance, accent: '#317b86' } },
  });
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.getByRole('tab', { name: 'Inhalt', exact: true }).click();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(page.locator('.design-group[open]')).toHaveCount(0);
  await header.click();
  await expect(page.locator('.design-group[open]')).toHaveCount(1);
  await page.reload();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(page.locator('.design-group[open]')).toHaveCount(1);
  await expect(page.getByLabel('Eigene Akzentfarbe', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Eigene Akzentfarbe', { exact: true })).toHaveValue('#317b86');
  await page.locator('.editor-panel').evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({ path: info.outputPath('designer-header-expanded.png') });
});

test('mobile design cards and global controls remain reachable without horizontal scrolling', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesigner(page);
  await page.getByRole('button', { name: 'Alle einklappen', exact: true }).click();
  await expect(page.locator('.design-group[open]')).toHaveCount(0);
  for (const id of ['photo', 'header', 'typography', 'spacing', 'sections']) {
    const summary = page.locator(`#design-${id}-summary`);
    await summary.scrollIntoViewIfNeeded();
    await expect(summary).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Alle ausklappen', exact: true })).toBeInViewport();
  const overflow = await page
    .locator('.editor-panel')
    .evaluate((panel) => panel.scrollWidth > panel.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.locator('.editor-panel').evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({ path: info.outputPath('designer-mobile-collapsed.png') });
  await page.getByRole('button', { name: 'Alle ausklappen', exact: true }).click();
  await expect(page.locator('.design-group[open]')).toHaveCount(5);
  const sections = page.locator('#design-sections-summary');
  await sections.scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Alle einklappen', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Alle einklappen', exact: true }).click();
  await expect(page.locator('.design-group[open]')).toHaveCount(0);
});

test('invalid saved navigation preferences fall back to visible design controls', async ({
  page,
}) => {
  await page.addInitScript(() => sessionStorage.setItem('folio.design-groups.v1', '["unknown"]'));
  await openDesigner(page);
  await expect(page.locator('.design-group[open]')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Alle einklappen', exact: true })).toBeVisible();
});
