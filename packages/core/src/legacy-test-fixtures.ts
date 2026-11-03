/** Reconstruct historical fixtures from their declared independent resource versions. */
export function withoutNewReferences<T>(source: T): T {
  const project = structuredClone(source) as {
    cv?: {
      schemaVersion: number;
      references?: unknown;
      skills?: { description?: unknown; category?: unknown; proficiency?: unknown }[];
      languages?: { proficiency?: unknown }[];
    };
    layout?: {
      schemaVersion: number;
      skills?: unknown;
      proficiencyPercentages?: unknown;
      sections?: { id: string }[];
      appearance?: {
        sectionHeadings?: { references?: unknown };
        headerShiftUpMm?: unknown;
        headerTextColor?: unknown;
        headerNameLayout?: unknown;
        stationHeadingOrder?: unknown;
        leftColumnLineHeight?: unknown;
        headerTextOffsetMm?: unknown;
        photoOffsetMm?: unknown;
        compactWithoutSummary?: unknown;
      };
    };
    template?: { schemaVersion: number; components?: string[] };
  };
  if (project.cv && project.cv.schemaVersion <= 5) delete project.cv.references;
  if (project.cv && project.cv.schemaVersion <= 7)
    for (const item of [...(project.cv.skills ?? []), ...(project.cv.languages ?? [])])
      delete item.proficiency;
  if (project.cv && project.cv.schemaVersion <= 6)
    for (const skill of project.cv.skills ?? []) {
      delete skill.description;
      delete skill.category;
    }
  if (project.layout && project.layout.schemaVersion <= 16) delete project.layout.skills;
  if (project.layout && project.layout.schemaVersion <= 22)
    delete project.layout.proficiencyPercentages;
  if (project.layout && project.layout.schemaVersion <= 17 && project.layout.appearance) {
    delete project.layout.appearance.headerShiftUpMm;
    delete project.layout.appearance.headerTextColor;
  }
  if (project.layout && project.layout.schemaVersion <= 18 && project.layout.appearance) {
    delete project.layout.appearance.headerNameLayout;
    delete project.layout.appearance.stationHeadingOrder;
    delete project.layout.appearance.leftColumnLineHeight;
  }
  if (project.layout && project.layout.schemaVersion <= 19 && project.layout.appearance)
    delete project.layout.appearance.headerTextOffsetMm;
  if (project.layout && project.layout.schemaVersion <= 20 && project.layout.appearance)
    delete project.layout.appearance.photoOffsetMm;
  if (project.layout && project.layout.schemaVersion <= 21 && project.layout.appearance)
    delete project.layout.appearance.compactWithoutSummary;
  if (project.layout && project.layout.schemaVersion <= 15) {
    project.layout.sections = project.layout.sections?.filter(
      (section: { id: string }) => section.id !== 'references',
    );
    if (project.layout.appearance?.sectionHeadings)
      delete project.layout.appearance.sectionHeadings.references;
  }
  if (project.template?.schemaVersion === 1)
    project.template.components = project.template.components?.filter(
      (id: string) => id !== 'references',
    );
  return project as T;
}
