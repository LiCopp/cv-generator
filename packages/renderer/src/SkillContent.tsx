import { skillBarValue, type Skill, type SkillsLayout } from '@cv/core';
import { ProficiencyBar } from './ProficiencyBar';

/** Explicit assessments override decorative lengths; qualitative labels stay independent. */
export function SkillContent({
  skill,
  config,
  categorized = false,
  showPercentage = true,
}: {
  skill: Skill;
  config: SkillsLayout;
  categorized?: boolean;
  showPercentage?: boolean;
}) {
  const Heading = categorized ? 'h4' : 'h3';
  const level = config.showLevel ? skill.level.trim() : '';
  const bar = config.display === 'bars' ? skillBarValue(skill.level, config) : undefined;
  return (
    <div className={`cv-skill cv-skill-${config.display}`}>
      <Heading>
        {skill.name}
        {config.display === 'detailed' && level && (
          <span className="cv-skill-inline-level"> — {level}</span>
        )}
      </Heading>
      {config.display !== 'detailed' && level && <p className="cv-skill-level">{level}</p>}
      {skill.proficiency !== null ? (
        <ProficiencyBar name={skill.name} value={skill.proficiency} showValue={showPercentage} />
      ) : (
        bar !== undefined && (
          <div className="cv-skill-bar" aria-hidden="true">
            <span style={{ width: `${bar}%` }} />
          </div>
        )
      )}
    </div>
  );
}
