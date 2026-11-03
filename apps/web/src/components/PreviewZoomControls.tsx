import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
} from '@mui/material';
import { Minus, Plus, RotateCcw, Ruler } from 'lucide-react';

export const minPreviewZoom = 25;
export const maxPreviewZoom = 400;
const calibrationKey = 'folio.preview-measured-mm.v1';
function readMeasurement(): number | null {
  try {
    const saved = localStorage.getItem(calibrationKey),
      value = saved === null ? NaN : Number(saved);
    return Number.isFinite(value) && value >= 12.5 && value <= 200 ? value : null;
  } catch {
    return null;
  }
}

export default function PreviewZoomControls({
  zoom,
  onZoomChange,
  onFit,
}: {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFit: () => void;
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [measurement, setMeasurement] = useState<number | null>(readMeasurement);
  const [calibrating, setCalibrating] = useState(false);
  const [measuredText, setMeasuredText] = useState('');
  const measured = Number(measuredText.replace(',', '.'));
  const valid =
    measuredText.trim() !== '' && Number.isFinite(measured) && measured >= 12.5 && measured <= 200;
  const label = (value: number) =>
    Number(value.toFixed(1)).toLocaleString('de-CH', { maximumFractionDigits: 1 });
  const originalZoom = (value: number) => (50 / value) * 100;
  function openCalibration() {
    setMenu(null);
    setMeasuredText(measurement === null ? '' : String(measurement));
    setCalibrating(true);
  }
  function applyCalibration() {
    if (!valid) return;
    setMeasurement(measured);
    try {
      localStorage.setItem(calibrationKey, String(measured));
    } catch {
      /* Calibration still works for this session. */
    }
    onZoomChange(originalZoom(measured));
    setCalibrating(false);
  }
  return (
    <>
      <div className="preview-zoom-controls">
        <Tooltip title="Verkleinern">
          <IconButton
            aria-label="Vorschau verkleinern"
            size="small"
            disabled={zoom <= minPreviewZoom}
            onClick={() => onZoomChange(Math.max(minPreviewZoom, zoom - 10))}
          >
            <Minus size={14} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoomstufe auswählen">
          <Button
            className="zoom-value"
            size="small"
            aria-label={`Zoomstufe auswählen, aktuell ${label(zoom)} %`}
            aria-haspopup="menu"
            aria-controls={menu ? 'preview-zoom-menu' : undefined}
            aria-expanded={Boolean(menu)}
            onClick={(event) => setMenu(event.currentTarget)}
          >
            {label(zoom)} %
          </Button>
        </Tooltip>
        <Tooltip title="Vergrössern">
          <IconButton
            aria-label="Vorschau vergrössern"
            size="small"
            disabled={zoom >= maxPreviewZoom}
            onClick={() => onZoomChange(Math.min(maxPreviewZoom, zoom + 10))}
          >
            <Plus size={14} />
          </IconButton>
        </Tooltip>
        <span className="toolbar-divider" />
        <Tooltip title="A4 in Originalgrösse am Bildschirm anzeigen">
          <IconButton
            aria-label="A4 in Originalgrösse anzeigen"
            size="small"
            onClick={() =>
              measurement === null ? openCalibration() : onZoomChange(originalZoom(measurement))
            }
          >
            <Ruler size={15} />
          </IconButton>
        </Tooltip>
        <Tooltip title="An Fensterbreite anpassen">
          <IconButton aria-label="Vorschau einpassen" size="small" onClick={onFit}>
            <RotateCcw size={14} />
          </IconButton>
        </Tooltip>
      </div>
      <Menu
        id="preview-zoom-menu"
        anchorEl={menu}
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
      >
        {[25, 50, 75, 100, 125, 150, 200, 300, 400].map((value) => (
          <MenuItem
            key={value}
            selected={Math.abs(zoom - value) < 0.01}
            onClick={() => {
              onZoomChange(value);
              setMenu(null);
            }}
          >
            {value} %
          </MenuItem>
        ))}
        <MenuItem divider onClick={openCalibration}>
          Bildschirm kalibrieren …
        </MenuItem>
      </Menu>
      <Dialog
        open={calibrating}
        onClose={() => setCalibrating(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="preview-calibration-title"
      >
        <DialogTitle id="preview-calibration-title">A4 in Originalgrösse</DialogTitle>
        <DialogContent>
          <p className="dialog-copy">
            Miss die folgende Linie mit einem Lineal direkt am Bildschirm. Trage ihre tatsächliche
            Länge in Millimetern ein.
          </p>
          <div
            className="preview-calibration-ruler"
            aria-label="Vergleichslinie, Referenzlänge 50 Millimeter"
          >
            <span>Vergleichslinie</span>
          </div>
          <TextField
            fullWidth
            autoFocus
            type="number"
            label="Gemessene Linienlänge (mm)"
            value={measuredText}
            onChange={(event) => setMeasuredText(event.target.value)}
            slotProps={{ htmlInput: { min: 12.5, max: 200, step: 0.5 } }}
            error={measuredText !== '' && !valid}
            helperText={
              measuredText !== '' && !valid
                ? 'Bitte eine Länge zwischen 12,5 und 200 mm eingeben.'
                : 'Die Linie ist als 50-mm-Referenz angelegt.'
            }
          />
          {valid && (
            <p className="dialog-copy">
              A4 wird mit {label(originalZoom(measured))} % dargestellt.
            </p>
          )}
          <p className="dialog-copy">
            Die Kalibrierung wird für diesen Browser gespeichert. Nach einem Monitorwechsel oder
            einer Änderung des Browserzooms bitte erneut kalibrieren.
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCalibrating(false)}>Abbrechen</Button>
          <Button variant="contained" disabled={!valid} onClick={applyCalibration}>
            A4 1:1 anzeigen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
