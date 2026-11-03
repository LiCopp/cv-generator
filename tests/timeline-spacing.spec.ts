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
function stationBoxes() {
  const zoomText = getComputedStyle(document.querySelector('.preview-scale') ?? document.body).zoom;
  const zoom = zoomText.endsWith('%') ? parseFloat(zoomText) / 100 : parseFloat(zoomText) || 1;
  return [...document.querySelectorAll('.cv-page')].flatMap((page) => {
    const origin = page.getBoundingClientRect();
    return [...page.querySelectorAll<HTMLElement>('.cv-station')].map((block) => {
      const box = block.getBoundingClientRect();
      return {
        id: block.dataset.blockId,
        top: (box.top - origin.top) / zoom,
        left: (box.left - origin.left) / zoom,
        height: box.height / zoom,
        width: box.width / zoom,
        paddingBottom: parseFloat(getComputedStyle(block).paddingBottom),
      };
    });
  });
}

function pointBoxes() {
  return [...document.querySelectorAll('.cv-page')].flatMap((page, index) => {
    const origin = page.getBoundingClientRect(),
      mm = origin.width / 210,
      zoom = mm / (96 / 25.4);
    return [...page.querySelectorAll<HTMLElement>('.cv-station-dot')].map((marker) => {
      const dot = marker.getBoundingClientRect(),
        station = marker.closest<HTMLElement>('.cv-station')!;
      const field = station.querySelector<HTMLElement>('.cv-entry-title > :first-child')!,
        box = field.getBoundingClientRect();
      const line = parseFloat(getComputedStyle(field).lineHeight) * zoom;
      const pseudo = getComputedStyle(station, '::before');
      const lineStart =
        station.previousElementSibling?.querySelector(':scope > h2') &&
        pseudo.display !== 'none' &&
        pseudo.content !== 'none'
          ? (station.getBoundingClientRect().top - origin.top + parseFloat(pseudo.top) * zoom) / mm
          : null;
      return {
        id: station.dataset.blockId,
        page: index,
        field: field.dataset.stationField,
        x: (dot.left + dot.width / 2 - origin.left) / mm,
        y: (dot.top + dot.height / 2 - origin.top) / mm,
        firstLine: (box.top + line / 2 - origin.top) / mm,
        lineStart,
        wrapped: box.height > line * 1.5,
      };
    });
  });
}

test('station points follow the first visible line for all orders, wrapped fields and missing metadata', async ({
  page,
}) => {
  const project = createProject('student');
  project.layout.sections.find((section) => section.id === 'education')!.region = 'sidebar';
  project.cv.education[0].title =
    'Verantwortung für gemeinsame Planung und Umsetzung langfristiger Projekte und verständlicher technischer Lösungen';
  project.cv.education[0].organization =
    'Beispielorganisation mit mehreren Fachbereichen und einem langen Institutionsnamen';
  project.cv.experience[0].title = project.cv.education[0].title;
  project.cv.experience[0].organization = project.cv.education[0].organization;
  Object.assign(project.cv.projects[0], {
    start: null,
    end: null,
    current: false,
    organization: '',
    location: '',
  });
  const orders = [
    ['date', 'title', 'organization'],
    ['date', 'organization', 'title'],
    ['title', 'date', 'organization'],
    ['title', 'organization', 'date'],
    ['organization', 'date', 'title'],
    ['organization', 'title', 'date'],
  ] as const;
  for (const timelineStyle of ['dots', 'line'] as const)
    for (const [index, order] of orders.entries()) {
      project.cv.title = `Stationspunkte ${timelineStyle} ${index}`;
      Object.assign(project.layout.appearance, {
        timelineStyle,
        stationHeadingOrder: [...order],
        sidebarSide: index % 2 ? 'right' : 'left',
        fontId: index % 2 ? 'lora' : 'source-sans',
        fontSizePt: index % 2 ? 12 : 9,
        stationDateLineHeight: index % 2 ? 2.4 : 1.1,
        stationTitleLineHeight: index % 2 ? 2.4 : 1.45,
        stationOrganizationLineHeight: index % 2 ? 2.4 : 1,
        stationDateTitleGapMm: 8,
        stationTitleOrganizationGapMm: 8,
      });
      await openProject(page, project);
      const points = await page.evaluate(pointBoxes);
      expect(points).toHaveLength(2);
      await expect(page.locator('.cv-page .cv-sidebar .cv-station-dot')).toHaveCount(0);
      for (const point of points) {
        expect(point.field).toBe(point.id?.startsWith('projects-') ? 'title' : order[0]);
        expect(Math.abs(point.y - point.firstLine), point.id).toBeLessThan(0.02);
        if (point.lineStart !== null)
          expect(Math.abs(point.y - point.lineStart), point.id).toBeLessThan(0.02);
      }
      if (order[0] !== 'date')
        expect(points.some((point) => point.id?.startsWith('experience-') && point.wrapped)).toBe(
          true,
        );
    }
});

