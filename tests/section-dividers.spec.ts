import { test, expect, type Page } from '@playwright/test';
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

function geometry() {
  const zoomText = getComputedStyle(document.querySelector('.preview-scale') ?? document.body).zoom;
  const zoom = zoomText.endsWith('%') ? parseFloat(zoomText) / 100 : parseFloat(zoomText) || 1;
  return [...document.querySelectorAll('.cv-page')].flatMap((page, pageIndex) => {
    const origin = page.getBoundingClientRect();
    return [
      ...page.querySelectorAll<HTMLElement>('.cv-block, .cv-wide-divider, .cv-intro-transition'),
    ].map((block) => {
      const box = block.getBoundingClientRect();
      return {
        id:
          block.dataset.blockId ??
          (block.matches('.cv-intro-transition') ? 'intro-transition' : 'wide-divider'),
        page: pageIndex,
        top: (box.top - origin.top) / zoom,
        left: (box.left - origin.left) / zoom,
        width: box.width / zoom,
        height: box.height / zoom,
      };
    });
  });
}

async function inspectLayout(page: Page) {
  const result = await page.locator('.cv-page').evaluateAll((pages) =>
    pages.flatMap((page) => {
      const footer = page.querySelector('.cv-footer')!.getBoundingClientRect();
      return [...page.querySelectorAll<HTMLElement>('.cv-block, .cv-wide-divider')].flatMap(
        (block) => {
          const failures: string[] = [],
            box = block.getBoundingClientRect();
          if (box.bottom >= footer.top || block.scrollWidth > block.clientWidth + 1)
            failures.push(`overflow: ${block.dataset.blockId}`);
          if (block.matches('.cv-section-divider')) {
            const column = block.parentElement!,
              columnBox = column.getBoundingClientRect();
            // Timeline-aligned lines may start left of the normal column inset.
            const heading = block.nextElementSibling?.querySelector('h2')?.getBoundingClientRect();
            if (
              (column.matches('.cv-main') && heading && Math.abs(box.left - heading.left) > 0.5) ||
              box.right > columnBox.right + 0.5
            )
              failures.push(`line outside column: ${block.dataset.blockId}`);
            if (!block.nextElementSibling?.querySelector('h2'))
              failures.push(`orphan divider: ${block.dataset.blockId}`);
          }
          return failures;
        },
      );
    }),
  );
  expect(result).toEqual([]);
}

