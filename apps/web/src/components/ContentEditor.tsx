import { useRef } from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import {
  Autocomplete,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  TextField,
  Tooltip,
} from '@mui/material';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import {
  makeEntry,
  makeLanguage,
  makeReference,
  makeSkill,
  skillLevels,
  type Project,
  type SectionId,
} from '@cv/core';
import { preparePhoto } from '../storage';
import StationDateField from './StationDateField';
import CalendarDateField from './CalendarDateField';
import DescriptionField from './DescriptionField';
import ProficiencyField from './ProficiencyField';

export type EditorSection = 'contact' | SectionId;
const descriptions: Record<EditorSection, { title: string; intro: string; tip: string }> = {
  contact: {
    title: 'Beginnen wir mit dir.',
    intro: 'Die wichtigsten Angaben für deinen nächsten Schritt.',
    tip: 'Du entscheidest, was du teilst. Geburtsdatum, Nationalität und ein Foto sind für einen guten Lebenslauf nicht nötig.',
  },
  summary: {
    title: 'Was macht dich aus?',
    intro: 'Ein paar persönliche Sätze, die Lust aufs Kennenlernen machen.',
    tip: 'Was interessiert dich? Was kannst du gut? Und wohin möchtest du? Drei bis vier Sätze reichen oft schon.',
  },
  education: {
    title: 'Dein Wissen. Dein Weg.',
    intro: 'Schule, Lehre oder Studium — hier ist Platz dafür.',
    tip: 'Beginne mit deiner aktuellen oder letzten Ausbildung. Auch ein voraussichtlicher Abschluss gehört hierhin.',
  },
  experience: {
    title: 'Was du schon mitbringst.',
    intro: 'Jede Erfahrung zählt. Auch die ersten kleinen Schritte.',
    tip: 'Schnupperlehren, Praktika, Ferienjobs und langjährige Berufserfahrung: Beschreibe kurz deine Aufgaben und was du gelernt hast.',
  },
  projects: {
    title: 'Ideen, die du anpackst.',
    intro: 'Eigene Projekte und Engagement machen dich greifbar.',
    tip: 'Ein Schulprojekt, ein eigenes kleines Produkt oder ehrenamtliche Mitarbeit zeigen, was dich bewegt.',
  },
  skills: {
    title: 'Das kannst du.',
    intro: 'Zeig deine Stärken — konkret und ehrlich.',
    tip: 'Nenne Programme, Werkzeuge oder fachliche Kenntnisse. Du kannst einen Kenntnisstand angeben und optional deine eigene Einschätzung als Progressbar zeigen.',
  },
  languages: {
    title: 'Verbindungen schaffen.',
    intro: 'Welche Sprachen sprichst und verstehst du?',
    tip: 'Du kannst ein Sprachniveau wie B1 oder B2 angeben, oder deine Kenntnisse in eigenen Worten beschreiben.',
  },
  interests: {
    title: 'Mehr als ein Lebenslauf.',
    intro: 'Was begeistert dich ausserhalb von Schule und Beruf?',
    tip: 'Zwei bis vier ausgewählte Interessen geben deinem Lebenslauf Persönlichkeit. Dieser Abschnitt ist freiwillig.',
  },
  references: {
    title: 'Menschen, die dich kennen.',
    intro: 'Kontaktpersonen für Rückfragen zu deiner Arbeit oder Ausbildung.',
    tip: 'Name, Funktion und passende Kontaktdaten helfen bei Rückfragen. Leere Angaben werden im Lebenslauf weggelassen.',
  },
};

