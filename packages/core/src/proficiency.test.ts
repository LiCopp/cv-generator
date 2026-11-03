import { describe, expect, it } from 'vitest';
import { createProject, makeLanguage, makeSkill } from './fixtures';
import { withoutNewReferences } from './legacy-test-fixtures';
import { parseProject, projectSchema } from './schema';

describe('optional proficiency values', () => {
  it('round-trips explicit assessments including zero independently of labels and display modes', () => {
    const project = createProject('blank');
    for (const value of [null, 0, 1, 37, 100]) {
      project.cv.skills = [
        makeSkill({ name: 'TypeScript', level: 'Eigene Bezeichnung', proficiency: value }),
      ];
      project.cv.languages = [makeLanguage({ name: 'Englisch', level: 'B2', proficiency: value })];
      for (const display of ['text', 'bars', 'detailed'] as const) {
        project.layout.skills.display = display;
        expect(parseProject(JSON.stringify(project))).toEqual(project);
      }
    }
  });

  it('migrates old files without inferring percentages from qualitative levels or decorative lengths', () => {
    const project = createProject('student');
    project.layout.skills.display = 'bars';
    project.layout.skills.barValues['Gute Kenntnisse'] = 91;
    const legacy = withoutNewReferences({ ...project, cv: { ...project.cv, schemaVersion: 7 } });
    const restored = parseProject(JSON.stringify(legacy));
    expect(restored).toEqual(project);
    expect(legacy.cv.skills[0]).not.toHaveProperty('proficiency');
    expect(legacy.cv.languages[0]).not.toHaveProperty('proficiency');
    expect(restored.cv.skills.every((item) => item.proficiency === null)).toBe(true);
    expect(restored.cv.languages.every((item) => item.proficiency === null)).toBe(true);
    expect(() =>
      parseProject(JSON.stringify({ ...project, cv: { ...project.cv, schemaVersion: 7 } })),
    ).toThrow('Version 7');
  });

  it('rejects invalid values, missing current fields, unknown fields and numeric assessments on interests', () => {
    const project = createProject('student');
    for (const section of ['skills', 'languages'] as const) {
      for (const proficiency of [-1, 101, 1.5, '75', undefined, NaN, Infinity]) {
        const invalid = structuredClone(project);
        Object.assign(invalid.cv[section][0], { proficiency });
        expect(projectSchema.safeParse(invalid).success).toBe(false);
      }
      const unknown = structuredClone(project);
      Object.assign(unknown.cv[section][0], { score: 50 });
      expect(() => parseProject(JSON.stringify(unknown))).toThrow();
    }
    Object.assign(project.cv.interests[0], { proficiency: 50 });
    expect(projectSchema.safeParse(project).success).toBe(false);
  });

  it('migrates percentage visibility independently of assessments and preserves explicit choices', () => {
    const project = createProject('student');
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 22 },
    });
    expect(parseProject(JSON.stringify(legacy))).toEqual(project);
    project.cv.skills[0].proficiency = 73;
    project.cv.languages[0].proficiency = 65;
    project.layout.proficiencyPercentages.skills[project.cv.skills[0].id] = false;
    project.layout.proficiencyPercentages.languages[project.cv.languages[0].id] = true;
    expect(parseProject(JSON.stringify(project))).toEqual(project);
    expect(() =>
      parseProject(
        JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 22 } }),
      ),
    ).toThrow('Version 22');
    Object.assign(project.layout.proficiencyPercentages.skills, { invalid: 'false' });
    expect(projectSchema.safeParse(project).success).toBe(false);
  });
});
