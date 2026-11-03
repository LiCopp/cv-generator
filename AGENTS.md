# AGENTS.md — CV Generator

## Purpose and product vision

Build an open-source, self-hostable CV/résumé generator for students applying for apprenticeships **and** adults with extensive work histories.

Primary goal: keep a CV current without manually readjusting elements in Word. Users enter structured information in forms, configure the design, see a live A4 preview, and export professional, text-extractable PDFs.

The application must work for both a short, one-page school-leaver CV and a long, multi-page professional CV. The design inspiration is a modern CV with an image/gradient header, overlapping profile photo, sidebar, skill bars, and long career history. This is a reference use case, **not** a requirement to hardcode one user's CV.

This file describes the agreed product direction and engineering guardrails. It is a specification for development, **not** a claim that the described features are already implemented.

## Core principles (non-negotiable)

1. **Separate content, layout and appearance.** CV data must not be tied to React components, positions, or specific templates.
2. **Declarative and portable.** Templates/layouts are versioned JSON resources, validated against schemas. The same CV can use different layouts.
3. **Content stays in document flow.** Avoid absolute positioning of text blocks as the normal editing model. Content growth must not force users to manually realign subsequent elements.
4. **Human-readable and machine-readable.** Preserve meaningful headings, semantic HTML, selectable PDF text and sensible reading order. Do not rasterize the CV into a screenshot/PDF image.
5. **Preview/print consistency.** Reuse the same renderer and styles for on-screen A4 preview and server-side PDF where practical; test actual PDF output.
6. **Easy to operate.** Begin with JSON persistence, keep a clean migration path to a database, and ship a Docker-based self-hosted deployment.
7. **Safe by default.** CVs contain personal information and photos, including those of minors. No public-by-default profiles, no arbitrary scripts from templates, no secret values in client files.
8. **Incremental delivery.** Implement the smallest functional vertical slice before adding a full layout editor or community marketplace.

## Intended user experience

- Responsive React/MUI application: editing/navigation panel, live document preview, and contextual design/property inspector.
- Forms for contact information, summary, education, school level, apprenticeships/job-shadowing, experience, languages, skills, interests/hobbies, projects, certificates/training and references as needed.
- Users can enable/disable, reorder and place sections into supported regions (header, main, sidebar, footer).
- A CV may be customized for different applications while retaining common biographical data; multi-CV and shared-profile modelling can follow after the MVP.
- Offer at least two contrasting initial use cases: a concise one-page student CV and an extended multi-page adult CV. Start with one functioning template; expand to 2–3 built-in presets.
- Adjustable page margins, spacing, **user-selectable font family**, font size/weight/line height, colors, column proportions, sidebar side, section order, photo shape (circle/rectangle/rounded rectangle), photo crop, header/background images and gradients.
- Offer an uncluttered, accessible editing experience. Advanced settings should not be required to produce a good CV.

## Architecture (initial direction)

- **Frontend:** React, TypeScript, Vite and MUI for the application UI. React Hook Form and Zod for input and model validation; Zustand is an acceptable lightweight editor state solution.
- **Renderer:** reusable React components emitting semantic HTML and print CSS, **not** a screenshot-based drawing canvas. Do not couple printable CV components to MUI.
- **Backend:** lightweight Node.js/TypeScript HTTP API, preferably Fastify, for server-side persistence, image handling, export and PDF generation. Keep a local-only prototype possible during the earliest iteration.
- **PDF:** Chromium/Playwright print-to-PDF or an equivalent HTML-to-PDF solution preserving text. Verify text extraction and multipage flow experimentally.
- **Storage:** JSON documents and file assets for the first release behind a storage abstraction; possible SQLite or another small DB later.
- **Deployment:** container image plus Compose example, with persistent volumes for mutable data/assets.
- Use a shared TypeScript/Zod domain package for frontend/backend schemas and types. These are proposed choices; if alternatives are selected, document the reasons before changing direction.

Suggested structure (create incrementally, not necessarily all at once):

