import { expect, test, type Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createProject, makeLanguage, makeSkill } from '../packages/core/src/fixtures';
import { withoutNewReferences } from '../packages/core/src/legacy-test-fixtures';
import { parseProject, type Project } from '../packages/core/src/schema';
import { openPrintHost } from './print-host';

async function openProject(page: Page, project: { cv: { title: string } }) {
  await page.goto('/');
  await page.locator('input[aria-label="Projektdatei öffnen"]').setInputFiles({
    name: 'skills.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.document-title > span').first()).toHaveText(project.cv.title);
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
}
async function mode(page: Page, name: 'Text' | 'Progressbar' | 'Detailliert') {
  await page.getByRole('combobox', { name: /^Darstellung der Kenntnisse/ }).click();
  await page.getByRole('option', { name, exact: true }).click();
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
}

test('optional levels, free labels, descriptions, categories and bar settings persist across modes and JSON', async ({
  page,
}, info) => {
  const project = createProject('blank');
  project.cv.title = 'Kenntnisse gestalten';
  await openProject(page, project);
  await page.getByRole('button', { name: 'Kenntnisse', exact: true }).click();
  for (const [i, name, level, category] of [
    [0, 'PowerShell', 'Sehr gute Kenntnisse', 'Automation'],
    [1, 'TypeScript', 'Praktische Projekterfahrung', 'Entwicklung'],
    [2, 'Neue Technologie', '', ''],
    [3, 'Projektmanagement', 'Langjährige Erfahrung', 'Methoden'],
  ] as const) {
    await page.getByRole('button', { name: 'Eintrag hinzufügen', exact: true }).click();
    await page.getByRole('textbox', { name: 'Kenntnis', exact: true }).nth(i).fill(name);
    const input = page
      .getByRole('combobox', { name: 'Kenntnisstand (optional)', exact: true })
      .nth(i);
    if (level) {
      await input.fill(level);
      if (i === 0 || i === 3) await page.getByRole('option', { name: level, exact: true }).click();
      else await input.press('Tab');
    }
    await page.getByLabel('Kategorie (optional)', { exact: true }).nth(i).fill(category);
  }
  await page
    .getByLabel('Beschreibung der Kenntnis (optional)', { exact: true })
    .first()
    .fill('Entwicklung von Automatisierungen.');
  await expect(page.locator('.cv-page [data-section="skills"] .cv-skill-description')).toHaveCount(
    0,
  );
  await expect(page.locator('.cv-page [data-section="skills"] .cv-skill-bar')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await mode(page, 'Progressbar');
  await expect(page.locator('.cv-page [data-section="skills"] .cv-skill-bar')).toHaveCount(1);
  await expect(page.locator('.cv-page .cv-skill-bar > span')).toHaveAttribute(
    'style',
    'width: 75%;',
  );
  await page.getByText('Balkenlängen je Kenntnisstand', { exact: true }).click();
  await page
    .getByRole('spinbutton', { name: 'Balkenlänge für Sehr gute Kenntnisse', exact: true })
    .fill('62');
  await expect(page.locator('.cv-page .cv-skill-bar > span')).toHaveAttribute(
    'style',
    'width: 62%;',
  );
  await expect(
    page.getByRole('checkbox', { name: 'Balken für Langjährige Erfahrung', exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole('checkbox', { name: 'Balken für Praktische Projekterfahrung', exact: true })
    .check();
  await page
    .getByRole('spinbutton', { name: 'Balkenlänge für Praktische Projekterfahrung', exact: true })
    .fill('20');
  await expect(page.locator('.cv-page [data-section="skills"] .cv-skill-bar')).toHaveCount(2);
  const showLevel = page.getByRole('switch', { name: 'Kenntnisstände anzeigen', exact: true });
  await showLevel.uncheck();
  await expect(page.locator('.cv-page .cv-skill-bar')).toHaveCount(0);
  await showLevel.check();
  await mode(page, 'Detailliert');
  await expect(page.locator('.cv-page .cv-skill-description')).toHaveText(
    'Entwicklung von Automatisierungen.',
  );
  await mode(page, 'Text');
  await expect(page.locator('.cv-page .cv-skill-description')).toHaveCount(0);
  await mode(page, 'Detailliert');
  await page
    .getByRole('switch', { name: 'Kenntnisse nach Kategorie gruppieren', exact: true })
    .check();
  await expect(page.locator('.cv-page .cv-skill-category')).toHaveText([
    'Automation',
    'Entwicklung',
    'Weitere Kenntnisse',
    'Methoden',
  ]);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('skills.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.cv.schemaVersion).toBe(8);
  expect(saved.layout.schemaVersion).toBe(23);
  expect(saved.cv.skills.map((skill) => skill.level)).toEqual([
    'Sehr gute Kenntnisse',
    'Praktische Projekterfahrung',
    '',
    'Langjährige Erfahrung',
  ]);
  expect(saved.cv.skills[0]).toMatchObject({
    name: 'PowerShell',
    description: 'Entwicklung von Automatisierungen.',
    category: 'Automation',
  });
  expect(saved.layout.skills).toMatchObject({
    display: 'detailed',
    showLevel: true,
    showDescription: true,
    groupByCategory: true,
    barValues: { 'Sehr gute Kenntnisse': 62, 'Praktische Projekterfahrung': 20 },
  });
  expect(saved.layout.skills.barValues).not.toHaveProperty('Langjährige Erfahrung');
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await expect(page.locator('.cv-page .cv-skill-description')).toHaveText(
    'Entwicklung von Automatisierungen.',
  );
  saved.cv.title += ' importiert';
  await openProject(page, saved);
  await page.getByRole('button', { name: 'Kenntnisse', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Kenntnisstand (optional)', exact: true }).nth(1),
  ).toHaveValue('Praktische Projekterfahrung');
  await expect(
    page.getByRole('combobox', { name: 'Kenntnisstand (optional)', exact: true }).nth(2),
  ).toHaveValue('');
  await page.getByRole('button', { name: 'Sprachen', exact: true }).click();
  await page.getByRole('button', { name: 'Eintrag hinzufügen', exact: true }).click();
  await page.getByRole('textbox', { name: 'Sprache', exact: true }).fill('Englisch');
  await page.getByLabel('Sprachniveau (optional)', { exact: true }).fill('B2');
  await expect(page.locator('.cv-page [data-section="languages"]')).toContainText([
    'Sprachen',
    'EnglischB2',
  ]);
});

test('old CV and layout without skills configuration load with the unchanged text presentation', async ({
  page,
}) => {
  const project = createProject('student');
  project.cv.title = 'Alte Kenntnisse';
  project.cv.skills[1].level = 'Eigener Kenntnisstand';
  const legacy = withoutNewReferences({
    ...project,
    cv: { ...project.cv, schemaVersion: 6 },
    layout: { ...project.layout, schemaVersion: 16 },
  });
  await openProject(page, legacy);
  await expect(page.locator('.cv-page [data-section="skills"] .cv-skill-text')).toHaveCount(3);
  await expect(page.locator('.cv-page [data-section="skills"] .cv-skill-level')).toHaveText([
    'Gute Kenntnisse',
    'Eigener Kenntnisstand',
    'Gute Kenntnisse',
  ]);
  await expect(page.locator('.cv-page .cv-skill-bar, .cv-page .cv-skill-description')).toHaveCount(
    0,
  );
});

function geometry() {
  return [...document.querySelectorAll('.cv-page')].map((page) => {
    const box = page.getBoundingClientRect(),
      mm = box.height / 297;
    const bottom = page.querySelector('.cv-columns')!.getBoundingClientRect().bottom;
    return [
      ...page.querySelectorAll<HTMLElement>('[data-section="skills"], [data-section="languages"]'),
    ].map((block) => ({
      id: block.dataset.blockId,
      top: (block.getBoundingClientRect().top - box.top) / mm,
      bottom: (block.getBoundingClientRect().bottom - box.top) / mm,
      limit: (bottom - box.top) / mm,
    }));
  });
}

async function printSkills(
  page: Page,
  context: import('@playwright/test').BrowserContext,
  project: Project,
  info: import('@playwright/test').TestInfo,
  tokens: string[],
) {
  const preview = await page.evaluate(geometry),
    count = await page.locator('.cv-page').count();
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
      path: info.outputPath('skills.pdf'),
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
      for (const skill of project.cv.skills) {
        expect(normalized).toContain(skill.name.replace(/\s/g, ''));
        if (skill.level) expect(normalized).toContain(skill.level.replace(/\s/g, ''));
      }
      for (const language of project.cv.languages)
        expect(normalized).toContain(language.level.replace(/\s/g, ''));
      for (const token of tokens) expect(normalized).toContain(token.replace(/\s/g, ''));
      if (!project.layout.skills.showDescription)
        expect(text).not.toContain('Automationsbeschreibung');
      const assessments = [...project.cv.skills, ...project.cv.languages].filter(
        (item) => item.proficiency !== null,
      );
      if (!assessments.length) expect(text).not.toContain('%');
      for (const [section, items] of [
        ['skills', project.cv.skills],
        ['languages', project.cv.languages],
      ] as const)
        for (const item of items)
          if (
            item.proficiency !== null &&
            project.layout.proficiencyPercentages[section][item.id] !== false
          )
            expect(normalized).toContain(`${item.proficiency}%`);
      for (const value of [73, 65]) {
        const matching = (['skills', 'languages'] as const).flatMap((section) =>
          project.cv[section]
            .filter((item) => item.proficiency === value)
            .map((item) => project.layout.proficiencyPercentages[section][item.id] === false),
        );
        if (matching.length && matching.every(Boolean))
          expect(normalized).not.toContain(`${value}%`);
      }
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
      await writeFile(info.outputPath('skills.png'), canvas.toBuffer('image/png'));
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
}

for (const display of ['text', 'bars', 'detailed'] as const) {
  test(`skills and qualitative language levels remain extractable in PDF: ${display}`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    const project = createProject('student');
    project.cv.title = `Kenntnisse PDF ${display}`;
    project.cv.skills = [
      makeSkill({
        id: 'ps',
        name: 'PowerShell',
        level: 'Sehr gute Kenntnisse',
        description: 'Automationsbeschreibung: Betrieb wiederverwendbarer Skripte.',
        category: 'Automation',
      }),
      makeSkill({
        id: 'ts',
        name: 'TypeScript',
        level: 'Praktische Projekterfahrung',
        category: 'Entwicklung',
      }),
      makeSkill({ id: 'new', name: 'Neue Technologie' }),
      makeSkill({
        id: 'pm',
        name: 'Projektmanagement',
        level: 'Langjährige Erfahrung',
        category: 'Methoden',
      }),
    ];
    project.cv.languages = ['Muttersprache', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(
      (level, i) => ({ id: `language-${i}`, name: `Sprache ${i + 1}`, level, proficiency: null }),
    );
    Object.assign(project.layout.skills, {
      display,
      showDescription: display === 'detailed',
      groupByCategory: display === 'detailed',
    });
    project.layout.appearance.sidebarSide = display === 'bars' ? 'right' : 'left';
    project.layout.appearance.fontId =
      display === 'detailed' ? 'lora' : display === 'bars' ? 'source-sans' : 'dm-sans';
    await openProject(page, project);
    await expect(page.locator('.cv-page [data-block-id="skills-new"]')).toHaveText(
      'Neue Technologie',
    );
    await expect(page.locator('.cv-page [data-block-id="skills-pm"]')).toContainText(
      'Langjährige Erfahrung',
    );
    await expect(page.locator('.cv-page .cv-skill-bar')).toHaveCount(display === 'bars' ? 1 : 0);
    if (display === 'bars') {
      await expect(page.locator('.cv-page .cv-skill-bar')).toHaveAttribute('aria-hidden', 'true');
      const ratio = await page
        .locator('.cv-page .cv-skill-bar')
        .evaluate(
          (bar) =>
            bar.firstElementChild!.getBoundingClientRect().width /
            bar.getBoundingClientRect().width,
        );
      expect(ratio).toBeCloseTo(0.75, 2);
    }
    await printSkills(
      page,
      context,
      project,
      info,
      display === 'detailed'
        ? [
            'Automationsbeschreibung: Betrieb wiederverwendbarer Skripte.',
            'Automation',
            'Entwicklung',
            'Methoden',
          ]
        : [],
    );
  });
}

for (const region of ['main', 'sidebar'] as const) {
  test(`long detailed skills flow through multiple pages in ${region}`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    const project = createProject('adult');
    project.cv.title = `Lange Kenntnisse ${region}`;
    const tokens = Array.from(
      { length: 50 },
      (_, i) => `Praxisabschnitt${String(i + 1).padStart(3, '0')}`,
    );
    project.cv.skills = [
      makeSkill({
        id: 'long',
        name: 'Automatisierung',
        level: 'Gute Kenntnisse',
        category: 'Praxis',
        description: tokens
          .map(
            (token) =>
              `${token}: Entwicklung und Betrieb verständlicher, wiederverwendbarer Werkzeuge. Gemeinsam Anforderungen klären, Lösungen prüfen und Erkenntnisse dokumentieren.`,
          )
          .join('\n'),
      }),
    ];
    Object.assign(project.layout.skills, {
      display: 'detailed',
      showDescription: true,
      groupByCategory: true,
    });
    project.layout.sections.find((section) => section.id === 'skills')!.region = region;
    project.layout.appearance.sidebarSide = region === 'main' ? 'right' : 'left';
    await openProject(page, project);
    expect(await page.locator('.cv-page').count()).toBeGreaterThanOrEqual(4);
    expect(
      await page
        .locator('.cv-page')
        .evaluateAll(
          (pages) =>
            pages.filter((page) =>
              page.querySelector('[data-block-id^="skills-long-description-"]'),
            ).length,
        ),
    ).toBeGreaterThan(1);
    await printSkills(page, context, project, info, tokens);
  });
}

async function setProficiency(page: Page, value: number) {
  const slider = page.getByRole('slider', { name: 'Beherrschung', exact: true });
  await slider.focus();
  await slider.press(value > 50 ? 'End' : 'Home');
  const steps = value > 50 ? 100 - value : value;
  for (let i = 0; i < steps; i++) await slider.press(value > 50 ? 'ArrowLeft' : 'ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuenow', String(value));
}

test('individual proficiency sliders support endpoints, reordering and persistence', async ({
  page,
}, info) => {
  const project = createProject('blank');
  project.cv.title = 'Eigene Kompetenzwerte';
  await openProject(page, project);
  await page.getByRole('button', { name: 'Kenntnisse', exact: true }).click();
  await page.getByRole('button', { name: 'Eintrag hinzufügen', exact: true }).click();
  await page.getByRole('textbox', { name: 'Kenntnis', exact: true }).fill('TypeScript');
  await page
    .getByRole('combobox', { name: 'Kenntnisstand (optional)', exact: true })
    .fill('Projekterfahrung');
  await page.getByRole('combobox', { name: 'Kenntnisstand (optional)', exact: true }).press('Tab');
  await expect(page.locator('.cv-page [role="meter"]')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Eigene Progressbar anzeigen', exact: true }).check();
  const slider = page.getByRole('slider', { name: 'Beherrschung', exact: true });
  const meter = page.locator('.cv-page [role="meter"]');
  await expect(meter).toHaveAttribute('aria-valuenow', '0');
  await setProficiency(page, 73);
  await expect(meter).toHaveAttribute('aria-valuenow', '73');
  await expect(meter.locator('span')).toHaveAttribute('style', 'width: 73%;');
  await slider.focus();
  await slider.press('End');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuenow', '100');
  await expect(meter).toHaveAttribute('aria-valuenow', '100');
  await slider.press('Home');
  await slider.press('ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  await setProficiency(page, 73);
  await page.getByRole('checkbox', { name: 'Prozentangabe anzeigen', exact: true }).uncheck();
  await expect(page.locator('.cv-page .cv-proficiency-value')).toHaveCount(0);
  await expect(meter).toHaveAttribute('aria-valuenow', '73');
  await page.getByRole('button', { name: 'Eintrag hinzufügen', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Kenntnis', exact: true })
    .nth(1)
    .fill('Ohne Einschätzung');
  await page.getByRole('button', { name: 'Eintrag 1 nach unten', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Eigene Progressbar anzeigen', exact: true }).nth(0),
  ).not.toBeChecked();
  await expect(page.getByRole('slider', { name: 'Beherrschung', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '73',
  );
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  for (const display of ['Progressbar', 'Detailliert', 'Text'] as const) {
    await mode(page, display);
    await expect(meter).toHaveCount(1);
    await expect(meter).toHaveAttribute('aria-valuenow', '73');
  }
  await page.getByRole('switch', { name: 'Kenntnisstände anzeigen', exact: true }).uncheck();
  await expect(meter).toHaveAttribute('aria-valuenow', '73');
  await expect(page.locator('.cv-page .cv-skill-level')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Kenntnisstände anzeigen', exact: true }).check();
  await page.getByRole('tab', { name: 'Inhalt', exact: true }).click();
  await page.getByRole('button', { name: 'Sprachen', exact: true }).click();
  await page.getByRole('button', { name: 'Eintrag hinzufügen', exact: true }).click();
  await page.getByRole('textbox', { name: 'Sprache', exact: true }).fill('Englisch');
  await page.getByLabel('Sprachniveau (optional)', { exact: true }).fill('B2');
  const show = page.getByRole('checkbox', { name: 'Eigene Progressbar anzeigen', exact: true });
  await show.check();
  await setProficiency(page, 65);
  await page.getByRole('checkbox', { name: 'Prozentangabe anzeigen', exact: true }).uncheck();
  await expect(page.locator('.cv-page .cv-proficiency-value')).toHaveCount(0);
  await expect(page.locator('.cv-page [data-section="languages"]')).toContainText([
    'Sprachen',
    'EnglischB2',
  ]);
  await page.getByRole('checkbox', { name: 'Prozentangabe anzeigen', exact: true }).check();
  await expect(
    page.locator('.cv-page [data-section="languages"] .cv-proficiency-value'),
  ).toHaveText('65 %');
  await page.getByRole('checkbox', { name: 'Prozentangabe anzeigen', exact: true }).uncheck();
  await show.uncheck();
  await expect(page.locator('.cv-page [data-section="languages"] [role="meter"]')).toHaveCount(0);
  await show.check();
  await setProficiency(page, 65);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('proficiency.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.cv.schemaVersion).toBe(8);
  expect(saved.cv.skills.map((item) => item.proficiency)).toEqual([null, 73]);
  expect(saved.cv.languages[0]).toMatchObject({ level: 'B2', proficiency: 65 });
  expect(saved.layout.proficiencyPercentages.skills[saved.cv.skills[1].id]).toBe(false);
  expect(saved.layout.proficiencyPercentages.languages[saved.cv.languages[0].id]).toBe(false);
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await expect(page.locator('.cv-page [role="meter"]')).toHaveCount(2);
  await expect(page.locator('.cv-page .cv-proficiency-value')).toHaveCount(0);
  saved.cv.title += ' importiert';
  await openProject(page, saved);
  await expect(page.locator('.cv-page [role="meter"][aria-valuenow="73"]')).toHaveCount(1);
  await expect(page.locator('.cv-page [role="meter"][aria-valuenow="65"]')).toHaveCount(1);
  await expect(page.locator('.cv-page .cv-proficiency-value')).toHaveCount(0);
});

for (const [sample, fontId, sidebarSide] of [
  ['student', 'dm-sans', 'left'],
  ['adult', 'source-sans', 'right'],
  ['adult', 'lora', 'left'],
] as const) {
  test(
    'explicit competence and language bars match PDF: ' + sample + ' ' + fontId,
    async ({ page, context }, info) => {
      await page.addInitScript(() => {
        window.print = () => {
          document.documentElement.dataset.printRequested = 'true';
        };
      });
      const project = createProject(sample);
      project.cv.title = 'Kompetenzbalken ' + fontId;
      project.cv.skills = [
        makeSkill({ id: 'zero', name: 'Neue Technologie', proficiency: 0 }),
        makeSkill({
          id: 'partial',
          name: 'TypeScript',
          level: 'Projekterfahrung',
          proficiency: 73,
        }),
        makeSkill({ id: 'full', name: 'PowerShell', level: 'Gute Kenntnisse', proficiency: 100 }),
        makeSkill({ id: 'plain', name: 'Ohne Bewertung' }),
      ];
      project.cv.languages = [
        makeLanguage({ id: 'english', name: 'Englisch', level: 'B2', proficiency: 65 }),
        makeLanguage({ id: 'german', name: 'Deutsch', level: 'Muttersprache', proficiency: 100 }),
        makeLanguage({ id: 'french', name: 'Französisch', level: 'A2' }),
      ];
      project.layout.proficiencyPercentages.skills.partial = false;
      project.layout.proficiencyPercentages.languages.english = false;
      project.layout.skills.display =
        fontId === 'lora' ? 'detailed' : fontId === 'dm-sans' ? 'bars' : 'text';
      project.layout.appearance.fontId = fontId;
      project.layout.appearance.sidebarSide = sidebarSide;
      project.layout.sections.find((section) => section.id === 'skills')!.region =
        fontId === 'source-sans' ? 'sidebar' : 'main';
      project.layout.sections.find((section) => section.id === 'languages')!.region =
        fontId === 'source-sans' ? 'main' : 'sidebar';
      await openProject(page, project);
      if (sample === 'adult')
        expect(await page.locator('.cv-page').count()).toBeGreaterThanOrEqual(4);
      await expect(page.locator('.cv-page [role="meter"]')).toHaveCount(5);
      await expect(page.locator('.cv-page .cv-proficiency-value')).toHaveCount(3);
      const bars = await page.locator('.cv-page [role="meter"]').evaluateAll((elements) =>
        elements.map((element) => ({
          value: Number(element.getAttribute('aria-valuenow')),
          ratio:
            element.firstElementChild!.getBoundingClientRect().width /
            element.getBoundingClientRect().width,
        })),
      );
      for (const bar of bars) expect(bar.ratio).toBeCloseTo(bar.value / 100, 2);
      await printSkills(page, context, project, info, [
        'Neue Technologie',
        'Ohne Bewertung',
        'Englisch',
        'Deutsch',
        'Französisch',
      ]);
    },
  );
}
