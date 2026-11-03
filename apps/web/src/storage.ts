import { currentRendererVersion, parseProject, type Project } from '@cv/core';

const STORAGE_KEY = 'folio.project.v1';
/** Local persistence uses the same import boundary and migrations as project files. */
export const localProjectStorage = {
  load(): Project | null {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseProject(saved) : null;
  },
  save(project: Project) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  },
};
/** Export content, effective layout, template and embedded assets as one editable JSON file. */
export function downloadProject(project: Project) {
  const exported = {
    ...project,
    manifest: { ...project.manifest, rendererVersion: currentRendererVersion },
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${project.cv.title.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 70) || 'lebenslauf'}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Local-only MVP: decode and re-encode raster images, discarding metadata. */
export async function preparePhoto(file: File, maxDimension = 800): Promise<string> {
  if (file.size > 4 * 1024 * 1024) throw new Error('Bitte wähle ein Bild mit maximal 4 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!png && !jpeg) throw new Error('Bitte wähle ein PNG- oder JPEG-Bild.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width > 8000 || bitmap.height > 8000)
      throw new Error('Das Bild darf maximal 8000 × 8000 Pixel haben.');
    const canvas = document.createElement('canvas');
    const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Das Bild konnte nicht verarbeitet werden.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/png');
    if (data.length > 2_800_000)
      throw new Error('Das Bild ist zu detailreich. Bitte wähle ein kleineres Bild.');
    return data;
  } finally {
    bitmap.close();
  }
}
