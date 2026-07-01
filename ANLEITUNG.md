# SocialFUX — Bedienungsanleitung

Interne Anleitung für den täglichen Betrieb von SocialFUX (`social.tuningfux.de`).

## Zugang

- URL: `https://social.tuningfux.de`
- Login: `admin@socialfux.local` / `admin123456`

Die Navigation befindet sich links in der Seitenleiste. Nach dem Login landest du automatisch im **Dashboard**.

---

## 1. Dashboard (`/dashboard`)

Startseite mit Live-Übersicht:

- **Kennzahlen**: Kunden, Neue News, Entwürfe, Freigegeben, Veröffentlicht.
- **Neueste News**: die zuletzt importierten News-Einträge mit Quelle, Status und Datum.
- **Neueste Inhalte**: die zuletzt generierten Texte mit Plattform, Status, Tonalität.
- **Schnellaktionen**: Direktlinks zu "Neuer Kunde", "News importieren", "Content generieren", "Creative erstellen".

Von hier aus siehst du auf einen Blick, was zu tun ist — mehr Interaktion ist nicht vorgesehen.

---

## 2. Kunden anlegen und pflegen (`/customers`)

### Kunde anlegen
1. Menüpunkt **Kunden** öffnen.
2. Oben rechts auf **"+ Neuer Kunde"** klicken.
3. Pflichtfeld: **Name**. Optional: Website, E-Mail, Telefon, Tonalität, Leistungen (Komma-getrennt, z.B. "Chiptuning, Diagnose, AdBlue"), Akzent-/Grundfarbe.
4. Auf **"Anlegen"** klicken.

Der Kunde erscheint danach in der Tabelle mit Logo-Platzhalter, Name, Leistungen, Website, Akzentfarbe und Status ("aktiv"/"inaktiv").

### Kunde bearbeiten (`/customers/{id}`)
Klick auf einen Kunden in der Liste öffnet die Detailseite mit 6 Reitern:

| Reiter | Was hier eingestellt wird |
|---|---|
| **Profil** | Name, Website, E-Mail, Telefon, Tonalität, Sprache, Notizen |
| **Branding** | Grundfarbe, Sekundärfarbe, Akzentfarbe (Farbwähler); Logo hochladen (PNG/JPG/WEBP/SVG, max. 10 MB) |
| **Leistungen** | Liste der angebotenen Services (Komma-getrennt) |
| **Social Links** | Instagram, Facebook, LinkedIn, TikTok, YouTube, Google Business |
| **Content** | Übersicht aller für diesen Kunden generierten Texte |
| **Creatives** | Übersicht aller visuellen Creatives dieses Kunden |

Wichtig: Änderungen werden erst gespeichert, wenn du oben rechts auf **"Speichern"** klickst. Logo-Upload speichert sofort beim Hochladen.

Die hier hinterlegten Farben, das Logo und die Tonalität werden automatisch bei jeder Content-/Creative-Generierung für diesen Kunden verwendet.

---

## 3. News-Quellen einrichten (`/news-sources`)

Hier werden RSS-Feeds oder Websites hinterlegt, aus denen automatisch Branchen-News gezogen werden.

### Neue Quelle anlegen
1. **"+ Neue Quelle"** klicken.
2. Pflichtfeld: **Name**. Dazu Website-URL und/oder RSS-URL, Typ (`rss` / `website` / `manual`), Scraper (`generic_rss` als Standard, außer für Quellen mit eigenem Scraper wie `autotuner`).
3. **"Anlegen"**.

### Quelle abrufen
Auf **"abrufen"** neben einer Quelle klicken — importiert neue Einträge aus dem Feed. Meldung zeigt z.B. "5 Einträge importiert (20 geprüft)". Bereits importierte Artikel werden nicht doppelt angelegt.

### Quelle pausieren/löschen
- Status-Badge ("aktiv"/"pausiert") anklicken, um die Quelle ein-/auszuschalten.
- **"löschen"** entfernt die Quelle inklusive Bestätigungsabfrage.

---

## 4. News prüfen und verwenden (`/news`)

Alle importierten News landen im **News-Eingang**.

