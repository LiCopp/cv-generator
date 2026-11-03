import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createProject } from '../packages/core/src/fixtures';
import { parseProject } from '../packages/core/src/schema';
import layoutData from '../templates/modern/layouts/default.json' with { type: 'json' };
import { openPrintHost } from './print-host';

async function openDesigner(page: Page) {
  const project = createProject('student');
  project.cv.title = 'Design-Reset-Test';
  project.layout.id = 'custom-layout';
  project.cv.contact.birthDate = { year: 2009, month: 5, day: 10 };
  project.cv.references = [
    {
      id: 'ref-1',
      name: 'Testperson',
      role: 'Lehrperson',
      organization: 'Testschule',
      email: 'referenz@example.com',
      phone: '123456',
      address: 'Musterweg 1',
      city: 'Bern',
    },
  ];
  const image = {
    mediaType: 'image/png' as const,
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=',
  };
  project.assets = { portrait: image, background: image };
  project.cv.contact.photoAssetId = 'portrait';
  project.layout.page.marginMm = 22;
  Object.assign(project.layout.appearance, {
    accent: '#78573c',
    fontId: 'lora',
    fontSizePt: 12,
    lineHeight: 1.8,
    leftColumnLineHeight: 2,
    showPhoto: true,
    photoSide: 'left',
    photoOffsetMm: -5,
    photoOverlapMm: 10,
    headerImageAssetId: 'background',
    headerImageTransparencyPercent: 50,
    headerTextOffsetMm: 3,
    headerNameLayout: 'inline',
    headerShiftUpMm: 5,
    headerEdge: 'diagonal',
    headerEdgeMirrored: true,
    sidebarSide: 'right',
    timelineTextGapMm: 10,
    sectionDividers: true,
    showRunningHeader: false,
    showFooter: false,
    showContactHeading: false,
    contactOrder: [...project.layout.appearance.contactOrder].reverse(),
    stationHeadingOrder: ['title', 'organization', 'date'],
  });
  project.layout.appearance.sectionHeadings.experience = {
    title: 'Meine Berufserfahrung',
    fontSizePt: 15,
  };
  project.layout.skills = {
    display: 'detailed',
    showDescription: true,
    showLevel: false,
    groupByCategory: true,
    barValues: { Individuell: 60 },
  };
  project.layout.sections.reverse();
  project.layout.sections.find((section) => section.id === 'education')!.enabled = false;
  project.layout.sections.find((section) => section.id === 'skills')!.region = 'main';
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'reset.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect.poll(() => storedProject(page)).toEqual(project);
  return project;
}
const storedProject = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('folio.project.v1')!));
const resetButton = (page: Page) =>
  page.getByRole('button', { name: 'Projekt zurücksetzen', exact: true });
const resetDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Projekt zurücksetzen?', exact: true });
const resetDataOption = (page: Page) =>
  resetDialog(page).getByRole('checkbox', {
    name: 'Auch Lebenslaufdaten und Bilder zurücksetzen',
    exact: true,
  });

test('reset requires confirmation and all cancellation paths preserve settings and preview', async ({
  page,
}) => {
  const project = await openDesigner(page);
  await page.getByRole('tab', { name: 'Inhalt', exact: true }).click();
  await expect(resetButton(page)).toHaveCount(1);
  expect(
    await page
      .locator('.header-actions > .reset-button')
      .evaluate((button) => button.previousElementSibling?.textContent),
  ).toBe('Öffnen');
  const preview = await page.locator('.cv-document').innerHTML();
  for (const cancel of ['button', 'escape', 'backdrop']) {
    await resetButton(page).click();
    await expect(resetDialog(page)).toBeVisible();
    await expect(
      resetDialog(page).getByRole('button', { name: 'Abbrechen', exact: true }),
    ).toBeFocused();
    await expect(resetDataOption(page)).not.toBeChecked();
    await resetDataOption(page).check();
    expect(await storedProject(page)).toEqual(project);
    expect(await page.locator('.cv-document').innerHTML()).toBe(preview);
    if (cancel === 'button')
      await resetDialog(page).getByRole('button', { name: 'Abbrechen', exact: true }).click();
    else if (cancel === 'escape') await page.keyboard.press('Escape');
    else await page.locator('.MuiDialog-container').click({ position: { x: 2, y: 2 } });
    await expect(resetDialog(page)).not.toBeVisible();
    await expect(resetButton(page)).toBeFocused();
    expect(await storedProject(page)).toEqual(project);
    expect(await page.locator('.cv-document').innerHTML()).toBe(preview);
  }
});

