export interface TextEdit {
  value: string;
  start: number;
  end: number;
}

export function toggleBold(value: string, start: number, end: number): TextEdit {
  if (start === end)
    return {
      value: `${value.slice(0, start)}**Text**${value.slice(end)}`,
      start: start + 2,
      end: start + 6,
    };
  const selected = value.slice(start, end);
  if (selected.includes('\n')) {
    const replacement = selected
      .split('\n')
      .map((line) => (line.trim() ? toggleBold(line, 0, line.length).value : line))
      .join('\n');
    return {
      value: value.slice(0, start) + replacement + value.slice(end),
      start,
      end: start + replacement.length,
    };
  }
  const prefix = /^([\t ]*[-*•][\t ]+)/.exec(selected);
  if (prefix && (start === 0 || value[start - 1] === '\n'))
    return toggleBold(value, start + prefix[0].length, end);
  if (
    value.slice(start, start + 2) === '**' &&
    value.slice(end - 2, end) === '**' &&
    end - start > 4
  )
    return {
      value: value.slice(0, start) + value.slice(start + 2, end - 2) + value.slice(end),
      start,
      end: end - 4,
    };
  if (value.slice(start - 2, start) === '**' && value.slice(end, end + 2) === '**')
    return {
      value: value.slice(0, start - 2) + value.slice(start, end) + value.slice(end + 2),
      start: start - 2,
      end: end - 2,
    };
  return {
    value: `${value.slice(0, start)}**${value.slice(start, end)}**${value.slice(end)}`,
    start: start + 2,
    end: end + 2,
  };
}

export function toggleBullets(value: string, start: number, end: number): TextEdit {
  const from = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
  const last = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const nextBreak = value.indexOf('\n', last),
    to = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(from, to).split('\n');
  const bullet = /^([\t ]*)[-*•][\t ]+/;
  const remove =
    lines.filter((line) => line.trim()).length > 0 &&
    lines.filter((line) => line.trim()).every((line) => bullet.test(line));
  const replacement = lines
    .map((line) => {
      if (!line.trim() && lines.length > 1) return line;
      if (remove) return line.replace(bullet, '$1');
      return bullet.test(line) ? line : line.replace(/^([\t ]*)/, '$1- ');
    })
    .join('\n');
  return {
    value: value.slice(0, from) + replacement + value.slice(to),
    start: from,
    end: from + replacement.length,
  };
}

export function continueBullet(value: string, start: number, end: number): TextEdit | null {
  if (start !== end || (start < value.length && value[start] !== '\n')) return null;
  const from = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
  const line = value.slice(from, start),
    match = /^([\t ]*)[-*•][\t ]+(.*)$/.exec(line);
  if (!match) return null;
  const insertion = match[2].trim() ? `\n${match[1]}- ` : '';
  const prefix = match[2].trim() ? value.slice(0, start) : value.slice(0, from) + match[1];
  const caret = prefix.length + insertion.length;
  return { value: prefix + insertion + value.slice(end), start: caret, end: caret };
}
