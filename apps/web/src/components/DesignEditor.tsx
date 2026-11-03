import { Button } from '@mui/material';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import HeaderDesignControls from './design/HeaderDesignControls';
import PhotoDesignControls from './design/PhotoDesignControls';
import SectionDesignControls from './design/SectionDesignControls';
import SpacingDesignControls from './design/SpacingDesignControls';
import TypographyDesignControls from './design/TypographyDesignControls';
import DesignGroup from './DesignGroup';

const designGroupIds = ['photo', 'header', 'typography', 'spacing', 'sections'] as const;
type DesignGroupId = (typeof designGroupIds)[number];
const designGroupsStorageKey = 'folio.design-groups.v1';
function readExpandedGroups(): DesignGroupId[] {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(designGroupsStorageKey) ?? 'null');
    if (
      Array.isArray(saved) &&
      saved.every((id) => designGroupIds.includes(id)) &&
      new Set(saved).size === saved.length
    )
      return saved;
  } catch {
    /* Navigation still works when session storage is unavailable. */
  }
  return [...designGroupIds];
}
export default function DesignEditor() {
  const [expandedGroups, setExpandedGroups] = useState<DesignGroupId[]>(readExpandedGroups);
  useEffect(() => {
    try {
      sessionStorage.setItem(designGroupsStorageKey, JSON.stringify(expandedGroups));
    } catch {
      /* Keep the in-memory navigation state. */
    }
  }, [expandedGroups]);
  function setGroupExpanded(id: DesignGroupId, expanded: boolean) {
    setExpandedGroups((current) =>
      current.includes(id) === expanded
        ? current
        : expanded
          ? [...current, id]
          : current.filter((value) => value !== id),
    );
  }
  return (
    <div className="content-editor design-editor">
      <p className="eyebrow">DEIN STIL</p>
      <h1>So, wie es zu dir passt.</h1>
      <p className="editor-intro">Ein gutes Design gibt deiner Geschichte Raum.</p>
      <div
        className="design-navigation"
        role="group"
        aria-label="Designbereiche ein- und ausklappen"
      >
        <div className="design-toggle-actions">
          <Button
            size="small"
            variant="outlined"
            startIcon={<ChevronDown size={15} />}
            onClick={() => setExpandedGroups([...designGroupIds])}
          >
            Alle ausklappen
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ChevronUp size={15} />}
            onClick={() => setExpandedGroups([])}
          >
            Alle einklappen
          </Button>
        </div>
        <span className="design-toggle-status" aria-live="polite">
          {expandedGroups.length} von {designGroupIds.length} Bereichen geöffnet
        </span>
      </div>
      <DesignGroup
        id="photo"
        number="01"
        title="Profilfoto"
        description="Form, Rahmen, Bildausschnitt & Position"
        expanded={expandedGroups.includes('photo')}
        onExpandedChange={(value) => setGroupExpanded('photo', value)}
      >
        <PhotoDesignControls />
      </DesignGroup>
      <DesignGroup
        id="header"
        number="02"
        title="Header"
        description="Name, Farben, Hintergrund & Abschluss"
        expanded={expandedGroups.includes('header')}
        onExpandedChange={(value) => setGroupExpanded('header', value)}
      >
        <HeaderDesignControls />
      </DesignGroup>
      <DesignGroup
        id="typography"
        number="03"
        title="Typografie"
        description="Schriftfamilie, Schriftgrösse & Zeilenabstände"
        expanded={expandedGroups.includes('typography')}
        onExpandedChange={(value) => setGroupExpanded('typography', value)}
      >
        <TypographyDesignControls />
      </DesignGroup>
      <DesignGroup
        id="spacing"
        number="04"
        title="Aufteilung & Abstände"
        description="Spalten, Trennlinien, Zeitachse & Stationsköpfe"
        expanded={expandedGroups.includes('spacing')}
        onExpandedChange={(value) => setGroupExpanded('spacing', value)}
      >
        <SpacingDesignControls />
      </DesignGroup>
      <DesignGroup
        id="sections"
        number="05"
        title="Abschnitte"
        description="Reihenfolge, Sichtbarkeit, Überschriften & Kenntnisse"
        expanded={expandedGroups.includes('sections')}
        onExpandedChange={(value) => setGroupExpanded('sections', value)}
      >
        <SectionDesignControls />
      </DesignGroup>
    </div>
  );
}
