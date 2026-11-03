import type { Page } from '@playwright/test';

/** Same-origin fonts/styles, without an editor instance that could overwrite localStorage. */
export async function openPrintHost(page: Page, sourceUrl: string): Promise<void> {
  await page.route(
    sourceUrl,
    (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>',
      }),
    { times: 1 },
  );
  await page.goto(sourceUrl);
}