### Manuell eine URL importieren
Oben im Eingabefeld eine Artikel-URL einfügen und **"URL importieren"** klicken — importiert direkt ohne Vorschau.

Für eine Vorschau mit Bearbeitungsmöglichkeit vor dem Speichern: Menüpunkt **"URL importieren"** (`/news/import-url`) nutzen — dort kannst du Titel, Bild, Zusammenfassung und Volltext vor dem Speichern noch anpassen.

### Status-Workflow
Jede News hat einen Status: **neu → gesichtet → verwendet / ignoriert / archiviert**.

- Filter oben (Status-Tabs) zeigt nur News mit gewähltem Status.
- Klick auf ein Item (Titel, Bild oder "Vorschau") öffnet die Detailansicht und markiert die News automatisch als **"gesichtet"**.
- **"Verwenden"** springt direkt zum Content-Generator mit dieser News vorausgewählt.
- **"ignorieren"** / **"archivieren"** entfernt die News aus der aktiven Warteschlange.

---

## 5. Content generieren (`/content-generator`)

Der Kern der App: aus einer News (oder frei) wird ein fertiger Social-Media-Text per Claude generiert.

### Schnellmodi
Zwei Buttons oben helfen beim Einstieg:
- **Manual Post**: Fertige Themen-Vorlagen anklicken (z.B. "BMW 330d Chiptuning — Erfahrungsbericht").
- **Service Post**: Klick auf einen der Kunden-Services generiert automatisch einen lokalen Werkstatt-Post dazu.

### Manueller Ablauf
1. **Kunde** wählen (Pflicht).
2. Optional: **News-Item** wählen (sonst wird frei generiert).
3. **Plattform** (Instagram, Facebook, LinkedIn, Google Business, Blog, Newsletter, WhatsApp) und **Tonalität** einstellen.
4. Optional: CTA, Ziel-Link, Zusatzanweisung (freier Prompt-Text an Claude).
5. **"Content generieren"** — erzeugt einen Vorschlag (Titel, Text, Hashtags). Automatisch wird eine Compliance-Prüfung mitgeschickt.
6. Alternativ **"3 Varianten generieren"** — erzeugt 3 unterschiedliche Tonalitäten (technisch/verkaufsstark/kurz) parallel zur Auswahl.

### Ergebnis bearbeiten
- Titel und Text sind direkt editierbar.
- **"Hashtags neu"** generiert neue Hashtag-Vorschläge.
- **"Compliance prüfen"** prüft auf riskante Aussagen (z.B. "100% legal", "TÜV garantiert").
- **"Sicherer formulieren"** lässt Claude riskante Formulierungen automatisch entschärfen.
- **"Speichern & zur Freigabe"** speichert den Content mit Status `review` und springt zur Freigabe-Ansicht.

---

## 6. Massen-Generierung (`/bulk-generator`)

Für viele News-Items auf einmal: erzeugt automatisch Text **und** Creative pro ausgewählter News, basierend auf einem Layout-Template.

1. **Kunde** wählen.
2. **Layout Template** wählen (siehe Abschnitt 8 — falls keins existiert, zuerst im Layout Editor eins anlegen).
3. Plattform, Tonalität, optional CTA/Link einstellen.
4. Rechts die gewünschten News-Items ankreuzen ("Alle" / "Keine" zur Schnellauswahl).
5. **"{N} Posts generieren"** klicken.

Ergebnis zeigt Anzahl erstellter Creatives (und ggf. Fehler); Link führt direkt zur Freigabe-Ansicht.

Wichtig: Das Layout-Template muss "Slot-Rollen" (z.B. `headline`, `image_slot`) haben, damit der Text/Bild automatisch eingesetzt wird — sonst bleibt das Layout statisch (Warnhinweis erscheint im UI).

---

## 7. Visuelles Creative erstellen (`/creative-editor`)

Einfacher, formularbasierter Editor für ein einzelnes Creative (Bild-Post).

1. Kunde wählen, optional bereits generierten Content oder ein Template als Basis laden.
2. Format wählen (Instagram Square, Story, Facebook Landscape, etc.).
3. Headline, Subline, CTA eintragen.
4. Hintergrundbild und/oder Logo über die Media-Auswahl setzen.
5. **"Creative speichern"** — legt das Creative an (oder aktualisiert es bei erneutem Speichern).
6. **"PNG exportieren"** — rendert das Creative serverseitig (Playwright) zu einer PNG-Datei und öffnet sie in einem neuen Tab.

