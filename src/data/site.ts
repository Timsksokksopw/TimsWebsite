// Zentrale Angaben – hier ändern, dann stimmt es auf allen Seiten.
export const site = {
  name: 'Tim Biedermann',
  tagline: 'Websites, Software und Plattformen',
  description:
    'Tim Biedermann baut Websites, Software und Plattformen: Mitgründer der Digitalagentur Wendico und Plattformentwickler bei Swisscom.',
  contact: {
    phoneDisplay: '+41 79 502 76 98',
    phoneHref: 'tel:+41795027698',
    linkedin: 'https://www.linkedin.com/in/tim-biedermann-ba5b35286/',
    // TODO Tim: Instagram-Handle eintragen (ohne @). Solange leer, wird der Link nicht angezeigt.
    instagram: '',
  },
  links: {
    wendico: 'https://wendico.ch',
    /** 30-Minuten-Erstgespräch bei Wendico */
    wendicoTermin: 'https://wendico.ch/kontakt#termin-buchen',
    wendicoLeistungen: 'https://wendico.ch/dienstleistungen',
    lostrios: 'https://lostrios.ch',
    lostriosSpotify: 'https://open.spotify.com/intl-de/artist/42PNTaZH3PRg9yJka15HdF',
    lostriosInstagram: 'https://www.instagram.com/lostrios_band',
    lostriosYoutube: 'https://www.youtube.com/@lostrios_band',
    ttc: 'https://www.ttc-neuhausen.ch/',
  },
};

export interface NavItem {
  /** Schlüssel für das Vorschaubild im Menü */
  key: string;
  label: string;
  href?: string;
  children?: { label: string; href: string }[];
}

// Reihenfolge im Menü: Business zuerst, Freizeit am Schluss.
export const nav: NavItem[] = [
  { key: 'wendico', label: 'Wendico', href: '/wendico/' },
  { key: 'arbeit', label: 'Arbeit', href: '/arbeit/' },
  { key: 'ueber', label: 'Über mich', href: '/ueber-mich/' },
  {
    key: 'freizeit',
    label: 'Freizeit',
    children: [
      { label: 'Musik', href: '/musik/' },
      { label: 'Sport', href: '/sport/' },
    ],
  },
  { key: 'kontakt', label: 'Kontakt', href: '/kontakt/' },
];

/** alle Seiten als flache Liste, z. B. für die Fusszeile */
export const navFlat = nav.flatMap((n) => n.children ?? (n.href ? [{ label: n.label, href: n.href }] : []));
