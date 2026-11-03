# ADR 004: Tagesgenaue Stationsdaten mit wählbarer Genauigkeit

Status: angenommen.

## Modell und Ausgabe

CV-Schema Version 3 erweitert explizite Datumsobjekte `{ year, month?, day? }` um optionale Tage. Jede Station speichert `startPrecision` und `endPrecision` unabhängig vom Datum. Neue, leere Stationen beginnen mit Genauigkeit `day`; die Formulare bieten Tag und Monat an. Die Genauigkeit `year` bleibt für bereits vorhandene Jahresangaben erhalten und editierbar.

Die Ausgabe verwendet `TT.MM.JJJJ` für Tagesangaben und weiterhin `MM/JJJJ` für Monatsangaben. Jahresangaben bleiben `JJJJ`. Ein unbekannter Tag wird nie als erster oder letzter Tag eines Monats ausgegeben. Wenn eine bestehende grobe Angabe auf eine feinere Eingabe umgeschaltet wird, zeigt das Formular den vorhandenen Wert als Hinweis, bis die fehlenden Bestandteile eingegeben wurden. Die Vorschau zeigt zwischenzeitlich weiterhin nur die tatsächlich bekannte Genauigkeit.

Die Wahl einer gröberen Ausgabe entfernt keine bekannten Bestandteile. Ein zuvor eingegebener Tag bleibt gespeichert und ist beim Zurückschalten verfügbar. Erst das aktive Eingeben eines neuen Monats ersetzt das Datumsobjekt durch die neue Monatsangabe. «Bis heute» lässt das gespeicherte Enddatum und dessen Genauigkeit bestehen und deaktiviert beide zugehörigen Felder.

Ein Enddatum ist optional. Für einen Schnuppertag oder eine eintägige Informationsveranstaltung genügt das Startdatum bei ausgeschaltetem «Bis heute». Die Ausgabe enthält dann nur dieses Datum, ohne Zeitraumstrich oder erfundenes Ende. Das Formular erklärt diese Möglichkeit und bietet «Enddatum entfernen» direkt am Bis-Feld. Dieser Knopf leert sowohl ein gespeichertes Enddatum als auch unvollständige native Eingabesegmente, setzt `end` auf `null` und behält Startdatum und Genauigkeitsauswahl bei. Bei laufenden Stationen ist er zusammen mit dem Enddatumsfeld deaktiviert. Das bestehende Datenmodell unterstützt diese Darstellung bereits; eine Schemaänderung oder Migration ist nicht erforderlich.

## Validierung und Migration

Die Validierung prüft Monatstage und gregorianische Schaltjahre. Zeiträume werden anhand ihrer effektiven Genauigkeit geprüft: exakte Tage dürfen nicht rückwärts laufen; bei Monats-/Jahresangaben wird deren möglicher Zeitraum berücksichtigt. Kalenderberechnungen verwenden UTC und sind unabhängig von der Zeitzone des Browsers.

Die Migration CV v1 → v2 ergänzt wie bisher nur den leeren Zivilstand. CV v2 → v3 übernimmt vorhandene Daten unverändert und setzt die Genauigkeit anhand der gespeicherten Bestandteile. Leere Endpunkte erhalten die neue Standardeinstellung `day`. Widersprüchliche neue Felder in alten Versionen werden abgewiesen, statt überschrieben. CV- und Layoutversionen entwickeln sich unabhängig; Rendererkennzeichnung für Exporte ist 1.3.0.

Die synthetischen Beispiele enthalten Tagesangaben und eine bewusst monatsgenaue Projektstation. Tests prüfen Schaltjahre, ungültige Tage, gemischte Genauigkeiten, Migration, rückwärts laufende Zeiträume, Umschalten ohne Tagverlust, Speicherung und tatsächliche PDF-Textausgabe.
