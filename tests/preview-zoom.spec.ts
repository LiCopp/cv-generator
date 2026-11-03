import { expect, test, type Page } from '@playwright/test';

async function chooseZoom(page: Page, value: number) {
  await page.getByRole('button', { name: /^Zoomstufe auswählen/ }).click();
  await page.getByRole('menuitem', { name: `${value} %`, exact: true }).click();
  await expect(page.locator('.preview-scale')).toHaveCSS('zoom', String(value / 100));
}

test('100 percent uses A4 geometry and larger previews remain fully reachable by scrolling', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.cv-document')).toHaveAttribute('data-ready', 'true');
  await chooseZoom(page, 100);
  const box = await page.locator('.cv-page').first().boundingBox();
  expect(box!.width).toBeCloseTo((210 * 96) / 25.4, 1);
  expect(box!.height).toBeCloseTo((297 * 96) / 25.4, 1);
  await chooseZoom(page, 400);
  await expect(
    page.getByRole('button', { name: 'Vorschau vergrössern', exact: true }),
  ).toBeDisabled();
  const reaches = await page.locator('.preview-viewport').evaluate((viewport) => {
    const sheet = viewport.querySelector('.cv-page')!;
    viewport.scrollLeft = 0;
    const left = sheet.getBoundingClientRect().left - viewport.getBoundingClientRect().left;
    viewport.scrollLeft = viewport.scrollWidth;
    const right = viewport.getBoundingClientRect().right - sheet.getBoundingClientRect().right;
    return { left, right, scrollable: viewport.scrollWidth > viewport.clientWidth };
  });
  expect(reaches.scrollable).toBe(true);
  expect(reaches.left).toBeGreaterThanOrEqual(0);
  expect(reaches.right).toBeGreaterThanOrEqual(-1);
  await chooseZoom(page, 25);
  await expect(
    page.getByRole('button', { name: 'Vorschau verkleinern', exact: true }),
  ).toBeDisabled();
  await chooseZoom(page, 100);
});

test('manual A4 zoom survives resizing and width fitting can be restored explicitly', async ({
  page,
}) => {
  await page.goto('/');
  await chooseZoom(page, 100);
  for (const width of [1600, 1200, 390]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 390) await page.getByRole('button', { name: 'Vorschau', exact: true }).click();
    await expect(page.locator('.preview-scale')).toHaveCSS('zoom', '1');
  }
  await page.getByRole('button', { name: 'Vorschau einpassen', exact: true }).click();
  await expect
    .poll(() =>
      page.locator('.preview-viewport').evaluate((element) => {
        const css = getComputedStyle(element),
          available =
            element.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
        const target =
          Math.min(400, Math.max(25, Math.floor((available / ((210 * 96) / 25.4)) * 100))) / 100;
        return Math.abs(
          parseFloat((element.querySelector('.preview-scale') as HTMLElement).style.zoom) - target,
        );
      }),
    )
    .toBeLessThan(0.011);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect
    .poll(() =>
      page
        .locator('.preview-scale')
        .evaluate((element) => parseFloat((element as HTMLElement).style.zoom)),
    )
    .toBeGreaterThan(0.8);
});

test('screen calibration applies a measured scale, persists locally and can be changed or cancelled', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'A4 in Originalgrösse anzeigen', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'A4 in Originalgrösse', exact: true });
  const apply = dialog.getByRole('button', { name: 'A4 1:1 anzeigen', exact: true });
  await expect(apply).toBeDisabled();
  expect((await dialog.locator('.preview-calibration-ruler').boundingBox())!.width).toBeCloseTo(
    (50 * 96) / 25.4,
    1,
  );
  await dialog
    .getByRole('spinbutton', { name: 'Gemessene Linienlänge (mm)', exact: true })
    .fill('40');
  await apply.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.preview-scale')).toHaveCSS('zoom', '1.25');
  await chooseZoom(page, 100);
  await page.getByRole('button', { name: 'A4 in Originalgrösse anzeigen', exact: true }).click();
  await expect(page.locator('.preview-scale')).toHaveCSS('zoom', '1.25');
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'A4 in Originalgrösse anzeigen', exact: true }).click();
  await expect(page.locator('.preview-scale')).toHaveCSS('zoom', '1.25');
  await page.getByRole('button', { name: /^Zoomstufe auswählen/ }).click();
  await page.getByRole('menuitem', { name: 'Bildschirm kalibrieren …', exact: true }).click();
  const measurement = dialog.getByRole('spinbutton', {
    name: 'Gemessene Linienlänge (mm)',
    exact: true,
  });
  await expect(measurement).toHaveValue('40');
  await measurement.fill('0');
  await expect(apply).toBeDisabled();
  await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(page.locator('.preview-scale')).toHaveCSS('zoom', '1.25');
  await page.getByRole('button', { name: /^Zoomstufe auswählen/ }).click();
  await page.getByRole('menuitem', { name: 'Bildschirm kalibrieren …', exact: true }).click();
  await measurement.fill('25');
  await apply.click();
  await expect(page.locator('.preview-scale')).toHaveCSS('zoom', '2');
});

test('zoom toolbar and calibration remain usable on mobile', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Vorschau', exact: true }).click();
  expect(
    await page
      .locator('.preview-toolbar')
      .evaluate((element) => element.scrollWidth > element.clientWidth + 1),
  ).toBe(false);
  await page.getByRole('button', { name: 'A4 in Originalgrösse anzeigen', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'A4 in Originalgrösse', exact: true });
  await expect(dialog.locator('.preview-calibration-ruler')).toBeInViewport();
  expect(await dialog.evaluate((element) => element.scrollWidth > element.clientWidth + 1)).toBe(
    false,
  );
  await expect(page.locator('.MuiDialog-container')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: info.outputPath('calibration-mobile.png') });
  await dialog
    .getByRole('spinbutton', { name: 'Gemessene Linienlänge (mm)', exact: true })
    .fill('50');
  await dialog.getByRole('button', { name: 'A4 1:1 anzeigen', exact: true }).click();
  await expect(page.locator('.preview-scale')).toHaveCSS('zoom', '1');
});