```text
apps/
  web/                 # editor, live preview, property panels
  api/                 # storage, assets, export
packages/
  core/                # CV, template, layout types; Zod schemas; migrations
  renderer/            # template-independent section renderers and print CSS
templates/
  classic/
    template.json
    layouts/default.json
  modern/
    template.json
    layouts/sidebar-left.json
    layouts/sidebar-right.json
    assets/
  creative/
    template.json
    layouts/default.json
docker/
compose.yaml
```

## Data model and portability

Keep these concepts independent:

- **CV document:** identity/contact details, career/school/education data and ordered content items. Include `schemaVersion`, persistent IDs for list entries and explicit date representations. Do not infer missing information or require adult-only fields for students.
- **Template definition:** versioned name/id, capabilities, regions, supported building blocks, defaults and bundled assets.
- **Layout definition:** versioned placement/order of section instances, page geometry and appearance overrides such as spacing, colors, image behavior and sidebar width.
- **Assets:** photos/backgrounds referenced by controlled asset IDs or portable relative paths, not machine-specific absolute paths.

Use separate, validated JSON schemas (with version fields) for CV, template, layout and export manifest. Include migrations when schemas evolve. Never silently discard fields on import or upgrade.

Store built-in templates in the repository; user-modified layouts and CV files belong in persistent runtime storage, never in source-controlled directories or mutable container layers.

Templates should be data-only. New community layouts may rearrange/configure **known** renderer components without needing new React code. A genuinely new component type requires an explicit, reviewed renderer extension. Do not execute imported JS, JSX, raw HTML, arbitrary CSS or expressions as template code.

### Project export/import

Support two distinct export paths:

1. **PDF export:** finished CV for printing/sharing. Initially one designed PDF; later optionally a simple one-column ATS-oriented variant.
2. **Editable project export:** portable bundle such as `.cvpkg` (ZIP) containing at least:
   - `manifest.json` with format/schema versions and referenced resources;
   - `cv.json`;
   - `template/template.json`;
   - `template/layout.json`;
   - required user assets (e.g. profile/background images) and template assets/fonts where permitted.

A project import should restore the CV and the exact effective layout/appearance, even on another installation without the original built-in template. Record template identity/version and fully resolve resource dependencies. Aim for backward-compatible import and explicit migrations; avoid depending on remote assets to reproduce a document.

Implement import defensively: enforce size/file-count limits, validate schemas, normalize archive paths, prevent ZIP traversal and ZIP bombs, restrict file types, reject executable content, and do not trust a bundle's claimed MIME type. Do not load remote URLs or active SVG/HTML from untrusted packages by default.

## Typography and font selection

- Provide a font-family selector in the visual editor, starting with a small curated set of readable fonts; users must not need to edit JSON manually.
- Store the selected font as a stable font ID in the versioned layout/appearance JSON, rather than a platform-dependent local font name. Resolve that ID through a maintained font registry (family, weights, style, font files, licensing).
- Support global font selection and, where useful, separate typography presets/overrides for headings and body text. Expose font sizes, weights and line height with sensible boundaries.
- Keep font rendering consistent between live preview and Playwright/Chromium PDF generation. Include or install licensed font files in the container so exporting does not depend on fonts installed on the user's computer.
- Package required, redistributable font assets (and applicable notices/licenses) with a portable project export when licensing permits. Otherwise provide an explicit, documented fallback and warn about potential layout changes.
- Prefer OFL/openly redistributable font families for built-in selections; respect embedding/distribution licenses. Do not enable remote arbitrary font URLs or unvalidated user-provided font uploads in the MVP.
- Font changes may affect line wrapping and pagination; test short and four-page CV fixtures with multiple fonts.

## Layout/rendering rules