Die Live-Vorschau rechts zeigt exakt, wie das Endergebnis aussehen wird — inklusive Kundenfarben und Logo.

---

## 8. Layout Editor (`/layout-editor`)

Der mächtigste Editor: freies Drag & Drop von Text-, Bild- und Box-Elementen, um wiederverwendbare Layout-Vorlagen zu bauen (für den Bulk-Generator).

### Grundlagen
- Kunde und Format oben wählen.
- Über **"+ Text"**, **"+ Bild"**, **"+ Box"** neue Ebenen (Layer) hinzufügen.
- Elemente auf der Leinwand per Maus verschieben und über die 8 Anfasspunkte an den Ecken/Kanten in der Größe ändern.
- **Snap-Raster** (ein/aus, Rastergröße 2,5–20%) hilft beim exakten Ausrichten.

### Ebenen-Eigenschaften (rechts, bei Auswahl eines Layers)
- Position/Größe in Prozent (X, Y, B, H).
- Bei Text: Inhalt, Schriftart (Presets oder freier Google-Font-Name), Größe, Gewicht, Farbe, Ausrichtung, Großschreibung.
- Bei Bild: Quelle, Anpassungsmodus (contain/cover/stretch).
- **Rolle (Template-Slot)**: entscheidend für automatische Befüllung —
  - Text: `static`, `headline (auto)`, `subline (auto)`, `cta (auto)`, `website_slot (auto)`
  - Bild: `static`, `image_slot (News/Auto)`, `logo_slot (Kunde)`

Nur Layer mit einer "(auto)"-Rolle werden beim Bulk-Generator automatisch mit Titel, Text, CTA, News-Bild bzw. Kundenlogo befüllt — alles andere bleibt statisch wie gestaltet.

### Gruppen
Mehrere Layer lassen sich zu einer Gruppe zusammenfassen (**"+ Neue Gruppe"**) und optional "verknüpfen" — dann bewegen sie sich beim Verschieben gemeinsam.

### Speichern
- **"Speichern als…"** legt das aktuelle Layout als **Layout-Template** an (wählbar: nur für diesen Kunden oder global für alle Kunden) — das ist die Vorlage, die im Bulk-Generator auswählbar wird.
- **"Speichern"** (unten) speichert die aktuelle Komposition direkt als einzelnes **Creative** (springt danach zurück zu Vorlagen).

---

## 9. Freigabe-Workflow (`/approvals`)

Übersicht aller Inhalte, die noch aktiv im Freigabe-Prozess sind: Status `draft`, `review`, `approved`, `scheduled`. Sobald ein Post veröffentlicht oder archiviert wird, verschwindet er von hier und taucht stattdessen im **Archiv** auf.

### Filter (Freigabe)
Nach Kunde, Plattform und Status (`draft`, `review`, `approved`, `scheduled`) filterbar.

### Detailansicht Freigabe (Klick auf einen Eintrag)
- **Fertige Post-Vorschau**: zeigt das verknüpfte Creative (falls vorhanden) und den Text/Hashtags nebeneinander — so, wie der fertige Post aussehen würde. Ist noch kein Creative verknüpft, erscheint ein Hinweis, eins im Creative Editor zu erstellen.
- **Freigabe-Link erstellen**: erzeugt einen öffentlichen Link (`/approve/{token}`), den der Kunde ohne Login öffnen kann, um den Entwurf zu kommentieren/freizugeben.
- **Freigabe-Aktionen**: je nach aktuellem Status stehen erlaubte Übergänge zur Verfügung (z.B. "Zur Freigabe senden", "Freigeben"). Optional kann eine Notiz mitgegeben werden. Wird ein Eintrag auf "veröffentlicht" oder "archiviert" gesetzt, schließt sich das Detailfenster automatisch und der Eintrag wandert ins Archiv.
- **Historie**: zeigt alle bisherigen Statuswechsel mit Zeitstempel und Nutzer.
- **löschen**: entfernt den Eintrag endgültig (mit Bestätigungsabfrage).

