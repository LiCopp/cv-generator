import { useRef } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { Button, TextField } from '@mui/material';
import { Bold, List } from 'lucide-react';
import type { Project } from '@cv/core';
import { continueBullet, toggleBold, toggleBullets, type TextEdit } from './description-editing';

export default function DescriptionField({
  section,
  index,
}: {
  section: 'education' | 'experience' | 'projects';
  index: number;
}) {
  const { control } = useFormContext<Project>();
  const { field, fieldState } = useController({
    control,
    name: `cv.${section}.${index}.description`,
  });
  const input = useRef<HTMLTextAreaElement | null>(null);
  const apply = (edit: TextEdit) => {
    field.onChange(edit.value);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(edit.start, edit.end);
    });
  };
  const format = (kind: 'bold' | 'bullets') => {
    const element = input.current;
    if (element)
      apply(
        (kind === 'bold' ? toggleBold : toggleBullets)(
          field.value,
          element.selectionStart,
          element.selectionEnd,
        ),
      );
  };
  return (
    <div className="description-field">
      <div
        className="description-toolbar"
        role="group"
        aria-label={`Beschreibung von Eintrag ${index + 1} formatieren`}
      >
        <Button
          type="button"
          size="small"
          startIcon={<Bold size={15} />}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => format('bold')}
        >
          Fett
        </Button>
        <Button
          type="button"
          size="small"
          startIcon={<List size={15} />}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => format('bullets')}
        >
          Aufzählung
        </Button>
      </div>
      <TextField
        label="Beschreibung (optional)"
        multiline
        minRows={4}
        name={field.name}
        value={field.value}
        onChange={field.onChange}
        onBlur={field.onBlur}
        inputRef={(element) => {
          input.current = element;
          field.ref(element);
        }}
        error={!!fieldState.error}
        helperText={
          fieldState.error?.message ??
          'Text markieren → Fett; Zeilen markieren → Aufzählung. Auch direkt: **fett** und - Listenpunkt. Enter setzt die Liste fort; eine leere Zeile beendet sie.'
        }
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (
            (event.ctrlKey || event.metaKey) &&
            !event.altKey &&
            event.key.toLowerCase() === 'b'
          ) {
            event.preventDefault();
            format('bold');
          } else if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            input.current
          ) {
            const edit = continueBullet(
              field.value,
              input.current.selectionStart,
              input.current.selectionEnd,
            );
            if (edit) {
              event.preventDefault();
              apply(edit);
            }
          }
        }}
      />
    </div>
  );
}
