export const skillLevels = [
  'Grundkenntnisse',
  'Gute Kenntnisse',
  'Sehr gute Kenntnisse',
  'Expertenkenntnisse',
  'Langjährige Erfahrung',
] as const;

/** Relative decorative lengths, not proficiency percentages stored in the CV. */
export function defaultSkillsLayout() {
  return {
    display: 'text' as 'text' | 'bars' | 'detailed',
    showLevel: true,
    showDescription: false,
    groupByCategory: false,
    barValues: {
      Grundkenntnisse: 25,
      'Gute Kenntnisse': 50,
      'Sehr gute Kenntnisse': 75,
      Expertenkenntnisse: 100,
    } as Record<string, number>,
  };
}

export function skillBarValue(
  level: string,
  config: { showLevel: boolean; barValues: Record<string, number> },
): number | undefined {
  const label = level.trim();
  return config.showLevel && label && Object.hasOwn(config.barValues, label)
    ? config.barValues[label]
    : undefined;
}

/** Group only when requested, retaining the first occurrence of every category and skill. */
export function groupSkills<T extends { category: string }>(
  skills: T[],
  grouped: boolean,
): { category: string; items: T[] }[] {
  if (!grouped) return [{ category: '', items: skills }];
  const groups = new Map<string, T[]>();
  for (const skill of skills) {
    const category = skill.category.trim();
    const items = groups.get(category) ?? [];
    items.push(skill);
    groups.set(category, items);
  }
  return [...groups].map(([category, items]) => ({ category, items }));
}
