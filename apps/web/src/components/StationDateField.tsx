import { useController, useFormContext } from 'react-hook-form';
import { dateInput, formatDate, type DatePrecision, type Project } from '@cv/core';
import CalendarDateField from './CalendarDateField';

export default function StationDateField({
  section,
  index,
  endpoint,
  disabled = false,
}: {
  section: 'education' | 'experience' | 'projects';
  index: number;
  endpoint: 'start' | 'end';
  disabled?: boolean;
}) {
  const { control } = useFormContext<Project>();
  const { field, fieldState } = useController({
    control,
    name: `cv.${section}.${index}.${endpoint}`,
  });
  const { field: precisionField } = useController({
    control,
    name: `cv.${section}.${index}.${endpoint}Precision`,
  });
  const precision = precisionField.value;
  const label = endpoint === 'start' ? 'Von' : 'Bis';
  const value = dateInput(field.value, precision);
  const needsDetail = field.value !== null && !value;
  return (
    <div className="station-date-field">
      <label className="date-precision-label">
        <span>Genauigkeit {label}</span>
        <select
          aria-label={`Genauigkeit ${label}`}
          value={precision}
          disabled={disabled}
          onChange={(event) => precisionField.onChange(event.target.value as DatePrecision)}
          onBlur={precisionField.onBlur}
          ref={precisionField.ref}
        >
          <option value="day">Taggenau</option>
          <option value="month">Monatsgenau</option>
          {precision === 'year' && <option value="year">Jahresgenau (bestehend)</option>}
        </select>
      </label>
      <CalendarDateField
        label={label}
        clearLabel={endpoint === 'end' ? 'Enddatum entfernen' : undefined}
        precision={precision}
        disabled={disabled}
        value={field.value}
        name={field.name}
        inputRef={field.ref}
        onBlur={field.onBlur}
        onChange={field.onChange}
        error={!!fieldState.error}
        helperText={
          fieldState.error
            ? 'Bitte Datum und Zeitraum prüfen.'
            : needsDetail
              ? `Vorhanden: ${formatDate(field.value)}. Bitte ${precision === 'day' ? 'Tag' : 'Monat'} ergänzen.`
              : endpoint === 'end'
                ? 'Optional. Für einen einzelnen Tag leer lassen.'
                : undefined
        }
      />
    </div>
  );
}
