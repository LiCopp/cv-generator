import { Controller, useFormContext } from 'react-hook-form';
import { Checkbox, FormControlLabel, MenuItem, Switch, TextField } from '@mui/material';
import { skillLevels, type Project } from '@cv/core';

export default function SkillsDesignControls() {
  const { control, watch, setValue } = useFormContext<Project>();
  const config = watch('layout.skills'),
    skills = watch('cv.skills');
  const labels = [
    ...new Set([
      ...skillLevels,
      ...skills.map((skill) => skill.level.trim()).filter(Boolean),
      ...Object.keys(config.barValues),
    ]),
  ].filter((label) => !['__proto__', 'constructor', 'prototype'].includes(label));
  return (
    <div className="skills-design-settings">
      <Controller
        control={control}
        name="layout.skills.display"
        render={({ field }) => (
          <TextField
            select
            label="Darstellung der Kenntnisse"
            {...field}
            onChange={(event) => {
              field.onChange(event);
              setValue('layout.skills.showDescription', event.target.value === 'detailed', {
                shouldDirty: true,
              });
            }}
          >
            <MenuItem value="text">Text</MenuItem>
            <MenuItem value="bars">Progressbar</MenuItem>
            <MenuItem value="detailed">Detailliert</MenuItem>
          </TextField>
        )}
      />
      <Controller
        control={control}
        name="layout.skills.showLevel"
        render={({ field }) => (
          <FormControlLabel
            label="Kenntnisstände anzeigen"
            control={
              <Switch
                size="small"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            }
          />
        )}
      />
      <Controller
        control={control}
        name="layout.skills.showDescription"
        render={({ field }) => (
          <FormControlLabel
            label="Beschreibungen der Kenntnisse anzeigen"
            control={
              <Switch
                size="small"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            }
          />
        )}
      />
      <Controller
        control={control}
        name="layout.skills.groupByCategory"
        render={({ field }) => (
          <FormControlLabel
            label="Kenntnisse nach Kategorie gruppieren"
            control={
              <Switch
                size="small"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            }
          />
        )}
      />
      <p className="group-description">
        Eigene Werte von 0 bis 100 kannst du unter «Inhalt → Kenntnisse» pro Eintrag als Progressbar
        einschalten. Sie bleiben in jeder Darstellung sichtbar und ersetzen die Balkenlänge des
        Kenntnisstands.
      </p>
      {config.display === 'bars' && (
        <>
          <p className="group-description">
            Ohne eigenen Wert gelten die folgenden grafischen Balkenlängen je Kenntnisstand. Sie
            sind keine Prozentbewertung. Ohne Einstufung oder passende Zuordnung entfällt der
            Balken. Langjährige Erfahrung und eigene Bezeichnungen erhalten nur nach deiner
            ausdrücklichen Zuordnung einen Balken.
          </p>
          <details className="spacing-details">
            <summary>Balkenlängen je Kenntnisstand</summary>
            <div>
              <Controller
                control={control}
                name="layout.skills.barValues"
                render={({ field }) => (
                  <>
                    {labels.map((label) => {
                      const enabled = Object.hasOwn(field.value, label);
                      return (
                        <div className="skill-bar-setting" key={label}>
                          <FormControlLabel
                            label={`Balken für ${label}`}
                            control={
                              <Checkbox
                                size="small"
                                checked={enabled}
                                disabled={!enabled && Object.keys(field.value).length >= 40}
                                onChange={(event) => {
                                  const next = { ...field.value };
                                  if (event.target.checked) next[label] = 50;
                                  else delete next[label];
                                  field.onChange(next);
                                }}
                              />
                            }
                          />
                          {enabled && (
                            <TextField
                              type="number"
                              label={`Balkenlänge für ${label}`}
                              value={field.value[label]}
                              slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
                              helperText="Relative Länge von 0 bis 100."
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                if (
                                  event.target.value.trim() &&
                                  Number.isFinite(value) &&
                                  value >= 0 &&
                                  value <= 100
                                )
                                  field.onChange({ ...field.value, [label]: value });
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
