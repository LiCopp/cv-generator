import {
  canMirrorHeaderEdge,
  headerEdgeLabels,
  headerEdgePaths,
  headerEdges,
  type Project,
} from '@cv/core';
import {
  Alert,
  Button,
  FormControlLabel,
  MenuItem,
  Slider,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { preparePhoto } from '../../storage';
const colors = ['#244d43', '#254766', '#61444f', '#78573c', '#393d45', '#5b526e'];

export default function HeaderDesignControls() {
  const { control, watch, setValue, getValues } = useFormContext<Project>();
  const appearance = watch('layout.appearance');
  const assets = watch('assets');
  const imageInput = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState('');
  const [loadingImage, setLoadingImage] = useState(false);
  async function uploadHeader(file: File) {
    const document = getValues('cv');
    setImageError('');
    setLoadingImage(true);
    try {
      const data = await preparePhoto(file, 1600);
      if (getValues('cv') !== document) return;
      const id = crypto.randomUUID();
      const nextAssets = {
        ...getValues('assets'),
        [id]: { mediaType: 'image/png' as const, data },
      };
      const previous = getValues('layout.appearance.headerImageAssetId');
      if (previous && previous !== getValues('cv.contact.photoAssetId'))
        delete nextAssets[previous];
      if (Object.keys(nextAssets).length > 4) throw new Error('Maximal vier Bilder sind erlaubt.');
      setValue('assets', nextAssets, { shouldDirty: true });
      setValue('layout.appearance.headerImageAssetId', id, { shouldDirty: true });
    } catch (error) {
      if (getValues('cv') === document)
        setImageError(
          error instanceof Error ? error.message : 'Das Bild konnte nicht geladen werden.',
        );
    } finally {
      setLoadingImage(false);
    }
  }

  return (
    <>
      <Controller
        control={control}
        name="layout.appearance.headerNameLayout"
        render={({ field }) => (
          <TextField select label="Namensdarstellung im Header" {...field}>
            <MenuItem value="stacked">Vorname und Nachname untereinander</MenuItem>
            <MenuItem value="inline">Vorname und Nachname nebeneinander</MenuItem>
          </TextField>
        )}
      />
      <p className="group-description">
        Nebeneinander nutzt eine gemeinsame Zeile. Sehr lange Namen umbrechen bei Bedarf, damit Text
        und Profilfoto vollständig sichtbar bleiben.
      </p>
      <div className="slider-label">
        <label id="header-shift-label">Header nach oben verschieben</label>
        <span>{appearance.headerShiftUpMm} mm</span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.headerShiftUpMm"
        render={({ field }) => (
          <Slider
            aria-labelledby="header-shift-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={0}
            max={20}
            step={0.5}
            size="small"
          />
        )}
      />
      <p className="group-description">
        Verschiebt den Header auf Seite 1 um bis zu 20 mm nach oben. Der gewonnene Platz wird für
        Inhalt genutzt; der Abstand unter dem Header bleibt separat einstellbar.
      </p>
      <div className="slider-label">
        <label id="header-text-offset-label">Name im Header vertikal verschieben</label>
        <span>
          {appearance.headerTextOffsetMm > 0 ? '+' : ''}
          {appearance.headerTextOffsetMm} mm
        </span>
      </div>
      <Controller
        control={control}
        name="layout.appearance.headerTextOffsetMm"
        render={({ field }) => (
          <Slider
            aria-labelledby="header-text-offset-label"
            value={field.value}
            onChange={(_, value) => field.onChange(value)}
            min={-15}
            max={15}
            step={0.5}
            size="small"
          />
        )}
      />
      <p className="group-description">
        Verschiebt nur den Namensblock mit Beschriftung und Untertitel: negative Werte nach oben,
        positive nach unten; 0 mm ist die bisherige Position. Die Bewegung endet am oberen
        Seitenrand bzw. vor dem Header-Abschluss. Headergrösse, Hintergrundbild und Profilfoto
        bleiben dabei unverändert.
      </p>
      <Controller
        control={control}
        name="layout.appearance.headerTextColor"
        render={({ field }) => (
          <TextField
            type="color"
            label="Schriftfarbe im Header"
            {...field}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}
      />
      <label className="control-label">Akzentfarbe</label>
      <div className="color-swatches">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            style={{ backgroundColor: color }}
            className={color === appearance.accent ? 'selected' : ''}
            aria-label={`Farbe ${color}`}
            aria-pressed={color === appearance.accent}
            onClick={() => setValue('layout.appearance.accent', color, { shouldDirty: true })}
          >
            {color === appearance.accent && <span>✓</span>}
          </button>
        ))}
      </div>
      <Controller
        control={control}
        name="layout.appearance.accent"
        render={({ field }) => (
          <TextField
            type="color"
            label="Eigene Akzentfarbe"
            {...field}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}
      />
      <p className="group-description">
        {appearance.headerImageAssetId
          ? 'Für Überschriften und Stationspunkte. Bei gesetztem Headerbild wird im Header kein Farbuntergrund verwendet.'
          : 'Für Header, Überschriften und Stationspunkte. Wähle eine Vorgabe oder deine eigene Farbe.'}
      </p>
      <Controller
        control={control}
        name="layout.appearance.headerStyle"
        render={({ field }) => (
          <TextField
            select
            label="Kopfbereich"
            disabled={!!appearance.headerImageAssetId}
            {...field}
          >
            <MenuItem value="gradient">Sanfter Farbverlauf</MenuItem>
            <MenuItem value="solid">Einfarbig</MenuItem>
          </TextField>
        )}
      />
      <label className="control-label">Hintergrundbild im Header (optional)</label>
      {Object.keys(assets).length > 0 && (
        <TextField
          select
          label="Gespeichertes Headerbild"
          value={appearance.headerImageAssetId ?? ''}
          onChange={(event) =>
            setValue('layout.appearance.headerImageAssetId', event.target.value || null, {
              shouldDirty: true,
            })
          }
        >
          <MenuItem value="">Kein Hintergrundbild</MenuItem>
          {Object.entries(assets).map(([id, asset], index) => (
            <MenuItem value={id} key={id}>
              <img
                src={asset.data}
                alt=""
                width={32}
                height={24}
                style={{ objectFit: 'cover', marginRight: 8 }}
              />
              Gespeichertes Bild {index + 1}
            </MenuItem>
          ))}
        </TextField>
      )}
      {appearance.headerImageAssetId && (
        <img
          className="header-image-preview"
          src={assets[appearance.headerImageAssetId]?.data}
          alt="Gewähltes Headerbild"
        />
      )}
      <Button
        variant="outlined"
        disabled={loadingImage}
        onClick={() => imageInput.current?.click()}
      >
        {loadingImage
          ? 'Bild wird geladen …'
          : appearance.headerImageAssetId
            ? 'Headerbild ändern'
            : 'Headerbild hinzufügen'}
      </Button>
      <input
        hidden
        ref={imageInput}
        aria-label="Headerbild hochladen"
        type="file"
        accept="image/png,image/jpeg"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadHeader(file);
          event.target.value = '';
        }}
      />
      {imageError && <Alert severity="error">{imageError}</Alert>}
      {appearance.headerImageAssetId && (
        <>
          <Button
            size="small"
            onClick={() => {
              const nextAssets = { ...getValues('assets') };
              if (appearance.headerImageAssetId !== getValues('cv.contact.photoAssetId'))
                delete nextAssets[appearance.headerImageAssetId!];
              setValue('layout.appearance.headerImageAssetId', null, { shouldDirty: true });
              setValue('assets', nextAssets, { shouldDirty: true });
            }}
          >
            Headerbild entfernen
          </Button>
          <div className="slider-label">
            <label id="header-image-transparency-label">Bildtransparenz</label>
            <span>{appearance.headerImageTransparencyPercent} %</span>
          </div>
          <Controller
            control={control}
            name="layout.appearance.headerImageTransparencyPercent"
            render={({ field }) => (
              <Slider
                aria-labelledby="header-image-transparency-label"
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
            0 %: Bild vollständig sichtbar. 100 %: Bild unsichtbar. Transparente Bereiche lassen den
            weissen Seitenhintergrund durchscheinen.
          </p>
          <div className="slider-label">
            <label id="header-image-dim-label">Bild abdunkeln</label>
            <span>{appearance.headerImageDimPercent} %</span>
          </div>
          <Controller
            control={control}
            name="layout.appearance.headerImageDimPercent"
            render={({ field }) => (
              <Slider
                aria-labelledby="header-image-dim-label"
                value={field.value}
                onChange={(_, value) => field.onChange(value)}
                min={0}
                max={80}
                step={5}
                size="small"
              />
            )}
          />
        </>
      )}
      <p className="group-description">
        PNG oder JPEG, maximal 4 MB. Das Bild füllt den Header aus und wird mittig zugeschnitten.
      </p>
      <label className="control-label" id="header-edge-label">
        Header-Abschluss
      </label>
      <Controller
        control={control}
        name="layout.appearance.headerEdge"
        render={({ field }) => (
          <ToggleButtonGroup
            className="header-edge-picker"
            exclusive
            aria-labelledby="header-edge-label"
            value={field.value}
            onChange={(_, value) => value && field.onChange(value)}
          >
            {headerEdges.map((edge) => (
              <ToggleButton value={edge} key={edge}>
                <svg
                  viewBox="0 0 1000 350"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  focusable="false"
                >
                  <rect width="1000" height="350" fill="currentColor" />
                  {edge !== 'straight' && (
                    <svg
                      y="200"
                      width="1000"
                      height="150"
                      viewBox="0 0 1000 100"
                      preserveAspectRatio="none"
                    >
                      <path
                        d={headerEdgePaths[edge]}
                        transform={
                          appearance.headerEdgeMirrored && canMirrorHeaderEdge(edge)
                            ? 'translate(1000 0) scale(-1 1)'
                            : undefined
                        }
                        fill="white"
                      />
                    </svg>
                  )}
                </svg>
                <span>{headerEdgeLabels[edge]}</span>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
      />
      <Controller
        control={control}
        name="layout.appearance.headerEdgeMirrored"
        render={({ field }) => (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={field.value}
                disabled={!canMirrorHeaderEdge(appearance.headerEdge)}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            }
            label="Header-Abschluss horizontal spiegeln"
          />
        )}
      />
      <p className="group-description">
        Für Welle und Schräge. Gerade, Bogen und Spitze sind bereits symmetrisch.
      </p>
      {appearance.headerEdge !== 'straight' && (
        <>
          <div className="slider-label">
            <label id="header-edge-depth-label">Höhe der Form</label>
            <span>{appearance.headerEdgeDepthMm} mm</span>
          </div>
          <Controller
            control={control}
            name="layout.appearance.headerEdgeDepthMm"
            render={({ field }) => (
              <Slider
                aria-labelledby="header-edge-depth-label"
                value={field.value}
                onChange={(_, value) => field.onChange(value)}
                min={4}
                max={16}
                step={1}
                size="small"
              />
            )}
          />
        </>
      )}
    </>
  );
}