test('optional dividers align student sections and survive save, reload and import', async ({
  page,
}, info) => {
  const project = createProject('student');
  project.cv.title = 'Trennlinien speichern';
  await openProject(page, project);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  const toggle = page.getByRole('switch', { name: 'Horizontale Trennlinien', exact: true });
  await expect(toggle).not.toBeChecked();
  await expect(page.locator('.cv-page hr')).toHaveCount(0);
  await toggle.check();
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.cv-page .cv-wide-divider')).toHaveCount(1);
  const boxes = await page.evaluate(geometry);
  const school = boxes.find((box) => box.id === 'heading-education')!,
    skills = boxes.find((box) => box.id === 'heading-skills')!;
  expect(school.page).toBe(skills.page);
  expect(school.top).toBeCloseTo(skills.top, 1);
  await expect(page.locator('.cv-page .cv-body-row .cv-main h2').first()).toHaveText('Ausbildung');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('dividers.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.layout.appearance.sectionDividers).toBe(true);
  expect(saved.cv).toEqual(project.cv);
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(page.locator('.cv-page hr')).toHaveCount(0);
  saved.cv.title = 'Trennlinien erneut importiert';
  await openProject(page, saved);
  await expect(page.locator('.cv-page .cv-wide-divider')).toHaveCount(1);
  await inspectLayout(page);
});

for (const side of ['left', 'right'] as const) {
  test(`shared separator and aligned headings match exported PDF with sidebar ${side}`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    const project = createProject('adult');
    project.cv.title = `Trennlinien PDF ${side}`;
    Object.assign(project.layout.appearance, {
      sectionDividers: true,
      sidebarSide: side,
      fontId: side === 'left' ? 'dm-sans' : 'lora',
      timelineOffsetMm: side === 'left' ? -10 : 12,
    });
    project.cv.summary =
      side === 'left'
        ? 'Gemeinsam gute Produkte gestalten.'
        : Array.from({ length: 5 }, (_, i) => `Absatz ${i + 1}: ${project.cv.summary}`).join('\n');
    if (side === 'right') {
      project.cv.contact.photoAssetId = 'photo';
      project.assets.photo = {
        mediaType: 'image/png',
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=',
      };
      Object.assign(project.layout.appearance, {
        showPhoto: true,
        photoSide: 'left',
        photoOverlapMm: 14,
        headerImageAssetId: 'photo',
        headerImageTransparencyPercent: 30,
      });
    }
    await openProject(page, project);
    const count = await page.locator('.cv-page').count();
    expect(count).toBeGreaterThanOrEqual(4);
    const sharesIntro = await page
      .locator('.cv-page .cv-intro-transition')
      .evaluate((transition) => !!transition.previousElementSibling?.matches('.cv-intro-row'));
    expect(sharesIntro).toBe(side === 'left');
    await expect(page.locator('.cv-page .cv-wide-divider')).toHaveCount(sharesIntro ? 1 : 0);
    if (sharesIntro) {
      const wide = await page.locator('.cv-page .cv-wide-divider hr').evaluate((line) => {
        const columns = line.closest('.cv-columns')!,
          box = columns.getBoundingClientRect(),
          style = getComputedStyle(columns);
        const zoomText = getComputedStyle(document.querySelector('.preview-scale')!).zoom;
        const zoom = zoomText.endsWith('%') ? parseFloat(zoomText) / 100 : parseFloat(zoomText);
        const hr = line.getBoundingClientRect();
        return {
          width: hr.width / zoom,
          innerWidth:
            box.width / zoom - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
          x: (hr.left - box.left) / zoom,
          padding: parseFloat(style.paddingLeft),
        };
      });
      expect(wide.width).toBeCloseTo(wide.innerWidth, 1);
      expect(wide.x).toBeCloseTo(wide.padding, 1);
    }
    const preview = await page.evaluate(geometry);
    const experience = preview.find((box) => box.id === 'heading-experience')!,
      skills = preview.find((box) => box.id === 'heading-skills')!,
      separator = preview.find((box) => box.id === 'intro-transition')!;
    if (!sharesIntro)
      expect(separator.height).toBeCloseTo(
        (project.layout.appearance.introBodyGapMm * 96) / 25.4,
        1,
      );
    expect(experience.page).toBe(skills.page);
    expect(experience.page).toBe(separator.page);
    expect(experience.top).toBeCloseTo(skills.top, 1);
    expect(experience.top).toBeGreaterThanOrEqual(separator.top + separator.height - 0.1);
    const intro = preview.filter(
      (box) =>
        box.id.startsWith('contact-') ||
        box.id.startsWith('summary-') ||
        box.id === 'heading-summary',
    );
    for (const box of intro)
      expect(
        box.page < separator.page ||
          (box.page === separator.page && box.top + box.height <= separator.top + 0.1),
      ).toBe(true);
    await inspectLayout(page);
    await page
      .locator('.cv-page')
      .first()
      .screenshot({ path: info.outputPath('preview.png') });
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
        await Promise.all([...document.images].map((image) => image.decode()));
      });
      await printed.emulateMedia({ media: 'print' });
      const printBoxes = await printed.evaluate(geometry);
      expect(printBoxes.map((box) => [box.id, box.page])).toEqual(
        preview.map((box) => [box.id, box.page]),
      );
      for (const [i, box] of printBoxes.entries())
        for (const key of ['left', 'top', 'width', 'height'] as const)
          expect(Math.abs(box[key] - preview[i][key]), `${box.id}: ${key}`).toBeLessThan(1.5);
      const bytes = await printed.pdf({
        path: info.outputPath('dividers.pdf'),
        format: 'A4',
        preferCSSPageSize: true,
        printBackground: true,
      });
      const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
      try {
        const pdf = await task.promise;
        expect(pdf.numPages).toBe(count);
        const items: { text: string; page: number; y: number }[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const content = await (await pdf.getPage(i)).getTextContent();
          items.push(
            ...content.items.flatMap((item) =>
              'str' in item ? [{ text: item.str, page: i - 1, y: item.transform[5] }] : [],
            ),
          );
        }
        const text = items
          .map((item) => item.text)
          .join('')
          .replace(/\s/g, '');
        for (const section of ['experience', 'education', 'projects'] as const)
          for (const entry of project.cv[section])
            expect(text).toContain(entry.organization.replace(/\s/g, ''));
        const pdfExperience = items.find((item) => item.text.trim() === 'ERFAHRUNG')!,
          pdfSkills = items.find((item) => item.text.trim() === 'KENNTNISSE')!;
        expect(pdfExperience.page).toBe(experience.page);
        expect(pdfSkills.page).toBe(pdfExperience.page);
        expect(Math.abs(pdfSkills.y - pdfExperience.y)).toBeLessThan(0.5);
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
        await writeFile(info.outputPath('pdf-page-1.png'), canvas.toBuffer('image/png'));
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

test('multipage summary finishes before either column starts and reordered sections stay in their column', async ({
  page,
}, info) => {
  const project = createProject('student');
  project.cv.title = 'Mehrseitiger Einstieg';
  project.layout.appearance.sectionDividers = true;
  project.cv.summary = Array.from(
    { length: 40 },
    (_, i) => `Kurzprofil Absatz ${i + 1}: ${project.cv.summary}`,
  ).join('\n');
  project.layout.sections.find((section) => section.id === 'education')!.region = 'sidebar';
  project.layout.sections.reverse();
  await openProject(page, project);
  const boxes = await page.evaluate(geometry),
    divider = boxes.find((box) => box.id === 'intro-transition')!;
  const summaries = boxes.filter((box) => box.id.startsWith('summary-'));
  expect(new Set(summaries.map((box) => box.page)).size).toBeGreaterThan(1);
  expect(summaries).toHaveLength(40);
  for (const box of summaries)
    expect(
      box.page < divider.page ||
        (box.page === divider.page && box.top + box.height <= divider.top + 0.1),
    ).toBe(true);
  const mainStart = boxes.find((box) => box.id === 'heading-projects')!,
    sidebarStart = boxes.find((box) => box.id === 'heading-interests')!;
  expect(mainStart.page).toBe(divider.page);
  expect(sidebarStart.page).toBe(divider.page);
  expect(mainStart.top).toBeCloseTo(sidebarStart.top, 1);
  await expect(page.locator('.cv-page .cv-body-row .cv-sidebar h2')).toHaveText([
    'Interessen',
    'Sprachen',
    'Kenntnisse',
    'Ausbildung',
  ]);
  await inspectLayout(page);
  await page.emulateMedia({ media: 'print' });
  const bytes = await page.pdf({
    path: info.outputPath('long-intro.pdf'),
    format: 'A4',
    preferCSSPageSize: true,
    printBackground: true,
  });
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
  try {
    const pdf = await task.promise;
    expect(pdf.numPages).toBe(await page.locator('.cv-page').count());
    const text: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++)
      text.push(
        (await (await pdf.getPage(i)).getTextContent()).items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' '),
      );
    for (let i = 1; i <= 40; i++)
      expect(text.join(' ').replace(/\s/g, '')).toContain(`KurzprofilAbsatz${i}:`);
    expect(text.join(' ')).toContain(project.cv.experience[0].organization);
  } finally {
    await task.destroy();
  }
});

