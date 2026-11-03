# Header verschieben und Schriftfarbe einstellen

Layoutschema 18 ergänzt `appearance.headerShiftUpMm` (0–10 mm) und `appearance.headerTextColor` (sechsstelliger Hex-Farbwert). Neue Projekte und explizit migrierte Layouts 1–17 verwenden 0 mm und Weiss (`#ffffff`); die bisherige Darstellung bleibt erhalten. Widersprüchliche neue Felder in alten Versionen werden abgewiesen. Renderer-Version ist 1.23.0, CV-Schema bleibt 7, Vorlagenschema bleibt 2.

Unter «Design → Header» verschiebt ein Regler den gesamten gestalteten Header auf Seite 1 nach oben. Hintergrund inklusive Kontur, Text und Foto behalten ihre relative Position. Eine zusätzliche Flussbox begrenzt die Darstellung an der oberen Seitenkante; die innere Headerbox erhält einen negativen oberen Abstand. Ihr bisheriger oberer Freiraum von mindestens 10 mm erlaubt den begrenzten Versatz, ohne Namen oder Foto abzuschneiden. Überlappende Fotos sind weiterhin in der Höhe der Headerbox enthalten und bleiben sichtbar.

Die Flussbox wird tatsächlich um den Versatz niedriger. Die Pagination misst diese sichtbare Höhe, wodurch der gewonnene Platz für Inhalt zur Verfügung steht. Eine reine Transformation ohne Anpassung der Inhaltsfläche wird vermieden. Der separat eingestellte Abstand unterhalb des Headers bleibt erhalten. Kleine Kopfzeilen auf Folgeseiten behalten ihre bisherige Position und Akzentfarbe.

Die freie Farbauswahl bestimmt die Grundfarbe aller Texte im gestalteten Header, einschliesslich Name, Berufsbezeichnung und «Lebenslauf». Die bisherige dezente Transparenz von Untertitel und kleiner Beschriftung bleibt erhalten. Die Akzentfarbe für Hintergrund, Überschriften, Balken und Stationspunkte sowie der Fotorahmen bleiben unabhängig. Die Schriftfarbe gilt auch bei einem Headerbild und dessen Transparenz.

Unit-Tests prüfen Migration, zulässige Versätze und sichere Farbwerte. Browser-/PDF-Tests prüfen Speicherung und Import, tatsächlichen Platzgewinn, die gemeinsame Verschiebung mit und ohne Foto, überlappende Fotos links, Fotos rechts, Headerbilder und Konturen. Erzeugte PDFs werden auf Seitenzahl, vollständigen extrahierbaren Headertext und tatsächlich gerasterte Schriftfarbe geprüft.
