# Strukturierte Kenntnisse und konfigurierbare Darstellung

CV-Schema 7 erweitert ausschliesslich die Einträge von `cv.skills`: stabile `id`, `name`, qualitativer `level` sowie `description` und `category`. Leere Zeichenketten bedeuten eine fehlende optionale Angabe. Eine Bewertung ist nicht erforderlich. Beschreibung ist Freitext bis 20 000 Zeichen; Name, Kategorie und Einstufung sind auf je 300 Zeichen begrenzt. Vordefinierte Einstufungen sind Grundkenntnisse, Gute Kenntnisse, Sehr gute Kenntnisse, Expertenkenntnisse und Langjährige Erfahrung. Individuelle Bezeichnungen bleiben zulässig. Es gibt kein numerisches Kompetenzniveau im CV-Datensatz. Sprachen und Interessen behalten ihr bisheriges Modell; Sprachbezeichnungen wie Muttersprache und A1–C2 bleiben Freitext.

Layoutschema 17 ergänzt die unabhängige Konfiguration `layout.skills`:

```json
{
  "skills": {
    "display": "text",
    "showLevel": true,
    "showDescription": false,
    "groupByCategory": false,
    "barValues": {
      "Grundkenntnisse": 25,
      "Gute Kenntnisse": 50,
      "Sehr gute Kenntnisse": 75,
      "Expertenkenntnisse": 100
    }
  }
}
```

`text` erhält die bisherige Darstellung mit Name und Kenntnisstand darunter. `bars` ergänzt einen dekorativen horizontalen Balken und behält den qualitativen Text sichtbar. `detailed` zeigt Name und Einstufung in einer Zeile und darunter die optionale Beschreibung. Die Sichtbarkeitsflags gelten in allen Modi. Beim Auswählen eines Modus im Editor ist die Beschreibung zunächst bei `detailed` ein- und bei den anderen Modi ausgeschaltet; ein eigener Schalter erlaubt Abweichungen. Die Daten bleiben bei jedem Wechsel unverändert.

Der Import löst eine fehlende oder unvollständige Skills-Konfiguration in aktuellem Layoutschema auf Standardwerte auf. Ohne Konfiguration gilt `text`. Bei explizitem `display: "detailed"` und fehlendem `showDescription` gilt `true`; explizit gespeicherte Flags bleiben erhalten. Die validierten Domain- und Editor-Typen enthalten immer die vollständig aufgelöste Konfiguration. Eine Migration von Layout 16 ergänzt dieselben Textstandardwerte. CV 6 erhält leere Beschreibungen und Kategorien; vorhandene Namen und qualitative Einstufungen bleiben erhalten. Die Ressourcen werden unabhängig migriert. Widersprüchliche neue Felder in alten Versionen und unbekannte Konfigurationsfelder werden abgewiesen. Renderer-Version ist 1.22.0; Vorlagenschema bleibt 2.

Die Zahlen in `barValues` sind relative grafische Längen von 0 bis 100, keine gemessenen Kompetenzprozente. Für fehlende Einstufungen, unbekannte individuelle Bezeichnungen und Langjährige Erfahrung gibt es standardmässig keinen Balken. Eigene Zuordnungen können ausdrücklich im Design-Editor aktiviert und bearbeitet werden; sie erzeugen keine numerischen CV-Daten und keine Prozentbeschriftung. Jede Zuordnung kann entfernt werden. Ohne sichtbaren Kenntnisstand wird auch kein Balken gezeigt. Balken sind für Hilfstechnologien dekorativ (`aria-hidden`), der qualitative Text ist semantisches HTML und extrahierbarer PDF-Text. Es werden höchstens 40 Zuordnungen akzeptiert.

Der bestehende Kenntnis-Editor erhält ein MUI-Autocomplete mit frei eingebbarem Wert, Beschreibung und Kategorie. Die Design-Einstellungen befinden sich bei «Design → Abschnitte → Kenntnisse». Kategorien werden nur auf Wunsch gruppiert: Reihenfolge der erstmals auftretenden Kategorien und Reihenfolge innerhalb jeder Gruppe bleiben erhalten; nicht zugeordnete Einträge stehen unter «Weitere Kenntnisse». Kategorieüberschriften sind `h3`, die untergeordneten Kompetenznamen `h4`.

Der MUI-freie Renderer verwendet die wiederverwendbare Komponente `SkillContent`. Lange Beschreibungen werden wie anderer Freitext in messbare Blöcke aufgeteilt; Name und erster Beschreibungsblock bleiben verbunden. Messansicht, Vorschau und Druck verwenden dieselben Komponenten und CSS-Regeln. HTML oder Markdown in Beschreibungen wird nicht ausgeführt. Schrift, Akzentfarbe, Spaltenzuordnung und Abschnittsreihenfolge bleiben den vorhandenen Layout-Einstellungen unterstellt.

Unit-Tests prüfen Migration, Standardauflösung, alle Einstufungen, individuelle Labels, Zuordnungen ohne automatische Erfahrungsprozente, Kategoriegruppierung, Grenzen und unveränderte Sprachstufen. Browser-/PDF-Tests prüfen Formulare, sofortigen Moduswechsel, explizite Balkenzuordnungen, optionale Angaben, Speichern/Import, alte Dateien sowie alle Modi und lange Beschreibungen in beiden Regionen einschliesslich vollständigem auslesbarem PDF-Text.

Erweiterung: [ADR 036](adr-036-optional-proficiency-bars.md) ergänzt mit CV-Schema 8 ausdrücklich eingegebene Kompetenzwerte pro Kenntnis und Sprache. Die ursprünglichen Zuordnungen aus dieser ADR bleiben als grafische Standarddarstellung ohne eigene Bewertung erhalten.
