import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
} from '@mui/material';

export default function ProjectResetDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (resetData: boolean) => void;
}) {
  const [resetData, setResetData] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) setResetData(false);
  }, [open]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="reset-project-title"
      aria-describedby="reset-project-description"
      slotProps={{ transition: { onEntered: () => cancelRef.current?.focus() } }}
    >
      <DialogTitle id="reset-project-title">Projekt zurücksetzen?</DialogTitle>
      <DialogContent>
        <p className="dialog-copy" id="reset-project-description">
          Alle Design-Einstellungen werden auf die Standardwerte der Studio-Vorlage zurückgesetzt.
          Dazu gehören auch Überschriften, Reihenfolge, Platzierung und Sichtbarkeit der Abschnitte.
        </p>
        <FormControlLabel
          control={
            <Checkbox
              checked={resetData}
              onChange={(event) => setResetData(event.target.checked)}
            />
          }
          label="Auch Lebenslaufdaten und Bilder zurücksetzen"
        />
        {resetData ? (
          <Alert severity="warning">
            Alle persönlichen Angaben, Einträge und hochgeladenen Bilder werden entfernt. Speichere
            dein Projekt vorher als Datei, wenn du es behalten möchtest.
          </Alert>
        ) : (
          <p className="dialog-copy">
            Lebenslaufdaten und Bilder bleiben gespeichert. Das Profilfoto wird ausgeblendet und das
            Headerbild abgewählt; beides kannst du danach erneut verwenden.
          </p>
        )}
      </DialogContent>
      <DialogActions>
        <Button ref={cancelRef} autoFocus onClick={onClose}>
          Abbrechen
        </Button>
        <Button variant="contained" onClick={() => onConfirm(resetData)}>
          Jetzt zurücksetzen
        </Button>
      </DialogActions>
    </Dialog>
  );
}
