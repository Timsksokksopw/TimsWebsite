// Foto-Tisch auf «Über mich».
// Gezeigt werden alle Bilder aus src/assets/fotos/persoenlich/ und zusätzlich die unten bei
// `ausAnderenOrdnern` genannten Fotos (damit Bilder nicht doppelt abgelegt werden müssen).
// Pro Foto lassen sich hier Titel, Thema, Ort/Datum und ein Satz für die Rückseite eintragen.
// Schlüssel ist der Dateiname ohne Endung. Fehlt ein Eintrag, wird der Dateiname zum Titel
// und das Foto landet im Thema «Sonstiges».
import { fotos, foto, captions, type Foto } from './fotos';

/** Reihenfolge der Themen in Filter und Anordnung «Nach Thema» */
export const themen = ['Musik', 'Sport', 'Draussen', 'Früher', 'Sonstiges'] as const;
export type Thema = (typeof themen)[number];

export interface MomentInfo {
  titel?: string;
  thema?: Thema;
  /** Ort und/oder Datum, erscheint klein auf der Rückseite */
  wo?: string;
  /** ein Satz für die Rückseite */
  text?: string;
}

export const angaben: Record<string, MomentInfo> = {
  'akustik-im-weinland': { titel: 'Bänkli mit Aussicht', thema: 'Musik', text: 'Gitarre, Bank, Abendlicht. Mehr braucht es nicht.' },
  'tim-live-cap': { titel: 'Auf der Bühne', thema: 'Musik', text: 'Mit Los Trios, Cap und Sonnenbrille.' },
  'studio-session': { titel: 'Im Studio', thema: 'Musik', text: 'Kopfhörer auf, Take läuft.' },
  'waldhof-live': { titel: 'Waldhoffest', thema: 'Musik', wo: 'Andelfingen', text: 'Drei Gitarren nebeneinander.' },
  'tim-als-kind': { titel: 'Früh übt sich', thema: 'Früher', text: 'Die erste Ibanez, fast so gross wie ich.' },
  'golf-range': { titel: 'Driving Range', thema: 'Sport', text: 'Noch ein Korb Bälle.' },
  'laufen': { titel: 'Laufrunde', thema: 'Sport', text: 'Kopf lüften nach einem Tag am Bildschirm.' },
  'snowboard-duo': { titel: 'Gipfelpose', thema: 'Sport', text: 'Der Snowboard-Versuch. Eigentlich fahre ich Ski.' },
  'snowboard-nebelmeer': { titel: 'Über dem Nebelmeer', thema: 'Draussen', text: 'Oben Sonne, unten Nebel.' },
  'wandern-tal': { titel: 'In den Bergen', thema: 'Draussen', text: 'Weite Täler und viel frische Luft.' },
  'hund-auf-der-alp': { titel: 'Bergbegleitung', thema: 'Draussen', text: 'Unterwegs auf der Alp.' },
  'rheinfall': { titel: 'Rheinfall', thema: 'Draussen', wo: 'Neuhausen', text: 'Gleich um die Ecke.' },
};

/** Fotos aus anderen Ordnern, die ebenfalls auf dem Tisch liegen */
export const ausAnderenOrdnern = Object.keys(angaben);

export interface Moment extends Required<Pick<MomentInfo, 'titel' | 'thema'>> {
  foto: Foto;
  wo: string;
  text: string;
}

export function momente(): Moment[] {
  const seen = new Set<string>();
  const list: Foto[] = [];
  for (const f of [...fotos('persoenlich'), ...ausAnderenOrdnern.map((n) => foto(n))]) {
    if (seen.has(f.name)) continue;
    seen.add(f.name);
    list.push(f);
  }
  return list.map((f) => {
    const a = angaben[f.name] ?? {};
    return { foto: f, titel: a.titel ?? captions[f.name] ?? f.alt, thema: a.thema ?? 'Sonstiges', wo: a.wo ?? '', text: a.text ?? '' };
  });
}