- Define A4 as the first supported page format; use explicit units (e.g. **mm** for physical page geometry, **%** for column widths, tokens/rem for on-screen UI).
- Use CSS Grid/Flexbox for sections and regions. Users may choose sidebar left/right, relative widths, padding and spacing via editor controls or drag-and-drop.
- Do not implement free-form absolute x/y placement of body text as the default: text must expand naturally and keep subsequent sections aligned.
- Isolate **decorative layers** (background art/gradients, frame and optional overlapping photo) from semantic content. Bounded absolute positioning is acceptable for non-flowing decoration.
- Centralize the mapping from validated layout JSON to CSS variables and renderer props; never hardcode one CV's sidebar/photo measurements across unrelated components.
- Design multi-page support deliberately: avoid awkward splits inside headings or short entries, handle section continuations, repeated/omitted header/sidebar content and overflow, and inspect pages in the resulting PDF. CSS page-break rules alone may be insufficient for independent two-column regions; consider measured pagination only if real tests show it necessary.
- Use text extraction tests to check PDF text, sequence and completeness; selectable text alone does **not** guarantee reliable ATS reading order.
- Treat skill bars as an optional visual display; include actual skill names and accessible textual proficiency labels where present. Do not invent unsupported proficiency scores.

## Security, privacy and accessibility

- The public/open-source project must not mean public user data. Default to private, local or authenticated access for stored documents; never expose CV folders as static public assets.
- First MVP may offer a no-account workflow with local editing, JSON/project import/export. Add proper authentication, per-user authorization and isolation **before** enabling shared hosted accounts or server-side multi-user persistence.
- Validate uploaded images on the server (content, file size, dimensions), safely decode/re-encode when appropriate, and guard against resource exhaustion. Consider stripping EXIF data. Treat background assets the same way.
- Add explicit controls for photo inclusion: a photo should be optional, not forced.
- Avoid collecting unnecessary sensitive information; users decide which fields to include. Consider children and minors in public deployment/privacy decisions.
- Provide keyboard-accessible form controls and section reordering alternatives to drag-and-drop; maintain useful contrast despite customizable backgrounds.
- Keep exports functional without network access to externally hosted fonts/assets where possible.

## Engineering and testing guidance for coding agents

- Follow established repository conventions as implementation grows. Favor small, understandable modules and type-safe interfaces over abstraction for its own sake.
- Update schemas, migrations, examples and documentation together whenever the data model changes.
- Add unit tests for schema validation, layout defaults/overrides, ordering, versions and imports; add at least one browser/PDF integration test for preview/export parity.
- Test at minimum: student CV (one page, little experience), adult CV (four or more pages, long entries), photo/no-photo, sidebar left/right, two languages as content, backgrounds, and PDF text extraction.
- Store fixture CVs using synthetic/anonymized data, never private personal information from sample CVs.
- Keep templates deterministic: given the same document, layout, assets, fonts and renderer version, the result should be visually reproducible as closely as practical.
- Do not add database, login, WYSIWYG canvas, public template marketplace, AI rewriting, or highly configurable page positioning to the first milestone unless separately requested.
- Explain meaningful architecture decisions in brief ADRs or docs. If a requirement threatens robust pagination or portability, surface the trade-off rather than silently weakening the requirement.

## Delivery roadmap

**M1 — First vertical slice:** scaffold React/TypeScript/MUI; define CV schema; basic student-friendly fields; one built-in layout JSON; semantic A4 live preview; local JSON import/export.

**M2 — PDF and adult CV:** server/Playwright PDF generation; text extraction checks; multi-page work history; education, sections and realistic long-content fixtures.

**M3 — Layout customization:** property inspector, sidebar left/right, reorder sections, page/section spacing, widths, font selector and typography controls, photo shapes/crop, gradients and image backgrounds; persist modifications as layout JSON.

**M4 — Portable project bundles:** versioned `.cvpkg` import/export with effective template/layout/assets, validation, migration and reproducibility tests. Additional built-in templates.

**M5 — Self-hosted service:** Fastify persistence/API (if not already introduced), container/Compose volumes, backups, single-instance private workflow; then evaluate multi-user accounts and database.

This sequence is a planning baseline, not a prohibition on small changes that make implementation simpler.

## Definition of done for the first useful release

A user can complete a CV entirely through forms; see an accurate A4 preview; adjust an initial set of design properties without editing code; save and reload the CV as JSON; export a readable, text-based PDF; and successfully use a sample short CV and a long CV without manually positioning text. New layout presets can be shipped as versioned JSON files.

When an agent proposes a feature, ensure it advances these goals instead of rebuilding a general-purpose document editor.
