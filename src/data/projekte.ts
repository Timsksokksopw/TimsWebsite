// Wendico-Projekte für das 3D-Karussell auf der Arbeit-Seite.
// Neues Projekt: Screenshot (3:2) nach src/assets/projekte/ legen und hier eintragen.
import type { ImageMetadata } from 'astro';

const shots = import.meta.glob<{ default: ImageMetadata }>('../assets/projekte/*.{png,jpg,jpeg,webp}', { eager: true });
const shot = (file: string) => {
  const hit = Object.entries(shots).find(([p]) => p.endsWith(`/${file}`));
  if (!hit) throw new Error(`Screenshot fehlt: ${file}`);
  return hit[1].default;
};

export const projekte = [
  { name: 'TTC Neuhausen', tag: 'Verein', url: 'https://www.ttc-neuhausen.ch/', img: shot('ttc-neuhausen.png') },
  { name: 'Los Trios', tag: 'Band', url: 'https://lostrios.ch/', img: shot('lostrios.png') },
  { name: 'Mini Tank', tag: 'Sport', url: 'https://mini-tank.ch/', img: shot('miniTank.png') },
  { name: 'Panat Ruangsri', tag: 'Portfolio', url: 'https://www.ruangsri.ch/panat', img: shot('panatruangsri.png') },
  { name: 'SC Beauty Luxe', tag: 'Beauty', url: 'https://scbeautyluxe.com/', img: shot('scbeautyluxe.png') },
  { name: 'Asia Food Festival', tag: 'Event', url: 'https://www.asiafoodfestival.ch/', img: shot('tresch-asia-events.png') },
  { name: 'Alija Gebäudereinigung', tag: 'Service', url: 'https://alija-gebaeudereinigung.ch/', img: shot('alija.png') },
  { name: 'Ryu Vogler', tag: 'Portfolio', url: 'https://ryuvogler.com/', img: shot('ryuvogler.png') },
  { name: 'Elegant Society', tag: 'Brand', url: 'https://elegantsociety.ch/', img: shot('elegantsociety.png') },
  { name: 'Weinland Esskultur', tag: 'Gastronomie', url: 'https://weinlandesskultur.ch/', img: shot('weinlandesskultur.png') },
  { name: 'Rebthai', tag: 'Gastronomie', url: 'https://weinlandesskultur.ch/pages/rebthai.html', img: shot('rebthai.png') },
  { name: 'Thai Lodge', tag: 'Gastronomie', url: 'https://weinlandesskultur.ch/pages/thaiLodge.html', img: shot('thailodge.png') },
  { name: 'Thai Helping Point', tag: 'Information', url: 'https://thaihelpingpoint.ch/', img: shot('thaihelpingpoint.png') },
];
