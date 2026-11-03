# ADR 001: Lokaler erster Entwurf mit gemeinsamem Druckrenderer

Status: angenommen für den ersten Entwurf.

## Entscheidung

React, TypeScript, Vite und MUI bilden die Oberfläche. React Hook Form verwaltet die Formulare, Zod validiert versionierte CV-, Template-, Layout- und Manifestmodelle. Die gemeinsame Domäne liegt in `packages/core`, der MUI-freie HTML-Renderer in `packages/renderer`. Ein Backend wird in dieser ersten vertikalen Scheibe bewusst noch nicht benötigt.

Vorlage und Layout sind getrennte, validierte JSON-Ressourcen. Die Abbildung von Layoutwerten auf CSS-Variablen ist zentral im Renderer. Importierte Daten werden ausschliesslich als Text bzw. begrenzte CSS-Werte gerendert; es gibt kein `dangerouslySetInnerHTML`, keine Templateausdrücke und keine externen Asset-URLs.

Eine lokale Speicheranbindung kapselt `localStorage`. Ein JSON-Projekt speichert Dokument, tatsächliche Vorlage, Layout und kontrollierte Foto-Assets zusammen. Unbekannte Felder und Versionen werden abgewiesen, damit keine Informationen still verschwinden. Bei einer beschädigten lokalen Datei überschreibt die Anwendung den gespeicherten Inhalt nicht automatisch. Eine neue bzw. importierte gültige Datei aktiviert das Speichern wieder.

## Seiten und PDF

Unabhängige Grid-Spalten fragmentieren im Browserdruck nicht zuverlässig gemeinsam. Deshalb misst der Renderer normale HTML-Blöcke nach `document.fonts.ready` bei exakter A4-Breite. Überschriften bleiben mit dem Folgeblock verbunden. Beschreibungstexte werden in kleine Stücke aufgeteilt, damit Einträge auch über Seitengrenzen wachsen können. Hauptspalte und Seitenleiste werden unabhängig gepackt, dann in gemeinsame A4-Seiten gesetzt. Nur die dekorativen Kopf-/Fussbereiche sind begrenzt positioniert.

PDF nutzt zunächst den Browserdruck und genau die bereits paginierten HTML-Seiten. Playwright erzeugt im Integrationstest echte PDFs; pdfjs prüft extrahierten Text, Reihenfolge und Seitenzahlen. Der spätere Exportdienst kann denselben Renderer wiederverwenden.

## Konsequenzen und Grenzen

Kein Konto und kein Server mit persönlichen Daten sind für die erste Nutzung nötig. Portable JSON-Dateien sichern auch das effektive Design. Die JSON-Datei ersetzt noch kein endgültiges `.cvpkg`; ZIP-Import, Schriftenpaket und Migrationen folgen separat.

Die Hauptspalte steht in der DOM-Reihenfolge vor der Seitenleiste, auch bei links angeordneter Seitenleiste. Das ist deterministisch, aber nicht gleichbedeutend mit optimaler Interpretation durch jedes ATS. Ein späteres einspaltiges ATS-Layout kann den gleichen Inhalt verwenden.

Es werden drei OFL-Schriftfamilien lokal gebündelt und deren Lizenzen mit dem Build kopiert. Die Vorschau und der PDF-Druck verwenden dieselben Dateien. Druckdialog-Optionen können die Ausgabe verändern; der getestete Referenzpfad ist Chromium mit A4, 100 %, ohne zusätzliche Browser-Ränder oder Kopf-/Fusszeilen.

Schrift- und Layoutänderungen lösen eine neue Messung aus. Sehr grosse Namen oder extreme ununterbrochene Zeichenfolgen benötigen weitere Belastungstests. Bildvalidierung erfolgt hier lokal; vor Serveruploads sind Pixelprüfung vor dem Dekodieren, sichere Rekodierung und Ressourcenbegrenzung serverseitig Pflicht.
