import { fontRegistry, typographyLineHeightMin, type Project } from '@cv/core';
import { FormControlLabel, MenuItem, Slider, Switch, TextField } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';

export default function TypographyDesignControls() {
  const { control, watch } = useFormContext<Project>();
  const appearance = watch('layout.appearance');

  return (
    <>
      <Controller
        control={control}
        name="layout.appearance.fontId"
        render={({ field }) => (
          <TextField select label="Schriftfamilie" {...field}>
            {Object.entries(fontRegistry).map(([id, font]) => (
              <MenuItem key={id} value={id} style={{ fontFamily: font.family }}>
                {font.label}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <div className="type-sample" style={{ fontFamily: fontRegistry[appearance.fontId].family }}>
        <span>Aa</span>
        <div>
          Deine Geschichte verdient
          <br />
          einen guten ersten Eindruck.
        </div>
      </div>
      <div className="slider-label">
        <label id="font-size-label">Schriftgrösse</label>
        <span>{appearance.fontSizePt} pt</span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.fontSizePt"
        render={({ field }) => (
          <Slider
            aria-labelledby="font-size-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={9}
            max={12}
            step={0.5}
            size="small"
          />
        )}
      />
      <div className="slider-label">
        <label id="line-height-label">Zeilenabstand</label>
        <span>{appearance.lineHeight.toFixed(2)}</span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.lineHeight"
        render={({ field }) => (
          <Slider
            aria-labelledby="line-height-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={typographyLineHeightMin}
            max={1.8}
            step={0.05}
            size="small"
          />
        )}
      />
      <Controller
        control={control}
        name="layout.appearance.leftColumnLineHeight"
        render={({ field }) => (
          <FormControlLabel
            label="Eigener Zeilenabstand für die linke Spalte"
            control={
              <Switch
                size="small"
                checked={field.value !== null}
                onChange={(event) =>
                  field.onChange(event.target.checked ? appearance.lineHeight : null)
                }
              />
            }
          />
        )}
      />
      {appearance.leftColumnLineHeight !== null && (
        <>
          <div className="slider-label">
            <label id="left-column-line-height-label">Zeilenabstand linke Spalte</label>
            <span>{appearance.leftColumnLineHeight.toFixed(2)} ×</span>
          </div>
          <Controller
            control={control}
            name="layout.appearance.leftColumnLineHeight"
            render={({ field }) => (
              <Slider
                aria-labelledby="left-column-line-height-label"
                value={field.value ?? appearance.lineHeight}
                onChange={(_, value) => field.onChange(value)}
                min={typographyLineHeightMin}
                max={2.4}
                step={0.05}
                size="small"
              />
            )}
          />
        </>
      )}
      <p className="group-description">
        Für den Fliesstext in der physisch linken Spalte unterhalb von Kontakt und «Über mich», auch
        wenn die Seitenleiste rechts steht. Abschnittsüberschriften behalten den allgemeinen
        Zeilenabstand, damit beide Spalten gleich ausgerichtet bleiben. Der obere Bereich und die
        eigenen Zeilenabstände der Stationsköpfe bleiben unverändert. Ausgeschaltet gilt der
        allgemeine Zeilenabstand.
      </p>
    </>
  );
}
