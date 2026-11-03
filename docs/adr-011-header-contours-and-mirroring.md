# Vollständige Headerkonturen und Spiegelung

Die Kürzung der Hintergrundebene um 0,5 mm aus ADR 006 vermied eine rechteckige PDF-Haarlinie. Sie entfernte allerdings auch die tiefsten Teile der Schräge und der Spitze. Bei geringer Formhöhe entstand eine gut sichtbare waagrechte Abflachung. Dieselbe Kürzung betraf hochgeladene Headerbilder.

Renderer 1.10.0 beschneidet stattdessen die gesamte dekorative Hintergrundebene direkt mit der Formkontur. Farbe, Verlauf, Bild, Abdunklung und geometrische Dekoration liegen in dieser Ebene. Der weisse SVG-Überleger und alle pauschalen Kürzungen entfallen. Text und Profilfoto bleiben separate Elemente; der Dokumentfluss und die Pagination behalten die gesamte Headerhöhe.

Das Formenregister enthält gemeinsame Kontrollpunkte für die SVG-Auswahlvorschau und den Renderer. Gerade Linien bleiben exakt; Bézierkurven werden mit 64 Segmenten als CSS-Polygon ausgegeben. Der Polygonfehler bleibt bei A4 und maximaler Formhöhe unter 0,01 mm. Die Kontur verwendet relative Breiten und physische Abstände von der Unterkante und passt sich dadurch auch an wachsende Headertexte an. Importierte Pfade oder freies CSS bleiben ausgeschlossen. Text wird im PDF weiterhin separat und auslesbar ausgegeben.

Layoutschema 6 ergänzt `headerEdgeMirrored`. Die horizontale Spiegelung betrifft ausschliesslich Welle und Schräge; symmetrische Formen ignorieren den Wert und deaktivieren den Regler. Die Auswahlvorschau zeigt ebenfalls die gespiegelte Form. Profilfoto, Headerbild und Text werden nicht gespiegelt. Frühere Layoutversionen werden explizit mit `false` migriert, ohne andere Felder zu ändern.

Unit-Tests prüfen Migration und Konturendpunkte. Browser-/PDF-Tests prüfen die unteren, früher abgeschnittenen Bereiche bei 4 und 16 mm Formhöhe, die Richtung gespiegelter Formen, Farbe und Hintergrundbild sowie den weissen Bereich unterhalb des Headers. Die Pixelprüfungen verwenden synthetische Dokumente und Bilder. Bestehende Prüfungen für Fotoüberlappung, Seitengrösse und Textauslesbarkeit bleiben bestehen.
