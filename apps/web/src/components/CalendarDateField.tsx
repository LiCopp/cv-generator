import { useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { IconButton, InputAdornment, TextField, Tooltip, type TextFieldProps } from '@mui/material';
import { X } from 'lucide-react';
import { dateInput, parseDateInput, type CvDate, type DatePrecision, type Project } from '@cv/core';

type Props = Pick<
  TextFieldProps,
  'label' | 'name' | 'inputRef' | 'onBlur' | 'disabled' | 'error' | 'helperText'
> & {
  value: CvDate | null;
  precision?: DatePrecision;
  onChange: (value: CvDate | null) => void;
  clearLabel?: string;
};

/** Keep native date segments intact while a year or another component is incomplete. */
export default function CalendarDateField({
  value,
  precision = 'day',
  onChange,
  inputRef,
  clearLabel,
  error,
  helperText,
  ...props
}: Props) {
  const {
    formState: { defaultValues },
  } = useFormContext<Project>();
  const input = useRef<HTMLInputElement | null>(null);
  const previousDefaults = useRef(defaultValues);
  const [invalid, setInvalid] = useState(false);
  const committed = dateInput(value, precision);
  useEffect(() => {
    const reset = previousDefaults.current !== defaultValues;
    previousDefaults.current = defaultValues;
    // A native input owns its unfinished segments. Only committed value changes or a
    // form reset may replace them; assigning even the same empty value clears segments.
    if (input.current && (reset || input.current.value !== committed))
      input.current.value = committed;
    setInvalid(false);
  }, [value, precision, defaultValues, committed]);

  return (
    <TextField
      {...props}
      key={precision}
      type={precision === 'year' ? 'number' : precision === 'month' ? 'month' : 'date'}
      defaultValue={committed}
      inputRef={(element: HTMLInputElement | null) => {
        input.current = element;
        if (typeof inputRef === 'function') inputRef(element);
        else if (inputRef) inputRef.current = element;
      }}
      slotProps={{
        input: {
          endAdornment: clearLabel ? (
            <InputAdornment position="end">
              <Tooltip title={clearLabel}>
                <span>
                  <IconButton
                    aria-label={clearLabel}
                    disabled={props.disabled}
                    size="small"
                    edge="end"
                    onClick={() => {
                      // Clearing one native segment leaves a badInput draft. Clear all of
                      // them explicitly, including drafts with no committed date yet.
                      if (input.current) input.current.value = '';
                      setInvalid(false);
                      onChange(null);
                      input.current?.focus();
                    }}
                  >
                    <X size={16} />
                  </IconButton>
                </span>
              </Tooltip>
            </InputAdornment>
          ) : undefined,
        },
        inputLabel: { shrink: true },
        htmlInput: {
          'data-calendar-date': '',
          min: precision === 'year' ? 1900 : precision === 'month' ? '1900-01' : '1900-01-01',
          max: precision === 'year' ? 2200 : precision === 'month' ? '2200-12' : '2200-12-31',
        },
      }}
      onChange={(event) => {
        const input = event.target;
        // Native inputs expose an empty value for incomplete segments as well as clearing.
        if (input.validity.badInput) {
          setInvalid(true);
          return;
        }
        try {
          const parsed = parseDateInput(input.value, precision);
          setInvalid(false);
          onChange(parsed);
        } catch {
          // Do not replace a partly typed year with the last committed date.
          setInvalid(true);
        }
      }}
      error={error || invalid}
      helperText={
        invalid ? 'Bitte ein vollständiges Datum zwischen 1900 und 2200 eingeben.' : helperText
      }
    />
  );
}