test('empty and moved introductory sections do not produce extra shared separators', async ({
  page,
}) => {
  for (const scenario of [
    'blank',
    'body-only',
    'intro-only',
    'summary-sidebar',
    'summary-disabled',
  ] as const) {
    const project = createProject(
      scenario === 'blank' || scenario === 'body-only' ? 'blank' : 'student',
    );
    project.cv.title = `Trennlinien ${scenario}`;
    project.layout.appearance.sectionDividers = true;
    if (scenario === 'body-only')
      project.cv.skills = [
        {
          id: 'skill',
          name: 'TypeScript',
          level: 'Grundkenntnisse',
          description: '',
          category: '',
          proficiency: null,
        },
      ];
    if (scenario === 'intro-only')
      project.layout.sections.forEach((section) => {
        section.enabled = section.id === 'summary';
      });
    if (scenario === 'summary-sidebar')
      project.layout.sections.find((section) => section.id === 'summary')!.region = 'sidebar';
    if (scenario === 'summary-disabled')
      project.layout.sections.find((section) => section.id === 'summary')!.enabled = false;
    await openProject(page, project);
    await expect(page.locator('.cv-page .cv-wide-divider')).toHaveCount(
      scenario === 'summary-sidebar' || scenario === 'summary-disabled' ? 1 : 0,
    );
    if (scenario === 'summary-sidebar')
      await expect(page.locator('.cv-page .cv-intro-row .cv-sidebar h2')).toHaveText([
        'Kontakt',
        'Über mich',
      ]);
    if (scenario === 'summary-disabled')
      await expect(page.locator('.cv-page [data-block-id="heading-summary"]')).toHaveCount(0);
    await inspectLayout(page);
  }
});
