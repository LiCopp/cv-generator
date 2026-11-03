# Kleinere Zeilenabstände unter Typografie

Der allgemeine Zeilenabstand lässt sich nun von 0,90 bis 1,80 einstellen, der eigene Zeilenabstand für die physisch linke Spalte von 0,90 bis 2,40. Beide Regler behalten Schritte von 0,05. Die gemeinsame Untergrenze liegt als `typographyLineHeightMin` im Domainpaket und wird für Zod-Validierung und Editor verwendet. Die bisherigen Vorgaben und gespeicherten Werte bleiben erhalten; `null` folgt in der linken Spalte weiterhin dem allgemeinen Wert. Kontakt- und Stationskopfregler behalten ihre eigenen Grenzen.

Es werden ausschliesslich die zulässigen Werte bereits vorhandener Zahlenfelder erweitert. Die Bedeutung der Daten und das Layoutschema 22 bleiben erhalten; eine Datenmigration ist deshalb nicht erforderlich. Neue kompakte Werte werden beim JSON-Import validiert und ohne Umrechnung gespeichert. Ältere Programmversionen mit engerer Validierung können diese Werte zurückweisen.

Unit-Tests prüfen die erweiterten Grenzen und den JSON-Rundlauf. Browser-Tests prüfen Tastaturbedienung, Schritte, Speichern, Neuladen und Import beider Regler. Kurze und mindestens vierseitige Lebensläufe mit allen drei Schriftfamilien prüfen Vorschau-/PDF-Geometrie, Inhalt und Seitenzahl an der neuen Untergrenze; gerasterte PDF-Seiten dienen der visuellen Kontrolle der engen Zeilen.
