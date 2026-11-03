import {
  dateInput,
  descriptionBlocks,
  formatDate,
  groupSkills,
  headingLabels,
  type HeadingId,
  type Project,
  type SectionId,
} from '@cv/core';
import { Cake, Globe, HeartHandshake, House, Mail, Phone } from 'lucide-react';
import { type CSSProperties, type ReactNode } from 'react';
import { ProficiencyBar } from './ProficiencyBar';
import { SkillContent } from './SkillContent';
import { StationHeading } from './StationHeading';
import { summaryParagraphs } from './summary';
import { type TimelineBlock } from './timeline';

/** A semantic flow unit whose wrapper is shared by measurement and visible pages. */
export interface Block extends TimelineBlock {
  summaryText?: string;
  summaryParagraphId?: string;
  summaryContinues?: boolean;
  referenceEnd?: boolean;
  contactItem?: boolean;
  contactLast?: boolean;
  content: ReactNode;
  section?: SectionId | 'contact';
  sectionHeading?: boolean;
  divider?: boolean;
  introTransition?: boolean;
  keepWithNext?: boolean;
  stationHeading?: boolean;
  bullet?: boolean;
  bulletContinuation?: boolean;
  bulletContinues?: boolean;
}

function SectionHeading({ project, id }: { project: Project; id: HeadingId }) {
  const heading = project.layout.appearance.sectionHeadings[id];
  return (
    <h2 style={{ '--cv-heading-size': `${heading.fontSizePt}pt` } as CSSProperties}>
      {heading.title.trim() || headingLabels[id]}
    </h2>
  );
}

/** Bound plain-text chunks before measuring; do not change these limits without PDF checks. */
function splitPlainText(text: string, maxChars: number) {
  return text
    .split(/\n+/)
    .filter(Boolean)
    .flatMap((paragraph) => {
      const chunks: string[] = [];
      let remaining = paragraph;
      while (remaining.length > maxChars) {
        const space = remaining.lastIndexOf(' ', maxChars);
        const boundary = space > maxChars / 3 ? space : maxChars;
        chunks.push(remaining.slice(0, boundary));
        remaining = remaining.slice(boundary).trimStart();
      }
      if (remaining) chunks.push(remaining);
      return chunks;
    });
}

/**
 * Turn enabled sections into ordered, measurable units without introducing layout coordinates.
 * A station title stays with its first description chunk; later chunks may cross pages.
 * Stable IDs let pagination move those units without changing their semantic contents.
 */
