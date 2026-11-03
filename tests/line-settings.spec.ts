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

function timelineGeometry() {
  const zoomText = getComputedStyle(document.querySelector('.preview-scale') ?? document.body).zoom;
  const zoom = zoomText.endsWith('%') ? parseFloat(zoomText) / 100 : parseFloat(zoomText) || 1;
  const margin = parseFloat(
    getComputedStyle(document.querySelector('.cv-document')!).getPropertyValue('--cv-margin'),
  );
  return [...document.querySelectorAll('.cv-page')].flatMap((page, pageIndex) => {
    const origin = page.getBoundingClientRect();
    const rect = (element: Element) => {
      const box = element.getBoundingClientRect();
      return {
        left: (box.left - origin.left) / zoom,
        top: (box.top - origin.top) / zoom,
        bottom: (box.bottom - origin.top) / zoom,
        width: box.width / zoom,
        height: box.height / zoom,
      };
    };
    return [...page.querySelectorAll<HTMLElement>('main.cv-main, aside.cv-sidebar')].map(
      (column) => {
        const blocks = [...column.querySelectorAll<HTMLElement>(':scope > .cv-block')];
        const first = blocks[0],
          last = blocks[blocks.length - 1],
          tail = column.querySelector('.cv-timeline-tail');
        const before = first && getComputedStyle(first, '::before'),
          lastBefore = last && getComputedStyle(last, '::before');
        return {
          page: pageIndex,
          region: column.matches('main') ? 'main' : 'sidebar',
          from: column.dataset.timelineFromPrevious === 'true',
          to: column.dataset.timelineToNext === 'true',
          first: first && {
            ...rect(first),
            section: first.dataset.section,
            station: first.matches('.cv-station'),
            lineTop: parseFloat(before!.top),
            lineDisplay: before!.display,
          },
          last: last && {
            ...rect(last),
            section: last.dataset.section,
            station: last.matches('.cv-station'),
            lineLeft: parseFloat(lastBefore!.left),
          },
          tail: tail ? rect(tail) : null,
          contentBottom: origin.height / zoom - ((margin + 8) * 96) / 25.4,
        };
      },
    );
  });
}

test('independent divider gaps and automatic or custom length survive save and reload', async ({
  page,
}, info) => {
  const project = createProject('student');
  project.cv.title = 'Linien konfigurieren';
  Object.assign(project.layout.appearance, { sectionDividers: true, timelineOffsetMm: -10 });
  await openProject(page, project);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  const before = page.getByRole('slider', {
    name: 'Abstand oberhalb der Trennlinien',
    exact: true,
  });
  const after = page.getByRole('slider', {
    name: 'Abstand unterhalb der Trennlinien',
    exact: true,
  });
  const custom = page.getByRole('switch', {
    name: 'Eigene Länge der Abschnittslinien',
    exact: true,
  });
  await expect(custom).not.toBeChecked();
  await before.press('Home');
  await after.press('End');
  await custom.check();
  const length = page.getByRole('slider', { name: 'Länge der Abschnittslinien', exact: true });
  await length.press('Home');
  for (let i = 0; i < 8; i++) await length.press('ArrowRight');
  await expect(length).toHaveAttribute('aria-valuenow', '50');
  const lines = await page.locator('.cv-measure').evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>('.cv-section-divider, .cv-wide-divider')].map(
      (block) => {
        const style = getComputedStyle(block),
          hr = block.querySelector('hr')!.getBoundingClientRect(),
          box = block.getBoundingClientRect();
        const heading = block.nextElementSibling?.querySelector('h2')?.getBoundingClientRect();
        const dot = block.nextElementSibling?.nextElementSibling
          ?.querySelector('.cv-station-dot')
          ?.getBoundingClientRect();
        return {
          wide: block.matches('.cv-wide-divider'),
          before: parseFloat(style.paddingTop),
          after: parseFloat(style.paddingBottom),
          width: hr.width,
          available: box.width,
          left: hr.left,
          headingLeft: heading?.left,
          gapBelow: heading && heading.top - hr.bottom,
          axis: dot && dot.left + dot.width / 2,
        };
      },
    ),
  );
  expect(lines.length).toBeGreaterThan(2);
  for (const line of lines) {
    expect(line.before).toBeCloseTo(((line.wide ? 5 : 0) * 96) / 25.4, 1);
    expect(line.after).toBeCloseTo(((line.wide ? 5 : 15) * 96) / 25.4, 1);
    expect(line.width).toBeCloseTo(line.available * (line.wide ? 1 : 0.5), 1);
    if (line.gapBelow !== undefined) expect(line.gapBelow).toBeCloseTo((15 * 96) / 25.4, 1);
    if (line.axis !== undefined) {
      expect(line.left).toBeCloseTo(line.axis, 1);
      expect(line.left).toBeCloseTo(line.headingLeft!, 1);
    }
  }
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt speichern', exact: true }).click();
  const file = info.outputPath('line-settings.json');
  await (await download).saveAs(file);
  const saved = parseProject(await readFile(file, 'utf8'));
  expect(saved.layout.appearance).toMatchObject({
    dividerSpacingBeforeMm: 0,
    dividerSpacingAfterMm: 15,
    dividerLengthPercent: 50,
  });
  expect(saved.cv).toEqual(project.cv);
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert');
  await page.reload();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(before).toHaveAttribute('aria-valuenow', '0');
  await expect(after).toHaveAttribute('aria-valuenow', '15');
  await expect(length).toHaveAttribute('aria-valuenow', '50');
  await custom.uncheck();
  const automatic = await page
    .locator('.cv-page .cv-section-divider')
    .first()
    .evaluate((block) => ({
      line: block.querySelector('hr')!.getBoundingClientRect().width,
      available: block.getBoundingClientRect().width,
    }));
  expect(automatic.line).toBeCloseTo(automatic.available, 1);
  await page.getByRole('combobox', { name: /^Stationen markieren/ }).click();
  await page.getByRole('option', { name: 'Ohne Markierung', exact: true }).click();
  await expect(page.locator('.cv-page .cv-section-divider').first()).toHaveCSS(
    'margin-left',
    '0px',
  );
  await page.getByRole('switch', { name: 'Horizontale Trennlinien', exact: true }).uncheck();
  await expect(before).toHaveCount(0);
  await expect(page.locator('.cv-page hr')).toHaveCount(0);
});

