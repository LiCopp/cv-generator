import { contactFieldLabels, sectionLabels, type Project } from '@cv/core';
import { FormControlLabel, IconButton, Switch } from '@mui/material';
import { ArrowDown, ArrowUp, Columns2 } from 'lucide-react';
import { Controller, useFormContext } from 'react-hook-form';
import SkillsDesignControls from '../SkillsDesignControls';
import { HeadingControls, SpacingControl } from './DesignControls';

export default function SectionDesignControls() {
  const { control, watch, setValue, getValues } = useFormContext<Project>();
  const appearance = watch('layout.appearance');
  const sections = watch('layout.sections');
  function reorder(index: number, direction: number) {
    const next = [...sections];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setValue('layout.sections', next, { shouldDirty: true });
  }

  return (
    <>
      <p className="group-description">
        Reihenfolge, Sichtbarkeit und Platz — du entscheidest. Überschrift und Schriftgrösse lassen
        sich für jeden Abschnitt einzeln ändern.
      </p>
      <div className="section-settings">
        <div className="section-setting">
          <div className="section-setting-title">
            <span>Kontakt</span>
          </div>
          <Controller
            control={control}
            name="layout.appearance.showContactHeading"
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                }
                label="Kontaktüberschrift anzeigen"
              />
            )}
          />
          <p className="group-description">
            Ohne Überschrift beginnen die Kontaktangaben auf Höhe von «Über mich».
          </p>
          <HeadingControls id="contact" disabled={!appearance.showContactHeading} />
          <SpacingControl
            name="contactLineHeight"
            label="Zeilenabstand Kontaktangaben"
            min={1}
            max={2.4}
            step={0.05}
            unit="×"
          />
          <SpacingControl
            name="contactSpacingMm"
            label="Abstand zwischen Kontaktangaben"
            min={0}
            max={8}
            step={0.1}
          />
          <p className="group-description">
            Kontaktangaben mit den Pfeilen sortieren. Leere Angaben erscheinen nicht; ihre Position
            bleibt gespeichert. Adresse und Ort bilden eine gemeinsame Angabe.
          </p>
          <ol className="contact-order" aria-label="Reihenfolge der Kontaktangaben">
            {appearance.contactOrder.map((id, index) => (
              <li key={id}>
                <span>{contactFieldLabels[id]}</span>
                <div>
                  {([-1, 1] as const).map((direction) => (
                    <IconButton
                      key={direction}
                      size="small"
                      aria-label={`${contactFieldLabels[id]} nach ${direction === -1 ? 'oben' : 'unten'}`}
                      disabled={
                        index + direction < 0 || index + direction >= appearance.contactOrder.length
                      }
                      onClick={() => {
                        const next = [...getValues('layout.appearance.contactOrder')];
                        [next[index], next[index + direction]] = [
                          next[index + direction],
                          next[index],
                        ];
                        setValue('layout.appearance.contactOrder', next, {
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
        </div>
        {sections.map((section, index) => (
          <div className="section-setting" key={section.id}>
            <div className="section-setting-title">
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={section.enabled}
                    onChange={(e) =>
                      setValue(`layout.sections.${index}.enabled`, e.target.checked, {
                        shouldDirty: true,
                      })
                    }
                  />
                }
                label={sectionLabels[section.id]}
              />
              <div>
                <IconButton
                  size="small"
                  aria-label={`${sectionLabels[section.id]} nach oben`}
                  disabled={index === 0}
                  onClick={() => reorder(index, -1)}
                >
                  <ArrowUp size={14} />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`${sectionLabels[section.id]} nach unten`}
                  disabled={index === sections.length - 1}
                  onClick={() => reorder(index, 1)}
                >
                  <ArrowDown size={14} />
                </IconButton>
              </div>
            </div>
            <div className="section-region">
              <Columns2 size={13} />
              <Controller
                control={control}
                name={`layout.sections.${index}.region`}
                render={({ field }) => (
                  <select aria-label={`Bereich für ${sectionLabels[section.id]}`} {...field}>
                    <option value="main">Hauptspalte</option>
                    <option value="sidebar">Seitenleiste</option>
                  </select>
                )}
              />
            </div>
            <HeadingControls id={section.id} />
            {section.id === 'skills' && <SkillsDesignControls />}
          </div>
        ))}
      </div>
    </>
  );
}
