# Code quality and behavior-preserving maintenance

Run the repository checks from the project root:

```sh
npm run format:check
npm run lint
npm run build
npm test
npm run test:browser
```

Use `npm run format` to apply the shared Prettier configuration to authored TypeScript, TSX, JavaScript tooling, JSON and CSS. `.gitattributes` keeps text checkouts in LF on Windows and Unix, matching Prettier. npm owns `package-lock.json`; it is intentionally excluded from formatting. ESLint uses the recommended JavaScript and TypeScript rules. Formatting remains a separate check, without an ESLint/Prettier bridge or additional React/CSS plugins. Production dependencies are unaffected by these development tools. Personal files and generated output are excluded from both tools.

## Pagination and layout invariants

- `packages/renderer/src/flow-blocks.tsx` builds semantic flow blocks in region order. Stable block IDs connect the measurement DOM, pagination results and visible document in `CvPreview.tsx`. Keep wrapper structure, spacing ownership and block order consistent between those paths.
- The hidden measurement portal is outside preview zoom. `useMeasuredPagination.tsx` uses font readiness and a physical CSS-mm probe to determine measurements; converting to rounded millimetres before pagination would change boundary decisions. The first page subtracts the complete designed header, its content gap, the bottom margin and optional footer space. Continuation pages subtract the optional running header, both margins and footer space.
- Summary paragraphs are measured in full after fonts load. DOM ranges identify their natural lines; groups of at most six lines become bounded pagination units, with paragraph spacing only on the final fragment. Visible fragments are grouped into a semantic paragraph per page. Preserve the original text and hanging trailing whitespace, and compare preview and PDF geometry when changing this path.
- `pagination.ts` looks ahead through `keepWithNext` chains but commits individual blocks. This keeps headings and station starts together while allowing a long description to continue. Its existing half-pixel tolerance prevents spurious pages from fractional DOM metrics. Oversized blocks are emitted once rather than retried indefinitely; text is divided into bounded chunks before measurement.
- By default, contact and summary finish before either body region starts. The taller introductory region sets their shared baseline. With `compactWithoutSummary` enabled and no visible summary, each region instead contains its entire flow: the main column starts below the header, while contact and subsequent sidebar sections paginate together. The local contact/body transition is measured, stays with its following heading/entry and is omitted at a page start. Subsequent main/sidebar page breaks are independent. Preserve empty leading page arrays: their indices refer to physical document pages.
- Page-start separators contribute neither a line nor its spacing. The separate introductory content gap remains on a fresh page even when the wide divider is omitted.
- `timeline.ts` connects actual boundary blocks belonging to the same station section in the main column, including transitions between distinct entries. Headings, dividers, different sections and empty pages interrupt the connection. CSS extends eligible main-column lines to the page's content boundary. Sidebar stations retain their content and vertical spacing but never receive dots, connecting lines, continuation flags/tails or timeline indentation. Scope timeline CSS to `.cv-main` in measurement, preview and print.
- `layoutStyles` in `page-layout.ts` is the shared layout-to-CSS mapping for measurement, preview and print. Keep the renderer independent of MUI. Header background clipping, bounded name/photo offsets in `DocumentHeader.tsx` and photo crop are decorative concerns; changes must not resize semantic text flow unintentionally.

## Data and export boundaries

`packages/core/src/schemas/` keeps strict Zod schemas for independent content, layout, template and manifest resources. Cross-resource validation in `schemas/project.ts` checks image references, template identity and supported placements. Unknown fields must remain errors rather than being stripped on import. `schema.ts` preserves the existing public exports.

The migration coordinator in `migrations/index.ts` upgrades template, CV and layout resources in their original order, using separate resource modules. Every historical version advances through its existing consecutive steps. Older appearance defaults differ from new-project defaults deliberately. Reject fields that did not belong to a claimed historical version before adding new fields; preserve literal legacy descriptions when introducing formatting syntax. Missing personal details and date components must never be inferred.

Local persistence and JSON file import share `parseProject` in `project-import.ts`, including its UTF-8 byte limit, migrations and validation. JSON export includes content, effective layout, template and embedded assets. The PDF path copies the completed semantic document into an isolated A4 iframe and waits for styles, fonts and images; it must not reflow the editor or rasterize CV text.

The module boundaries and compatibility entry points are documented in [ADR 037](adr-037-modular-editor-core-and-renderer.md). The web editor keeps design-area controls under `components/design/` and persistence, file actions and preview zoom under `hooks/`.

## Comparing actual PDFs before and after maintenance

After a successful full browser suite, capture its PDF output **before** editing behavior-sensitive code:

```sh
# Create private/ locally if it does not exist.
npm run pdf:snapshot -- capture test-results private/pdf-before.json
```

After the changes, rerun the same full suite and compare:

```sh
npm run test:browser
npm run pdf:snapshot -- compare test-results private/pdf-before.json
```

The snapshot records every PDF's page geometry, ordered extracted text with positions, and a SHA-256 hash of each page's rendered pixels. It ignores changing PDF metadata and rejects an empty PDF directory or changed file inventory. The comparison is exact and requires the same browser, OS, font packages and PDF.js version; it is a local maintenance check, not a portable visual baseline. Investigate mismatches before replacing a baseline. Keep snapshots and PDFs outside version control, especially when working with personal CVs.
