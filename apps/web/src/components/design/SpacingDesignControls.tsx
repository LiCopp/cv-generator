import { stationHeadingLabels, type Project } from '@cv/core';
import {
  FormControlLabel,
  IconButton,
  MenuItem,
  Slider,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { ArrowDown, ArrowUp, PanelLeft, PanelRight } from 'lucide-react';
import { Controller, useFormContext } from 'react-hook-form';
import { SpacingControl } from './DesignControls';

export default function SpacingDesignControls() {
  const { control, watch, setValue, getValues } = useFormContext<Project>();
  const appearance = watch('layout.appearance');

  return (
    <>
      <Controller
        control={control}
        name="layout.appearance.showRunningHeader"
        render={({ field }) => (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            }
            label="Kopfzeile auf Folgeseiten anzeigen"
          />
        )}
      />
      <p className="group-description">
        Die kleine Kopfzeile ab Seite 2. Beim Ausschalten steht ihr Platz für Inhalt zur Verfügung.
        Der gestaltete Header auf Seite 1 bleibt sichtbar.
      </p>
      <Controller
        control={control}
        name="layout.appearance.showFooter"
        render={({ field }) => (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            }
            label="Fusszeile anzeigen"
          />
        )}
      />
      <p className="group-description">
        Name und Seitenzahlen auf allen Seiten. Ohne Fusszeile wird ihr Platz für Inhalt genutzt.
        Die gewählten Seitenränder bleiben erhalten.
      </p>
      <div className="slider-label">
        <label id="header-content-gap-label">Abstand zum Header</label>
        <span>{appearance.headerContentGapMm} mm</span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.headerContentGapMm"
        render={({ field }) => (
          <Slider
            aria-labelledby="header-content-gap-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={0}
            max={30}
            step={0.5}
            size="small"
          />
        )}
      />
      <p className="group-description">
        Abstand von Kontakt und «Über mich» zum Header auf der ersten Seite. Ein überlappendes
        Profilfoto wird dabei berücksichtigt.
      </p>
      <div className="slider-label">
        <label id="intro-body-gap-label">Abstand nach Kontakt & Über mich</label>
        <span>{appearance.introBodyGapMm} mm</span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.introBodyGapMm"
        render={({ field }) => (
          <Slider
            aria-labelledby="intro-body-gap-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={0}
            max={30}
            step={0.5}
            size="small"
          />
        )}
      />
      <p className="group-description">
        Beide Spalten starten gemeinsam nach dem längeren Einstiegsabschnitt, auch ohne Trennlinie.
        Bei eingeschalteten Linien kommen deren Abstände hinzu. Mit der folgenden Option können sie
        ohne «Über mich» unabhängig beginnen.
      </p>
      <Controller
        control={control}
        name="layout.appearance.compactWithoutSummary"
        render={({ field }) => (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            }
            label="Freien Platz bei ausgeblendetem Über mich nutzen"
          />
        )}
      />
      <p className="group-description">
        Wenn «Über mich» ausgeblendet oder leer ist, beginnt die Hauptspalte direkt unter dem
        Header. Die Seitenleiste läuft unter den Kontaktangaben weiter. Eine eingeschaltete
        Trennlinie bleibt dann auf die Seitenleiste begrenzt.
      </p>
      <Controller
        control={control}
        name="layout.appearance.sectionDividers"
        render={({ field }) => (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            }
            label="Horizontale Trennlinien"
          />
        )}
      />
      <p className="group-description">
        Beim gemeinsamen Einstieg überspannt die erste Linie beide Spalten. Ohne «Über mich» und mit
        aktivierter Platznutzung bleibt sie unter den Kontaktangaben in der Seitenleiste. Weitere
        Trennlinien bleiben in ihrer Spalte. Die Abschnittsreihenfolge bleibt erhalten.
      </p>
      {appearance.sectionDividers && (
        <>
          <SpacingControl
            name="introDividerSpacingBeforeMm"
            label="Abstand oberhalb der Headerlinie"
            min={0}
            max={15}
          />
          <SpacingControl
            name="introDividerSpacingAfterMm"
            label="Abstand unterhalb der Headerlinie"
            min={0}
            max={15}
          />
          <p className="group-description">
            Für die Linie nach dem Einstieg, bei aktivierter Platznutzung nur unter den
            Kontaktangaben. Der Abstand nach dem Einstieg kommt zusätzlich hinzu.
          </p>
          <div className="slider-label">
            <label id="divider-before-label">Abstand oberhalb der Trennlinien</label>
            <span>{appearance.dividerSpacingBeforeMm} mm</span>
          </div>
          <Controller
            control={control}
            name="layout.appearance.dividerSpacingBeforeMm"
            render={({ field }) => (
              <Slider
                aria-labelledby="divider-before-label"
                value={field.value}
                onChange={(_, value) => field.onChange(value)}
                min={0}
                max={15}
                step={0.5}
                size="small"
              />
            )}
          />
          <div className="slider-label">
            <label id="divider-after-label">Abstand unterhalb der Trennlinien</label>
            <span>{appearance.dividerSpacingAfterMm} mm</span>
          </div>
          <Controller
            control={control}
            name="layout.appearance.dividerSpacingAfterMm"
            render={({ field }) => (
              <Slider
                aria-labelledby="divider-after-label"
                value={field.value}
                onChange={(_, value) => field.onChange(value)}
                min={0}
                max={15}
                step={0.5}
                size="small"
              />
            )}
          />
          <p className="group-description">
            Für die weiteren Linien innerhalb der einzelnen Spalten. Die breite Headerlinie hat
            eigene Abstände.
          </p>
          <Controller
            control={control}
            name="layout.appearance.dividerLengthPercent"
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={field.value !== null}
                    onChange={(event) => field.onChange(event.target.checked ? 100 : null)}
                  />
                }
                label="Eigene Länge der Abschnittslinien"
              />
            )}
          />
          {appearance.dividerLengthPercent !== null && (
            <>
              <div className="slider-label">
                <label id="divider-length-label">Länge der Abschnittslinien</label>
                <span>{appearance.dividerLengthPercent} %</span>
              </div>
              <Controller
                control={control}
                name="layout.appearance.dividerLengthPercent"
                render={({ field }) => (
                  <Slider
                    aria-labelledby="divider-length-label"
                    value={field.value ?? 100}
                    onChange={(_, value) => field.onChange(value)}
                    min={10}
                    max={100}
                    step={5}
                    size="small"
                  />
                )}
              />
            </>
          )}
          <p className="group-description">
            Abschnittslinien beginnen an der Zeitachse, sonst am linken Spaltenrand. Automatisch
            reichen sie bis zum rechten Textrand; eine eigene Länge verkürzt sie auf 10–100 % dieses
            Platzes. Die Linie nach dem Einstieg verwendet die volle Breite ihres Bereichs: beide
            Spalten beim gemeinsamen Einstieg, sonst nur die Seitenleiste.
          </p>
        </>
      )}
      <label className="control-label" id="sidebar-label">
        Position der Seitenleiste
      </label>
      <Controller
        control={control}
        name="layout.appearance.sidebarSide"
        render={({ field }) => (
          <ToggleButtonGroup
            fullWidth
            exclusive
            size="small"
            aria-labelledby="sidebar-label"
            value={field.value}
            onChange={(_, value) => value && field.onChange(value)}
          >
            <ToggleButton value="left">
              <PanelLeft size={16} /> Links
            </ToggleButton>
            <ToggleButton value="right">
              <PanelRight size={16} /> Rechts
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      />
      <div className="slider-label">
        <label id="sidebar-width-label">Breite der Seitenleiste</label>
        <span>{appearance.sidebarPercent} %</span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.sidebarPercent"
        render={({ field }) => (
          <Slider
            aria-labelledby="sidebar-width-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={25}
            max={36}
            step={1}
            size="small"
          />
        )}
      />
      <div className="slider-label">
        <label id="margin-label">Seitenrand</label>
        <span>{watch('layout.page.marginMm')} mm</span>
      </div>
      <Controller
        control={control}
        name="layout.page.marginMm"
        render={({ field }) => (
          <Slider
            aria-labelledby="margin-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={10}
            max={22}
            step={1}
            size="small"
          />
        )}
      />
      <div className="slider-label">
        <label id="spacing-label">Abschnittsabstand</label>
        <span>{appearance.spacingMm} mm</span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.spacingMm"
        render={({ field }) => (
          <Slider
            aria-labelledby="spacing-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={3}
            max={9}
            step={0.5}
            size="small"
          />
        )}
      />
      <Controller
        control={control}
        name="layout.appearance.timelineStyle"
        render={({ field }) => (
          <TextField select label="Stationen markieren" {...field}>
            <MenuItem value="line">Punkte mit Verbindungslinie</MenuItem>
            <MenuItem value="dots">Nur Punkte</MenuItem>
            <MenuItem value="none">Ohne Markierung</MenuItem>
          </TextField>
        )}
      />
      <div className="slider-label">
        <label id="timeline-position-label">Position der Zeitachse</label>
        <span>
          {appearance.timelineOffsetMm > 0 ? '+' : ''}
          {appearance.timelineOffsetMm} mm
        </span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.timelineOffsetMm"
        render={({ field }) => (
          <Slider
            aria-labelledby="timeline-position-label"
            aria-describedby="timeline-position-help"
            getAriaValueText={(value) =>
              `${Math.abs(value)} Millimeter ${value < 0 ? 'nach links' : value > 0 ? 'nach rechts' : '(Standard)'}`
            }
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={-10}
            max={12}
            step={0.5}
            disabled={appearance.timelineStyle === 'none'}
            size="small"
          />
        )}
      />
      <p className="group-description" id="timeline-position-help">
        Nach links (−) oder rechts (+) verschieben. Die Hauptüberschriften bleiben linksbündig zur
        Zeitachse, der Stationstext behält seinen Abstand. 0 mm entspricht der Standardposition.
      </p>
      <div className="slider-label">
        <label id="timeline-text-gap-label">Abstand Zeitachse zum Text</label>
        <span>{appearance.timelineTextGapMm} mm</span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.timelineTextGapMm"
        render={({ field }) => (
          <Slider
            aria-labelledby="timeline-text-gap-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={2}
            max={14}
            step={0.25}
            disabled={appearance.timelineStyle === 'none'}
            size="small"
          />
        )}
      />
      <div className="slider-label">
        <label id="station-spacing-label">Abstand zwischen Stationen</label>
        <span>{appearance.stationSpacingMm} mm</span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.stationSpacingMm"
        render={({ field }) => (
          <Slider
            aria-labelledby="station-spacing-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={0}
            max={12}
            step={0.5}
            size="small"
          />
        )}
      />
      <p className="group-description">
        Der Abstand zur Zeitachse gilt nur in der Hauptspalte. Der Stationsabstand gilt für
        Ausbildung, Erfahrung und Projekte in beiden Spalten und kommt nach dem letzten Textblock
        hinzu; Absätze innerhalb einer Station behalten ihren Abstand.
      </p>
      <details className="spacing-details">
        <summary>Stationskopf: Datum, Titel & Arbeitgeber</summary>
        <div>
          <ol className="contact-order" aria-label="Reihenfolge im Stationskopf">
            {appearance.stationHeadingOrder.map((field, index) => (
              <li key={field}>
                <span>{stationHeadingLabels[field]}</span>
                <div>
                  {([-1, 1] as const).map((direction) => (
                    <IconButton
                      key={direction}
                      size="small"
                      aria-label={`${stationHeadingLabels[field]} im Stationskopf nach ${direction === -1 ? 'oben' : 'unten'}`}
                      disabled={
                        index + direction < 0 ||
                        index + direction >= appearance.stationHeadingOrder.length
                      }
                      onClick={() => {
                        const next = [...getValues('layout.appearance.stationHeadingOrder')];
                        [next[index], next[index + direction]] = [
                          next[index + direction],
                          next[index],
                        ];
                        setValue('layout.appearance.stationHeadingOrder', next, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                    >
                      {direction === -1 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                    </IconButton>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <p className="group-description">
            Die Reihenfolge gilt für Erfahrung, Ausbildung und Projekte in beiden Spalten. Der
            Jobtitel bleibt hervorgehoben; leere Angaben werden übersprungen.
          </p>
          <SpacingControl
            name="stationDateLineHeight"
            label="Zeilenabstand Datum"
            min={1}
            max={2.4}
            step={0.05}
            unit="×"
          />
          <SpacingControl
            name="stationTitleLineHeight"
            label="Zeilenabstand Stationstitel"
            min={1}
            max={2.4}
            step={0.05}
            unit="×"
          />
          <SpacingControl
            name="stationOrganizationLineHeight"
            label="Zeilenabstand Arbeitgeber / Institution"
            min={1}
            max={2.4}
            step={0.05}
            unit="×"
          />
          <SpacingControl
            name="stationDateTitleGapMm"
            label="Abstand nach Datum"
            min={0}
            max={8}
            step={0.1}
          />
          <SpacingControl
            name="stationTitleOrganizationGapMm"
            label="Abstand vor Arbeitgeber / Institution"
            min={0}
            max={8}
            step={0.1}
          />
          <p className="group-description">
            Für Erfahrung, Ausbildung und Projekte in beiden Spalten. Diese Werte sind unabhängig
            vom Beschreibungstext und vom Abstand zwischen Stationen.
          </p>
        </div>
      </details>
      <p className="group-description">
        Für Ausbildung, Erfahrung und Projekte in der Hauptspalte. In der Seitenleiste erscheinen
        Stationen ohne Zeitachse und Punkte. Die Markierungen verwenden deine Akzentfarbe. Bei
        «Punkte mit Verbindungslinie» wird die Zeitachse bis zum Ende des Inhaltsbereichs und auf
        der Folgeseite weitergeführt, solange derselbe Abschnitt weitergeht.
      </p>
    </>
  );
}
