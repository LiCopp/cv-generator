export const sectionIds = [
  'summary',
  'experience',
  'education',
  'projects',
  'skills',
  'languages',
  'interests',
  'references',
] as const;

export type SectionId = (typeof sectionIds)[number];

export const sectionLabels: Record<SectionId, string> = {
  summary: 'Über mich',
  experience: 'Erfahrung',
  education: 'Ausbildung',
  projects: 'Projekte & Engagement',
  skills: 'Kenntnisse',
  languages: 'Sprachen',
  interests: 'Interessen',
  references: 'Referenzen',
};

export const headingIds = ['contact', ...sectionIds] as const;

export type HeadingId = (typeof headingIds)[number];

export const headingLabels: Record<HeadingId, string> = { contact: 'Kontakt', ...sectionLabels };

export const contactFieldIds = [
  'birth-date',
  'address',
  'email',
  'phone',
  'marital-status',
  'website',
] as const;

export const contactFieldLabels: Record<(typeof contactFieldIds)[number], string> = {
  'birth-date': 'Geburtsdatum',
  address: 'Adresse',
  email: 'E-Mail',
  phone: 'Telefon',
  'marital-status': 'Zivilstand',
  website: 'Website',
};

export const stationHeadingFields = ['date', 'title', 'organization'] as const;

export const stationHeadingLabels: Record<(typeof stationHeadingFields)[number], string> = {
  date: 'Datum',
  title: 'Jobtitel',
  organization: 'Arbeitgeber / Institution',
};
