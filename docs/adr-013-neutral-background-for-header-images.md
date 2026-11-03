# Neutraler Untergrund für Headerbilder

Renderer 1.11.1 ersetzt für gesetzte Headerbilder den Farb-/Verlaufsuntergrund aus ADR 012 durch Transparenz. Das Bild samt Abdunklung wird gegen die weisse Dokumentseite gemischt. Dadurch verfärbt die Akzentfarbe weder teilweise transparente PNGs noch die über den Regler eingestellte Bildtransparenz. Die Akzentfarbe bleibt für Überschriften und Stationspunkte wirksam.

Der Header wählt abhängig vom vorhandenen Bildasset entweder den Bildmodus oder den gespeicherten Farb-/Verlaufsmodus. Im Bildmodus ist die Hintergrundebene transparent. Das Farb-/Verlaufsfeld ist im Editor deaktiviert; beim Entfernen des Bildes wird die bisherige Einstellung wieder wirksam. Die Datenstruktur bleibt bei CV-Schema 3 und Layoutschema 7; es ist keine Migration erforderlich.

Bestehende Browser-/PDF-Tests prüfen den neutralen Untergrund bei 0, 50 und 100 % Bildtransparenz für beide gespeicherten Headerstile, mit zusätzlicher Abdunklung. Sie prüfen ausserdem, dass Änderungen der Akzentfarbe nur die dokumentweiten Akzente beeinflussen und dass das Entfernen des Bilds die Farbdarstellung wiederherstellt.
