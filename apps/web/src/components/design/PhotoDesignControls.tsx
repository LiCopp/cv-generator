import { type Project } from '@cv/core';
import {
  Checkbox,
  FormControlLabel,
  MenuItem,
  Slider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';

export default function PhotoDesignControls() {
  const { control, watch } = useFormContext<Project>();
  const appearance = watch('layout.appearance');

  return (
    <>
      <Controller
        control={control}
        name="layout.appearance.showPhoto"
        render={({ field }) => (
          <FormControlLabel
            control={
              <Checkbox
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                size="small"
              />
            }
            label="Foto im Lebenslauf anzeigen"
          />
        )}
      />
      <Controller
        control={control}
        name="layout.appearance.photoShape"
        render={({ field }) => (
          <TextField select label="Fotoform" {...field}>
            <MenuItem value="circle">Kreis</MenuItem>
            <MenuItem value="rounded">Abgerundetes Rechteck</MenuItem>
            <MenuItem value="rectangle">Rechteck</MenuItem>
          </TextField>
        )}
      />
      <div className="slider-label">
        <label id="photo-width-label">Fotogrösse (Breite)</label>
        <span>{appearance.photoWidthMm} mm</span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.photoWidthMm"
        render={({ field }) => (
          <Slider
            aria-labelledby="photo-width-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={24}
            max={60}
            step={1}
            size="small"
          />
        )}
      />
      <p className="group-description">
        Beim Kreis entspricht die Breite dem Durchmesser. Bei rechteckiger Form wächst die Höhe
        proportional mit.
      </p>
      <Controller
        control={control}
        name="layout.appearance.photoBorderColor"
        render={({ field }) => (
          <TextField
            type="color"
            label="Rahmenfarbe"
            {...field}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}
      />
      <div className="slider-label">
        <label id="photo-border-width-label">Rahmenbreite</label>
        <span>{appearance.photoBorderWidthMm.toFixed(1)} mm</span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.photoBorderWidthMm"
        render={({ field }) => (
          <Slider
            aria-labelledby="photo-border-width-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={0}
            max={4}
            step={0.1}
            size="small"
          />
        )}
      />
      <p className="group-description">0 mm blendet den Rahmen aus.</p>
      <Controller
        control={control}
        name="layout.appearance.photoFit"
        render={({ field }) => (
          <TextField select label="Bildausschnitt" {...field}>
            <MenuItem value="cover">Ausfüllen (zugeschnitten)</MenuItem>
            <MenuItem value="contain">Einpassen (mehr vom Bild)</MenuItem>
          </TextField>
        )}
      />
      <div className="slider-label">
        <label id="photo-x-label">Bildausschnitt horizontal</label>
        <span>{appearance.photoPositionX} %</span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.photoPositionX"
        render={({ field }) => (
          <Slider
            aria-labelledby="photo-x-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={0}
            max={100}
            step={5}
            size="small"
          />
        )}
      />
      <div className="slider-label">
        <label id="photo-y-label">Bildausschnitt vertikal</label>
        <span>{appearance.photoPositionY} %</span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.photoPositionY"
        render={({ field }) => (
          <Slider
            aria-labelledby="photo-y-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={0}
            max={100}
            step={5}
            size="small"
          />
        )}
      />
      <p className="group-description">
        50 % zentriert das Bild. Mit «Einpassen» und den Ausschnittreglern lässt sich mehr vom
        Gesicht zeigen. Verschieben kann weisse Freiflächen erzeugen; die Fotoform und der Rahmen
        bleiben fest.
      </p>
      <label className="control-label" id="photo-side-label">
        Position des Profilfotos
      </label>
      <Controller
        control={control}
        name="layout.appearance.photoSide"
        render={({ field }) => (
          <ToggleButtonGroup
            fullWidth
            exclusive
            size="small"
            aria-labelledby="photo-side-label"
            value={field.value}
            onChange={(_, value) => value && field.onChange(value)}
          >
            <ToggleButton value="left">Links</ToggleButton>
            <ToggleButton value="right">Rechts</ToggleButton>
          </ToggleButtonGroup>
        )}
      />
      <div className="slider-label">
        <label id="photo-offset-label">Foto im Header vertikal verschieben</label>
        <span>
          {appearance.photoOffsetMm > 0 ? '+' : ''}
          {appearance.photoOffsetMm} mm
        </span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.photoOffsetMm"
        render={({ field }) => (
          <Slider
            aria-labelledby="photo-offset-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={-15}
            max={15}
            step={0.5}
            size="small"
            disabled={!appearance.showPhoto}
          />
        )}
      />
      <p className="group-description">
        Verschiebt das ganze Foto samt Rahmen: negative Werte nach oben, positive nach unten. Die
        Bewegung bleibt im sichtbaren Bereich; Headergrenze, Name und Bildausschnitt bleiben
        unverändert. Die Überlappung lässt sich separat einstellen. Ragt das Foto weiter nach unten,
        erhält der Inhalt darunter entsprechend mehr Abstand.
      </p>
      <div className="slider-label">
        <label id="photo-overlap-label">Überlappung der Headergrenze</label>
        <span>{appearance.photoOverlapMm} mm</span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.photoOverlapMm"
        render={({ field }) => (
          <Slider
            aria-labelledby="photo-overlap-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={0}
            max={20}
            step={1}
            size="small"
          />
        )}
      />
      <p className="group-description">
        0 mm: Foto innerhalb des Headers. Grössere Werte lassen es über die Unterkante hinausragen.
        Der Inhalt darunter rückt automatisch nach.
      </p>
      <p className="group-description">Ein Foto kannst du unter «Persönliches» hinzufügen.</p>
    </>
  );
}
