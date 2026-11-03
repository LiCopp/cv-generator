# Transparenz des Headerbilds

Layoutschema 7 ergänzt `headerImageTransparencyPercent` (0–100). Renderer-Version ist 1.11.0; das CV-Schema bleibt bei Version 3. Frühere Layouts erhalten explizit 0 % Transparenz und behalten damit ihre bisherige Darstellung. Referenzen auf Bilder, Abdunklung und Spiegelung bleiben erhalten. Widersprüchliche Felder in älteren Versionen werden abgewiesen.

Bild und schwarze Abdunklung liegen in einer gemeinsamen dekorativen Ebene mit der Deckkraft `1 − Transparenz / 100`. Darunter bleibt die gewählte Headerfarbe bzw. der Verlauf sichtbar. So verschwindet bei 100 % auch die Abdunklung vollständig. Text und Profilfoto gehören weiterhin zu separaten Ebenen; die vorhandene Formkontur beschneidet die gesamte Hintergrunddekoration. Die zentrale Abbildung auf CSS-Variablen wird für Vorschau und Druck wiederverwendet; die Seitenaufteilung ändert sich nicht.

Modelltests prüfen Migration, Rundlauf und Wertebereiche. Browser-/PDF-Tests vergleichen die tatsächliche Farbmischung bei 0, 50 und 100 % für einfarbige und verlaufende Header mit zusätzlicher Abdunklung. Sie prüfen ausserdem deckende Profilfotos, auslesbaren Text sowie Speicherung und Wiederherstellung des Transparenzwerts.
