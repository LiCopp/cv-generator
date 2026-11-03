# ADR 002: Header-Abschlüsse und Stationsmarkierungen

Status: angenommen.

## Entscheidung

Layoutschema Version 2 ergänzt `headerEdge` (straight, wave, diagonal, arc, chevron), `headerEdgeDepthMm` (4–16 mm) und `timelineStyle` (none, dots, line). Neue Lebensläufe verwenden eine Welle und Punkte mit Verbindungslinie. Die Auswahl liegt ausschliesslich im Layout, unabhängig vom CV-Inhalt. JSON-Exporte verwenden Renderer-Version 1.1.0.

Der Header-Abschluss ist ein dekoratives, verborgenes SVG aus einem fest definierten Formenregister. Importierte Pfade oder SVG-Dateien werden nicht ausgeführt. Text und Foto bleiben im normalen Header-Flexlayout. Zusätzlicher unterer Innenabstand reserviert Platz für die Form; die Seitenaufteilung misst die gesamte Headerhöhe einschliesslich Form. Vorschau und Druck verwenden dieselbe Vektordekoration.

Ausbildung, Erfahrung und Projekte bekommen eine schmale dekorative Spur links neben Titel und Beschreibung. Jede Station hat genau einen Punkt; Beschreibungsfortsetzungen bekommen keinen neuen Punkt. Die Linie folgt den normalen Textblöcken und kann deshalb bei mehrseitigen Einträgen mit dem Text fortgesetzt werden. Dekoration bleibt aus der zugänglichen Textreihenfolge ausgeschlossen. Alle Blockhöhen werden einschliesslich der geänderten Textbreite erneut gemessen.

## Migration und Datenschutz

Layout Version 1 wird ohne Feldverlust auf Version 2 migriert: gerader Header, neutrale Formhöhe 10 mm und keine Stationsmarkierungen. Das bewahrt die bisherige effektive Gestaltung. Unbekannte Felder, Versionen und widersprüchliche neue Felder in einem v1-Layout werden explizit abgewiesen. Der lokale Speicherschlüssel bleibt gleich, damit bereits gespeicherte Dokumente gefunden werden. Die Migration speichert erst nach erfolgreicher vollständiger Validierung.

Das private Referenz-PDF dient ausschliesslich der visuellen Orientierung. Seine Inhalte und Bilder sind weder Testfixtures noch mitgelieferte Projektassets. Browser-/PDF-Tests verwenden weiterhin synthetische Beispieldaten.

## Prüfung

Tests decken Migration, ungültige Formwerte, JSON-Roundtrips, UI-Auswahl, alle fünf Formen in echten A4-PDFs, Markeranzahl und mehrseitige Lebensläufe ab. Die Textauslesbarkeit und die bestehende Hauptspalten-Reihenfolge bleiben erhalten.