### Erlaubte Status-Übergänge
```
draft    → review, archived
review   → approved, draft, archived
approved → scheduled, published, review, archived
scheduled→ published, approved, archived
published→ archived
archived → draft
```

---

## 10. Archiv (`/archive`)

Zeigt ausschließlich **fertige, abgeschlossene Posts** — Status `published` und `archived`. Kein aktiver Freigabe-Workflow mehr, keine Freigabe-Links.

### Filter (Archiv)
Nach Kunde, Plattform und Status (`published`, `archived`) filterbar.

### Detailansicht Archiv (Klick auf einen Eintrag)
- **Fertige Post-Vorschau**: Creative + Text/Hashtags nebeneinander.
- **Historie**: alle bisherigen Statuswechsel.
- **"Zurück zum Entwurf verschoben"**: holt einen fertigen Post zurück in den Freigabe-Workflow (`/approvals`), falls er doch nochmal bearbeitet werden muss.
- **löschen**: entfernt den Eintrag endgültig (mit Bestätigungsabfrage).

---

## 11. Vorlagen (`/templates`)

Vordefinierte, wiederverwendbare Design-Vorlagen für den Creative-Editor (einfacher als der Layout Editor — feste Struktur statt freiem Layout).

- **"+ Neue Vorlage"** öffnet den visuellen Template-Builder: Name, Format, Stil-Schlüssel, Hintergrund-Muster (Grid/Diagonal/Linien/Clean), Badge-Text, Akzentfarbe, Hintergrundfarbe.
- **Vorschau mit Kunde**: Dropdown zur Auswahl, mit wessen Branding (Farben, Name, Website) die Live-Vorschau angezeigt wird. Ist ein Kunde gewählt, hat dessen Branding automatisch Vorrang vor der manuell gesetzten Vorlagenfarbe.
- **duplizieren** / **bearbeiten** / **löschen** pro Vorlage möglich.
- Vorlagen können pro Kunde oder **global** (für alle Kunden nutzbar) angelegt werden.

---

## 12. Media Library (`/media-library`)

Zentrale Bibliothek für wiederverwendbare Assets (Logos, Hintergründe, Fotos etc.), die im Creative Editor und Layout Editor als Bildquelle ausgewählt werden können.

- **Upload**: Kategorie wählen (Logo, Background, ECU, Werkstatt, Auto, Tool, Icon, Creative Export, News Image), optional Kunde zuordnen, Tags/Quelle/Lizenz-Notiz angeben, Datei hochladen (max. 10 MB, png/jpg/webp/svg/gif).
- **Filter**: nach Kategorie und Kunde.
- **Bild anklicken**: öffnet eine Lightbox mit dem Bild in voller Größe (schließen per X, Klick daneben oder Escape).
- **url kopieren** / **löschen** pro Asset.

---

## 13. Einstellungen (`/settings`)

Reine Anzeige-Seite (keine Eingaben) mit Systemstatus: Domain, API-Basis-URL, Upload-Verzeichnis, ob die KI (Claude) konfiguriert ist.

---

## Typischer Gesamt-Ablauf (Kurzfassung)

```
1. Kunde anlegen (Farben, Logo, Leistungen hinterlegen)
   → Kunden

2. News-Quelle einrichten und abrufen ODER URL manuell importieren
   → News-Quellen / News-Eingang

3. Layout-Template einmalig bauen (mit "(auto)"-Rollen für Headline/Bild/Logo)
   → Layout Editor

4a. EINZELN: News im Content-Generator zu Text machen,
    dann im Creative Editor ein passendes Bild dazu erstellen
    → Content-Generator → Creative Editor

4b. VIELE AUF EINMAL: mehrere News auswählen, Layout-Template wählen,
    Text + Creative werden automatisch für alle generiert
    → Massen-Generator

5. Im Freigabe-Bereich die fertige Vorschau (Text + Bild) prüfen,
   Freigabe-Link an den Kunden schicken, Status durch den Workflow schieben
   → Freigabe

6. Sobald veröffentlicht/archiviert: der Post wandert automatisch ins Archiv
   → Archiv

7. Bei Bedarf: PNG exportieren (Creative Editor) für den finalen Download
```