test('confirmed reset restores defaults, retains CV and images, persists and exports as text-based A4 PDF', async ({
  page,
  context,
}, info) => {
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = 'true';
    };
  });
  const project = await openDesigner(page);
  await page.getByRole('button', { name: /^Zoomstufe auswählen/ }).click();
  await page.getByRole('menuitem', { name: '100 %', exact: true }).click();
  await page.getByRole('button', { name: 'Alle einklappen', exact: true }).click();
  await resetButton(page).click();
  await resetDialog(page).getByRole('button', { name: 'Jetzt zurücksetzen', exact: true }).click();
  await expect(resetDialog(page)).not.toBeVisible();
  const expected = { ...project, layout: { ...layoutData, id: project.layout.id } };
  await expect.poll(() => storedProject(page)).toEqual(expected);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.cv-document')).toHaveCSS('--cv-accent', layoutData.appearance.accent);
  await expect(page.locator('.cv-document .cv-photo')).toHaveCount(0);
  await expect(page.locator('.design-group[open]')).toHaveCount(0);
  await expect(page.locator('.preview-scale')).toHaveCSS('zoom', '1');
  await page.getByRole('button', { name: 'Header', exact: true }).click();
  await expect(page.getByLabel('Eigene Akzentfarbe', { exact: true })).toHaveValue(
    layoutData.appearance.accent,
  );
  await page.getByRole('combobox', { name: 'Gespeichertes Headerbild', exact: true }).click();
  await page.getByRole('option', { name: 'Gespeichertes Bild 2', exact: true }).click();
  await expect(page.getByAltText('Gewähltes Headerbild', { exact: true })).toBeVisible();
  await resetButton(page).click();
  await resetDialog(page).getByRole('button', { name: 'Jetzt zurücksetzen', exact: true }).click();
  await expect.poll(() => storedProject(page)).toEqual(expected);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('reset-project.json');
  await (await download).saveAs(file);
  expect(parseProject(await readFile(file, 'utf8'))).toEqual(expected);
  await page.reload();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  expect(await storedProject(page)).toEqual(expected);
  await expect(page.getByLabel('Eigene Akzentfarbe', { exact: true })).toHaveValue(
    layoutData.appearance.accent,
  );
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
  const pageCount = await page.locator('.cv-page').count();
  await page.getByRole('button', { name: 'PDF exportieren', exact: true }).click();
  await expect(page.frameLocator('iframe[data-cv-print]').locator('html')).toHaveAttribute(
    'data-print-requested',
    'true',
  );
  const frame = (await (await page
    .locator('iframe[data-cv-print]')
    .elementHandle())!.contentFrame())!;
  const printPage = await context.newPage();
  try {
    await openPrintHost(printPage, page.url());
    await printPage.setContent(await frame.content());
    await printPage.evaluate(async () => {
      await document.fonts.ready;
    });
    const bytes = await printPage.pdf({
      path: info.outputPath('reset.pdf'),
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
    });
    const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
    try {
      const pdf = await task.promise;
      expect(pdf.numPages).toBe(pageCount);
      const first = await pdf.getPage(1);
      expect(first.view[2]).toBeCloseTo((210 * 72) / 25.4, 0);
      expect(first.view[3]).toBeCloseTo((297 * 72) / 25.4, 0);
      let text = '';
      for (let index = 1; index <= pdf.numPages; index++)
        text += (await (await pdf.getPage(index)).getTextContent()).items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ');
      expect(text).toContain(project.cv.contact.firstName);
      expect(text).toContain(project.cv.contact.lastName);
      expect(text).toContain('ERFAHRUNG');
      expect(text).toContain('AUSBILDUNG');
      expect(text).not.toContain('MEINE BERUFSERFAHRUNG');
      for (const entry of project.cv.experience) expect(text).toContain(entry.title);
      for (const skill of project.cv.skills) {
        expect(text).toContain(skill.name);
        expect(text).toContain(skill.level);
      }
      expect(text).not.toContain('Jetzt zurücksetzen');
    } finally {
      await task.destroy();
    }
  } finally {
    await printPage.close();
  }
});

test('reset and confirmation remain accessible on mobile', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesigner(page);
  await page.getByRole('button', { name: 'Alle einklappen', exact: true }).click();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(resetButton(page)).toBeInViewport();
    expect(
      await page
        .locator('.app-header')
        .evaluate((element) => element.scrollWidth > element.clientWidth + 1),
    ).toBe(false);
  }
  await page.getByRole('button', { name: 'Vorschau', exact: true }).click();
  await expect(resetButton(page)).toBeInViewport();
  await resetButton(page).click();
  const dialog = resetDialog(page);
  await expect(
    dialog.getByRole('button', { name: 'Jetzt zurücksetzen', exact: true }),
  ).toBeInViewport();
  expect(await dialog.evaluate((element) => element.scrollWidth > element.clientWidth + 1)).toBe(
    false,
  );
  await expect(page.locator('.MuiDialog-container')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: info.outputPath('reset-confirmation-mobile.png') });
  await resetDataOption(page).check();
  await expect(
    dialog.getByRole('button', { name: 'Jetzt zurücksetzen', exact: true }),
  ).toBeInViewport();
  await dialog.getByRole('button', { name: 'Jetzt zurücksetzen', exact: true }).click();
  await expect(page.getByLabel('Vorname', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Vorname', { exact: true })).toHaveValue('');
});

