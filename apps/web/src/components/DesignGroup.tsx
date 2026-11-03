import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export default function DesignGroup({
  id,
  number,
  title,
  description,
  expanded,
  onExpandedChange,
  children,
}: {
  id: string;
  number: string;
  title: string;
  description: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      className="design-group"
      open={expanded}
      onToggle={(event) => {
        if (event.target === event.currentTarget) onExpandedChange(event.currentTarget.open);
      }}
    >
      <summary
        className="design-group-summary"
        id={`design-${id}-summary`}
        role="button"
        aria-expanded={expanded}
        aria-label={title}
        aria-controls={`design-${id}-content`}
      >
        <span className="design-group-number" aria-hidden="true">
          {number}
        </span>
        <h2>{title}</h2>
        <ChevronDown className="design-group-chevron" size={18} aria-hidden="true" />
        <span className="design-group-caption">{description}</span>
      </summary>
      <div
        className="design-group-content"
        id={`design-${id}-content`}
        role="region"
        aria-labelledby={`design-${id}-summary`}
      >
        {children}
      </div>
    </details>
  );
}
