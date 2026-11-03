import { headingLabels, type HeadingId, type Project } from '@cv/core';
import { Slider, TextField } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
type SpacingName =
  | 'introDividerSpacingBeforeMm'
  | 'introDividerSpacingAfterMm'
  | 'contactLineHeight'
  | 'contactSpacingMm'
  | 'stationDateLineHeight'
  | 'stationTitleLineHeight'
  | 'stationOrganizationLineHeight'
  | 'stationDateTitleGapMm'
  | 'stationTitleOrganizationGapMm';
export function SpacingControl({
  name,
  label,
  min,
  max,
  step = 0.5,
  unit = 'mm',
}: {
  name: SpacingName;
  label: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  const { control, watch } = useFormContext<Project>();
  const value = watch(`layout.appearance.${name}`),
    id = `spacing-${name}`;
  return (
    <>
      <div className="slider-label">
        <label id={id}>{label}</label>
        <span>
          {unit === '×' ? value.toFixed(2) : value} {unit}
        </span>
      </div>
      <Controller
        control={control}
        name={`layout.appearance.${name}`}
        render={({ field }) => (
          <Slider
            aria-labelledby={id}
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={min}
            max={max}
            step={step}
            size="small"
          />
        )}
      />
    </>
  );
}
export function HeadingControls({ id, disabled = false }: { id: HeadingId; disabled?: boolean }) {
  const { control, watch } = useFormContext<Project>();
  const heading = watch(`layout.appearance.sectionHeadings.${id}`);
  return (
    <div className="section-heading-settings">
      <Controller
        control={control}
        name={`layout.appearance.sectionHeadings.${id}.title`}
        render={({ field }) => (
          <TextField
            label={`Überschrift für ${headingLabels[id]}`}
            {...field}
            disabled={disabled}
            helperText={`Leer = ${headingLabels[id]}`}
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />
        )}
      />
      <div className="slider-label">
        <label id={`heading-size-${id}`}>Schriftgrösse für {headingLabels[id]}</label>
        <span>{heading.fontSizePt} pt</span>
      </div>
      <Controller
        control={control}
        name={`layout.appearance.sectionHeadings.${id}.fontSizePt`}
        render={({ field }) => (
          <Slider
            aria-labelledby={`heading-size-${id}`}
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={8}
            max={20}
            step={0.5}
            disabled={disabled}
            size="small"
          />
        )}
      />
    </div>
  );
}
