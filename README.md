# Tim Biedermann – persönliche Website

Statische Website mit [Astro](https://astro.build) und [Three.js](https://threejs.org).
Acht Seiten: Start, Wendico, Arbeit, Über mich, Musik, Sport, Kontakt und eine 404-Seite.
Business steht vorne (Wendico, Swisscom); Musik und Sport liegen im Menü unter «Freizeit».

## Starten

```bash
npm install      # nur beim ersten Mal
npm run dev      # Entwicklung: http://localhost:4321
npm run build    # fertige Website im Ordner dist/
npm run preview  # dist/ lokal ansehen
```

Der Ordner `dist/` kann auf jedes Hosting geladen werden (Hostpoint, Cloudflare Pages, Vercel …).

## Inhalte ändern

| Was | Wo |
| --- | --- |
| Kontaktangaben, Links, Menü-Einträge | `src/data/site.ts` |
| Vorschaubilder im Menü | `src/components/Nav.astro` → `sources` |
| Logo (das goldene T) | `src/data/logo.ts` |
| Texte der Startseite und ihrer vier Türen | `src/pages/index.astro` |
| Leistungen auf der Wendico-Seite | `src/pages/wendico.astro` → `leistungen` |
| Instagram-Handle (noch leer) | `src/data/site.ts` → `contact.instagram` |
| Texte einer Seite | `src/pages/<seite>.astro` |
| Bildunterschriften | `src/data/fotos.ts` |
| Wendico-Projekte im Karussell | `src/data/projekte.ts` + Screenshot (3:2) in `src/assets/projekte/` |
| Farben und Schriften, auch die der einzelnen Welten | `src/styles/global.css` (ganz oben) |
| Fotos und Texte auf dem Foto-Tisch (Über mich) | `src/assets/fotos/persoenlich/` und `src/data/momente.ts` |

## Neue Fotos

Bild in den passenden Ordner legen, fertig. Die Galerien laden alles automatisch
und erzeugen beim Build verkleinerte WebP-Versionen.

- `src/assets/fotos/musik/` und `band/` → Galerie auf der Musik-Seite
- `src/assets/fotos/sport/` → Galerie auf der Sport-Seite
- `src/assets/fotos/persoenlich/` → Foto-Tisch auf «Über mich» (siehe unten)
- `src/assets/fotos/portrait/`, `natur/` → werden gezielt in Seiten eingebunden

Dateinamen ohne Leerzeichen und Umlaute wählen, zum Beispiel `gig-waldhof-2027.jpg`.
Die Originale aus der ersten Lieferung liegen weiterhin unverändert in `Bilder/`.

## Foto-Tisch auf «Über mich»

Fotos zum Anfassen, Werfen, Umdrehen und Ordnen (Streuen, Stapel, Fächer, Raster, Nach Thema), mit Filter nach Thema.

- **Neues Foto:** Bild nach `src/assets/fotos/persoenlich/` legen. Es erscheint automatisch, der Dateiname wird zur Bildunterschrift.
- **Titel, Thema, Ort und Text für die Rückseite:** in `src/data/momente.ts` unter `angaben` eintragen (Schlüssel = Dateiname ohne Endung).
- **Fotos aus anderen Ordnern** (z. B. `sport/`) liegen auf dem Tisch, sobald sie in `angaben` stehen.
- **Neues Thema:** in `themen` in derselben Datei ergänzen.

Aufbau: `src/components/Momente.astro` (Markup und Aussehen) und `src/scripts/momente.ts` (Anordnungen und Bewegung).

## Loader

Bei jedem Seitenaufruf zeichnet sich das Logo-T und füllt sich mit Gold, bis Schriften, Fotos und 3D-Szenen der Seite bereit sind.
Beim ersten Besuch einer Sitzung bleibt er mindestens 1,3 Sekunden stehen, bei jedem weiteren Seitenwechsel mindestens 0,6,
höchstens aber 7 Sekunden (`MIN_MS`, `MAX_MS` in `src/components/Loader.astro`).
Eigene Ladeaufgaben meldet man mit `loader.track(name, promise)` aus `src/scripts/loader.ts` an.
Die lange Fassung nochmals ansehen: Browser-Tab schliessen und neu öffnen.

## Welten: ein Rahmen, mehrere Stile

Die Idee der Website: ein Mensch, mehrere Welten. Der Rahmen ist überall gleich (Leiste mit dem goldenen T,
Vollbild-Menü, Fusszeile, Fliesstext in Schibsted Grotesk). Farben und Titelschrift wechseln je nach Welt.

| Welt | Wo | Farben | Titelschrift |
| --- | --- | --- | --- |
| Grundton | alle Seiten ohne eigene Welt | Weiss, Tinte `#16181d`, Gold nur für das Logo und kleine Details | Schibsted Grotesk |
| Swisscom | Seite `/arbeit/` und Tür auf der Startseite | Weiss, Navy `#001155`, Blau `#0445c8`; bewusst ohne Swisscom-Logo | Schibsted Grotesk 700 |
| Wendico | Seite `/wendico/` und Tür auf der Startseite | Waldgrün `#14231d`, Lime `#d8ff71`, Grund `#f4f7f4` wie auf wendico.ch | Manrope, Text in DM Sans |
| Los Trios | Seite `/musik/` und Tür auf der Startseite | nur Schwarz und Weiss; Fotos schwarz-weiss, farbig erst beim Überfahren; farbig ist sonst nur die Gitarre | Libre Bodoni kursiv (wie im Bandlogo) |
| Sport | Tür auf der Startseite und Seite `/sport/` | Weiss, Tinte `#111`, Orange `#fa5a1e` vom Ski-Helm | Archivo, schmal und fett |

- **Welt einer Seite setzen:** `<Base world="sport">`. Das schreibt `data-world` auf `<html>`; die Farben dazu stehen in
  `src/styles/global.css` im Block `:root[data-world='sport']`. Eine neue Welt braucht dort einen Block und einen Eintrag
  im Typ von `world` in `src/layouts/Base.astro`.
- **Schriften:** Jede Seite lädt nur, was sie braucht, über einen Import oben in der Seite
  (z. B. `import '@fontsource-variable/archivo/wdth.css'`). Die Namen stehen als `--font-sport`, `--font-wendico`,
  `--font-wendico-body` und `--font-lostrios` in `global.css`. Mono-Schrift gibt es nur für Tasten und Anzeige der Gitarre.
- **Orange und Kontrast:** Weisse Schrift auf Orange ist nur für sehr grosse Wörter gedacht. Text und Knöpfe auf Orange
  stehen in Tinte, orange Schrift in normaler Grösse nimmt `--orange-deep`.
- **Welten in Seiten:** Auf der Wendico-Seite wechselt nur der Inhalt (`main`) auf Manrope und DM Sans, Leiste, Menü und Fusszeile bleiben im gemeinsamen Rahmen. Die Musik-Seite trägt zusätzlich `theme="stage"` (dunkles Farbschema); der Block `lostrios` steht in `global.css` deshalb nach dem Block `stage`.
- **Leiste über dunklen Abschnitten:** Abschnitte mit `data-nav-tone="dark"` beschriften die Leiste automatisch hell.

Bewusst weggelassen, weil es schnell nach Vorlage aussieht: kleine Labels über jeder Überschrift, Nummern 01/02/03 ohne
echte Reihenfolge, Pfeile hinter Links, mit Mittelpunkten verkettete Angaben, einzelne farbige Wörter in Überschriften
und Einblenden bei jedem Abschnitt. Umgesetzt auf Startseite, Sport, Arbeit, Wendico und Musik; «Über mich» und «Kontakt» folgen.

## 3D-Szenen

Alle Szenen liegen in `src/scripts/three/` und sind komplett im Code gebaut (keine 3D-Dateien):

| Datei | Szene |
| --- | --- |
| `hero.ts` | Startseite, Einstieg: Gitarrenfoto mit Tiefeneffekt und Glas-Schriftzug «BIEDERMANN» |
| `logo.ts` | das Logo-T als 3D-Objekt, aus denselben Pfaden wie das flache Logo |
| `stack-model.ts` | Plattform-Stack als Modell (Arbeit-Seite) |
| `guitar-model.ts` | das Gitarrenmodell (Korpus, Hals, Tremolo, Regler, Kopfplatte) |
| `music.ts` | Bühne und Bedienung: Saiten, Griffbrett, Tremolohebel, Regler, Looper, Einpassen ins Layout |
| `audio.ts` | Sound: Saiten-Synthese, Effektpedale, Begleitband, Akkorde, Licks und Riffs |
| `mountain.ts` | Berg mit Skilift, Skifahrern/Bikern und Winter/Sommer-Schalter; passt Grösse und Lage ans Fenster an |
| `pingpong.ts` | Tischtennis-Minispiel im orangen Block der Sport-Seite |
| `work.ts` | Plattform-Stack (Arbeit, in Swisscom-Farben) und Projekt-Karussell (Wendico, die Karten blenden am Rand ins Waldgrün aus) |
| `viewer.ts`, `objects.ts`, `cap.ts` | einzelne Objekte (Cord-Cap, Plektrum, Golfball …) |

### Startseite: Türen in die Welten

Alles steht in `src/pages/index.astro`:

1. **Einstieg:** das Gitarrenfoto (`akustik-im-weinland`) mit dem Glas-Schriftzug, Name und Kurztext direkt auf dem Bild.
2. **Auftakt:** «Wo du mich findest.» mit den vier Welten als Sprungmarken, jede in ihrer eigenen Schrift.
3. **Vier Türen:** Swisscom, Wendico, Los Trios und Sport. Jede Tür ist ein fensterhoher Abschnitt im Stil ihrer Welt
   und führt auf die passende Seite.
4. **Gerade aktuell** (Liste `notizen`, neueste zuerst) und die Karte zum Erstgespräch.

Beim Scrollen bleibt jede Tür oben stehen und die nächste schiebt sich darüber (`position: sticky`, Klasse `is-stack`,
gesetzt im Skript am Ende der Seite). Ist eine Tür höher als das Fenster, etwa am Handy, bleibt sie erst stehen, wenn ihr
unteres Ende erreicht ist. Bei «Bewegung reduzieren» und ohne JavaScript stehen die Türen normal untereinander.

- **Anderes Einstiegsfoto:** in `index.astro` bei `heroFoto` den Namen ändern und bei `initHero` den Bildausschnitt
  (`focus`) anpassen. Das Foto wird nur einmal geladen: Das `<img>` dient zugleich als Textur für den Glas-Effekt.
- **Neue Tür:** einen weiteren `<section class="door …">` in `.doors` einfügen und im Auftakt verlinken.

### Sport-Seite

`src/pages/sport.astro`, in dieser Reihenfolge:

1. **Einstieg:** der drehbare Berg, dahinter gross das Wort der Jahreszeit («Winter» oder «Sommer»). Der Schalter links
   unten wechselt Wort, Text und Szene. Die Szene meldet die Höhe des Gipfels als `--peak-y`, damit das Wort in jeder
   Fenstergrösse hinter dem Gipfel steht, und rückt die Insel so, dass sie Titel und Schalter nie überdeckt.
2. **Motivation** und das dunkle Band mit den Zahlen.
3. **Sportarten als Blöcke:** Ski gross, danach die Liste `blocks` oben in der Datei. Ein Block ohne Foto
   (`img: null`) wird dunkel. Reihenfolge und Texte ändert man dort.
4. **Tischtennis:** der orange Block mit Liga, Link zum TTC Neuhausen und dem Spiel «Halt den Ball oben.».
5. **Galerie:** alle Fotos aus `src/assets/fotos/sport/`.

### Logo ändern

Das T besteht aus drei Pfaden in `src/data/logo.ts` (linker Arm, rechter Arm, Stamm; Zeichenfläche 118 × 148).
Header, Menü, 3D-Logo und Plektren übernehmen Änderungen automatisch.
Nur `public/favicon.svg` enthält eine eigene Kopie der Pfade und muss von Hand nachgezogen werden.

### Gitarre: Tasten

| Taste | Funktion |
| --- | --- |
| `1` bis `8` | Akkord wählen (nochmals drücken = offene Saiten) |
| `A S D F G H` | einzelne Saiten, tiefe E bis hohe E |
| Leertaste | Akkord anschlagen |
| `Q` / `W` | Solo / Riff |
| `E` | Looper: aufnehmen, abspielen, löschen |
| `R` | Band (Schlagzeug und Bass) starten oder stoppen |
| `T` | Palm Mute |
| `X` halten | Tremolohebel drücken |

Akkorde, Solo-Licks und Riffs stehen am Ende von `audio.ts` und lassen sich dort ergänzen.
Die Akkordfolge der Band (`Em · C · G · D`) steht in der Klasse `Band` in derselben Datei.
