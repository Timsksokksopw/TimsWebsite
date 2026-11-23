// Zugriff auf den Loader für Seiten und 3D-Szenen. Die Steuerung selbst steht als Inline-Skript
// in src/components/Loader.astro (window.__tb), damit sie vor allen Skript-Dateien läuft.
// Seiten melden Ladeaufgaben mit loader.track(name, promise) an. Der Loader läuft bei jedem Seitenaufruf;
// fehlt er einmal (z. B. Seite aus dem Zurück-Cache des Browsers), ist alles sofort «fertig».

export interface LoaderApi {
  /** läuft der Loader bei diesem Seitenaufruf? */
  readonly active: boolean;
  /** Aufgabe anmelden; sie zählt als erledigt, sobald das Promise fertig ist (auch bei Fehler) */
  track(name: string, promise: Promise<unknown>): void;
  /** ruft fn auf, sobald der Loader weg ist (sofort, wenn keiner läuft) */
  whenDone(fn: () => void): void;
  readonly finished: boolean;
  /** angezeigter Fortschritt 0 … 1 */
  readonly progress: number;
  readonly tasks: Record<string, boolean>;
}

const idle: LoaderApi = {
  active: false,
  track() {},
  whenDone: (fn) => fn(),
  finished: true,
  progress: 1,
  tasks: {},
};

export const loader: LoaderApi = (window as any).__tb ?? idle;
