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
| Texte und Kapitel der Startseite | `src/pages/index.astro` |
| Leistungen auf der Wendico-Seite | `src/pages/wendico.astro` → `leistungen` |
| Instagram-Handle (noch leer) | `src/data/site.ts` → `contact.instagram` |
| Texte einer Seite | `src/pages/<seite>.astro` |
| Bildunterschriften | `src/data/fotos.ts` |
| Wendico-Projekte im Karussell | `src/data/projekte.ts` + Screenshot (3:2) in `src/assets/projekte/` |
| Farben und Schrift | `src/styles/global.css` (ganz oben) |
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

## Schrift

Eine Familie für alles: Schibsted Grotesk (über `@fontsource-variable/schibsted-grotesk`). Hervorhebungen in Überschriften
stehen in `<em>` und erscheinen in der Akzentfarbe statt kursiv. Mono-Schrift gibt es nur noch für Tasten und Anzeige der Gitarre.

## 3D-Szenen

Alle Szenen liegen in `src/scripts/three/` und sind komplett im Code gebaut (keine 3D-Dateien):

| Datei | Szene |
| --- | --- |
| `hero.ts` | Startseite, Einstieg: Gitarrenfoto mit Tiefeneffekt und Glas-Schriftzug «BIEDERMANN» |
| `goldstaub/` | Startseite: Scroll-Story, in der Goldstaub von Form zu Form fliegt (Details unten) |
| `logo.ts` | das Logo-T als 3D-Objekt, aus denselben Pfaden wie das flache Logo |
| `stack-model.ts` | Plattform-Stack als Modell (Startseite und Arbeit-Seite) |
| `guitar-model.ts` | das Gitarrenmodell (Korpus, Hals, Tremolo, Regler, Kopfplatte) |
| `music.ts` | Bühne und Bedienung: Saiten, Griffbrett, Tremolohebel, Regler, Looper, Einpassen ins Layout |
| `audio.ts` | Sound: Saiten-Synthese, Effektpedale, Begleitband, Akkorde, Licks und Riffs |
| `mountain.ts` | Berg mit Skilift, Skifahrern/Bikern und Winter/Sommer-Schalter |
| `pingpong.ts` | Tischtennis-Minispiel |
| `work.ts` | Plattform-Stack und Projekt-Karussell |
| `viewer.ts`, `objects.ts`, `cap.ts` | einzelne Objekte (Cord-Cap, Plektrum, Golfball …) |

### Startseite: vom Tag in den Abend

Die Startseite hat vier Teile, alle in `src/pages/index.astro`:

1. **Tag:** heller Einstieg mit dem Gitarrenfoto (`akustik-im-weinland`), dem Glas-Schriftzug und Name mit Kurztext direkt auf dem Bild.
2. **Dämmerung:** Farbverlauf von hell zu dunkel, davor steigen Goldfunken auf (`src/scripts/dusk.ts`).
3. **Abend:** die Goldstaub-Story (siehe unten).
4. **Morgen:** kurzer Verlauf zurück ins Helle, dann «Gerade aktuell» und die Fusszeile.

Ein anderes Einstiegsfoto: in `index.astro` bei `heroFoto` den Namen ändern und bei `initHero` den Bildausschnitt (`focus`) anpassen.
Abschnitte mit dunklem Hintergrund tragen `data-nav-tone="dark"`; dort beschriftet sich die Leiste oben automatisch hell.

### Goldstaub-Story

Die Scrollposition steuert alles. Fünf Kapitel, dazwischen zerfällt das Objekt zu Goldstaub
und setzt sich neu zusammen: Logo-T → Browserfenster (Wendico) → Plattform-Stack (Swisscom)
→ Portrait → Plektrum (Freizeit).

| Datei in `goldstaub/` | Aufgabe |
| --- | --- |
| `timeline.ts` | Länge der Kapitel und Übergänge (`HOLDS`, `MORPH`, in Bildschirmhöhen) |
| `shapes.ts` | die fünf Objekte und ihre Gold-/Anthrazit-Materialien |
| `sampling.ts` | macht aus Objekten und dem Portraitfoto Punktwolken |
| `dust.ts` | die Partikel und ihr Flug von Form zu Form |
| `dissolve.ts` | löst die massiven Objekte passend zum Staub auf |
| `index.ts` | Bühne, Licht, Layout, Scroll, Texte, Kapitelanzeige |

Welche Projekt-Screenshots im Browserfenster laufen, steht in `src/pages/index.astro` (`shotProjects`).
Das Portrait ist `src/assets/fotos/portrait/tim-studio.jpg`; ein neues Foto sollte einen ruhigen, einfarbigen Hintergrund haben.
Ohne WebGL stehen die Kapitel einfach untereinander; bei «Bewegung reduzieren» wechseln die Objekte ohne Partikel.

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
