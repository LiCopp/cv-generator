/** User-entered line breaks delimit paragraphs; text length never creates a paragraph. */
export function summaryParagraphs(text: string): string[] {
  return text.split(/\r?\n+/).filter(Boolean);
}

/** Read the browser's natural line wrapping with loaded fonts and the actual column width. */
export function measureSummaryFragments(paragraph: HTMLParagraphElement, maxLines = 6) {
  if (!Number.isInteger(maxLines) || maxLines < 1)
    throw new Error('Die Zeilenzahl muss positiv sein.');
  const text = paragraph.textContent ?? '';
  const node = paragraph.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return [];
  const range = document.createRange();
  const lines: { start: number; end: number; top: number }[] = [];
  for (let start = 0; start < text.length;) {
    const end = start + (text.codePointAt(start)! > 0xffff ? 2 : 1);
    range.setStart(node, start);
    range.setEnd(node, end);
    const rect = range.getClientRects()[0];
    const previous = lines.at(-1);
    if (rect && (!previous || Math.abs(rect.top - previous.top) > 0.5))
      lines.push({ start, end, top: rect.top });
    else if (previous) previous.end = end;
    start = end;
  }
  const lineHeight = paragraph.getBoundingClientRect().height / Math.max(1, lines.length);
  const fragments: { lines: string[]; height: number }[] = [];
  for (let index = 0; index < lines.length; index += maxLines) {
    const group = lines.slice(index, index + maxLines);
    fragments.push({
      lines: group.map((line) => text.slice(line.start, line.end)),
      height: group.length * lineHeight,
    });
  }
  return fragments;
}
