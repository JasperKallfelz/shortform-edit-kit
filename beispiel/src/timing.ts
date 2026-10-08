// Zeitpunkte des (gedachten) Voiceovers – die einzige Stelle, an der Zeiten stehen.
// In einem echten Projekt wird diese Datei aus der Sprachaufnahme erzeugt (Wort-Ausrichtung per Whisper o. Ä.) und nicht von Hand gepflegt;
// ein neuer Take ergibt eine neue Datei, und Bild und Ton wandern von selbst mit. Hier stehen Beispielwerte, damit die Demo auch ohne Aufnahme getaktet läuft.
// Jede Zahl = Beginn des Wortes in Millisekunden ab Start der Audiodatei.
export const VO = {
  /** Länge des Videos in ms */
  endMs: 9000,
  w: {
    // Szene 1: "this is your hook, hello"
    thisIs: 300, yourHook: 800, hello: 1450,
    // Szene 2: "look at these numbers"
    look: 3000, numbers: 3400,
    // Szene 3: "I'm Your Name, thanks for watching"
    im: 6000, yourName: 6300, thanks: 7400,
  },
};
