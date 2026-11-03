import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { Download } from 'lucide-react';

export default function NewProjectDialog({
  open,
  onClose,
  onSave,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Einen neuen Anfang machen?</DialogTitle>
      <DialogContent>
        <p className="dialog-copy">
          Der aktuelle Lebenslauf wird im Browser ersetzt. Speichere ihn vorher als Projektdatei,
          wenn du ihn behalten möchtest.
        </p>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => void onSave()} startIcon={<Download size={15} />}>
          Aktuelles Projekt speichern
        </Button>
        <Button variant="contained" onClick={onConfirm}>
          Neu beginnen
        </Button>
      </DialogActions>
    </Dialog>
  );
}
