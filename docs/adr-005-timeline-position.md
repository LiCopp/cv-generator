# ADR 005: Horizontale Position der Zeitachse

## Entscheidung

Layoutschema Version 3 ergänzt `appearance.timelineOffsetMm` als Zahl von −10 bis +12 mm, standardmässig 0. Der ursprünglich bei −4 mm beginnende Bereich wurde auf Wunsch erweitert. Die JSON-Struktur bleibt gleich; vorhandene Werte behalten ihre Bedeutung. Der Designregler bietet Schritte von 0,5 mm und ist ohne Stationsmarkierungen deaktiviert. Die Einstellung gilt für Ausbildung, Erfahrung und Projekte in beiden Dokumentregionen. CV-Daten und Abschnittsreihenfolge bleiben unabhängig davon.

Der Renderer übersetzt den Wert zentral in `--cv-timeline-offset`. Stationsblöcke verschieben sich durch einen linken Aussenabstand, der auch negativ sein darf, bei konstantem innerem Textabstand. Dies vermeidet ungültiges negatives Padding. Alle Hauptüberschriften und die übrigen Hauptspaltenblöcke beginnen exakt auf der Mittelachse der Linie (1,25 mm nach dem verschobenen Blockanfang). In der Seitenleiste werden nur Stationsüberschriften entsprechend ausgerichtet. Ohne Markierungen entfällt diese Einrückung. Text bleibt im normalen Dokumentfluss; die vorhandene Messung berücksichtigt neue Zeilenumbrüche und Seitenumbrüche. Selbst bei 10 mm Seitenrand bleibt der äusserste Punkt innerhalb des Blatts. Zum Inhalt der benachbarten Spalte bleiben dank 9 mm Spaltenabstand und 6 mm Seitenleistenpolster mindestens 5,35 mm Platz. Vorschau und PDF verwenden dieselbe Geometrie.

Layouts v1 → v2 → v3 werden explizit migriert. Bestehende Layouts erhalten 0 mm. Bereits vorhandene neue Felder in alten Versionen werden als Konflikt abgewiesen. JSON-Exporte verwenden Renderer-Version 1.5.0 für die erweiterte Verschiebung und die gemeinsame Ausrichtung.

## Prüfung

Modelltests prüfen Grenzen, Roundtrip und Migration. Browser-/PDF-Tests prüfen links/rechts verschobene Punkte, Ausrichtung von Linie und Überschriften, Textabstand, Speicherung/Import sowie mehrseitigen Inhalt in Hauptspalte und Seitenleiste, einschliesslich kleinstem Seitenrand.
