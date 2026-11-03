import { withoutNewReferences } from '../packages/core/src/legacy-test-fixtures';
import { test, expect } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createProject } from '../packages/core/src/fixtures';
import { headerEdges, headerEdgeLabels, parseProject } from '../packages/core/src/schema';
import { readFile } from 'node:fs/promises';
import type { Project } from '../packages/core/src/schema';

async function openProject(page: import('@playwright/test').Page, project: Project) {
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
}
async function extractPdf(page: import('@playwright/test').Page, path: string) {
  const buffer = await page.pdf({
    path,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  const loadingTask = getDocument({ data: new Uint8Array(buffer), useSystemFonts: false });
  const pdf = await loadingTask.promise;
  const texts: string[] = [];
  const positions: { text: string; x: number }[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    texts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    positions.push(
      content.items.flatMap((item) =>
        'str' in item ? [{ text: item.str, x: item.transform[4] }] : [],
      ),
    );
  }
  const count = pdf.numPages;
  await loadingTask.destroy();
  return { count, texts, positions, text: texts.join(' ') };
}

async function expectTimelineHeadingsAligned(page: import('@playwright/test').Page) {
  const errors = await page.locator('.cv-page').evaluateAll((pages) => {
    const axis = (region: string) => {
      const dot = pages
        .flatMap((page) => [...page.querySelectorAll(`.cv-${region} .cv-station-dot`)])[0]
        ?.getBoundingClientRect();
      return dot ? dot.left + dot.width / 2 : undefined;
    };
    const mainAxis = axis('main');
    return pages.flatMap((page) => [
      ...[...page.querySelectorAll('.cv-main > .cv-block:not(.cv-station)')].flatMap((block) => {
        const delta = Math.abs(block.getBoundingClientRect().left - mainAxis!);
        return mainAxis !== undefined && delta > 0.15 ? [{ text: block.textContent, delta }] : [];
      }),
    ]);
  });
  expect(errors).toEqual([]);
  await expect(page.locator('.cv-page .cv-sidebar .cv-station-dot')).toHaveCount(0);
}
test('edits, restores, exports and safely rejects invalid imports', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByLabel('Vorname', { exact: true }).fill('Mara');
  await expect(page.locator('.cv-page h1')).toContainText('Mara');
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await expect(page.getByLabel('Vorname', { exact: true })).toHaveValue('Mara');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs(testInfo.outputPath('saved-project.json'));
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":999}'),
  });
  await expect(page.getByRole('alert')).toContainText('ungültig');
  await expect(page.getByLabel('Vorname', { exact: true })).toHaveValue('Mara');
  await page.screenshot({ path: testInfo.outputPath('editor.png'), fullPage: true });
});
for (const font of ['dm-sans', 'source-sans', 'lora'] as const) {
  test(`student A4 preview matches a one-page PDF with ${font}`, async ({ page }, testInfo) => {
    const project = createProject('student');
    project.layout.appearance.fontId = font;
    await openProject(page, project);
    await expect(page.locator('.cv-page')).toHaveCount(1);
    const result = await extractPdf(page, testInfo.outputPath('student.pdf'));
    expect(result.count).toBe(1);
    for (const expected of [
      'Lena',
      'Berger',
      'Sekundarschule',
      'Schnupperlehre',
      'Figma',
      'Deutsch',
      'Englisch',
      'Fotografie',
    ])
      expect(result.text).toContain(expected);
    expect(result.text.indexOf('Über mich'.toUpperCase())).toBeLessThan(
      result.text.indexOf('AUSBILDUNG'),
    );
    await page.screenshot({ path: testInfo.outputPath('student-editor.png'), fullPage: true });
  });
}
for (const font of ['dm-sans', 'source-sans', 'lora'] as const) {
  test(`adult multipage flow stays complete with ${font}, sidebar right, photo and background`, async ({
    page,
  }, testInfo) => {
    const project = createProject('adult');
    project.layout.appearance.fontId = font;
    project.layout.appearance.sidebarSide = 'right';
    project.layout.appearance.showPhoto = true;
    project.cv.contact.photoAssetId = 'test-photo';
    project.assets['test-photo'] = {
      mediaType: 'image/png',
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=',
    };
    await openProject(page, project);
    const previewCount = await page.locator('.cv-page').count();
    expect(previewCount).toBeGreaterThanOrEqual(4);
    const overflow = await page.locator('.cv-page').evaluateAll((pages) =>
      pages.some((page) => {
        const footer = page.querySelector('.cv-footer')!.getBoundingClientRect();
        return [...page.querySelectorAll('.cv-block')].some(
          (block) => block.getBoundingClientRect().bottom > footer.top - 4,
        );
      }),
    );
    expect(overflow).toBe(false);
    const result = await extractPdf(page, testInfo.outputPath(`adult-${font}.pdf`));
    expect(result.count).toBe(previewCount);
    for (let i = 1; i <= 12; i++) expect(result.text).toContain(`Beispielunternehmen ${i}`);
    expect(result.text).toContain('Mentoring');
    expect(result.text).toContain('Deutsch');
    const position = project.cv.experience.map((entry) => result.text.indexOf(entry.organization));
    expect(position).toEqual([...position].sort((a, b) => a - b));
    await page.emulateMedia({ media: 'print' });
    await page.screenshot({ path: testInfo.outputPath(`adult-${font}.png`), fullPage: true });
  });
}
test('design controls affect preview and mobile navigation stays usable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(page.locator('.design-group h2')).toHaveText([
    'Profilfoto',
    'Header',
    'Typografie',
    'Aufteilung & Abstände',
    'Abschnitte',
  ]);
  await page.getByLabel('Eigene Akzentfarbe', { exact: true }).fill('#317b86');
  await expect(page.locator('.cv-document')).toHaveCSS('--cv-accent', '#317b86');
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(page.getByLabel('Eigene Akzentfarbe', { exact: true })).toHaveValue('#317b86');
  await page.getByRole('button', { name: 'Farbe #254766', exact: true }).click();
  await expect(page.locator('.cv-document')).toHaveCSS('--cv-accent', '#254766');
  await expect(page.getByLabel('Eigene Akzentfarbe', { exact: true })).toHaveValue('#254766');
  await page
    .getByRole('group', { name: 'Position der Seitenleiste', exact: true })
    .getByRole('button', { name: 'Rechts', exact: true })
    .click();
  await expect(page.locator('.cv-document')).toHaveClass(/cv-sidebar-right/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Vorschau', exact: true }).click();
  await expect(page.locator('.preview-panel')).toBeVisible();
  await expect(page.locator('.editor-panel')).toBeHidden();
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await expect(page.locator('.editor-panel')).toBeVisible();
});
test('a long description flows through a narrow sidebar without losing its ending', async ({
  page,
}, testInfo) => {
  const project = createProject('blank');
  project.cv.contact.firstName = 'Robin';
  project.cv.contact.lastName = 'Beispiel';
  project.cv.summary = `${'Ein langer Absatz mit vielen Erfahrungen und hilfreichen Details. '.repeat(80)}SichtbaresEnde`;
  project.layout.sections.find((section) => section.id === 'summary')!.region = 'sidebar';
  project.layout.appearance.fontId = 'lora';
  project.layout.appearance.fontSizePt = 12;
  project.layout.appearance.lineHeight = 1.8;
  project.layout.page.marginMm = 22;
  project.layout.appearance.sidebarPercent = 25;
  await openProject(page, project);
  expect(await page.locator('.cv-page').count()).toBeGreaterThan(1);
  const overflow = await page.locator('.cv-page').evaluateAll((pages) =>
    pages.some((page) => {
      const footer = page.querySelector('.cv-footer')!.getBoundingClientRect();
      return [...page.querySelectorAll('.cv-block')].some(
        (block) => block.getBoundingClientRect().bottom >= footer.top,
      );
    }),
  );
  expect(overflow).toBe(false);
  const result = await extractPdf(page, testInfo.outputPath('long-sidebar.pdf'));
  expect(result.text).toContain('SichtbaresEnde');
  expect(result.count).toBe(await page.locator('.cv-page').count());
});
for (const [index, edge] of headerEdges.entries()) {
  test(`header ${edge} and station markers survive A4 PDF export`, async ({ page }, testInfo) => {
    const project = createProject('student');
    project.layout.appearance.headerEdge = edge;
    project.layout.appearance.headerEdgeDepthMm = 16;
    project.layout.appearance.headerStyle = index % 2 ? 'solid' : 'gradient';
    project.layout.appearance.sidebarSide = index % 2 ? 'right' : 'left';
    project.layout.appearance.timelineStyle = index % 2 ? 'dots' : 'line';
    await openProject(page, project);
    await expect(page.locator('.cv-page')).toHaveCount(1);
    await expect(page.locator('.cv-page .cv-station-dot')).toHaveCount(3);
    await expect(page.locator('.cv-page .cv-header-edge')).toHaveCount(edge === 'straight' ? 0 : 1);
    if (edge !== 'straight')
      await expect(page.locator('.cv-page .cv-header-edge')).toHaveAttribute('data-shape', edge);
    const overlap = await page.locator('.cv-page').evaluateAll((pages) =>
      pages.some((page) => {
        const header = page.querySelector('.cv-header')!.getBoundingClientRect();
        const footer = page.querySelector('.cv-footer')!.getBoundingClientRect();
        return [...page.querySelectorAll('.cv-block')].some((block) => {
          const rect = block.getBoundingClientRect();
          return rect.top < header.bottom || rect.bottom >= footer.top;
        });
      }),
    );
    expect(overlap).toBe(false);
    await page.locator('.cv-page').screenshot({ path: testInfo.outputPath(`header-${edge}.png`) });
    const result = await extractPdf(page, testInfo.outputPath(`header-${edge}.pdf`));
    expect(result.count).toBe(1);
    for (const text of ['Lena', 'Berger', 'Sekundarschule', 'Schnupperlehre', 'Schülerzeitung'])
      expect(result.text).toContain(text);
  });
}
test('migrates saved layouts and saves header and station controls without losing content', async ({
  page,
}, testInfo) => {
  const project = createProject('student');
  const {
    headerEdge,
    headerEdgeDepthMm,
    timelineStyle,
    timelineOffsetMm,
    photoSide,
    photoOverlapMm,
    headerImageAssetId,
    headerImageDimPercent,
    photoWidthMm,
    photoBorderWidthMm,
    photoBorderColor,
    photoFit,
    photoPositionX,
    photoPositionY,
    headerEdgeMirrored,
    headerImageTransparencyPercent,
    timelineTextGapMm,
    stationSpacingMm,
    sectionDividers,
    dividerSpacingBeforeMm,
    dividerSpacingAfterMm,
    dividerLengthPercent,
    headerContentGapMm,
    introBodyGapMm,
    sectionHeadings,
    showContactHeading,
    showRunningHeader,
    showFooter,
    introDividerSpacingBeforeMm,
    introDividerSpacingAfterMm,
    contactOrder,
    contactLineHeight,
    contactSpacingMm,
    stationDateLineHeight,
    stationTitleLineHeight,
    stationOrganizationLineHeight,
    stationDateTitleGapMm,
    stationTitleOrganizationGapMm,
    ...oldAppearance
  } = project.layout.appearance;
  const legacy = withoutNewReferences({
    ...project,
    layout: { ...project.layout, schemaVersion: 1, appearance: oldAppearance },
  });
  await page.goto('/');
  await page.evaluate(
    (saved) => localStorage.setItem('folio.project.v1', saved),
    JSON.stringify(legacy),
  );
  await page.reload();
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.cv-page .cv-header-edge')).toHaveCount(0);
  await expect(page.locator('.cv-page .cv-station-dot')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await page.getByRole('button', { name: headerEdgeLabels.diagonal, exact: true }).click();
  await page.getByLabel('Header-Abschluss horizontal spiegeln', { exact: true }).check();
  await page.getByRole('combobox', { name: /^Stationen markieren/ }).click();
  await page.getByRole('option', { name: 'Punkte mit Verbindungslinie', exact: true }).click();
  await expect(page.locator('.cv-page .cv-header-edge')).toHaveAttribute('data-shape', 'diagonal');
  await expect(page.locator('.cv-page .cv-station-dot')).toHaveCount(3);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const download = await downloadPromise;
  const file = testInfo.outputPath('layout-v2.json');
  await download.saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.cv).toEqual(project.cv);
  expect(saved.layout.schemaVersion).toBe(23);
  expect(saved.layout.appearance.headerEdge).toBe('diagonal');
  expect(saved.layout.appearance.headerEdgeMirrored).toBe(true);
  expect(saved.layout.appearance.timelineStyle).toBe('line');
  expect(saved.manifest.rendererVersion).toBe('1.28.0');
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.screenshot({
    path: testInfo.outputPath('header-design-controls.png'),
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator('.cv-page .cv-header-edge')).toHaveAttribute('data-shape', 'diagonal');
  await expect(page.locator('.cv-page .cv-header-edge')).toHaveAttribute('data-mirrored', 'true');
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(
    page.getByLabel('Header-Abschluss horizontal spiegeln', { exact: true }),
  ).toBeChecked();
  await page.getByRole('button', { name: headerEdgeLabels.arc, exact: true }).click();
  await expect(
    page.getByLabel('Header-Abschluss horizontal spiegeln', { exact: true }),
  ).toBeDisabled();
});
for (const side of ['left', 'right'] as const) {
  test(`contact icons and optional marital status print correctly with sidebar ${side}`, async ({
    page,
  }, testInfo) => {
    const project = createProject('student');
    project.layout.appearance.sidebarSide = side;
    project.layout.appearance.timelineStyle = 'line';
    project.cv.contact.email = 'vorname.nachname.mit.langem.namen@example.com';
    project.cv.contact.website = 'portfolio.example.com';
    await openProject(page, project);
    await expect(page.locator('.cv-page [data-contact="marital-status"]')).toHaveCount(0);
    await page.getByLabel('Zivilstand (optional)', { exact: true }).fill('Verheiratet');
    await expect(page.locator('.cv-page [data-contact="marital-status"]')).toHaveText(
      'Verheiratet',
    );
    await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('.cv-page .cv-contact-icon')).toHaveCount(5);
    await expect(page.locator('.cv-page [data-contact="address"]')).toContainText(
      'Beispielstrasse 12',
    );
    await expect(page.locator('.cv-page [data-contact="address"]')).toContainText('8000 Zürich');
    await expect(page.locator('.cv-page .cv-station-dot')).toHaveCount(3);
    const geometry = await page
      .locator('.cv-page .cv-intro-row .cv-sidebar')
      .evaluate((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          borders: [style.borderLeftWidth, style.borderRightWidth],
          overflow: [...element.querySelectorAll('.cv-contact-line')].some(
            (line) => line.getBoundingClientRect().right > rect.right + 1,
          ),
        };
      });
    expect(geometry.borders).toEqual(['0px', '0px']);
    expect(geometry.overflow).toBe(false);
    const result = await extractPdf(page, testInfo.outputPath(`contacts-${side}.pdf`));
    expect(result.count).toBe(await page.locator('.cv-page').count());
    for (const text of ['Verheiratet', 'Beispielstrasse 12', 'Zürich', 'portfolio.example.com'])
      expect(result.text).toContain(text);
    expect(result.text.replace(/\s/g, '')).toContain(project.cv.contact.email);
    await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
    await page.reload();
    await expect(page.getByLabel('Zivilstand (optional)', { exact: true })).toHaveValue(
      'Verheiratet',
    );
    await page.emulateMedia({ media: 'print' });
    await page.screenshot({ path: testInfo.outputPath(`contacts-${side}.png`), fullPage: true });
  });
}
test('empty contact details render no icons and older CVs load without inventing marital status', async ({
  page,
}) => {
  const project = createProject('blank');
  const { maritalStatus, birthDate, ...contact } = project.cv.contact;
  await page.goto('/');
  const legacy = withoutNewReferences({
    ...project,
    cv: { ...project.cv, schemaVersion: 1, contact },
  });
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'legacy.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByLabel('Zivilstand (optional)', { exact: true })).toHaveValue('');
  await expect(page.locator('.cv-page .cv-contact-icon')).toHaveCount(0);
  await expect(
    page.locator('.cv-page').getByRole('heading', { name: 'Kontakt', exact: true }),
  ).toHaveCount(0);
});
for (const section of [
  { name: 'Ausbildung', title: 'Abschluss oder Ausbildung', key: 'education' },
  { name: 'Erfahrung', title: 'Position oder Tätigkeit', key: 'experience' },
  { name: 'Projekte & Engagement', title: 'Projekt oder Tätigkeit', key: 'projects' },
] as const) {
  test(`${section.key} dates default to days and switch precision without losing entered days`, async ({
    page,
  }, testInfo) => {
    await openProject(page, createProject('blank'));
    await page.getByRole('button', { name: section.name, exact: true }).click();
    await page.getByRole('button', { name: 'Eintrag hinzufügen', exact: true }).click();
    await page.getByLabel(section.title, { exact: true }).fill('Teststation');
    const from = page.getByLabel('Von', { exact: true });
    const until = page.getByLabel('Bis', { exact: true });
    await expect(from).toHaveAttribute('type', 'date');
    await expect(until).toHaveAttribute('type', 'date');
    await from.fill('2024-02-29');
    await until.fill('2025-03-15');
    await expect(page.locator('.cv-page .cv-date')).toHaveText('29.02.2024 – 15.03.2025');
    await page.getByLabel('Genauigkeit Von', { exact: true }).selectOption('month');
    await expect(from).toHaveAttribute('type', 'month');
    await expect(from).toHaveValue('2024-02');
    await expect(page.locator('.cv-page .cv-date')).toHaveText('02/2024 – 15.03.2025');
    await page.getByLabel('Genauigkeit Von', { exact: true }).selectOption('day');
    await expect(from).toHaveValue('2024-02-29');
    await page.getByLabel('Genauigkeit Bis', { exact: true }).selectOption('month');
    await until.fill('2025-04');
    await expect(page.locator('.cv-page .cv-date')).toHaveText('29.02.2024 – 04/2025');
    await page.getByLabel('Genauigkeit Bis', { exact: true }).selectOption('day');
    await expect(until).toHaveValue('');
    await expect(
      page.getByText('Vorhanden: 04/2025. Bitte Tag ergänzen.', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('.cv-page .cv-date')).toHaveText('29.02.2024 – 04/2025');
    await until.fill('2025-04-30');
    await page.getByLabel('Bis heute / noch laufend', { exact: true }).check();
    await expect(until).toBeDisabled();
    await expect(page.getByLabel('Genauigkeit Bis', { exact: true })).toBeDisabled();
    await expect(page.locator('.cv-page .cv-date')).toHaveText('29.02.2024 – Heute');
    await page.getByLabel('Bis heute / noch laufend', { exact: true }).uncheck();
    await expect(until).toHaveValue('2025-04-30');
    await expect(page.locator('.cv-page .cv-date')).toHaveText('29.02.2024 – 30.04.2025');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
    const download = await downloadPromise;
    const file = testInfo.outputPath('station-dates.json');
    await download.saveAs(file);
    const saved = parseProject(await readFile(file, 'utf8'));
    expect(saved.cv.schemaVersion).toBe(8);
    expect(saved.cv[section.key][0].start).toEqual({ year: 2024, month: 2, day: 29 });
    expect(saved.cv[section.key][0].end).toEqual({ year: 2025, month: 4, day: 30 });
    expect(saved.cv[section.key][0].startPrecision).toBe('day');
    expect(saved.cv[section.key][0].endPrecision).toBe('day');
    await page.getByLabel('Genauigkeit Bis', { exact: true }).selectOption('month');
    await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
    await page.reload();
    await page.getByRole('button', { name: section.name, exact: true }).click();
    await expect(page.getByLabel('Genauigkeit Bis', { exact: true })).toHaveValue('month');
    await expect(page.getByLabel('Bis', { exact: true })).toHaveValue('2025-04');
    await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
    const result = await extractPdf(page, testInfo.outputPath('station-dates.pdf'));
    expect(result.text).toContain('29.02.2024');
    expect(result.text).toContain('04/2025');
    expect(result.text).not.toContain('30.04.2025');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel(section.title, { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath('station-dates-mobile.png'),
      fullPage: true,
    });
  });
}
test('day-level ordering errors prevent export and recover after correcting the date', async ({
  page,
}) => {
  await openProject(page, createProject('blank'));
  await page.getByRole('button', { name: 'Erfahrung', exact: true }).click();
  await page.getByRole('button', { name: 'Eintrag hinzufügen', exact: true }).click();
  await page.getByLabel('Von', { exact: true }).fill('2025-03-16');
  await page.getByLabel('Bis', { exact: true }).fill('2025-03-15');
  await expect(
    page.getByText('Das Ende muss nach dem Beginn liegen.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'PDF exportieren', exact: true })).toBeDisabled();
  await page.getByLabel('Bis', { exact: true }).fill('2025-03-16');
  await expect(page.getByRole('button', { name: 'PDF exportieren', exact: true })).toBeEnabled();
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
});
test('legacy month/year station dates migrate and can be edited without invented dates', async ({
  page,
}) => {
  const project = createProject('blank');
  const { birthDate, ...contact } = project.cv.contact;
  const legacy = withoutNewReferences({
    ...project,
    cv: {
      ...project.cv,
      contact,
      schemaVersion: 2,
      experience: [
        {
          id: 'legacy-station',
          title: 'Bestehende Station',
          organization: '',
          location: '',
          start: { year: 2020 },
          end: { year: 2025, month: 3 },
          current: false,
          description: '',
        },
      ],
    },
  });
  await page.goto('/');
  await page.evaluate(
    (saved) => localStorage.setItem('folio.project.v1', saved),
    JSON.stringify(legacy),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Erfahrung', exact: true }).click();
  await expect(page.locator('.cv-page .cv-date')).toHaveText('2020 – 03/2025');
  await expect(page.getByLabel('Genauigkeit Von', { exact: true })).toHaveValue('year');
  await expect(page.getByLabel('Genauigkeit Bis', { exact: true })).toHaveValue('month');
  await expect(page.getByLabel('Von', { exact: true })).toHaveValue('2020');
  await expect(page.getByLabel('Bis', { exact: true })).toHaveValue('2025-03');
  await page.getByLabel('Genauigkeit Von', { exact: true }).selectOption('day');
  await expect(page.getByLabel('Von', { exact: true })).toHaveValue('');
  await expect(
    page.getByText('Vorhanden: 2020. Bitte Tag ergänzen.', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.cv-page .cv-date')).toHaveText('2020 – 03/2025');
  await page.getByLabel('Von', { exact: true }).fill('2020-08-15');
  await expect(page.locator('.cv-page .cv-date')).toHaveText('15.08.2020 – 03/2025');
});

test('timeline position moves both ways, survives saving and disables without markers', async ({
  page,
}, testInfo) => {
  const project = createProject('student');
  const {
    timelineOffsetMm,
    photoSide,
    photoOverlapMm,
    headerImageAssetId,
    headerImageDimPercent,
    photoWidthMm,
    photoBorderWidthMm,
    photoBorderColor,
    photoFit,
    photoPositionX,
    photoPositionY,
    headerEdgeMirrored,
    headerImageTransparencyPercent,
    timelineTextGapMm,
    stationSpacingMm,
    sectionDividers,
    dividerSpacingBeforeMm,
    dividerSpacingAfterMm,
    dividerLengthPercent,
    headerContentGapMm,
    introBodyGapMm,
    sectionHeadings,
    showContactHeading,
    showRunningHeader,
    showFooter,
    introDividerSpacingBeforeMm,
    introDividerSpacingAfterMm,
    contactOrder,
    contactLineHeight,
    contactSpacingMm,
    stationDateLineHeight,
    stationTitleLineHeight,
    stationOrganizationLineHeight,
    stationDateTitleGapMm,
    stationTitleOrganizationGapMm,
    ...appearance
  } = project.layout.appearance;
  await page.goto('/');
  // Finish the initial autosave before seeding the historical stored project.
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.evaluate(
    (saved) => localStorage.setItem('folio.project.v1', saved),
    JSON.stringify(
      withoutNewReferences({
        ...project,
        layout: { ...project.layout, schemaVersion: 2, appearance },
      }),
    ),
  );
  await page.reload();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  const position = page.getByRole('slider', { name: 'Position der Zeitachse', exact: true });
  await expect(position).toHaveAttribute('aria-valuenow', '0');
  await expectTimelineHeadingsAligned(page);
  for (const [key, offset] of [
    ['Home', -10],
    ['End', 12],
    ['ArrowLeft', 11.5],
  ] as const) {
    await position.focus();
    await position.press(key);
    await expect(position).toHaveAttribute('aria-valuenow', String(offset));
    await expect(page.locator('.cv-document')).toHaveCSS('--cv-timeline-offset', `${offset}mm`);
    const geometry = await page
      .locator('.cv-page .cv-station-start')
      .first()
      .evaluate((element) => {
        const dot = getComputedStyle(element.querySelector('.cv-station-dot')!);
        const line = getComputedStyle(element, '::before');
        const style = getComputedStyle(element);
        return {
          offset: parseFloat(style.marginLeft),
          dot: parseFloat(dot.left),
          line: parseFloat(line.left),
          dotWidth: parseFloat(dot.width),
          lineWidth: parseFloat(line.width),
          padding: parseFloat(style.paddingLeft),
        };
      });
    const mm = 96 / 25.4;
    expect(geometry.offset).toBeCloseTo(offset * mm, 1);
    expect(geometry.dot).toBeCloseTo(0.35 * mm, 1);
    expect(geometry.dot + geometry.dotWidth / 2).toBeCloseTo(
      geometry.line + geometry.lineWidth / 2,
      1,
    );
    expect(geometry.padding - geometry.dot - geometry.dotWidth).toBeCloseTo(2.85 * mm, 1);
    await expectTimelineHeadingsAligned(page);
  }
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = testInfo.outputPath('timeline-position.json');
  await (await downloadPromise).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.layout.appearance.timelineOffsetMm).toBe(11.5);
  expect(saved.cv).toEqual(project.cv);
  await page.getByRole('combobox', { name: /^Stationen markieren/ }).click();
  await page.getByRole('option', { name: 'Ohne Markierung', exact: true }).click();
  await expect(position).toBeDisabled();
  await expect(page.locator('.cv-page .cv-station-dot')).toHaveCount(0);
  await expect(page.locator('.cv-page .cv-station').first()).toHaveCSS('padding-left', '0px');
  await expect(page.locator('.cv-page .cv-main > .cv-block').first()).toHaveCSS(
    'margin-left',
    '0px',
  );
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(position).toBeDisabled();
  await expect(position).toHaveAttribute('aria-valuenow', '11.5');
  await page.getByRole('combobox', { name: /^Stationen markieren/ }).click();
  await page.getByRole('option', { name: 'Nur Punkte', exact: true }).click();
  await expect(position).toBeEnabled();
  await expect(page.locator('.cv-page .cv-station-dot')).toHaveCount(3);
  await expect(position).toHaveAttribute('aria-valuenow', '11.5');
  await expectTimelineHeadingsAligned(page);
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles(file);
  await expect(page.locator('.cv-document')).toHaveClass(/cv-timeline-line/);
  await expect(position).toHaveAttribute('aria-valuenow', '11.5');
  await page.setViewportSize({ width: 390, height: 844 });
  await position.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('timeline-control-mobile.png'),
    fullPage: true,
  });
});

for (const kind of ['student', 'adult'] as const) {
  for (const offset of [-10, 12]) {
    test(`${kind} timeline at ${offset} mm keeps all content in preview and PDF`, async ({
      page,
    }, testInfo) => {
      const project = createProject(kind);
      project.layout.appearance.timelineOffsetMm = offset;
      project.layout.appearance.sidebarSide = offset < 0 ? 'left' : 'right';
      if (offset < 0) project.layout.page.marginMm = 10;
      if (kind === 'adult') {
        project.layout.sections.find((section) => section.id === 'education')!.region = 'sidebar';
        project.layout.page.marginMm = offset < 0 ? 10 : 22;
        project.layout.appearance.sidebarPercent = 25;
        project.layout.appearance.fontId = 'lora';
        project.layout.appearance.fontSizePt = 12;
      }
      await openProject(page, project);
      const previewCount = await page.locator('.cv-page').count();
      if (kind === 'student') expect(previewCount).toBe(1);
      else expect(previewCount).toBeGreaterThanOrEqual(4);
      await expectTimelineHeadingsAligned(page);
      const problems = await page.locator('.cv-page').evaluateAll((pages) =>
        pages.flatMap((page) => {
          const footer = page.querySelector('.cv-footer')!.getBoundingClientRect();
          const pageRect = page.getBoundingClientRect();
          return [...page.querySelectorAll<HTMLElement>('.cv-station')]
            .filter((station) => {
              const box = station.getBoundingClientRect();
              const dot = station.querySelector('.cv-station-dot')?.getBoundingClientRect();
              const text =
                station.firstElementChild?.nextElementSibling ?? station.firstElementChild!;
              const textRect = text.getBoundingClientRect();
              return (
                box.bottom >= footer.top ||
                station.scrollWidth > station.clientWidth + 1 ||
                (!!dot && (dot.left < pageRect.left || dot.right > textRect.left))
              );
            })
            .map((station) => station.textContent);
        }),
      );
      expect(problems).toEqual([]);
      const result = await extractPdf(page, testInfo.outputPath('timeline.pdf'));
      expect(result.count).toBe(previewCount);
      for (const entry of [
        ...project.cv.education,
        ...project.cv.experience,
        ...project.cv.projects,
      ]) {
        expect(result.text.replace(/\s/g, '')).toContain(entry.title.replace(/\s/g, ''));
        if (entry.organization)
          expect(result.text.replace(/\s/g, '')).toContain(entry.organization.replace(/\s/g, ''));
      }
      await page.emulateMedia({ media: 'print' });
      await expectTimelineHeadingsAligned(page);
      for (const title of ['Über mich', 'Erfahrung']) {
        const heading = page
          .locator('.cv-page .cv-main')
          .getByRole('heading', { name: title, exact: true })
          .first();
        const x = await heading.evaluate(
          (element) => (element.getBoundingClientRect().left * 72) / 96,
        );
        const printed = result.positions[0].find(
          (item) => item.text.trim() === title.toUpperCase(),
        );
        expect(printed, `PDF heading ${title}`).toBeDefined();
        expect(Math.abs(printed!.x - x)).toBeLessThan(0.5);
      }
      await page
        .locator('.cv-page')
        .first()
        .screenshot({ path: testInfo.outputPath('timeline-first-page.png') });
    });
  }
}
