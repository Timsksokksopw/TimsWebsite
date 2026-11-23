// Das Logo: ein kalligrafisches T, nachgezeichnet nach Tims goldenem T von timswebi.ch.
// Diese Pfade sind die einzige Quelle: Header, Favicon und das 3D-T auf der Startseite nutzen sie.
// Zum Ändern: Pfade in einem Vektorprogramm (viewBox 118 × 148) anpassen und hier einsetzen.
// Die drei Teile überlappen sich absichtlich; in 3D liegt der Stamm vor den Armen.

export const T_SIZE = { w: 118, h: 148 };
export const T_VIEWBOX = `0 0 ${T_SIZE.w} ${T_SIZE.h}`;

export const T_PARTS = {
  /** linker Arm: eingerollte Klaue */
  left: 'M4.4 23.1 C14 22.5 24 18 33 13.2 C40 9.6 50 9.4 60 13.5 L62 24 C52 22.5 40.500 23 33 26.500 C25.500 30 23 39 28.800 49.700 C20 46 12 37 9.500 30 C8 26.500 6.500 24.500 4.400 23.100 Z',
  /** rechter Arm: Welle mit hochgezogener Spitze und Sporn */
  right:
    'M62 16 L70 18.700 C76 21 82 28.500 92 30 C101 31.200 109 26 113.600 14.500 C117.500 23.500 116.500 33.500 110 39.500 C104.500 44.500 97 46 90.500 45.600 C89 50 87 54.500 83.400 57.900 C82.500 51 78.500 43 70.200 36 L62 34 Z',
  /** Stamm: Spitze oben, Sporn und spitzer Fuss unten */
  stem: 'M69.600 2.800 C70.600 8 70.200 14 70.200 19.800 L70 110 C70 114.500 73 117.500 77.800 119.400 C66 123 55 133 48.700 146.100 C50.200 141 50.900 137 50.900 134.200 L50.600 34 C50.600 29 47.500 25.500 42 23.700 C52 20 62.500 12.500 69.600 2.800 Z',
};

/** hellere Facette auf der rechten Stammhälfte – gibt dem flachen Logo den geschliffenen Look */
export const T_FACET =
  'M69.600 2.800 C70.600 8 70.200 14 70.200 19.800 L70 110 C70 114.500 73 117.500 77.800 119.400 C66 123 55 133 48.700 146.100 C54 136 60.500 128 61 118 L61.600 30 C61.800 20 65 10 69.600 2.800 Z';

export const T_PATH = [T_PARTS.left, T_PARTS.right, T_PARTS.stem].join(' ');
