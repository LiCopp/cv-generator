export interface DescriptionRun {
  text: string;
  bold: boolean;
}
export interface DescriptionBlock {
  kind: 'paragraph' | 'bullet';
  runs: DescriptionRun[];
  continuation: boolean;
}

/** Literal legacy text stays literal when upgrading to the limited formatting syntax. */
export function escapeDescription(text: string): string {
  return text.replace(/[\\*]/g, '\\$&').replace(/(^[\t ]*)([-•])(?=[\t ])/gm, '$1\\$2');
}

/** Only paired ** markers and escaped punctuation are recognized. HTML stays text. */
export function descriptionRuns(text: string): DescriptionRun[] {
  const parts: (string | null)[] = [];
  let plain = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\' && /[\\*\-•]/.test(text[i + 1] ?? '')) plain += text[++i];
    else if (text[i] === '*' && text[i + 1] === '*') {
      parts.push(plain, null);
      plain = '';
      i++;
    } else plain += text[i];
  }
  parts.push(plain);
  const runs: DescriptionRun[] = [];
  const append = (text: string, bold: boolean) => {
    if (!text) return;
    const previous = runs.at(-1);
    if (previous?.bold === bold) previous.text += text;
    else runs.push({ text, bold });
  };
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] !== null) append(parts[i]!, false);
    else if (parts[i + 2] === null && parts[i + 1]) {
      append(parts[i + 1]!, true);
      i += 2;
    } else append('**', false);
  }
  return runs;
}

/** Split rendered text rather than markup so bold survives long-item page breaks. */
export function descriptionBlocks(text: string, maxChars: number): DescriptionBlock[] {
  if (!Number.isInteger(maxChars) || maxChars < 1)
    throw new Error('Die Textblocklänge muss positiv sein.');
  return text.split(/\r?\n/).flatMap((line) => {
    const bullet = /^[\t ]*[-*•][\t ]+(.*)$/.exec(line);
    const runs = descriptionRuns(bullet ? bullet[1] : line);
    const plain = runs.map((run) => run.text).join('');
    if (!plain.trim()) return [];
    const blocks: DescriptionBlock[] = [];
    let start = 0;
    while (start < plain.length) {
      let end = plain.length;
      if (end - start > maxChars) {
        const space = plain.lastIndexOf(' ', start + maxChars);
        end = space > start + maxChars / 3 ? space : start + maxChars;
        // Avoid splitting a UTF-16 surrogate pair in long unbroken text.
        if (
          end > start &&
          /[\uD800-\uDBFF]/.test(plain[end - 1]) &&
          /[\uDC00-\uDFFF]/.test(plain[end])
        )
          end++;
      }
      let offset = 0;
      const chunk = runs.flatMap((run) => {
        const from = Math.max(0, start - offset),
          to = Math.min(run.text.length, end - offset);
        offset += run.text.length;
        return to > from ? [{ text: run.text.slice(from, to), bold: run.bold }] : [];
      });
      blocks.push({
        kind: bullet ? 'bullet' : 'paragraph',
        runs: chunk,
        continuation: blocks.length > 0,
      });
      start = end;
      while (start < plain.length && /\s/.test(plain[start])) start++;
    }
    return blocks;
  });
}