function ContactFields({ notify }: { notify: (message: string, error?: boolean) => void }) {
  const {
    register,
    control,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<Project>();
  const input = useRef<HTMLInputElement>(null);
  const assetId = watch('cv.contact.photoAssetId');
  const assets = watch('assets');
  async function upload(file: File) {
    const document = getValues('cv');
    try {
      const data = await preparePhoto(file);
      if (getValues('cv') !== document) return;
      const id = crypto.randomUUID();
      const nextAssets = {
        ...getValues('assets'),
        [id]: { mediaType: 'image/png' as const, data },
      };
      const previous = getValues('cv.contact.photoAssetId');
      if (previous && previous !== getValues('layout.appearance.headerImageAssetId'))
        delete nextAssets[previous];
      if (Object.keys(nextAssets).length > 4) throw new Error('Maximal vier Bilder sind erlaubt.');
      setValue('assets', nextAssets, { shouldDirty: true });
      setValue('cv.contact.photoAssetId', id, { shouldDirty: true });
      setValue('layout.appearance.showPhoto', true, { shouldDirty: true });
      notify('Dein Foto wurde hinzugefügt.');
    } catch (error) {
      if (getValues('cv') === document)
        notify(
          error instanceof Error ? error.message : 'Das Foto konnte nicht geladen werden.',
          true,
        );
    }
  }
  return (
    <>
      <div className="photo-field">
        <div className="photo-avatar">
          {assetId && assets[assetId] ? (
            <img src={assets[assetId].data} alt="Dein Profilfoto" />
          ) : (
            <ImagePlus size={23} strokeWidth={1.4} />
          )}
        </div>
        <div>
          <strong>Ein Gesicht zu deiner Geschichte</strong>
          <p>Profilfoto · freiwillig</p>
          <button className="text-link" onClick={() => input.current?.click()} type="button">
            {assetId ? 'Foto ändern' : 'Foto hinzufügen'} <span>↗</span>
          </button>
        </div>
        {assetId && (
          <IconButton
            aria-label="Foto entfernen"
            size="small"
            onClick={() => {
              const nextAssets = { ...getValues('assets') };
              if (assetId !== getValues('layout.appearance.headerImageAssetId'))
                delete nextAssets[assetId];
              setValue('cv.contact.photoAssetId', null, { shouldDirty: true });
              setValue('assets', nextAssets, { shouldDirty: true });
            }}
          >
            <X size={17} />
          </IconButton>
        )}
        <input
          hidden
          ref={input}
          aria-label="Profilfoto hochladen"
          type="file"
          accept="image/png,image/jpeg"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = '';
          }}
        />
      </div>
      <div className="form-divider">
        <span>PERSÖNLICHE ANGABEN</span>
      </div>
      <div className="field-row">
        <TextField label="Vorname" {...register('cv.contact.firstName')} />
        <TextField label="Nachname" {...register('cv.contact.lastName')} />
      </div>
      <TextField
        label="Berufsbezeichnung oder Bewerbungsziel"
        {...register('cv.contact.headline')}
        helperText="Zum Beispiel: Bewerbung um eine Lehrstelle als …"
        multiline
        maxRows={3}
      />
      <Controller
        control={control}
        name="cv.contact.birthDate"
        render={({ field, fieldState }) => (
          <CalendarDateField
            label="Geburtsdatum (optional)"
            value={field.value}
            name={field.name}
            inputRef={field.ref}
            onBlur={field.onBlur}
            onChange={field.onChange}
            error={!!fieldState.error}
            helperText={
              fieldState.error
                ? 'Bitte gib ein gültiges Geburtsdatum ein.'
                : 'Freiwillige Angabe. Leer lassen, um sie wegzulassen.'
            }
          />
        )}
      />
      <TextField
        label="Zivilstand (optional)"
        {...register('cv.contact.maritalStatus')}
        helperText="Freiwillige Angabe. Leer lassen, um sie wegzulassen."
      />
      <div className="form-divider">
        <span>SO ERREICHT MAN DICH</span>
      </div>
      <TextField
        label="E-Mail-Adresse"
        type="email"
        {...register('cv.contact.email')}
        error={!!errors.cv?.contact?.email}
        helperText={errors.cv?.contact?.email?.message}
      />
      <TextField label="Telefon" type="tel" {...register('cv.contact.phone')} />
      <TextField label="Strasse und Hausnummer" {...register('cv.contact.address')} />
      <TextField label="PLZ und Ort" {...register('cv.contact.city')} />
      <TextField
        label="Website oder Portfolio (optional)"
        {...register('cv.contact.website')}
        placeholder="mein-portfolio.ch"
      />
      <Controller
        control={control}
        name="cv.title"
        render={({ field }) => (
          <TextField
            label="Name dieses Lebenslaufs"
            {...field}
            helperText="Nur für dich — erscheint nicht im Lebenslauf."
          />
        )}
      />
    </>
  );
}

