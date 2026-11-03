import templateData from '../../../templates/modern/template.json' with { type: 'json' };
import layoutData from '../../../templates/modern/layouts/default.json' with { type: 'json' };
import {
  currentRendererVersion,
  datePrecision,
  projectSchema,
  type Entry,
  type Language,
  type Project,
  type Reference,
  type Skill,
} from './schema';

export const makeReference = (values: Partial<Reference> = {}): Reference => ({
  id: crypto.randomUUID(),
  name: '',
  role: '',
  organization: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  ...values,
});
export const makeSkill = (values: Partial<Skill> = {}): Skill => ({
  id: crypto.randomUUID(),
  name: '',
  level: '',
  description: '',
  category: '',
  proficiency: null,
  ...values,
});

export const makeLanguage = (values: Partial<Language> = {}): Language => ({
  id: crypto.randomUUID(),
  name: '',
  level: '',
  proficiency: null,
  ...values,
});

export const makeEntry = (values: Partial<Entry> = {}): Entry => ({
  id: crypto.randomUUID(),
  title: '',
  organization: '',
  location: '',
  start: null,
  end: null,
  current: false,
  description: '',
  startPrecision: datePrecision(values.start ?? null),
  endPrecision: datePrecision(values.end ?? null),
  ...values,
});
export const studentProject: Project = projectSchema.parse({
  manifest: { format: 'folio-json', formatVersion: 1, rendererVersion: currentRendererVersion },
  template: templateData,
  layout: layoutData,
  assets: {},
  cv: {
    schemaVersion: 8,
    id: 'student-example',
    title: 'Mein erster Lebenslauf',
    contact: {
      firstName: 'Lena',
      lastName: 'Berger',
      headline: 'Bewerbung um eine Lehrstelle als Mediamatikerin',
      email: 'lena.berger@example.com',
      phone: '+41 79 123 45 67',
      address: 'Beispielstrasse 12',
      city: '8000 Zürich',
      website: '',
      maritalStatus: '',
      birthDate: null,
      photoAssetId: null,
    },
    summary:
      'Ich bin neugierig, kreativ und begeistere mich für die Verbindung von Gestaltung und Technik. In meiner Freizeit gestalte ich kleine digitale Projekte. Jetzt möchte ich meine Ideen in einer Lehre einbringen und Neues dazulernen.',
    education: [
      {
        id: 'school-1',
        title: 'Sekundarschule, Niveau A',
        organization: 'Sekundarschule Beispiel',
        location: 'Zürich',
        start: { year: 2023, month: 8, day: 14 },
        end: { year: 2026, month: 7, day: 10 },
        startPrecision: 'day',
        endPrecision: 'day',
        current: false,
        description:
          'Schwerpunkte: Informatik, Deutsch und bildnerisches Gestalten\nVoraussichtlicher Abschluss: Sommer 2026',
      },
    ],
    experience: [
      {
        id: 'experience-1',
        title: 'Schnupperlehre Mediamatik',
        organization: 'Musterstudio AG',
        location: 'Zürich',
        start: { year: 2025, month: 10, day: 6 },
        end: { year: 2025, month: 10, day: 10 },
        startPrecision: 'day',
        endPrecision: 'day',
        current: false,
        description:
          'Einblicke in Webdesign und digitale Kommunikation. Mitarbeit an einem Social-Media-Beitrag und Gestaltung eines eigenen kleinen Plakats.',
      },
    ],
    projects: [
      {
        id: 'project-1',
        title: 'Eine Website für unsere Schülerzeitung',
        organization: 'Schulprojekt',
        location: '',
        start: { year: 2025, month: 3 },
        end: null,
        startPrecision: 'month',
        endPrecision: 'day',
        current: false,
        description:
          'Gemeinsam im Dreierteam geplant und umgesetzt. Verantwortlich für Gestaltung, Fotos und die ersten Schritte mit HTML und CSS.',
      },
    ],
    skills: [
      {
        id: 'skill-1',
        name: 'Figma & Canva',
        level: 'Gute Kenntnisse',
        description: '',
        category: '',
        proficiency: null,
      },
      {
        id: 'skill-2',
        name: 'HTML & CSS',
        level: 'Grundkenntnisse',
        description: '',
        category: '',
        proficiency: null,
      },
      {
        id: 'skill-3',
        name: 'Microsoft 365',
        level: 'Gute Kenntnisse',
        description: '',
        category: '',
        proficiency: null,
      },
    ],
    languages: [
      makeLanguage({ id: 'language-1', name: 'Deutsch', level: 'Muttersprache' }),
      makeLanguage({ id: 'language-2', name: 'Englisch', level: 'B1' }),
      makeLanguage({ id: 'language-3', name: 'Französisch', level: 'A2' }),
    ],
    interests: [
      { id: 'interest-1', name: 'Fotografie', level: '' },
      { id: 'interest-2', name: 'Volleyball', level: '' },
      { id: 'interest-3', name: 'Digitale Gestaltung', level: '' },
    ],
    references: [],
  },
});

