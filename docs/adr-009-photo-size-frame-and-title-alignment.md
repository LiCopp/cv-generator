# Fotogrösse, Rahmen und Headerausrichtung

Layoutschema 5 ergänzt `photoWidthMm` (24–60 mm), `photoBorderWidthMm` (0–4 mm), `photoBorderColor` (sechsstelliger Hexwert), `photoFit` (`cover`/`contain`) und `photoPositionX`/`photoPositionY` (0–100 %). Renderer-Version ist 1.9.0; CV-Schema bleibt bei Version 3. Bestehende Layouts werden explizit migriert: 34 mm Breite, 1,2 mm weisser Rahmen, mittiger füllender Zuschnitt. Bereits gewählte Fotoseite, Überlappung, Headerbild und alle Inhalte bleiben erhalten. Widersprüchliche Felder in älteren Versionen werden abgewiesen.

Alle Einstellungen werden zentral in `layoutStyles` auf CSS-Variablen abgebildet. Die Breite bezeichnet das Aussenmass inklusive Rahmen. Kreise bleiben quadratisch; rechteckige Rahmen behalten das bisherige Verhältnis 34:40. Bei 0 mm Rahmenbreite entfällt der Rahmen. Die Mindesthöhe des Headers und der seitliche Platz für den Text berücksichtigen die tatsächlichen Fotomasse. Auch grosse Fotos mit geringer Überlappung bleiben innerhalb des Headers oben sichtbar. Die bestehende Pagination misst weiterhin den gesamten Headerwrapper.

Bei einem sichtbaren Foto links füllt der Text die verbleibende Headerbreite und richtet Name sowie Untertitel rechtsbündig aus. Ohne sichtbares Foto bleibt der Text linksbündig. Das Verhalten gilt sowohl für ein Foto innerhalb des Headers als auch für ein überlappendes Foto.

Eine grössere Fotofläche allein ändert den Zuschnitt nicht. Deshalb bietet der Editor zusätzlich `object-fit: contain` sowie horizontale und vertikale `object-position`-Regler an. «Einpassen» kann weisse Freiflächen erzeugen; die gewählte Kreis-/Rechteckform begrenzt weiterhin die sichtbare Fläche. Text und Bild werden im PDF separat ausgegeben; der Lebenslauf bleibt auslesbar.

Modelltests prüfen Migration, Rundlauf und Wertebereiche. Browser-/PDF-Tests prüfen Regler und lokale Speicherung, beide Fotoseiten, Grössen an den Grenzen, randlose und farbige Rahmen, alle Headerformen, Textpositionen und Bildpixel im exportierten PDF. Ein hochformatiges synthetisches Bild prüft die Freiflächen beim Einpassen. Private Referenzbilder werden nicht als Testdaten verwendet.
