import { withoutNewReferences } from './legacy-test-fixtures';
import { describe, expect, it } from 'vitest';
import { createProject } from './fixtures';
import { descriptionBlocks, descriptionRuns, escapeDescription } from './description';
import { parseProject } from './schema';

describe('station description formatting', () => {
  it('recognizes mixed paragraphs, bullet variants and multiple bold words without interpreting other markup', () => {
    const blocks = descriptionBlocks(
      'Ein **klarer** Einstieg mit **Fokus**.\n\n- **Planung** im Team\n* Umsetzung\n• Prüfung\n[Link](https://example.com) <script>test</script>',
      500,
    );
    expect(blocks.map((block) => block.kind)).toEqual([
      'paragraph',
      'bullet',
      'bullet',
      'bullet',
      'paragraph',
    ]);
    expect(blocks[0].runs).toEqual([
      { text: 'Ein ', bold: false },
      { text: 'klarer', bold: true },
      { text: ' Einstieg mit ', bold: false },
      { text: 'Fokus', bold: true },
      { text: '.', bold: false },
    ]);
    expect(blocks[4].runs).toEqual([
      { text: '[Link](https://example.com) <script>test</script>', bold: false },
    ]);
    expect(descriptionRuns('**offen und ****')).toEqual([
      { text: 'offen und ', bold: true },
      { text: '**', bold: false },
    ]);
    expect(descriptionRuns('**offen')).toEqual([{ text: '**offen', bold: false }]);
    expect(descriptionRuns('****')).toEqual([{ text: '****', bold: false }]);
  });
  it('preserves literal punctuation and windows paths through escaping', () => {
    const text =
      '**Kein Fettdruck** C:\\Tools\\CV\n- Keine Liste\n* Auch keine Liste\n• Ein Zeichen';
    const blocks = descriptionBlocks(escapeDescription(text), 500);
    expect(
      blocks.every((block) => block.kind === 'paragraph' && block.runs.every((run) => !run.bold)),
    ).toBe(true);
    expect(blocks.map((block) => block.runs.map((run) => run.text).join('')).join('\n')).toBe(text);
  });
  it('splits long bullet items without losing bold emphasis or repeating markers', () => {
    const blocks = descriptionBlocks('- Vorher **' + 'Wichtig '.repeat(150) + '** nachher', 150);
    expect(blocks.length).toBeGreaterThan(5);
    expect(blocks.every((block) => block.kind === 'bullet')).toBe(true);
    expect(blocks.map((block) => block.continuation)).toEqual([
      false,
      ...blocks.slice(1).map(() => true),
    ]);
    expect(
      blocks
        .flatMap((block) => block.runs.filter((run) => run.bold))
        .map((run) => run.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    ).toBe('Wichtig '.repeat(150).trim());
    expect(blocks.at(-1)!.runs.at(-1)).toEqual({ text: ' nachher', bold: false });
    expect(
      descriptionBlocks('- ' + '😀'.repeat(200), 151)
        .flatMap((block) => block.runs)
        .map((run) => run.text)
        .join(''),
    ).toBe('😀'.repeat(200));
    expect(descriptionBlocks(' \n\n- \r\n', 150)).toEqual([]);
  });
  it('upgrades v4 descriptions as literal text, including maximum-size source, and round-trips v5 formatting', () => {
    const project = createProject('student');
    project.cv.experience[0].description = '**Bisher wörtlich**\n- Bisher wörtlich';
    project.cv.education[0].description = '*'.repeat(20_000);
    const legacy = withoutNewReferences({ ...project, cv: { ...project.cv, schemaVersion: 4 } });
    const migrated = parseProject(JSON.stringify(legacy));
    expect(migrated.cv.schemaVersion).toBe(8);
    expect(migrated.cv.experience[0].description).toBe(
      escapeDescription(project.cv.experience[0].description),
    );
    expect(migrated.cv.education[0].description).toHaveLength(40_000);
    expect(parseProject(JSON.stringify(migrated))).toEqual(migrated);
    expect(parseProject(JSON.stringify(project))).toEqual(project);
    expect(migrated.layout).toEqual(project.layout);
    expect(migrated.assets).toEqual(project.assets);
  });
});