test('spacing controls apply to all station sections and survive save, reload and marker changes', async ({
  page,
}, info) => {
  const project = createProject('student');
  project.cv.title = 'Zeitachsenabstände testen';
  for (const section of ['education', 'experience', 'projects'] as const) {
    const entry = project.cv[section][0];
    project.cv[section] = [0, 1].map((index) => ({
      ...structuredClone(entry),
      id: `${section}-${index}`,
      title: `${section} Station ${index + 1}`,
      description: index ? '' : 'Erster Absatz.\nZweiter Absatz.',
    }));
  }
  await openProject(page, project);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  const textGap = page.getByRole('slider', { name: 'Abstand Zeitachse zum Text', exact: true });
  const stationGap = page.getByRole('slider', { name: 'Abstand zwischen Stationen', exact: true });
  for (const [key, gap, spacing] of [
    ['Home', 2, 0],
    ['End', 14, 12],
  ] as const) {
    await textGap.press(key);
    await stationGap.press(key);
    await expect(textGap).toHaveAttribute('aria-valuenow', String(gap));
    await expect(stationGap).toHaveAttribute('aria-valuenow', String(spacing));
    const geometry = await page.locator('.cv-measure').evaluate((root) => {
      return [...root.querySelectorAll<HTMLElement>('.cv-station')].map((block) => {
        const style = getComputedStyle(block),
          dot = block.querySelector('.cv-station-dot')?.getBoundingClientRect();
        const title = block.querySelector('.cv-entry-title')?.getBoundingClientRect();
        return {
          id: block.dataset.blockId,
          gap: title && dot ? title.left - dot.left - dot.width / 2 : null,
          end: block.matches('.cv-station-end, .cv-station-single'),
          padding: parseFloat(style.paddingBottom),
        };
      });
    });
    for (const section of ['education', 'experience', 'projects']) {
      const blocks = geometry.filter((block) => block.id!.startsWith(`${section}-`));
      expect(blocks.filter((block) => block.gap !== null)).toHaveLength(2);
      for (const block of blocks) {
        if (block.gap !== null) expect(block.gap).toBeCloseTo((gap * 96) / 25.4, 1);
        expect(block.padding).toBeCloseTo(((1.8 + (block.end ? spacing : 0)) * 96) / 25.4, 1);
      }
    }
  }
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const path = info.outputPath('station-spacing.json');
  await (await download).saveAs(path);
  const saved = parseProject(await readFile(path, 'utf8'));
  expect(saved.layout.appearance).toMatchObject({ timelineTextGapMm: 14, stationSpacingMm: 12 });
  expect(saved.cv).toEqual(project.cv);
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(textGap).toHaveAttribute('aria-valuenow', '14');
  await expect(stationGap).toHaveAttribute('aria-valuenow', '12');
  await page.getByRole('combobox', { name: /^Stationen markieren/ }).click();
  await page.getByRole('option', { name: 'Ohne Markierung', exact: true }).click();
  await expect(textGap).toBeDisabled();
  await expect(stationGap).toBeEnabled();
  await expect(page.locator('.cv-page .cv-station').first()).toHaveCSS('padding-left', '0px');
  await page.getByRole('combobox', { name: /^Stationen markieren/ }).click();
  await page.getByRole('option', { name: 'Nur Punkte', exact: true }).click();
  await expect(textGap).toBeEnabled();
  await expect(textGap).toHaveAttribute('aria-valuenow', '14');
});

