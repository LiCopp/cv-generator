import { describe, expect, it } from 'vitest';
import { createProject, makeSkill } from './fixtures';
import { withoutNewReferences } from './legacy-test-fixtures';
import { parseProject, projectSchema } from './schema';
import { defaultSkillsLayout, groupSkills, skillBarValue, skillLevels } from './skills';

describe('structured skills and portable presentation', () => {
  it('migrates old CV skills and missing layout settings without changing names, labels or languages', () => {
    const project = createProject('adult');
    project.cv.skills[0].level = 'Individuelle Erfahrung';
    const legacy = withoutNewReferences({
      ...project,
      cv: { ...project.cv, schemaVersion: 6 },
      layout: { ...project.layout, schemaVersion: 16 },
    });
    expect(parseProject(JSON.stringify(legacy))).toEqual(project);
    expect(legacy.layout).not.toHaveProperty('skills');
    expect(legacy.cv.skills[0]).not.toHaveProperty('description');
    expect(parseProject(JSON.stringify(legacy)).cv.languages).toEqual(project.cv.languages);
    expect(() =>
      parseProject(JSON.stringify({ ...project, cv: { ...project.cv, schemaVersion: 6 } })),
    ).toThrow('Version 6');
    expect(() =>
      parseProject(
        JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 16 } }),
      ),
    ).toThrow('Version 16');
  });
  it('resolves absent or partial current layout configuration to text defaults without overwriting supplied values', () => {
    const project = createProject('student'),
      { skills, ...layout } = project.layout;
    expect(parseProject(JSON.stringify({ ...project, layout })).layout.skills).toEqual(
      defaultSkillsLayout(),
    );
    expect(
      parseProject(JSON.stringify({ ...project, layout: { ...layout, skills: {} } })).layout.skills,
    ).toEqual(defaultSkillsLayout());
    expect(
      parseProject(
        JSON.stringify({ ...project, layout: { ...layout, skills: { display: 'detailed' } } }),
      ).layout.skills.showDescription,
    ).toBe(true);
    expect(
      parseProject(
        JSON.stringify({
          ...project,
          layout: {
            ...layout,
            skills: { display: 'detailed', showDescription: true, barValues: {} },
          },
        }),
      ).layout.skills,
    ).toEqual({
      ...defaultSkillsLayout(),
      display: 'detailed',
      showDescription: true,
      barValues: {},
    });
  });
  it('retains optional self-assessment, custom labels, descriptions and categories independently of display mode', () => {
    const project = createProject('student');
    project.cv.skills = ['', ...skillLevels, 'Praktische Projekterfahrung'].map((level, index) =>
      makeSkill({
        id: `skill-${index}`,
        name: `Kenntnis ${index}`,
        level,
        description: index % 2 ? 'Eigene Erfahrung\nWeiterer Absatz.' : '',
        category: index % 2 ? 'Methoden' : '',
      }),
    );
    const cv = structuredClone(project.cv);
    for (const display of ['text', 'bars', 'detailed'] as const) {
      Object.assign(project.layout.skills, { display, showDescription: display === 'detailed' });
      const restored = parseProject(JSON.stringify(project));
      expect(restored).toEqual(project);
      expect(restored.cv).toEqual(cv);
    }
  });
  it('does not invent a bar for missing, individual or experience-based labels', () => {
    const config = defaultSkillsLayout();
    for (const level of [
      '',
      ' ',
      'Langjährige Erfahrung',
      'Praktische Projekterfahrung',
      'constructor',
    ])
      expect(skillBarValue(level, config)).toBeUndefined();
    expect(skillBarValue('Sehr gute Kenntnisse', config)).toBe(75);
    config.barValues['Sehr gute Kenntnisse'] = 62;
    expect(skillBarValue('Sehr gute Kenntnisse', config)).toBe(62);
    config.barValues['Langjährige Erfahrung'] = 45;
    expect(skillBarValue('Langjährige Erfahrung', config)).toBe(45);
    config.barValues['Praktische Projekterfahrung'] = 0;
    expect(skillBarValue('Praktische Projekterfahrung', config)).toBe(0);
    config.showLevel = false;
    expect(skillBarValue('Sehr gute Kenntnisse', config)).toBeUndefined();
    expect(defaultSkillsLayout().barValues['Sehr gute Kenntnisse']).toBe(75);
  });
  it('groups categories stably only when requested and preserves ungrouped items', () => {
    const items = [
      makeSkill({ name: 'A', category: 'Methoden' }),
      makeSkill({ name: 'B' }),
      makeSkill({ name: 'C', category: 'Sprachen' }),
      makeSkill({ name: 'D', category: ' Methoden ' }),
    ];
    const original = structuredClone(items);
    expect(groupSkills(items, false)).toEqual([{ category: '', items }]);
    expect(
      groupSkills(items, true).map((group) => [
        group.category,
        group.items.map((item) => item.name),
      ]),
    ).toEqual([
      ['Methoden', ['A', 'D']],
      ['', ['B']],
      ['Sprachen', ['C']],
    ]);
    expect(items).toEqual(original);
  });
  it('rejects unsafe or invalid configuration and oversized content without discarding fields', () => {
    const project = createProject('student');
    for (const value of [
      { display: 'html' },
      { showLevel: 'true' },
      { barValues: { Test: -1 } },
      { barValues: { Test: 101 } },
      { barValues: { Test: '75%' } },
      { html: '<script />' },
      { barValues: Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`level${i}`, 50])) },
    ]) {
      expect(
        projectSchema.safeParse({
          ...project,
          layout: { ...project.layout, skills: { ...project.layout.skills, ...value } },
        }).success,
      ).toBe(false);
    }
    for (const value of [
      { description: 'x'.repeat(20_001) },
      { category: 'x'.repeat(301) },
      { level: 'x'.repeat(301) },
      { score: 99 },
    ])
      expect(
        projectSchema.safeParse({
          ...project,
          cv: { ...project.cv, skills: [{ ...project.cv.skills[0], ...value }] },
        }).success,
      ).toBe(false);
  });
  it('keeps mother tongue and all CEFR language levels as qualitative text', () => {
    const project = createProject('student');
    project.cv.languages = ['Muttersprache', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(
      (level, i) => ({ id: `language-${i}`, name: `Sprache ${i}`, level, proficiency: null }),
    );
    expect(parseProject(JSON.stringify(project)).cv.languages).toEqual(project.cv.languages);
  });
});