test('optional data reset clears all entries and images, saves and reloads a blank editable project', async ({
  page,
}, info) => {
  const project = await openDesigner(page);
  await resetButton(page).click();
  await resetDataOption(page).check();
  await expect(resetDialog(page).getByRole('alert')).toContainText('Alle persönlichen Angaben');
  await resetDialog(page).getByRole('button', { name: 'Jetzt zurücksetzen', exact: true }).click();
  const expected = {
    ...project,
    cv: { ...createProject('blank').cv, id: project.cv.id },
    assets: {},
    layout: { ...layoutData, id: project.layout.id },
  };
  await expect.poll(() => storedProject(page)).toEqual(expected);
  await expect(page.getByRole('tab', { name: 'Inhalt', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByLabel('Vorname', { exact: true })).toHaveValue('');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('blank-project.json');
  await (await download).saveAs(file);
  expect(parseProject(await readFile(file, 'utf8'))).toEqual(expected);
  await page.reload();
  expect(await storedProject(page)).toEqual(expected);
  await expect(page.getByLabel('Vorname', { exact: true })).toHaveValue('');
  await page.getByLabel('Vorname', { exact: true }).fill('Neustart');
  await expect
    .poll(() => storedProject(page))
    .toEqual({
      ...expected,
      cv: { ...expected.cv, contact: { ...expected.cv.contact, firstName: 'Neustart' } },
    });
  await resetButton(page).click();
  await expect(resetDataOption(page)).not.toBeChecked();
});

for (const target of ['profile', 'header'] as const) {
  test(`pending ${target} image processing is discarded after reset and retained after cancellation`, async ({
    page,
  }) => {
    await openDesigner(page);
    const image = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#abc123';
      context.fillRect(0, 0, 32, 32);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.evaluate(() => {
      const original = window.createImageBitmap.bind(window);
      window.createImageBitmap = async (source: ImageBitmapSource) => {
        const bitmap = await original(source);
        await new Promise<void>((resolve) => {
          (window as Window & { releaseResetImage?: () => void }).releaseResetImage = resolve;
        });
        return bitmap;
      };
    });
    if (target === 'profile') await page.getByRole('tab', { name: 'Inhalt', exact: true }).click();
    await page
      .getByLabel(target === 'profile' ? 'Profilfoto hochladen' : 'Headerbild hochladen', {
        exact: true,
      })
      .setInputFiles({
        name: 'pending.png',
        mimeType: 'image/png',
        buffer: Buffer.from(image, 'base64'),
      });
    await expect
      .poll(() =>
        page.evaluate(
          () => typeof (window as Window & { releaseResetImage?: () => void }).releaseResetImage,
        ),
      )
      .toBe('function');
    await resetButton(page).click();
    await resetDataOption(page).check();
    await resetDialog(page)
      .getByRole('button', { name: 'Jetzt zurücksetzen', exact: true })
      .click();
    await expect
      .poll(() => storedProject(page))
      .toMatchObject({ assets: {}, cv: { contact: { photoAssetId: null } } });
    await page.evaluate(async () => {
      (window as Window & { releaseResetImage?: () => void }).releaseResetImage!();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    await expect(page.getByRole('button', { name: 'PDF exportieren', exact: true })).toBeEnabled();
    await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
    expect(await storedProject(page)).toMatchObject({
      assets: {},
      cv: { contact: { photoAssetId: null } },
      layout: { appearance: { headerImageAssetId: null, showPhoto: false } },
    });
    await page.getByRole('tab', { name: 'Design', exact: true }).click();
    await expect(
      page.getByRole('combobox', { name: 'Gespeichertes Headerbild', exact: true }),
    ).toHaveCount(0);
    // Cancelling the dialog must allow a subsequent upload to finish normally.
    await page.evaluate(() => {
      delete (window as Window & { releaseResetImage?: () => void }).releaseResetImage;
    });
    if (target === 'profile') await page.getByRole('tab', { name: 'Inhalt', exact: true }).click();
    await page
      .getByLabel(target === 'profile' ? 'Profilfoto hochladen' : 'Headerbild hochladen', {
        exact: true,
      })
      .setInputFiles({
        name: 'retained.png',
        mimeType: 'image/png',
        buffer: Buffer.from(image, 'base64'),
      });
    await expect
      .poll(() =>
        page.evaluate(
          () => typeof (window as Window & { releaseResetImage?: () => void }).releaseResetImage,
        ),
      )
      .toBe('function');
    await resetButton(page).click();
    await resetDataOption(page).check();
    await resetDialog(page).getByRole('button', { name: 'Abbrechen', exact: true }).click();
    await page.evaluate(() => {
      (window as Window & { releaseResetImage?: () => void }).releaseResetImage!();
    });
    await expect.poll(async () => Object.keys((await storedProject(page)).assets).length).toBe(1);
    const retained = parseProject(JSON.stringify(await storedProject(page)));
    if (target === 'profile') {
      expect(retained.cv.contact.photoAssetId).not.toBeNull();
      expect(retained.layout.appearance.showPhoto).toBe(true);
    } else expect(retained.layout.appearance.headerImageAssetId).not.toBeNull();
  });
}