export function createProject(kind: 'student' | 'adult' | 'blank'): Project {
  const project = structuredClone(studentProject);
  project.cv.id = crypto.randomUUID();
  if (kind === 'blank') {
    project.cv.title = 'Mein Lebenslauf';
    for (const key of Object.keys(project.cv.contact) as (keyof typeof project.cv.contact)[]) {
      if (key !== 'photoAssetId' && key !== 'birthDate') project.cv.contact[key] = '';
    }
    project.cv.summary = '';
    for (const section of [
      'education',
      'experience',
      'projects',
      'skills',
      'languages',
      'interests',
      'references',
    ] as const)
      project.cv[section] = [];
  }
  if (kind === 'adult') {
    project.cv.title = 'Beruflicher Lebenslauf';
    project.cv.contact = {
      ...project.cv.contact,
      firstName: 'Alex',
      lastName: 'Sommer',
      headline: 'Projektleitung & digitale Produktentwicklung',
      email: 'alex.sommer@example.com',
      phone: '+41 79 555 01 23',
      city: '3000 Bern',
    };
    project.cv.summary =
      'Ich begleite digitale Produkte von der ersten Idee bis zum zuverlässigen Betrieb. Seit über zwanzig Jahren verbinde ich technische Erfahrung mit klarer Kommunikation und der Freude an gemeinsamer Arbeit. Mein Schwerpunkt liegt auf zugänglichen Anwendungen und nachhaltigen Prozessen.';
    project.cv.experience = Array.from({ length: 12 }, (_, index) => ({
      id: `career-${index}`,
      title: ['Senior Projektleitung', 'Product Owner', 'Softwareentwicklung'][index % 3],
      organization: `Beispielunternehmen ${index + 1}`,
      location: index % 2 ? 'Bern' : 'Zürich',
      start: { year: 2024 - index * 2, month: 1, day: 1 },
      end: index === 0 ? null : { year: 2026 - index * 2, month: 12, day: 31 },
      startPrecision: 'day',
      endPrecision: 'day',
      current: index === 0,
      description: [
        'Verantwortung für die Planung und Umsetzung digitaler Produkte in einem interdisziplinären Team. Gemeinsam mit Fachbereichen wurden Anforderungen geklärt, Prioritäten gesetzt und verständliche Entscheidungsgrundlagen erarbeitet.',
        'Begleitung des gesamten Entwicklungsprozesses: von Nutzungsinterviews über Prototypen bis zur Einführung und kontinuierlichen Verbesserung. Regelmässige Abstimmung mit internen und externen Beteiligten sowie nachvollziehbare Dokumentation der Ergebnisse.',
        'Aufbau wiederverwendbarer Prozesse für Qualitätssicherung, barrierearme Gestaltung und den zuverlässigen Betrieb. Wissenstransfer durch Workshops, gemeinsame Reviews und die Begleitung neuer Teammitglieder.',
      ].join('\n\n'),
    }));
    project.cv.education = [
      {
        id: 'degree-1',
        title: 'BSc Wirtschaftsinformatik',
        organization: 'Beispiel-Fachhochschule',
        location: 'Bern',
        start: { year: 2000, month: 9, day: 1 },
        end: { year: 2004, month: 7, day: 15 },
        startPrecision: 'day',
        endPrecision: 'day',
        current: false,
        description:
          'Schwerpunkte: Software Engineering, Projektmanagement und Mensch-Computer-Interaktion.',
      },
    ];
    project.cv.projects = [
      {
        id: 'volunteer-1',
        title: 'Mentoring für Berufseinsteigende',
        organization: 'Verein Beispiel',
        location: 'Bern',
        start: { year: 2019, month: 1, day: 1 },
        end: null,
        startPrecision: 'day',
        endPrecision: 'day',
        current: true,
        description:
          'Ehrenamtliche Begleitung bei der beruflichen Orientierung und Durchführung von Workshops zu digitalen Kompetenzen.',
      },
    ];
    project.cv.skills = [
      {
        id: 'adult-skill-1',
        name: 'Projektmanagement',
        level: 'Langjährige Erfahrung',
        description: '',
        category: '',
        proficiency: null,
      },
      {
        id: 'adult-skill-2',
        name: 'Produktentwicklung',
        level: 'Langjährige Erfahrung',
        description: '',
        category: '',
        proficiency: null,
      },
      {
        id: 'adult-skill-3',
        name: 'TypeScript & React',
        level: 'Sehr gute Kenntnisse',
        description: '',
        category: '',
        proficiency: null,
      },
    ];
    project.layout.sections = [...project.layout.sections].sort((a, b) =>
      a.id === 'experience' ? -1 : b.id === 'experience' ? 1 : 0,
    );
    project.layout.sections = [
      project.layout.sections.find((s) => s.id === 'summary')!,
      ...project.layout.sections.filter((s) => s.id !== 'summary'),
    ];
  }
  return project;
}
