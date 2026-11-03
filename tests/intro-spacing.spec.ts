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

function introGeometry() {
  const zoomText = getComputedStyle(document.querySelector('.preview-scale') ?? document.body).zoom;
  const zoom = zoomText.endsWith('%') ? parseFloat(zoomText) / 100 : parseFloat(zoomText) || 1;
  return [...document.querySelectorAll('.cv-page')].map((page, index) => {
    const origin = page.getBoundingClientRect();
    const rect = (element: Element | null) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        top: (box.top - origin.top) / zoom,
        bottom: (box.bottom - origin.top) / zoom,
        height: box.height / zoom,
      };
    };
    return {
      page: index,
      header: rect(page.querySelector('.cv-header-shell, .cv-running-header'))!,
      intro: rect(page.querySelector('.cv-intro-row')),
      transition: rect(page.querySelector('.cv-intro-transition')),
      main: rect(page.querySelector('.cv-body-row .cv-main h2')),
      sidebar: rect(page.querySelector('.cv-body-row .cv-sidebar h2')),
      summary: [...page.querySelectorAll('[data-section="summary"]')].map((block) => rect(block)!),
      blocks: [...page.querySelectorAll<HTMLElement>('.cv-block')].map((block) => ({
        id: block.dataset.blockId,
        ...rect(block)!,
      })),
      footer: rect(page.querySelector('.cv-footer'))!,
    };
  });
}

test('header and shared intro gaps stay adjustable without lines and survive saving', async ({
  page,
}, info) => {
  const project = createProject('adult');
  project.cv.title = 'Einstieg ohne Linien';
  project.cv.summary = 'Gemeinsam gute Produkte gestalten.';
  await openProject(page, project);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  const headerGap = page.getByRole('slider', { name: 'Abstand zum Header', exact: true });
  const introGap = page.getByRole('slider', {
    name: 'Abstand nach Kontakt & Über mich',
    exact: true,
  });
  const lines = page.getByRole('switch', { name: 'Horizontale Trennlinien', exact: true });
  await expect(lines).not.toBeChecked();
  await expect(headerGap).toHaveAttribute('aria-valuenow', '15');
  await expect(introGap).toHaveAttribute('aria-valuenow', '5');
  for (const key of ['Home', 'End'] as const) {
    await headerGap.press(key);
    await introGap.press(key);
    const value = key === 'Home' ? 0 : 30;
    const first = (await page.evaluate(introGeometry))[0];
    expect(first.intro!.top - first.header.bottom).toBeCloseTo((value * 96) / 25.4, 1);
    expect(first.main!.top - first.intro!.bottom).toBeCloseTo((value * 96) / 25.4, 1);
    expect(first.main!.top).toBeCloseTo(first.sidebar!.top, 1);
    await expect(page.locator('.cv-page hr')).toHaveCount(0);
  }
  await lines.check();
  const withLine = (await page.evaluate(introGeometry))[0];
  expect(withLine.main!.top).toBeCloseTo(withLine.sidebar!.top, 1);
  expect(withLine.main!.top - withLine.intro!.bottom).toBeGreaterThan((40 * 96) / 25.4);
  await expect(introGap).toHaveAttribute('aria-valuenow', '30');
  await lines.uncheck();
  const withoutLine = (await page.evaluate(introGeometry))[0];
  expect(withoutLine.main!.top - withoutLine.intro!.bottom).toBeCloseTo((30 * 96) / 25.4, 1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('intro-spacing.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.layout.appearance).toMatchObject({
    headerContentGapMm: 30,
    introBodyGapMm: 30,
    sectionDividers: false,
  });
  expect(saved.cv).toEqual(project.cv);
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(headerGap).toHaveAttribute('aria-valuenow', '30');
  await expect(introGap).toHaveAttribute('aria-valuenow', '30');
  await page.getByRole('slider', { name: 'Seitenrand', exact: true }).press('Home');
  await expect(headerGap).toHaveAttribute('aria-valuenow', '30');
  saved.cv.title = 'Einstiegsabstände importiert';
  await openProject(page, saved);
  const imported = (await page.evaluate(introGeometry))[0];
  expect(imported.intro!.top - imported.header.bottom).toBeCloseTo((30 * 96) / 25.4, 1);
});

