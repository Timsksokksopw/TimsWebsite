// Fotos werden automatisch aus src/assets/fotos/<ordner>/ geladen.
// Neues Bild in den passenden Ordner legen → erscheint in der Galerie der Seite.
// Optional hier eine Bildunterschrift ergänzen (Schlüssel = Dateiname ohne Endung).
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/fotos/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG}', { eager: true });

export const captions: Record<string, string> = {
  'tim-portrait': 'Tim Biedermann',
  'tim-anzug': 'Tim im Anzug',
  'tim-studio': 'Studioportrait',
  'studio-ibanez-nah': 'Im Studio: die blaue Ibanez',
  'studio-session': 'Recording-Session mit Kopfhörer und Cap',
  'ibanez-kopfplatte': 'Kopfplatte der Ibanez Prestige',
  'akustik-im-weinland': 'Gitarre auf dem Bänkli',
  'tim-als-kind': 'Die Anfänge: erste Ibanez',
  'tim-live-cap': 'Live mit Cap und Sonnenbrille',
  'live-drei-gitarren': 'Los Trios live: drei Gitarren, drei Krawatten',
  'tim-live-pilotenbrille': 'Auf der Bühne mit Los Trios',
  'waldhof-live': 'Los Trios am Waldhoffest in Andelfingen',
  'snowboard-nebelmeer': 'Über dem Nebelmeer',
  'snowboard-duo': 'Gipfelpose',
  'snowboard-pause': 'Der Snowboard-Versuch',
  'golf-range': 'Auf der Driving Range',
  'laufen': 'Laufrunde im Wald',
  'wandern-tal': 'Unterwegs in den Bergen',
  'hund-auf-der-alp': 'Begleitung auf der Alp',
  'rheinfall': 'Am Rheinfall',
};

export interface Foto {
  src: ImageMetadata;
  name: string;
  alt: string;
}

const pretty = (n: string) => n.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** Alle Fotos aus einem oder mehreren Unterordnern von src/assets/fotos */
export function fotos(...folders: string[]): Foto[] {
  return Object.entries(files)
    .filter(([p]) => folders.some((f) => p.includes(`/fotos/${f}/`)))
    .map(([p, m]) => {
      const name = p.split('/').pop()!.replace(/\.[^.]+$/, '');
      return { src: m.default, name, alt: captions[name] ?? pretty(name) };
    });
}

export function foto(name: string): Foto {
  const hit = Object.entries(files).find(([p]) => p.split('/').pop()!.replace(/\.[^.]+$/, '') === name);
  if (!hit) throw new Error(`Foto nicht gefunden: ${name}`);
  return { src: hit[1].default, name, alt: captions[name] ?? pretty(name) };
}