for (const scenario of ['main', 'single-entries'] as const) {
  test(`timeline continues to the page boundary and into the exported PDF: ${scenario}`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printRequested = 'true';
      };
    });
    const project = createProject('adult');
    project.cv.title = `Zeitachse fortsetzen ${scenario}`;
    Object.assign(project.layout.appearance, {
      sectionDividers: true,
      sidebarSide: 'left',
      dividerSpacingBeforeMm: 2,
      dividerSpacingAfterMm: 8,
      dividerLengthPercent: 65,
      timelineOffsetMm: -8,
      fontId: 'source-sans',
    });
    if (scenario === 'single-entries')
      project.cv.experience = Array.from({ length: 36 }, (_, i) => ({
        ...project.cv.experience[0],
        id: `short-${i}`,
        organization: `Station ${i + 1}`,
        description: '',
      }));
    await openProject(page, project);
    const preview = await page.evaluate(timelineGeometry),
      connections = preview.filter((column) => column.to);
    expect(connections.length).toBeGreaterThan(0);
    for (const column of preview) {
      const next = preview.find(
        (next) => next.page === column.page + 1 && next.region === column.region,
      );
      const expected =
        column.region === 'main' &&
        !!column.last?.station &&
        !!next?.first?.station &&
        column.last.section === next.first.section;
      expect(column.to).toBe(expected);
      if (expected) {
        expect(next!.from).toBe(true);
        expect(column.tail).not.toBeNull();
        expect(column.tail!.top).toBeCloseTo(column.last!.bottom, 1);
        expect(column.tail!.left).toBeCloseTo(column.last!.left + column.last!.lineLeft, 1);
        expect(column.tail!.bottom).toBeCloseTo(column.contentBottom, 1);
        expect(next!.first!.lineTop).toBe(0);
        expect(next!.first!.lineDisplay).toBe('block');
      } else expect(column.tail).toBeNull();
    }
    const count = await page.locator('.cv-page').count();
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
      const printGeometry = await printed.evaluate(timelineGeometry);
      expect(
        printGeometry.map((column) => [column.page, column.region, column.from, column.to]),
      ).toEqual(preview.map((column) => [column.page, column.region, column.from, column.to]));
      for (const [i, column] of printGeometry.entries())
        if (column.tail)
          for (const key of ['left', 'top', 'bottom', 'height'] as const)
            expect(Math.abs(column.tail[key] - preview[i].tail![key])).toBeLessThan(1.5);
      const bytes = await printed.pdf({
        path: info.outputPath('continued-timeline.pdf'),
        format: 'A4',
        preferCSSPageSize: true,
        printBackground: true,
      });
      const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
      try {
        const pdf = await task.promise;
        expect(pdf.numPages).toBe(count);
        const text: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++)
          text.push(
            (await (await pdf.getPage(i)).getTextContent()).items
              .map((item) => ('str' in item ? item.str : ''))
              .join(' '),
          );
        const normalized = text.join(' ').replace(/\s/g, '');
        for (const section of ['experience', 'education', 'projects'] as const)
          for (const entry of project.cv[section])
            expect(normalized).toContain(entry.organization.replace(/\s/g, ''));
        const chosen = printGeometry.find((column) => column.tail && column.tail.height > 4)!;
        expect(chosen).toBeDefined();
        const next = printGeometry.find(
          (column) => column.page === chosen.page + 1 && column.region === chosen.region,
        )!;
        for (const column of [chosen, next]) {
          const pdfPage = await pdf.getPage(column.page + 1),
            viewport = pdfPage.getViewport({ scale: 2 });
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
          await pdfPage.render({ canvas, canvasContext, viewport }).promise;
          const x = Math.round((chosen.tail!.left + chosen.tail!.width / 2) * 1.5);
          const y = Math.round(
            (column === chosen ? chosen.tail!.bottom - 2 : next.first!.top + 1) * 1.5,
          );
          const pixel = canvasContext.getImageData(x - 1, y, 3, 1).data;
          expect(
            [...pixel].some((value, i) => i % 4 !== 3 && value < 245),
            `printed continuation on page ${column.page + 1}`,
          ).toBe(true);
          await writeFile(
            info.outputPath(`timeline-page-${column.page + 1}.png`),
            canvas.toBuffer('image/png'),
          );
        }
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
    await page.getByRole('tab', { name: 'Design', exact: true }).click();
    for (const name of ['Nur Punkte', 'Ohne Markierung']) {
      await page.getByRole('combobox', { name: /^Stationen markieren/ }).click();
      await page.getByRole('option', { name, exact: true }).click();
      await expect(page.locator('.cv-page .cv-timeline-tail')).toHaveCount(0);
    }
  });
}