for (const scenario of ['contact-taller', 'multipage-summary'] as const) {
  test(`aligned intro without dividers matches actual PDF: ${scenario}`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    const project = createProject('adult');
    project.cv.title = `Einstieg PDF ${scenario}`;
    Object.assign(project.layout.appearance, {
      sectionDividers: false,
      headerContentGapMm: scenario === 'contact-taller' ? 0 : 30,
      introBodyGapMm: scenario === 'contact-taller' ? 0 : 30,
      sidebarSide: scenario === 'contact-taller' ? 'left' : 'right',
      fontId: scenario === 'contact-taller' ? 'dm-sans' : 'lora',
    });
    project.cv.summary =
      scenario === 'contact-taller'
        ? 'Gemeinsam gute Produkte gestalten.'
        : Array.from({ length: 24 }, (_, i) => `Kurzprofil ${i + 1}: ${project.cv.summary}`).join(
            '\n',
          );
    if (scenario === 'multipage-summary') {
      project.assets.photo = {
        mediaType: 'image/png',
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=',
      };
      project.cv.contact.photoAssetId = 'photo';
      Object.assign(project.layout.appearance, {
        showPhoto: true,
        photoOverlapMm: 20,
        photoSide: 'left',
      });
    }
    await openProject(page, project);
    await expect(page.locator('.cv-page hr')).toHaveCount(0);
    const preview = await page.evaluate(introGeometry),
      bodyPage = preview.find((page) => page.transition)!;
    expect(preview[0].intro!.top - preview[0].header.bottom).toBeCloseTo(
      (project.layout.appearance.headerContentGapMm * 96) / 25.4,
      1,
    );
    expect(bodyPage.main!.top).toBeCloseTo(bodyPage.sidebar!.top, 1);
    expect(bodyPage.main!.top - (bodyPage.intro?.bottom ?? bodyPage.transition!.top)).toBeCloseTo(
      (project.layout.appearance.introBodyGapMm * 96) / 25.4,
      1,
    );
    for (const page of preview)
      for (const block of page.blocks)
        expect(block.bottom, `${block.id} on page ${page.page + 1}`).toBeLessThan(page.footer.top);
    if (scenario === 'multipage-summary') {
      expect(preview.filter((page) => page.summary.length).length).toBeGreaterThan(1);
      expect(
        preview.flatMap((page) => page.blocks).filter((block) => block.id?.startsWith('summary-')),
      ).toHaveLength(24);
    }
    const lastSummaryPage = preview.filter((page) => page.summary.length).at(-1)!;
    expect(bodyPage.page).toBeGreaterThanOrEqual(lastSummaryPage.page);
    if (bodyPage.page === lastSummaryPage.page)
      expect(bodyPage.main!.top).toBeGreaterThanOrEqual(lastSummaryPage.summary.at(-1)!.bottom);
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
      const printBoxes = await printed.evaluate(introGeometry);
      expect(printBoxes).toHaveLength(preview.length);
      for (const [i, page] of printBoxes.entries()) {
        for (const region of ['intro', 'main', 'sidebar', 'transition'] as const) {
          expect(!!page[region]).toBe(!!preview[i][region]);
          if (page[region])
            for (const key of ['top', 'height'] as const)
              expect(
                Math.abs(page[region]![key] - preview[i][region]![key]),
                `page ${i + 1} ${region} ${key}`,
              ).toBeLessThan(1.5);
        }
      }
      const bytes = await printed.pdf({
        path: info.outputPath('aligned-intro.pdf'),
        format: 'A4',
        preferCSSPageSize: true,
        printBackground: true,
      });
      const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
      try {
        const pdf = await task.promise;
        expect(pdf.numPages).toBe(preview.length);
        const items: { text: string; page: number; y: number }[] = [];
        for (let i = 1; i <= pdf.numPages; i++)
          items.push(
            ...(await (await pdf.getPage(i)).getTextContent()).items.flatMap((item) =>
              'str' in item ? [{ text: item.str, page: i - 1, y: item.transform[5] }] : [],
            ),
          );
        const normalized = items
          .map((item) => item.text)
          .join('')
          .replace(/\s/g, '');
        for (const section of ['experience', 'education', 'projects'] as const)
          for (const entry of project.cv[section])
            expect(normalized).toContain(entry.organization.replace(/\s/g, ''));
        if (scenario === 'multipage-summary')
          for (let i = 1; i <= 24; i++) expect(normalized).toContain(`Kurzprofil${i}:`);
        const experience = items.find((item) => item.text.trim() === 'ERFAHRUNG')!,
          skills = items.find((item) => item.text.trim() === 'KENNTNISSE')!;
        expect(experience.page).toBe(bodyPage.page);
        expect(skills.page).toBe(bodyPage.page);
        expect(Math.abs(experience.y - skills.y)).toBeLessThan(0.5);
        const page = await pdf.getPage(bodyPage.page + 1),
          viewport = page.getViewport({ scale: 1.5 });
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
        await page.render({ canvas, canvasContext, viewport }).promise;
        await writeFile(info.outputPath('aligned-body-start.png'), canvas.toBuffer('image/png'));
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

test('empty or disabled intro sections and moved summary do not add a redundant gap', async ({
  page,
}) => {
  for (const scenario of [
    'body-only',
    'intro-only',
    'summary-sidebar',
    'summary-disabled',
  ] as const) {
    const project = createProject(scenario === 'body-only' ? 'blank' : 'student');
    project.cv.title = `Einstieg ${scenario}`;
    Object.assign(project.layout.appearance, {
      sectionDividers: false,
      headerContentGapMm: 4,
      introBodyGapMm: 18,
    });
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
    await expect(page.locator('.cv-page hr')).toHaveCount(0);
    await expect(page.locator('.cv-page .cv-intro-transition')).toHaveCount(
      scenario === 'body-only' || scenario === 'intro-only' ? 0 : 1,
    );
    if (scenario === 'summary-sidebar' || scenario === 'summary-disabled') {
      const first = (await page.evaluate(introGeometry))[0];
      expect(first.main!.top).toBeCloseTo(first.sidebar!.top, 1);
      expect(first.main!.top - first.intro!.bottom).toBeCloseTo((18 * 96) / 25.4, 1);
    }
  }
});
