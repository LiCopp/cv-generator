# ADR 007: Seitenabstände beim Drucken erhalten

## Befund

Beim tatsächlichen Chrome-Druck eines synthetischen Beispiels waren die Innenabstände der Inhaltsspalten links, rechts und oben 0 statt 15 mm. Der Rahmen selbst hatte die korrekte A4-Breite. Die bisherigen Exporttests prüften Breite, Seitenzahl und Textvollständigkeit, aber nicht diese Abstände.

Ursache war die Übernahme aller eingebetteten Styles über `CSSRule.cssText`. Chromium serialisierte `padding: var(--cv-margin); padding-bottom: 0` mit leeren Werten für die übrigen drei Langformen. Das erneute Einlesen dieser Regeln verlor die variablen Seitenabstände. Das war sowohl im nativen Druck aus dem Frame als auch beim Druck desselben Inhalts in einer eigenen Seite reproduzierbar.

## Entscheidung

Eingebettete Stylesheets werden aus ihrem ursprünglichen Text übernommen. Nur Styles ohne Text (insbesondere per CSSOM befüllte Emotion-Tags) werden weiterhin über ihre CSS-Regeln übertragen. Externe Stylesheets behalten ihren bisherigen Ladeweg. Die Spaltenregel verwendet zusätzlich einen einzigen vollständigen Padding-Ausdruck ohne nachträgliche Überschreibung eines einzelnen Werts.

JSON-Exporte verwenden Renderer-Version 1.7.0. Daten- und Layoutschema bleiben unverändert.

## Prüfung

Exporttests vergleichen die berechneten Seitenabstände der Live-Vorschau mit denen der vorbereiteten Druckansicht und prüfen im PDF die horizontalen Textpositionen. Dies ergänzt die bestehenden Prüfungen auf A4, Header-Kanten, Schriften, Fotos, Seitenzahl und auslesbaren Text. Der tatsächliche Chrome-Druck wird mit eigenem Testprofil, A4, 100 % und ohne Druckränder kontrolliert.