function EntryFields({ section }: { section: 'experience' | 'education' | 'projects' }) {
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext<Project>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: `cv.${section}`,
    keyName: 'formKey',
  });
  return (
    <>
      {fields.map((item, index) => (
        <div className="entry-card" key={item.formKey}>
          <div className="entry-card-top">
            <span>Eintrag {String(index + 1).padStart(2, '0')}</span>
            <div className="entry-actions">
              <Tooltip title="Nach oben">
                <span>
                  <IconButton
                    disabled={index === 0}
                    aria-label={`Eintrag ${index + 1} nach oben`}
                    onClick={() => move(index, index - 1)}
                    size="small"
                  >
                    <ArrowUp size={15} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Nach unten">
                <span>
                  <IconButton
                    disabled={index === fields.length - 1}
                    aria-label={`Eintrag ${index + 1} nach unten`}
                    onClick={() => move(index, index + 1)}
                    size="small"
                  >
                    <ArrowDown size={15} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Eintrag löschen">
                <IconButton
                  aria-label={`Eintrag ${index + 1} löschen`}
                  onClick={() => remove(index)}
                  size="small"
                >
                  <Trash2 size={15} />
                </IconButton>
              </Tooltip>
            </div>
          </div>
          <TextField
            label={
              section === 'education'
                ? 'Abschluss oder Ausbildung'
                : section === 'projects'
                  ? 'Projekt oder Tätigkeit'
                  : 'Position oder Tätigkeit'
            }
            {...register(`cv.${section}.${index}.title`)}
          />
          <TextField
            label={
              section === 'education' ? 'Schule oder Institution' : 'Unternehmen oder Organisation'
            }
            {...register(`cv.${section}.${index}.organization`)}
          />
          <TextField label="Ort (optional)" {...register(`cv.${section}.${index}.location`)} />
          <div className="field-row">
            <StationDateField section={section} index={index} endpoint="start" />
            <StationDateField
              section={section}
              index={index}
              endpoint="end"
              disabled={watch(`cv.${section}.${index}.current`)}
            />
          </div>
          <Controller
            control={control}
            name={`cv.${section}.${index}.current`}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                }
                label="Bis heute / noch laufend"
              />
            )}
          />
          {errors.cv?.[section]?.[index]?.end && (
            <p className="field-error" role="alert">
              Das Ende muss nach dem Beginn liegen.
            </p>
          )}
          <DescriptionField section={section} index={index} />
        </div>
      ))}
      {!fields.length && (
        <div className="empty-state">
          <span>Ein neuer Abschnitt beginnt.</span>
          <p>Füge deinen ersten Eintrag hinzu.</p>
        </div>
      )}
      <Button
        className="add-entry"
        fullWidth
        variant="outlined"
        startIcon={<Plus size={16} />}
        onClick={() => append(makeEntry())}
      >
        Eintrag hinzufügen
      </Button>
    </>
  );
}
function ReferenceFields() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<Project>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'cv.references',
    keyName: 'formKey',
  });
  return (
    <>
      {fields.map((item, index) => (
        <div className="entry-card" key={item.formKey}>
          <div className="entry-card-top">
            <span>Referenzperson {index + 1}</span>
            <div className="entry-actions">
              <IconButton
                size="small"
                aria-label={`Referenzperson ${index + 1} nach oben`}
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              >
                <ArrowUp size={15} />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Referenzperson ${index + 1} nach unten`}
                disabled={index === fields.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <ArrowDown size={15} />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Referenzperson ${index + 1} löschen`}
                onClick={() => remove(index)}
              >
                <Trash2 size={15} />
              </IconButton>
            </div>
          </div>
          <TextField label="Name der Referenzperson" {...register(`cv.references.${index}.name`)} />
          <TextField label="Funktion (optional)" {...register(`cv.references.${index}.role`)} />
          <TextField
            label="Organisation (optional)"
            {...register(`cv.references.${index}.organization`)}
          />
          <TextField
            label="E-Mail der Referenzperson"
            type="email"
            {...register(`cv.references.${index}.email`)}
            error={!!errors.cv?.references?.[index]?.email}
            helperText={errors.cv?.references?.[index]?.email?.message}
          />
          <TextField
            label="Telefon der Referenzperson"
            type="tel"
            {...register(`cv.references.${index}.phone`)}
          />
          <TextField
            label="Strasse und Hausnummer (optional)"
            {...register(`cv.references.${index}.address`)}
          />
          <TextField label="PLZ und Ort (optional)" {...register(`cv.references.${index}.city`)} />
        </div>
      ))}
      {!fields.length && (
        <div className="empty-state">
          <span>Noch keine Referenzpersonen.</span>
          <p>Füge eine Kontaktperson hinzu.</p>
        </div>
      )}
      <Button
        className="add-entry"
        fullWidth
        variant="outlined"
        startIcon={<Plus size={16} />}
        onClick={() => append(makeReference())}
      >
        Referenzperson hinzufügen
      </Button>
    </>
  );
}
function SkillFields({ section }: { section: 'skills' | 'languages' | 'interests' }) {
  const { control, register, getValues, setValue } = useFormContext<Project>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: `cv.${section}`,
    keyName: 'formKey',
  });
  return (
    <>
      {fields.map((item, index) => (
        <div className="entry-card" key={item.formKey}>
          <div className="entry-card-top">
            <span>Eintrag {index + 1}</span>
            <div className="entry-actions">
              <IconButton
                disabled={index === 0}
                aria-label={`Eintrag ${index + 1} nach oben`}
                onClick={() => move(index, index - 1)}
                size="small"
              >
                <ArrowUp size={15} />
              </IconButton>
              <IconButton
                disabled={index === fields.length - 1}
                aria-label={`Eintrag ${index + 1} nach unten`}
                onClick={() => move(index, index + 1)}
                size="small"
              >
                <ArrowDown size={15} />
              </IconButton>
              <IconButton
                aria-label={`Eintrag ${index + 1} löschen`}
                onClick={() => {
                  remove(index);
                  if (section !== 'interests') {
                    const path = `layout.proficiencyPercentages.${section}` as const;
                    const percentages = { ...getValues(path) };
                    delete percentages[item.id];
                    setValue(path, percentages, { shouldDirty: true });
                  }
                }}
                size="small"
              >
                <Trash2 size={15} />
              </IconButton>
            </div>
          </div>
          <TextField
            label={
              section === 'languages'
                ? 'Sprache'
                : section === 'interests'
                  ? 'Interesse'
                  : 'Kenntnis'
            }
            {...register(`cv.${section}.${index}.name`)}
          />
          {section === 'skills' ? (
            <>
              <Controller
                control={control}
                name={`cv.skills.${index}.level`}
                render={({ field }) => (
                  <Autocomplete
                    freeSolo
                    options={[...skillLevels]}
                    value={field.value || null}
                    inputValue={field.value}
                    onChange={(_, value) => field.onChange(value ?? '')}
                    onInputChange={(_, value) => field.onChange(value)}
                    onBlur={field.onBlur}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        inputRef={field.ref}
                        label="Kenntnisstand (optional)"
                        helperText="Stufe auswählen oder eigene Bezeichnung eingeben. Leer lassen ist möglich."
                      />
                    )}
                  />
                )}
              />
              <TextField
                label="Beschreibung der Kenntnis (optional)"
                multiline
                minRows={3}
                {...register(`cv.skills.${index}.description`)}
                helperText="Praktische Erfahrungen oder Beispiele. Die Anzeige wird im Design eingestellt."
              />
              <TextField
                label="Kategorie (optional)"
                {...register(`cv.skills.${index}.category`)}
                helperText="Freie Bezeichnung, z. B. Methoden. Die Gruppierung lässt sich im Design einschalten."
              />
            </>
          ) : (
            section === 'languages' && (
              <TextField
                label="Sprachniveau (optional)"
                {...register(`cv.languages.${index}.level`)}
                placeholder="z. B. Muttersprache, B2"
              />
            )
          )}
          {section !== 'interests' && (
            <ProficiencyField section={section} index={index} itemId={item.id} />
          )}
        </div>
      ))}
      {!fields.length && (
        <div className="empty-state">
          <span>Hier ist Platz für dich.</span>
          <p>Füge deinen ersten Eintrag hinzu.</p>
        </div>
      )}
      <Button
        className="add-entry"
        fullWidth
        variant="outlined"
        startIcon={<Plus size={16} />}
        onClick={() =>
          append(
            section === 'skills'
              ? makeSkill()
              : section === 'languages'
                ? makeLanguage()
                : { id: crypto.randomUUID(), name: '', level: '' },
          )
        }
      >
        Eintrag hinzufügen
      </Button>
    </>
  );
}
export default function ContentEditor({
  section,
  notify,
}: {
  section: EditorSection;
  notify: (message: string, error?: boolean) => void;
}) {
  const { register } = useFormContext<Project>();
  const copy = descriptions[section];
  return (
    <div className="content-editor" key={section}>
      <p className="eyebrow">DEIN LEBENSLAUF</p>
      <h1>{copy.title}</h1>
      <p className="editor-intro">{copy.intro}</p>
      <div className="editor-fields">
        {section === 'contact' ? (
          <ContactFields notify={notify} />
        ) : section === 'summary' ? (
          <TextField
            label="Über mich"
            multiline
            minRows={9}
            {...register('cv.summary')}
            helperText="Schreibe so, wie du dich auch persönlich vorstellen würdest."
          />
        ) : section === 'references' ? (
          <ReferenceFields />
        ) : section === 'experience' || section === 'education' || section === 'projects' ? (
          <EntryFields section={section} />
        ) : (
          <SkillFields section={section} />
        )}
      </div>
      <div className="editor-tip">
        <span className="tip-spark">✧</span>
        <div>
          <strong>Ein kleiner Tipp</strong>
          <p>{copy.tip}</p>
        </div>
      </div>
    </div>
  );
}
