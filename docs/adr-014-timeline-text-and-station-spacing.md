# Textabstand und Stationsabstand der Zeitachse

Layoutschema 8 ergänzt `timelineTextGapMm` (2–14 mm, Standard 3,75 mm) und `stationSpacingMm` (0–12 mm, Standard 1,5 mm). Renderer-Version ist 1.12.0; CV-Schema bleibt bei Version 3. Frühere Layouts werden explizit mit diesen Standardwerten migriert. Vorhandene Werte, Texte und Assets bleiben erhalten; widersprüchliche Felder in älteren Versionen werden abgewiesen.

Der Textabstand wird von der Mitte der Achse gemessen und über die zentrale Layoutabbildung auf alle Stationsblöcke angewendet. Die bisherigen 5 mm linken Innenabstand setzen sich bei den Standardwerten aus 1,25 mm Achsenposition und 3,75 mm Textabstand zusammen. Punkte, Linie und Überschriften bleiben an ihrer bisherigen Achse; nur Stationstexte rücken weiter hinein. Bei ausgeblendeten Markierungen ist der Textabstandsregler deaktiviert und der Wert bleibt gespeichert.

Stationsabstand liegt als zusätzlicher unterer Innenabstand am letzten Block eines Eintrags. Er ersetzt den bisherigen festen Abstand von 1,5 mm am letzten Beschreibungsabsatz. Stationen ohne Beschreibung erhalten jetzt denselben zusätzlichen Abstand. Die normalen Blockabstände bleiben bestehen, ebenso Abstände zwischen Absätzen innerhalb einer Station. Die Regel gilt unabhängig vom Markierungsstil für Ausbildung, Erfahrung und Projekte in beiden Regionen. Die Verbindungslinie folgt weiterhin der Blockhöhe.

Die bestehende Pagination misst die tatsächlichen Blockhöhen und Textumbrüche nach jeder Layoutänderung. Breitere Einzüge und grössere Stationsabstände können dadurch zusätzliche Seiten erzeugen. Es wird keine feste Positionierung eingeführt.

Modelltests prüfen Migration, Wertebereiche und JSON-Rundlauf. Browser-/PDF-Tests prüfen alle drei Stationsabschnitte, Stationen mit und ohne Beschreibung, Speichern und Wiederherstellung, Stilwechsel sowie kurze und mehrseitige CVs mit schmaler Seitenleiste und Einstellungen an beiden Bereichsgrenzen. Sie vergleichen Stationsgeometrie in Vorschau und Druck, PDF-Seitenzahl, Textpositionen und vollständige Einträge.
