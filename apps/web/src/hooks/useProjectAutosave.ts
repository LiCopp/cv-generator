import { projectSchema, type Project } from '@cv/core';
import { useEffect, useState } from 'react';
import { localProjectStorage } from '../storage';

/** Debounced local persistence preserves invalid or unreadable saved projects. */
export function useProjectAutosave(project: Project, allowSave: boolean, loadError: boolean) {
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'invalid'>(
    loadError ? 'error' : 'saving',
  );

  useEffect(() => {
    if (!allowSave) return;
    const valid = projectSchema.safeParse(project);
    if (!valid.success) {
      setSaveState('invalid');
      return;
    }
    setSaveState('saving');
    const timer = setTimeout(() => {
      try {
        localProjectStorage.save(valid.data);
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [project, allowSave]);

  return saveState;
}
