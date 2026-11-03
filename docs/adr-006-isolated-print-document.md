# ADR 006: Getrennte Druckansicht und Header ohne PDF-Haarlinien

## Problem

Der Browserdruck der gesamten Editor-Seite kann Vorschau-Zoom, responsive Container und MUI-Portale berücksichtigen. Ein Tooltip am Export-Button blieb in der Druckansicht aktiv. Am rechteckigen Rand des Header-Hintergrunds war im tatsächlichen Chromium-PDF eine feine Linie unterhalb des weissen SVG-Abschlusses sichtbar.

## Entscheidung

«PDF exportieren» erstellt ein temporäres, gleichursprüngliches Druck-iframe. Es enthält ausschliesslich einen DOM-Snapshot der bereits paginierten A4-Seiten, die effektiven Layoutvariablen und dieselben Styles und lokalen Schriften. Keine neue Vorlage, keine Rasterisierung von Text und keine zusätzliche Datenübertragung. Auch per CSSOM eingefügte Emotion-Regeln werden übernommen. Vor dem Drucken werden Styles, Fotos und Schriften geladen; nach `afterprint` wird der Frame entfernt und der Fokus zurückgegeben. Fehler beim Vorbereiten werden im Editor angezeigt.

Die versteckte Messregion des Renderers liegt als Portal direkt im Dokumentkörper. Sie bleibt auch bei mobiler, ausgeblendeter Vorschau messbar und verwendet die gleiche Typografie und Layoutvariablen wie die sichtbaren Seiten. Sie wird weder kopiert noch gedruckt.

Die Print-CSS setzt A4 und Zoom 1 explizit, entfernt Vorschau-Schatten und blendet Editor-Portale auch bei direktem Browserdruck aus. Die Browseroptionen für Papierformat, Skalierung, Ränder und Kopf-/Fusszeilen bleiben unter Kontrolle des Nutzers.

JSON-Exporte verwenden Renderer-Version 1.6.0. CV- und Layoutstruktur bleiben unverändert; bestehende Projekte sind weiterhin lesbar.

Der farbige Header-Hintergrund ist eine eigene dekorative Ebene. Bei geformtem Abschluss endet sie 0,5 mm vor dem unteren rechteckigen Rand, der ohnehin weiss überdeckt wird. Das weisse SVG überlappt die Seiten geringfügig. Dadurch können Rundungs- und Clippingartefakte keinen farbigen rechteckigen Rahmen hinterlassen. Header-Text bleibt semantisches HTML und im PDF auslesbar.

## Prüfung

Browsertests betätigen den Export-Button, prüfen die tatsächliche Druckansicht und erzeugen daraus PDFs. Prüfungen umfassen unterschiedliche Vorschau-Zoomstufen, Desktop/Mobilansicht, lange Inhalte, Fotos, geladene Schriften, Textauslesbarkeit und Seitenzahlen. Rasterprüfungen der fertigen PDFs kontrollieren die volle A4-Breite und den weissen Bereich unter dem Header-Abschluss; sie ändern nichts an der textbasierten Ausgabe.
