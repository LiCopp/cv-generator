/** An explicit self-assessment, with readable text in both HTML and PDF. */
export function ProficiencyBar({
  name,
  value,
  showValue = true,
}: {
  name: string;
  value: number | null;
  showValue?: boolean;
}) {
  if (value === null || !Number.isInteger(value) || value < 0 || value > 100) return null;
  return (
    <div className="cv-proficiency">
      <div
        className="cv-skill-bar"
        role="meter"
        aria-label={`Beherrschung: ${name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value} %`}
      >
        <span style={{ width: `${value}%` }} />
      </div>
      {showValue && <span className="cv-proficiency-value">{value} %</span>}
    </div>
  );
}
