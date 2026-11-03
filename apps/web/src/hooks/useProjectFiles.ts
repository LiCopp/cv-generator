import { MAX_IMPORT_BYTES, parseProject, projectSchema, type Project } from '@cv/core';
import type { RefObject } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { printDocument } from '../print';
import { downloadProject } from '../storage';

/** File import/export shares the form validation and completed preview boundary. */
export function useProjectFiles(
  methods: UseFormReturn<Project>,
  project: Project,
  panelRef: RefObject<HTMLElement | null>,
  notify: (message: string, error?: boolean) => void,
  onImported: () => void,
) {
  async function importFile(file: File) {
    try {
      if (file.size > MAX_IMPORT_BYTES)
        throw new Error('Die Datei ist zu gross. Erlaubt sind maximal 6 MB.');
      const imported = parseProject(await file.text());
      methods.reset(imported);
      onImported();
      notify('Dein Lebenslauf wurde geöffnet.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Die Datei konnte nicht geöffnet werden.',
        true,
      );
    }
  }
  function calendarInputsValid() {
    const invalid = panelRef.current?.querySelector<HTMLInputElement>(
      'input[data-calendar-date]:invalid',
    );
    if (!invalid) return true;
    invalid.reportValidity();
    return false;
  }
  async function saveFile() {
    if (!(await methods.trigger()) || !calendarInputsValid()) {
      notify('Bitte prüfe deine Eingaben vor dem Speichern.', true);
      return;
    }
    downloadProject(projectSchema.parse(methods.getValues()));
    notify('Dein Projekt wurde als JSON gespeichert.');
  }
  async function print() {
    if (!(await methods.trigger()) || !calendarInputsValid()) {
      notify('Bitte prüfe deine Eingaben vor dem PDF-Export.', true);
      return;
    }
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      const wait = () =>
        document.querySelector('.cv-document')?.getAttribute('data-ready') === 'true'
          ? resolve()
          : requestAnimationFrame(wait);
      requestAnimationFrame(wait);
    });
    try {
      const document = window.document.querySelector<HTMLElement>('.cv-document');
      if (!document) throw new Error('Die Vorschau ist noch nicht bereit.');
      await printDocument(document, project.cv.title);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Der PDF-Export konnte nicht vorbereitet werden.',
        true,
      );
    }
  }

  return { importFile, saveFile, print };
}
