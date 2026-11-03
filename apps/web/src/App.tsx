import { createProject, projectSchema, resetProjectSettings, type Project } from '@cv/core';
import { CvPreview } from '@cv/renderer';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Snackbar,
  Tooltip,
} from '@mui/material';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Download,
  Eye,
  FilePlus2,
  FileText,
  FolderOpen,
  GraduationCap,
  Heart,
  Languages,
  Leaf,
  LockKeyhole,
  Palette,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import ContentEditor, { type EditorSection } from './components/ContentEditor';
import DesignEditor from './components/DesignEditor';
import EditorHelpDialog from './components/EditorHelpDialog';
import NewProjectDialog from './components/NewProjectDialog';
import PreviewZoomControls from './components/PreviewZoomControls';
import ProjectResetDialog from './components/ProjectResetDialog';
import { usePreviewZoom } from './hooks/usePreviewZoom';
import { useProjectAutosave } from './hooks/useProjectAutosave';
import { useProjectFiles } from './hooks/useProjectFiles';
import { localProjectStorage } from './storage';

const navigation: { id: EditorSection; label: string; icon: typeof UserRound }[] = [
  { id: 'contact', label: 'Persönliches', icon: UserRound },
  { id: 'summary', label: 'Über mich', icon: FileText },
  { id: 'education', label: 'Ausbildung', icon: GraduationCap },
  { id: 'experience', label: 'Erfahrung', icon: BriefcaseBusiness },
  { id: 'projects', label: 'Projekte & Engagement', icon: BookOpen },
  { id: 'skills', label: 'Kenntnisse', icon: Sparkles },
  { id: 'languages', label: 'Sprachen', icon: Languages },
  { id: 'interests', label: 'Interessen', icon: Heart },
  { id: 'references', label: 'Referenzen', icon: UserRound },
];
function initialProject() {
  try {
    return { project: localProjectStorage.load() ?? createProject('student'), error: false };
  } catch {
    return { project: createProject('student'), error: true };
  }
}
export default function App() {
  const [initial] = useState(initialProject);
  const methods = useForm<Project>({
    defaultValues: initial.project,
    resolver: zodResolver(projectSchema),
    mode: 'onChange',
  });
  const project = useWatch({ control: methods.control }) as Project;
  const [section, setSection] = useState<EditorSection>('contact');
  const [tab, setTab] = useState<'content' | 'design'>('content');
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(
    initial.error
      ? {
          message:
            'Das gespeicherte Projekt konnte nicht geladen werden. Es wurde ein Beispiel geöffnet. Deine gespeicherten Daten wurden nicht verändert.',
          error: true,
        }
      : null,
  );
  const [allowSave, setAllowSave] = useState(!initial.error);
  const saveState = useProjectAutosave(project, allowSave, initial.error);
  const { zoom, viewportRef, changePreviewZoom, fitPreview } = usePreviewZoom();
  const [pageCount, setPageCount] = useState(1);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [sampleMenu, setSampleMenu] = useState<HTMLElement | null>(null);
  const [pendingSample, setPendingSample] = useState<'student' | 'adult' | 'blank' | null>(null);
  const [help, setHelp] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const notify = (message: string, error = false) => setToast({ message, error });
  const { importFile, saveFile, print } = useProjectFiles(methods, project, panelRef, notify, () =>
    setAllowSave(true),
  );
  const validation = projectSchema.safeParse(project);
  const filled = navigation.filter((item) =>
    item.id === 'contact'
      ? !!(project.cv.contact.firstName && project.cv.contact.lastName && project.cv.contact.email)
      : !!project.cv[item.id].length,
  );
  const progress = Math.round((filled.length / navigation.length) * 100);
  const currentIndex = navigation.findIndex((item) => item.id === section);

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [section, tab]);

  function replaceSample() {
    if (!pendingSample) return;
    methods.reset(createProject(pendingSample));
    setAllowSave(true);
    setPendingSample(null);
    setSection('contact');
    setTab('content');
    notify('Dein neuer Lebenslauf ist bereit.');
  }
  function resetProject(resetData: boolean) {
    methods.reset(resetProjectSettings(methods.getValues(), resetData));
    setAllowSave(true);
    setConfirmReset(false);
    if (resetData) {
      setSection('contact');
      setTab('content');
      setMobilePreview(false);
    }
    notify(
      resetData
        ? 'Design und Lebenslaufdaten wurden zurückgesetzt.'
        : 'Das Design wurde auf Standardwerte zurückgesetzt.',
    );
  }

  return (
    <FormProvider {...methods}>
      <div className={`app-shell ${mobilePreview ? 'show-mobile-preview' : ''}`}>
        <header className="app-header">
          <a className="brand" href="./" aria-label="folio Startseite">
            <span className="brand-icon">
              <Leaf size={23} strokeWidth={1.7} />
            </span>
            <span>
              folio<span className="brand-dot">.</span>
            </span>
          </a>
          <div className="header-divider" />
          <div className="document-title">
            <span>{project.cv.title || 'Mein Lebenslauf'}</span>
            <span
              className={`save-status ${saveState === 'error' || saveState === 'invalid' ? 'save-error' : ''}`}
              role="status"
            >
              {saveState === 'saved' ? (
                <>
                  <CheckCheck size={13} /> Lokal gespeichert
                </>
              ) : saveState === 'saving' ? (
                'Wird gespeichert …'
              ) : saveState === 'invalid' ? (
                'Bitte Eingaben prüfen'
              ) : (
                'Bitte als Datei speichern'
              )}
            </span>
          </div>
          <div className="header-actions">
            <Tooltip title="Ein gespeichertes JSON-Projekt öffnen">
              <Button
                className="open-button"
                color="inherit"
                startIcon={<FolderOpen size={17} />}
                onClick={() => importRef.current?.click()}
              >
                Öffnen
              </Button>
            </Tooltip>
            <Tooltip title="Design und optional Lebenslaufdaten zurücksetzen">
              <Button
                className="reset-button"
                aria-label="Projekt zurücksetzen"
                color="inherit"
                startIcon={<RotateCcw size={17} />}
                onClick={() => setConfirmReset(true)}
              >
                <span className="reset-button-label">Zurücksetzen</span>
              </Button>
            </Tooltip>
            <Tooltip title="Lebenslauf und Design als bearbeitbare JSON-Datei herunterladen">
              <Button
                className="save-button"
                variant="outlined"
                startIcon={<Download size={16} />}
                onClick={() => void saveFile()}
              >
                Projekt speichern
              </Button>
            </Tooltip>
            <Tooltip title="Druckdialog öffnen und «Als PDF speichern» wählen">
              <Button
                variant="contained"
                startIcon={<ArrowDownToLine size={17} />}
                onClick={() => void print()}
                disabled={!validation.success}
              >
                PDF exportieren
              </Button>
            </Tooltip>
          </div>
          <input
            ref={importRef}
            hidden
            type="file"
            accept="application/json,.json"
            aria-label="Projektdatei öffnen"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = '';
            }}
          />
        </header>
        <div className="mobile-switch">
          <button
            className={!mobilePreview ? 'active' : ''}
            onClick={() => setMobilePreview(false)}
          >
            <FileText size={16} /> Bearbeiten
          </button>
          <button className={mobilePreview ? 'active' : ''} onClick={() => setMobilePreview(true)}>
            <Eye size={16} /> Vorschau
          </button>
        </div>
        <div className="workspace">
          <nav className="editor-nav" aria-label="Lebenslauf-Bereiche">
            <div className="nav-top">
              <span className="workspace-label">DEIN WORKSPACE</span>
              <Button
                className="cv-picker"
                fullWidth
                color="inherit"
                onClick={(e) => setSampleMenu(e.currentTarget)}
              >
                <span className="cv-picker-icon">
                  <FileText size={18} />
                </span>
                <span>
                  Mein Lebenslauf<small>Studio-Vorlage</small>
                </span>
                <ChevronDown size={15} />
              </Button>
            </div>
            <div className="nav-section-label">
              INHALT <span>{navigation.length} Abschnitte</span>
            </div>
            <div className="nav-items">
              {navigation.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`nav-item ${section === item.id && tab === 'content' ? 'active' : ''}`}
                  onClick={() => {
                    setSection(item.id);
                    setTab('content');
                  }}
                >
                  <item.icon size={17} strokeWidth={1.6} />
                  <span>{item.label}</span>
                  {filled.includes(item) && <Check size={13} className="nav-check" />}
                </button>
              ))}
            </div>
            <div className="nav-design">
              <button
                className={`nav-item ${tab === 'design' ? 'active' : ''}`}
                onClick={() => setTab('design')}
              >
                <Palette size={17} strokeWidth={1.6} />
                <span>Design & Layout</span>
                <ChevronRight size={15} />
              </button>
            </div>
            <div className="nav-bottom">
              <div className="privacy-card">
                <span className="privacy-icon">
                  <ShieldCheck size={20} strokeWidth={1.4} />
                </span>
                <strong>Deine Daten bleiben bei dir.</strong>
                <p>
                  Direkt in deinem Browser.
                  <br />
                  Ohne Konto. Ohne Cloud.
                </p>
                <span className="privacy-badge">
                  <span /> Privat & lokal
                </span>
              </div>
              <button className="help-link" onClick={() => setHelp(true)}>
                <CircleHelp size={15} /> Gut zu wissen <span>↗</span>
              </button>
              <div className="nav-footer">
                Mit Sorgfalt gestaltet. <Leaf size={12} />
              </div>
            </div>
          </nav>
          <section className="editor-panel" ref={panelRef} aria-label="Lebenslauf bearbeiten">
            <div className="editor-tabs" role="tablist" aria-label="Bearbeitungsmodus">
              <button
                role="tab"
                aria-selected={tab === 'content'}
                className={tab === 'content' ? 'active' : ''}
                onClick={() => setTab('content')}
              >
                <FileText size={15} /> Inhalt
              </button>
              <button
                role="tab"
                aria-selected={tab === 'design'}
                className={tab === 'design' ? 'active' : ''}
                onClick={() => setTab('design')}
              >
                <Palette size={15} /> Design
              </button>
            </div>
            {tab === 'content' ? (
              <ContentEditor section={section} notify={notify} />
            ) : (
              <DesignEditor />
            )}
            {tab === 'content' && (
              <div className="editor-bottom">
                <div className="editor-progress">
                  <div>
                    <span>Deine Geschichte wächst</span>
                    <span>
                      {filled.length}/{navigation.length}
                    </span>
                  </div>
                  <LinearProgress variant="determinate" value={progress} />
                </div>
                <div className="editor-navigation">
                  <Button
                    color="inherit"
                    disabled={currentIndex === 0}
                    startIcon={<ArrowLeft size={15} />}
                    onClick={() => setSection(navigation[currentIndex - 1].id)}
                  >
                    Zurück
                  </Button>
                  <Button
                    variant="contained"
                    endIcon={<ArrowRight size={15} />}
                    onClick={() =>
                      currentIndex < navigation.length - 1
                        ? setSection(navigation[currentIndex + 1].id)
                        : setTab('design')
                    }
                  >
                    {currentIndex < navigation.length - 1 ? 'Weiter' : 'Zum Design'}
                  </Button>
                </div>
              </div>
            )}
          </section>
          <section className="preview-panel" aria-label="Live-Vorschau">
            <div className="preview-heading">
              <div>
                <span className="live-dot" />
                <span>Deine Vorschau</span>
                <span className="live-badge">LIVE</span>
              </div>
              <Tooltip title="Die Vorschau verwendet dieselben Seiten wie der PDF-Druck.">
                <IconButton
                  aria-label="Informationen zur Vorschau"
                  size="small"
                  onClick={() => setHelp(true)}
                >
                  <CircleHelp size={16} />
                </IconButton>
              </Tooltip>
            </div>
            <div className="preview-toolbar">
              <span>
                <FileText size={14} /> A4 <span className="toolbar-separator">/</span>{' '}
                <span className="page-counter">
                  {pageCount} {pageCount === 1 ? 'Seite' : 'Seiten'}
                </span>
              </span>
              <PreviewZoomControls
                zoom={zoom}
                onZoomChange={changePreviewZoom}
                onFit={fitPreview}
              />
            </div>
            <div className="preview-viewport" ref={viewportRef}>
              <div className="preview-scale" style={{ zoom: zoom / 100 }}>
                <CvPreview project={project} onPageCount={setPageCount} />
              </div>
              <div className="preview-note">
                <LockKeyhole size={12} />
                <span>Nur du siehst deinen Lebenslauf.</span>
              </div>
            </div>
            <div className="preview-bottom">
              <span>
                <span className="small-spark">✧</span> Dein nächster Schritt beginnt hier.
              </span>
              <span>
                STUDIO <span className="tiny-dot">·</span> A4
              </span>
            </div>
          </section>
        </div>
        <ProjectResetDialog
          open={confirmReset}
          onClose={() => setConfirmReset(false)}
          onConfirm={resetProject}
        />
        <Menu anchorEl={sampleMenu} open={!!sampleMenu} onClose={() => setSampleMenu(null)}>
          <MenuItem
            onClick={() => {
              setPendingSample('blank');
              setSampleMenu(null);
            }}
          >
            <FilePlus2 size={16} /> Neuer, leerer Lebenslauf
          </MenuItem>
          <MenuItem
            onClick={() => {
              setPendingSample('student');
              setSampleMenu(null);
            }}
          >
            <GraduationCap size={16} /> Beispiel: Schule & Lehre
          </MenuItem>
          <MenuItem
            onClick={() => {
              setPendingSample('adult');
              setSampleMenu(null);
            }}
          >
            <BriefcaseBusiness size={16} /> Beispiel: Viel Berufserfahrung
          </MenuItem>
        </Menu>
        <NewProjectDialog
          open={!!pendingSample}
          onClose={() => setPendingSample(null)}
          onSave={saveFile}
          onConfirm={replaceSample}
        />
        <EditorHelpDialog open={help} onClose={() => setHelp(false)} />
        <Snackbar
          open={!!toast}
          autoHideDuration={6500}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity={toast?.error ? 'error' : 'success'}
            variant="filled"
            onClose={() => setToast(null)}
          >
            {toast?.message}
          </Alert>
        </Snackbar>
      </div>
    </FormProvider>
  );
}
