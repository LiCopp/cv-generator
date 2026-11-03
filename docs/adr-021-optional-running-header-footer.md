# Optionale Kopf- und Fusszeile

Layoutschema 14 ergänzt die unabhängigen booleschen Eigenschaften `appearance.showRunningHeader` und `appearance.showFooter`. Neue Projekte und explizit migrierte Layouts 1–13 behalten beide Zeilen sichtbar. Widersprüchliche neue Felder in alten Versionen werden abgewiesen. Renderer-Version ist 1.18.0; CV-Schema bleibt bei 4.

Unter «Design → Aufteilung & Abstände» betrifft die Kopfzeilenoption ausschliesslich die kleine Zeile auf Folgeseiten. Der gestaltete Header inklusive Bild und Foto auf Seite 1 bleibt erhalten. Die Fusszeilenoption betrifft Name und Seitenzahlen auf allen Seiten. Beide Einstellungen werden mit dem effektiven Layout gespeichert und importiert.

Ausgeblendete Zeilen werden nicht gerendert. Die Messung berücksichtigt eine fehlende Kopfzeile mit Höhe 0 statt 15 mm. Der zusätzliche Fussbereich beträgt abhängig von der Sichtbarkeit 8 oder 0 mm; derselbe Wert wird für die Pagination und die CSS-Inhaltshöhe verwendet. Die eingestellten Seitenränder bleiben erhalten. Dadurch stehen Folgeseiten ohne beide Zeilen 23 mm mehr Inhaltshöhe zur Verfügung, auf Seite 1 sind es 8 mm. Die Zeitachse füllt den entsprechend vergrösserten Inhaltsbereich. Vorschau und PDF verwenden dieselben gemessenen Seiten.

Schema-Tests prüfen Migration, Typen und alle vier Sichtbarkeitskombinationen. Browser-/PDF-Tests prüfen die Schalter, Speicherung, Import, tatsächliche Inhaltsgeometrie, erneute Seitenverteilung, Zeitachsenfortsetzung sowie Seitenzahl und vollständigen auslesbaren PDF-Text. Browser-eigene Druckkopf- und Fusszeilen bleiben eine unabhängige Einstellung im Druckdialog.
