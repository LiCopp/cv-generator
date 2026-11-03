import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** PDF metadata changes on every export; compare rendered pixels and semantic text instead. */
async function inspectPdf(path) {
  const task = getDocument({ data: new Uint8Array(await readFile(path)), useSystemFonts: false });
  try {
    const document = await task.promise;
    const pages = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      const drawing = document.canvasFactory.create(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      try {
        await page.render({ canvas: drawing.canvas, canvasContext: drawing.context, viewport })
          .promise;
        const pixels = drawing.context.getImageData(
          0,
          0,
          drawing.canvas.width,
          drawing.canvas.height,
        ).data;
        pages.push({
          view: page.view,
          text: content.items
            .filter((item) => 'str' in item)
            .map((item) => ({
              text: item.str,
              transform: item.transform,
              width: item.width,
              height: item.height,
              direction: item.dir,
              endOfLine: item.hasEOL,
            })),
          pixelsSha256: createHash('sha256').update(pixels).digest('hex'),
        });
      } finally {
        document.canvasFactory.destroy(drawing);
        page.cleanup();
      }
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

async function pdfFiles(directory, root = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await pdfFiles(path, root)));
    else if (entry.name.endsWith('.pdf')) files.push(relative(root, path).replaceAll('\\', '/'));
  }
  return files.sort();
}

const [operation, directory, manifestPath] = process.argv.slice(2);
if (!['capture', 'compare'].includes(operation) || !directory || !manifestPath) {
  throw new Error(
    'Usage: node scripts/pdf-output-snapshot.mjs <capture|compare> <PDF directory> <manifest.json>',
  );
}
const files = await pdfFiles(directory);
if (!files.length) throw new Error('No PDFs found; refusing an empty comparison.');
if (operation === 'capture') {
  const snapshots = {};
  for (const file of files) snapshots[file] = await inspectPdf(join(directory, file));
  await writeFile(manifestPath, JSON.stringify(snapshots));
  console.log(
    `Captured ${files.length} PDFs (page geometry, ordered text, positions and rendered pixels).`,
  );
} else {
  const expected = JSON.parse(await readFile(manifestPath, 'utf8'));
  const differences = [];
  for (const file of new Set([...Object.keys(expected), ...files])) {
    if (!(file in expected) || !files.includes(file)) {
      differences.push(`${file}: missing or new PDF`);
      continue;
    }
    const actual = await inspectPdf(join(directory, file));
    if (JSON.stringify(actual) !== JSON.stringify(expected[file])) differences.push(file);
  }
  if (differences.length) {
    console.error('PDF differences:', differences);
    process.exitCode = 1;
  } else
    console.log(
      `All ${files.length} PDFs match exactly in page geometry, ordered text, positions and rendered pixels.`,
    );
}
