# ADR 037: Kleinere Module für Editor, Datenmodell und Renderer

Status: angenommen.

## Entscheidung

Die bestehende Trennung zwischen Web-Oberfläche, gemeinsamem Datenmodell und MUI-freiem Renderer bleibt bestehen. Innerhalb dieser Bereiche werden Module nach ihrer Verantwortung aufgeteilt:

- `apps/web/src/components/DesignEditor.tsx` koordiniert die fünf ein-/ausklappbaren Designbereiche. Die eigentlichen Formularfelder liegen unter `components/design/`, mit gemeinsamen Abstands- und Überschriftenreglern in `DesignControls.tsx`. Jeder Bereich liest seine Formulardaten über den bestehenden React-Hook-Form-Kontext.
- `apps/web/src/hooks/` kapselt automatische Speicherung, Dateiimport/-export und Vorschau-Zoom. `App.tsx` verbindet diese Abläufe mit Navigation und Oberfläche.
- `packages/core/src/schemas/` enthält die getrennten Schemas für Lebenslauf, Layout, Vorlage und Projekt sowie gemeinsame Validierungsbausteine. Datumsfunktionen, Abschnittsdefinitionen, Schriftregister und Headerformen haben eigene Module.
- `packages/core/src/migrations/` trennt die Migrationen von Vorlage, Lebenslauf und Layout. Der Koordinator führt sie weiterhin in genau dieser Reihenfolge aus; jeder historische Versionsschritt und seine ursprünglichen Standardwerte bleiben erhalten.
- `packages/renderer/src/flow-blocks.tsx` erstellt semantische Inhaltsblöcke und trennt Einstieg und Folgeinhalt. `page-layout.ts` übersetzt Layoutwerte in CSS-Variablen und berechnet gemeinsame Seitengrössen. `DocumentHeader.tsx` kapselt den gestalteten Header und dessen begrenzte dekorative Verschiebungen.
- `packages/renderer/src/useMeasuredPagination.tsx` misst unskalierte Inhaltsblöcke nach dem Laden der Schriften. `CvPreview.tsx` verwendet diese Ergebnisse für die gemeinsame Mess- und Seitendarstellung. Der reine Algorithmus bleibt in `pagination.ts`.

`packages/core/src/schema.ts` und `packages/renderer/src/index.tsx` bleiben öffentliche Einstiegspunkte mit den bisherigen Exports. Neue interne Module importieren ihre konkreten Abhängigkeiten direkt. Typabhängigkeiten zwischen Datumsfunktionen und Lebenslaufeinträgen werden als reine Typimports ausgedrückt.

## Konsequenzen und Validierung

Das Refactoring führt keine neuen Abhängigkeiten, Datenfelder, Dateiformate oder Schema-/Rendererversionen ein. Vorlagen, Standardwerte, Migrationen, Formularbeschriftungen und DOM-Struktur bleiben erhalten. Kleinere Dateien erleichtern die gemeinsame Weiterentwicklung und gezielte Codeprüfungen.

Die bestehenden Unit- und Browsertests prüfen Verhalten und Migrationen. Die PDF-Ausgaben der vollständigen Browsersuite werden vor und nach der Aufteilung mit `pdf:snapshot` verglichen: Seitengeometrie, Textreihenfolge, Textpositionen und gerenderte Pixel.

Beim Vorher-Lauf zeigte sich ausserdem ein bereits vorhandenes Rennen beim Aufräumen zweier Drucktests: Chrome kann den Druckrahmen bereits entfernt haben, bevor der Test nochmals `afterprint` auslöst. Die Aufräumstellen tolerieren diesen abgeschlossenen Zustand; sämtliche vorherigen Vorschau-, PDF- und Textprüfungen bleiben bestehen.

Die Prüfung verwaister Überschriften berücksichtigt jetzt auch die bereits bestehenden Absatz- und Listencontainer: Der nächste Inhaltsblock darf darin verschachtelt sein, muss aber weiterhin auf derselben Seite direkt auf die Überschrift folgen. Zuvor wurde eine korrekt gruppierte Kurzprofil-Fortsetzung irrtümlich als fehlender Folgeinhalt gewertet.

## Ergebnis der Prüfung

Build, Lint und Formatprüfung sind erfolgreich. Alle 106 Unit-Tests und alle 187 Browsertests bestehen. Die Browserprüfung lief mit dem lokal installierten Chrome über `PLAYWRIGHT_CHROME_PATH`. Alle 128 erzeugten PDFs stimmen mit dem Stand vor der Modulaufteilung exakt überein: Seitengeometrie, geordneter Text, Textpositionen und gerenderte Pixel. Die Vergleichsdateien bleiben lokal im ausgeschlossenen Ordner `.npm-cache/`.