export function buildRegionBlocks(project: Project, region: 'main' | 'sidebar'): Block[] {
  const blocks: Block[] = [];
  const maxChars = region === 'sidebar' ? 150 : 500;
  if (region === 'sidebar') {
    const contact = project.cv.contact;
    const contactFields = {
      'birth-date': {
        value: formatDate(contact.birthDate, 'day'),
        dateTime: dateInput(contact.birthDate, 'day'),
        icon: Cake,
      },
      address: { value: [contact.address, contact.city].filter(Boolean).join('\n'), icon: House },
      email: { value: contact.email, icon: Mail },
      phone: { value: contact.phone, icon: Phone },
      'marital-status': { value: contact.maritalStatus, icon: HeartHandshake },
      website: { value: contact.website, icon: Globe },
    };
    const lines = project.layout.appearance.contactOrder
      .map((id) => ({ id, dateTime: undefined as string | undefined, ...contactFields[id] }))
      .filter((line) => line.value.trim());
    if (lines.length) {
      if (project.layout.appearance.showContactHeading)
        blocks.push({
          id: 'contact-heading',
          section: 'contact',
          sectionHeading: true,
          keepWithNext: true,
          content: <SectionHeading project={project} id="contact" />,
        });
      lines.forEach((line, i) =>
        blocks.push({
          id: `contact-${line.id}`,
          section: 'contact',
          contactItem: true,
          contactLast: i === lines.length - 1,
          content: (
            <p className="cv-contact-line" data-contact={line.id}>
              <line.icon
                className="cv-contact-icon"
                strokeWidth={1.7}
                aria-hidden="true"
                focusable="false"
              />
              <span>
                {line.dateTime ? (
                  <time dateTime={line.dateTime} aria-label={`Geburtsdatum: ${line.value}`}>
                    {line.value}
                  </time>
                ) : (
                  line.value
                )}
              </span>
            </p>
          ),
        }),
      );
    }
  }
  for (const section of project.layout.sections.filter(
    (item) => item.region === region && item.enabled,
  )) {
    const value =
      section.id === 'references'
        ? project.cv.references.filter((reference) =>
            Object.entries(reference).some(([key, value]) => key !== 'id' && value.trim()),
          )
        : project.cv[section.id];
    if (!value.length) continue;
    const start = blocks.length;
    blocks.push({
      id: `heading-${section.id}`,
      sectionHeading: true,
      keepWithNext: true,
      stationHeading: ['education', 'experience', 'projects'].includes(section.id),
      content: <SectionHeading project={project} id={section.id} />,
    });
    if (section.id === 'summary') {
      summaryParagraphs(project.cv.summary).forEach((text, i) =>
        blocks.push({ id: `summary-${i}`, summaryText: text, content: <p>{text}</p> }),
      );
    } else if (
      section.id === 'education' ||
      section.id === 'experience' ||
      section.id === 'projects'
    ) {
      for (const entry of project.cv[section.id]) {
        const description = descriptionBlocks(entry.description, maxChars);
        blocks.push({
          id: `${section.id}-${entry.id}`,
          keepWithNext: description.length > 0,
          station: description.length ? 'start' : 'single',
          content: (
            <StationHeading entry={entry} order={project.layout.appearance.stationHeadingOrder} />
          ),
        });
        description.forEach((part, i) =>
          blocks.push({
            id: `${section.id}-${entry.id}-p${i}`,
            station: i === description.length - 1 ? 'end' : 'body',
            bullet: part.kind === 'bullet',
            bulletContinuation: part.continuation,
            bulletContinues: part.kind === 'bullet' && description[i + 1]?.continuation,
            content: (
              <p className={part.kind === 'bullet' ? 'cv-bullet-text' : undefined}>
                {part.runs.map((run, j) =>
                  run.bold ? <strong key={j}>{run.text}</strong> : run.text,
                )}
              </p>
            ),
          }),
        );
      }
    } else if (section.id === 'skills') {
      const config = project.layout.skills;
      for (const group of groupSkills(project.cv.skills, config.groupByCategory)) {
        if (config.groupByCategory)
          blocks.push({
            id: `skills-category-${group.items[0].id}`,
            keepWithNext: true,
            content: (
              <h3 className="cv-skill-category">{group.category || 'Weitere Kenntnisse'}</h3>
            ),
          });
        for (const skill of group.items) {
          const description = config.showDescription
            ? splitPlainText(skill.description, maxChars)
            : [];
          blocks.push({
            id: `skills-${skill.id}`,
            keepWithNext: description.length > 0,
            content: (
              <SkillContent
                skill={skill}
                config={config}
                categorized={config.groupByCategory}
                showPercentage={project.layout.proficiencyPercentages.skills[skill.id] ?? true}
              />
            ),
          });
          description.forEach((text, i) =>
            blocks.push({
              id: `skills-${skill.id}-description-${i}`,
              content: <p className="cv-skill-description">{text}</p>,
            }),
          );
        }
      }
    } else if (section.id === 'references') {
      for (const reference of project.cv.references) {
        const fields = [
          { id: 'name', text: reference.name, name: true },
          { id: 'role', text: reference.role },
          { id: 'organization', text: reference.organization },
          { id: 'email', text: reference.email, icon: Mail },
          { id: 'phone', text: reference.phone, icon: Phone },
          {
            id: 'address',
            text: [reference.address, reference.city].filter((value) => value.trim()).join('\n'),
            icon: House,
          },
        ].filter((field) => field.text.trim());
        const details = fields.flatMap((field) =>
          splitPlainText(field.text, maxChars).map((text, i) => ({
            ...field,
            text,
            chunk: i,
            contact: !!field.icon,
            icon: i === 0 ? field.icon : undefined,
          })),
        );
        const shortPerson = fields.reduce((length, field) => length + field.text.length, 0) <= 300;
        details.forEach((field, i) =>
          blocks.push({
            id: `references-${reference.id}-${field.id}-${field.chunk}`,
            keepWithNext: i < details.length - 1 && (shortPerson || i === 0),
            referenceEnd: i === details.length - 1,
            content: field.name ? (
              <h3 className="cv-reference-name">{field.text}</h3>
            ) : (
              <p className={field.contact ? 'cv-reference-contact' : 'cv-reference-detail'}>
                {field.icon ? (
                  <field.icon
                    className="cv-contact-icon"
                    strokeWidth={1.7}
                    aria-hidden="true"
                    focusable="false"
                  />
                ) : (
                  field.contact && <span className="cv-contact-icon" aria-hidden="true" />
                )}
                <span>{field.text}</span>
              </p>
            ),
          }),
        );
      }
    } else {
      for (const item of project.cv[section.id as 'languages' | 'interests']) {
        blocks.push({
          id: `${section.id}-${item.id}`,
          content: (
            <div className="cv-skill">
              <h3>{item.name}</h3>
              {item.level && <p>{item.level}</p>}
              {'proficiency' in item && (
                <ProficiencyBar
                  name={item.name}
                  value={item.proficiency}
                  showValue={project.layout.proficiencyPercentages.languages[item.id] ?? true}
                />
              )}
            </div>
          ),
        });
      }
    }
    for (let i = start; i < blocks.length; i++) blocks[i].section = section.id;
  }
  return blocks;
}

/** Keep the shared introduction, or join each column's complete flow in compact mode. */
export function splitIntroduction(
  blocks: Block[],
  showSectionDividers: boolean,
  compactWithoutSummary: boolean,
) {
  const isIntro = (block: Block) => block.section === 'contact' || block.section === 'summary';
  const body: Block[] = [];
  let hasSection = false;
  for (const block of blocks.filter((block) => !isIntro(block))) {
    if (block.sectionHeading) {
      if (showSectionDividers && hasSection)
        body.push({
          id: `separator-${block.section}`,
          divider: true,
          keepWithNext: true,
          content: <hr aria-hidden="true" />,
        });
      hasSection = true;
    }
    body.push(block);
  }
  const intro = blocks.filter(isIntro);
  if (compactWithoutSummary) {
    // Each column now owns its complete flow. A local transition is measured like
    // any other block and disappears if the following content starts a new page.
    const transition: Block[] =
      intro.length && body.length
        ? [
            {
              id: 'contact-body-transition',
              divider: true,
              introTransition: true,
              keepWithNext: true,
              content: showSectionDividers ? (
                <div className="cv-wide-divider">
                  <hr aria-hidden="true" />
                </div>
              ) : null,
            },
          ]
        : [];
    return { intro: [], body: [...intro, ...transition, ...body] };
  }
  return { intro, body };
}
