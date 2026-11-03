/**
 * Print the completed semantic renderer without recalculating pagination in a new viewport.
 * An isolated A4 iframe removes editor zoom, layout and MUI portals from the print context.
 * Fonts, stylesheet loads and decoded images must settle before Chromium takes its snapshot.
 * `afterprint` restores focus and removes the frame; preparation errors clean up immediately.
 */
export async function printDocument(source: HTMLElement, title: string): Promise<void> {
  // Loaded dimensions determine the photo crop. Copy after its load handler has applied it.
  await Promise.all([...source.querySelectorAll('img')].map((image) => image.decode()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const frame = document.createElement('iframe');
  frame.dataset.cvPrint = '';
  frame.title = 'Lebenslauf drucken';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  Object.assign(frame.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '210mm',
    height: '297mm',
    border: '0',
  });
  const previousFocus = document.activeElement;
  document.body.append(frame);
  const printWindow = frame.contentWindow;
  const printDocument = frame.contentDocument;
  const cleanup = () => {
    frame.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
      previousFocus.focus({ preventScroll: true });
  };
  if (!printWindow || !printDocument) {
    cleanup();
    throw new Error('Die Druckansicht konnte nicht geöffnet werden.');
  }
  try {
    printDocument.title = title || 'Lebenslauf';
    const base = printDocument.createElement('base');
    base.href = document.baseURI;
    printDocument.head.append(base);
    const stylesLoaded: Promise<void>[] = [];
    for (const node of document.head.querySelectorAll<HTMLStyleElement | HTMLLinkElement>(
      'style, link[rel="stylesheet"]',
    )) {
      if (node instanceof HTMLStyleElement) {
        const style = printDocument.createElement('style');
        // Preserve authored CSS: Chromium can lose variable shorthand values in cssText.
        // Emotion's empty style tags still need rules inserted through CSSOM.
        style.textContent = node.textContent?.trim()
          ? node.textContent
          : node.sheet
            ? [...node.sheet.cssRules].map((rule) => rule.cssText).join('\n')
            : '';
        printDocument.head.append(style);
      } else {
        const link = printDocument.importNode(node, true);
        stylesLoaded.push(
          new Promise((resolve, reject) => {
            link.addEventListener('load', () => resolve(), { once: true });
            link.addEventListener(
              'error',
              () => reject(new Error('Die Druckstile konnten nicht geladen werden.')),
              { once: true },
            );
          }),
        );
        printDocument.head.append(link);
      }
    }
    const snapshot = printDocument.importNode(source, true);
    snapshot.querySelector('.cv-measure')?.remove();
    printDocument.body.append(snapshot);
    await Promise.all(stylesLoaded);
    await Promise.all([...snapshot.querySelectorAll('img')].map((image) => image.decode()));
    await printDocument.fonts.ready;
    await new Promise<void>((resolve) =>
      printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(() => resolve())),
    );
    printWindow.addEventListener('afterprint', cleanup, { once: true });
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}
