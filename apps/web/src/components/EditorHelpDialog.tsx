import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from '@mui/material';
import { X } from 'lucide-react';

export default function EditorHelpDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Dein Lebenslauf. Ganz bei dir.
        <IconButton className="dialog-close" aria-label="Hilfe schliessen" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <div className="help-content">
          <p>
            <strong>Einfach anfangen.</strong> Trage deine Angaben ein. Die Vorschau aktualisiert
            sich direkt. Unter «Design» kannst du Farben, Schrift und Aufteilung ändern.
          </p>
          <p>
            <strong>Lokal gespeichert.</strong> Deine Angaben bleiben in diesem Browser. Mit
            «Projekt speichern» lädst du eine bearbeitbare JSON-Datei inklusive Design und Foto
            herunter. Mit «Öffnen» lädst du sie wieder. Sichere die Datei, bevor du Browserdaten
            löschst.
          </p>
          <p>
            <strong>Als PDF mitnehmen.</strong> «PDF exportieren» öffnet den Druckdialog. Wähle «Als
            PDF speichern», A4, keine Ränder und deaktiviere die Kopf- und Fusszeilen des Browsers.
            Aktiviere Hintergrundgrafiken für die Farben.
          </p>
          <p>
            <strong>Beispiele ausprobieren.</strong> Oben links findest du einen kurzen
            Schüler-Lebenslauf, einen langen Berufs-Lebenslauf und einen leeren Start. Alle
            Beispieldaten sind erfunden.
          </p>
          <p className="help-version">Erster lokaler Entwurf · folio 0.1</p>
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Alles klar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
