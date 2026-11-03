import { expect, test, type Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createProject, makeReference } from '../packages/core/src/fixtures';
import { headingIds, headingLabels, parseProject, type Project } from '../packages/core/src/schema';
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

function headingGeometry() {
  const zoomText = getComputedStyle(document.querySelector('.preview-scale') ?? document.body).zoom;
  const zoom = zoomText.endsWith('%') ? parseFloat(zoomText) / 100 : parseFloat(zoomText) || 1;
  return [...document.querySelectorAll('.cv-page')].flatMap((page, i) => {
    const origin = page.getBoundingClientRect();
    return [...page.querySelectorAll<HTMLElement>('.cv-block > h2')].map((heading) => {
      const box = heading.getBoundingClientRect();
      return {
        id: heading.parentElement!.dataset.blockId,
        page: i,
        text: heading.textContent!,
        top: (box.top - origin.top) / zoom,
        height: box.height / zoom,
        size: parseFloat(getComputedStyle(heading).fontSize),
      };
    });
  });
}

test('all headings can be renamed and resized independently and survive moving, saving and import', async ({
  page,
}, info) => {
  const project = createProject('adult');
  project.cv.title = 'Überschriften bearbeiten';
  await openProject(page, project);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  for (const id of headingIds) {
    await expect(
      page.getByRole('textbox', { name: `Überschrift für ${headingLabels[id]}`, exact: true }),
    ).toHaveValue(headingLabels[id]);
    await expect(
      page.getByRole('slider', { name: `Schriftgrösse für ${headingLabels[id]}`, exact: true }),
    ).toHaveAttribute('aria-valuenow', '9');
  }
  const title = page.getByRole('textbox', { name: 'Überschrift für Erfahrung', exact: true });
  const size = page.getByRole('slider', { name: 'Schriftgrösse für Erfahrung', exact: true });
  await title.fill('Berufserfahrung');
  await size.press('End');
  await page
    .getByRole('textbox', { name: 'Überschrift für Kontakt', exact: true })
    .fill('Kontaktangaben');
  await page
    .getByRole('textbox', { name: 'Überschrift für Über mich', exact: true })
    .fill('Persönliches Profil');
  await page
    .getByRole('textbox', { name: 'Überschrift für Kenntnisse', exact: true })
    .fill('Fachkenntnisse');
  await page
    .getByRole('slider', { name: 'Schriftgrösse für Kenntnisse', exact: true })
    .press('Home');
  await expect(page.locator('.cv-page [data-block-id="heading-experience"] h2')).toHaveText(
    'Berufserfahrung',
  );
  const headings = await page.evaluate(headingGeometry);
  expect(headings.find((heading) => heading.id === 'heading-experience')!.size).toBeCloseTo(
    (20 * 96) / 72,
    2,
  );
  expect(headings.find((heading) => heading.id === 'heading-skills')!.size).toBeCloseTo(
    (8 * 96) / 72,
    2,
  );
  expect(headings.find((heading) => heading.id === 'heading-experience')!.top).toBeCloseTo(
    headings.find((heading) => heading.id === 'heading-skills')!.top,
    1,
  );
  await page.getByRole('button', { name: 'Erfahrung nach oben', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Bereich für Erfahrung', exact: true })
    .selectOption('sidebar');
  await expect(
    page.locator('.cv-page .cv-sidebar [data-block-id="heading-experience"] h2'),
  ).toHaveText('Berufserfahrung');
  await expect(size).toHaveAttribute('aria-valuenow', '20');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('headings.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.cv).toEqual(project.cv);
  expect(saved.layout.appearance.sectionHeadings.experience).toEqual({
    title: 'Berufserfahrung',
    fontSizePt: 20,
  });
  expect(saved.layout.appearance.sectionHeadings.skills).toEqual({
    title: 'Fachkenntnisse',
    fontSizePt: 8,
  });
  expect(saved.layout.sections.find((section) => section.id === 'experience')!.region).toBe(
    'sidebar',
  );
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(title).toHaveValue('Berufserfahrung');
  await expect(size).toHaveAttribute('aria-valuenow', '20');
  await title.fill('   ');
  await expect(page.locator('.cv-page [data-block-id="heading-experience"] h2')).toHaveText(
    'Erfahrung',
  );
  saved.cv.title = 'Eigene Überschriften importiert';
  await openProject(page, saved);
  await expect(page.locator('.cv-page [data-block-id="heading-experience"] h2')).toHaveText(
    'Berufserfahrung',
  );
});

for (const kind of ['student', 'adult'] as const) {
  test(`long custom headings and large sizes remain complete in preview and actual PDF: ${kind}`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    const project = createProject(kind);
    project.cv.title = `Eigene Titel im PDF ${kind}`;
    project.cv.references = [
      makeReference({
        id: 'reference-heading',
        name: 'Robin Beispiel',
        email: 'robin@example.com',
      }),
    ];
    Object.assign(project.layout.appearance, {
      sectionDividers: true,
      fontId: kind === 'student' ? 'source-sans' : 'lora',
      sidebarSide: kind === 'student' ? 'left' : 'right',
      sidebarPercent: 25,
    });
    Object.assign(project.layout.appearance.sectionHeadings, {
      contact: { title: 'Kontaktmöglichkeiten', fontSizePt: 16 },
      summary: { title: 'Profil & Motivation', fontSizePt: 12 },
      experience: { title: 'Berufserfahrung und praktische Einblicke', fontSizePt: 20 },
      education: { title: 'Ausbildung & Abschlüsse', fontSizePt: 18 },
      projects: { title: 'Ausgewählte Projekte & Engagement', fontSizePt: 20 },
      skills: { title: 'Fachkenntnisse und digitale Werkzeuge', fontSizePt: 18 },
      languages: { title: 'Sprachkenntnisse', fontSizePt: 14 },
      interests: { title: 'Persönliche Interessen', fontSizePt: 8 },
    });
    if (kind === 'adult')
      project.layout.sections.find((section) => section.id === 'projects')!.region = 'sidebar';
    await openProject(page, project);
    const preview = await page.evaluate(headingGeometry),
      count = await page.locator('.cv-page').count();
    expect(preview).toHaveLength(headingIds.length);
    if (kind === 'adult') expect(count).toBeGreaterThanOrEqual(4);
    const problems = await page.locator('.cv-page').evaluateAll((pages) =>
      pages.flatMap((page) => {
        const footer = page.querySelector('.cv-footer')!.getBoundingClientRect();
        return [...page.querySelectorAll<HTMLElement>('.cv-block')].flatMap((block) => {
          const errors: string[] = [];
          if (
            block.getBoundingClientRect().bottom >= footer.top ||
            block.scrollWidth > block.clientWidth + 1
          )
            errors.push(`overflow ${block.dataset.blockId}`);
          // Summary fragments and list items share semantic paragraph/list wrappers.
          // Inspect their first flow block on this page when checking heading orphans.
          const next = block.nextElementSibling;
          const nextBlock = next?.matches('.cv-summary-paragraph, .cv-description-list')
            ? next.querySelector(':scope > .cv-block')
            : next;
          if (
            block.querySelector('h2') &&
            !nextBlock?.matches('.cv-block:not(.cv-section-divider)')
          )
            errors.push(`orphan heading ${block.dataset.blockId}`);
          return errors;
        });
      }),
    );
    expect(problems).toEqual([]);
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
      const printHeadings = await printed.evaluate(headingGeometry);
      expect(printHeadings.map((heading) => [heading.id, heading.page, heading.text])).toEqual(
        preview.map((heading) => [heading.id, heading.page, heading.text]),
      );
      for (const [i, heading] of printHeadings.entries()) {
        expect(heading.size).toBeCloseTo(preview[i].size, 2);
        for (const key of ['top', 'height'] as const)
          expect(Math.abs(heading[key] - preview[i][key]), `${heading.id}: ${key}`).toBeLessThan(
            1.5,
          );
      }
      const bytes = await printed.pdf({
        path: info.outputPath('custom-headings.pdf'),
        format: 'A4',
        preferCSSPageSize: true,
        printBackground: true,
      });
      const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
      try {
        const pdf = await task.promise;
        expect(pdf.numPages).toBe(count);
        const items: { text: string; size: number }[] = [];
        for (let i = 1; i <= pdf.numPages; i++)
          items.push(
            ...(await (await pdf.getPage(i)).getTextContent()).items.flatMap((item) =>
              'str' in item
                ? [{ text: item.str, size: Math.hypot(item.transform[0], item.transform[1]) }]
                : [],
            ),
          );
        const normalized = items
          .map((item) => item.text)
          .join('')
          .replace(/\s/g, '');
        for (const id of headingIds) {
          const heading = project.layout.appearance.sectionHeadings[id];
          expect(normalized).toContain(heading.title.toUpperCase().replace(/\s/g, ''));
          const item = items.find(
            (item) =>
              item.text.trim().length >= 3 &&
              heading.title.toUpperCase().startsWith(item.text.trim()),
          );
          expect(item, `PDF heading ${id}`).toBeDefined();
          expect(item!.size).toBeCloseTo(heading.fontSizePt, 1);
        }
        for (const section of ['education', 'experience', 'projects'] as const)
          for (const entry of project.cv[section])
            expect(normalized).toContain(entry.organization.replace(/\s/g, ''));
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
        await writeFile(info.outputPath('custom-headings.png'), canvas.toBuffer('image/png'));
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
