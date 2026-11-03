import { Controller, useFormContext } from 'react-hook-form';
import { Checkbox, FormControlLabel, Slider } from '@mui/material';
import type { Project } from '@cv/core';

export default function ProficiencyField({
  section,
  index,
  itemId,
}: {
  section: 'skills' | 'languages';
  index: number;
  itemId: string;
}) {
  const { control } = useFormContext<Project>();
  return (
    <Controller
      control={control}
      name={`cv.${section}.${index}.proficiency`}
      render={({ field }) => (
        <div>
          <FormControlLabel
            control={
              <Checkbox
                checked={field.value !== null}
                onChange={(_, checked) => field.onChange(checked ? 0 : null)}
              />
            }
            label="Eigene Progressbar anzeigen"
          />
          {field.value !== null && (
            <>
              <Controller
                control={control}
                name={`layout.proficiencyPercentages.${section}.${itemId}`}
                defaultValue={true}
                render={({ field: percentageField }) => (
                  <FormControlLabel
                    label="Prozentangabe anzeigen"
                    control={
                      <Checkbox
                        checked={percentageField.value ?? true}
                        onChange={(_, checked) => percentageField.onChange(checked)}
                      />
                    }
                  />
                )}
              />
              <Slider
                aria-label="Beherrschung"
                name={field.name}
                slotProps={{ input: { ref: field.ref, onBlur: field.onBlur } }}
                getAriaValueText={(value) => `${value} %`}
                min={0}
                max={100}
                step={1}
                value={Math.min(100, Math.max(0, field.value))}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value} %`}
                onChange={(_, value) => field.onChange(value)}
                onChangeCommitted={field.onBlur}
              />
            </>
          )}
        </div>
      )}
    />
  );
}