for (const kind of ['student', 'adult'] as const) {
  for (const maximum of [false, true]) {
    test(`${kind} station spacing ${maximum ? 'maximum' : 'minimum'} keeps PDF complete in both columns`, async ({
      page,
      context,
    }, info) => {
      await page.addInitScript(() => {
        window.print = () => {
          document.documentElement.dataset.printRequested = 'true';
        };
      });
      const project = createProject(kind);
      project.cv.title += maximum ? ' – grosse Abstände' : ' – kleine Abstände';
      Object.assign(project.layout.appearance, {
        timelineTextGapMm: maximum ? 14 : 2,
        stationSpacingMm: maximum ? 12 : 0,
        timelineOffsetMm: maximum ? 12 : -10,
        sidebarSide: maximum ? 'right' : 'left',
        sidebarPercent: 25,
        fontSizePt: 12,
        fontId: 'lora',
      });
      project.layout.appearance.stationHeadingOrder = maximum
        ? ['title', 'date', 'organization']
        : ['organization', 'title', 'date'];
      project.layout.page.marginMm = maximum ? 22 : 10;
      project.layout.sections.find((section) => section.id === 'education')!.region = 'sidebar';
      await openProject(page, project);
      const count = await page.locator('.cv-page').count();
      if (kind === 'adult') expect(count).toBeGreaterThanOrEqual(4);
      const expected = await page.locator('.cv-measure').evaluate((root) => {
        const left = root.getBoundingClientRect().left;
        return [...root.querySelectorAll<HTMLElement>('.cv-station-start, .cv-station-single')].map(
          (block) => {
            const title = block.querySelector('h3')!;
            const dot = block.querySelector('.cv-station-dot')?.getBoundingClientRect();
            const content = block.querySelector('.cv-entry-title')!.getBoundingClientRect();
            return {
              title: title.textContent!,
              gap: dot ? content.left - dot.left - dot.width / 2 : null,
              x: ((title.getBoundingClientRect().left - left) * 72) / 96,
            };
          },
        );
      });
      expect(expected).toHaveLength(
        project.cv.education.length + project.cv.experience.length + project.cv.projects.length,
      );
      for (const entry of expected)
        if (entry.gap !== null)
          expect(entry.gap).toBeCloseTo(
            (project.layout.appearance.timelineTextGapMm * 96) / 25.4,
            1,
          );
      const overflow = await page.locator('.cv-page').evaluateAll((pages) =>
        pages.flatMap((page) => {
          const footer = page.querySelector('.cv-footer')!.getBoundingClientRect();
          return [...page.querySelectorAll<HTMLElement>('.cv-station')]
            .filter(
              (block) =>
                block.getBoundingClientRect().bottom >= footer.top ||
                block.scrollWidth > block.clientWidth + 1,
            )
            .map((block) => block.textContent);
        }),
      );
      expect(overflow).toEqual([]);
      const previewBoxes = await page.evaluate(stationBoxes);
      const previewPoints = await page.evaluate(pointBoxes);
      for (const point of previewPoints)
        expect(Math.abs(point.y - point.firstLine), point.id).toBeLessThan(0.02);
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
        await printPage.emulateMedia({ media: 'print' });
        const printBoxes = await printPage.evaluate(stationBoxes);
        const printPoints = await printPage.evaluate(pointBoxes);
        expect(printPoints.map((point) => point.id)).toEqual(
          previewPoints.map((point) => point.id),
        );
        for (const [index, point] of printPoints.entries()) {
          expect(point.page).toBe(previewPoints[index].page);
          expect(Math.abs(point.y - point.firstLine), point.id).toBeLessThan(0.02);
          expect(Math.abs(point.y - previewPoints[index].y), point.id).toBeLessThan(0.3);
          if (point.lineStart !== null)
            expect(Math.abs(point.y - point.lineStart), point.id).toBeLessThan(0.02);
        }
        expect(printBoxes.map((box) => box.id)).toEqual(previewBoxes.map((box) => box.id));
        for (const [i, box] of printBoxes.entries()) {
          expect(box.paddingBottom).toBeCloseTo(previewBoxes[i].paddingBottom, 1);
          // Preview zoom rounds font metrics; check geometry within one CSS pixel,
          // while the physical spacing itself must match without that tolerance.
          for (const key of ['top', 'left', 'width', 'height'] as const)
            expect(Math.abs(box[key] - previewBoxes[i][key]), `${box.id}: ${key}`).toBeLessThan(1);
        }
        const bytes = await printPage.pdf({
          path: info.outputPath('station-spacing.pdf'),
          format: 'A4',
          preferCSSPageSize: true,
          printBackground: true,
        });
        const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
        try {
          const pdf = await task.promise;
          expect(pdf.numPages).toBe(count);
          const items: { text: string; x: number }[] = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const content = await (await pdf.getPage(i)).getTextContent();
            items.push(
              ...content.items.flatMap((item) =>
                'str' in item ? [{ text: item.str, x: item.transform[4] }] : [],
              ),
            );
          }
          const text = items
            .map((item) => item.text)
            .join(' ')
            .replace(/\s/g, '');
          for (const section of ['education', 'experience', 'projects'] as const) {
            for (const entry of project.cv[section])
              expect(text).toContain(entry.organization.replace(/\s/g, ''));
          }
          for (const entry of expected) {
            const printed = items.find(
              (item) =>
                entry.title.startsWith(item.text.trim()) &&
                item.text.trim().length >= 3 &&
                Math.abs(item.x - entry.x) < 0.5,
            );
            expect(printed, `PDF text position: ${entry.title}`).toBeDefined();
          }
          const paintedPage = printPoints[0].page;
          const sheet = await pdf.getPage(paintedPage + 1),
            viewport = sheet.getViewport({ scale: 2 });
          const factory = pdf.canvasFactory as {
            create(
              width: number,
              height: number,
            ): {
              canvas: HTMLCanvasElement & { toBuffer(type: string): Buffer };
              context: CanvasRenderingContext2D;
            };
          };
          const { canvas, context: drawing } = factory.create(
            Math.ceil(viewport.width),
            Math.ceil(viewport.height),
          );
          await sheet.render({ canvas, canvasContext: drawing, viewport }).promise;
          const color = project.layout.appearance.accent
              .match(/[0-9a-f]{2}/gi)!
              .map((part) => parseInt(part, 16)),
            scale = viewport.width / 210;
          for (const point of printPoints.filter((point) => point.page === paintedPage))
            for (const offset of [-0.5, 0, 0.5]) {
              const pixel = drawing.getImageData(
                Math.round(point.x * scale),
                Math.round((point.y + offset) * scale),
                1,
                1,
              ).data;
              for (let channel = 0; channel < 3; channel++)
                expect(
                  Math.abs(pixel[channel] - color[channel]),
                  `PDF marker ${point.id}`,
                ).toBeLessThan(8);
            }
          await writeFile(info.outputPath('station-points.png'), canvas.toBuffer('image/png'));
        } finally {
          await task.destroy();
        }
      } finally {
        await printPage.close();
      }
      await page.evaluate(() =>
        document
          .querySelector<HTMLIFrameElement>('iframe[data-cv-print]')!
          .contentWindow!.dispatchEvent(new Event('afterprint')),
      );
    });
  }
}
