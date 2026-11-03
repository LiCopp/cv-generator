# ADR 003: Kontakticons und freiwilliger Zivilstand

Status: angenommen.

Die durchgehende Trennlinie zwischen Hauptspalte und Seitenleiste entfällt. Die unabhängige Stationslinie mit ihren Punkten bleibt erhalten. Spaltenabstände und die links/rechts wählbare Seitenleiste bleiben Teil des bestehenden Layoutmodells.

Kontakte werden als fliessende Zeilen mit lokal gebündelten Lucide-SVG-Icons gerendert: Haus für Adresse, Brief für E-Mail, Telefon, Globus für Website und Hände für Zivilstand. Strasse und Ort bilden einen zweizeiligen Adressblock mit einem Icon. Leere Angaben erzeugen weder Icon noch Platzhalter. Icons sind für Screenreader verborgen; Werte bleiben HTML-Text und im PDF auslesbar. Die zusätzliche Iconbreite wird bei der normalen DOM-Pagination mitgemessen.

CV-Schema Version 2 ergänzt `contact.maritalStatus` als frei formulierbaren Text. Eine leere Zeichenfolge bedeutet «nicht angegeben» und wird nicht ausgegeben. Es gibt keine Pflichtangabe oder vorausgewählte persönliche Information. Schüler- und Erwachsenenbeispiele bleiben in diesem Feld leer.

Die explizite Migration von CV Version 1 ergänzt nur das leere Feld und bewahrt die vorhandenen Werte, Assets und Layouteinstellungen. CV- und Layoutversionen werden unabhängig migriert. Widersprüchliche oder unbekannte Felder werden weiterhin abgewiesen. Exporte verwenden Renderer-Version 1.2.0; ältere unterstützte Rendererkennungen bleiben importierbar.

Tests prüfen alte CVs, gleichzeitige CV-/Layoutmigration, persönliche Freitexte, leere Kontakte, beide Seitenleistenpositionen und tatsächliche PDF-Textausgabe.
