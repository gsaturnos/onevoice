// A restrained, warm screen-print palette for "The kitchen table". Colours are
// chosen to read like a linocut / inked poster: few hues, confident contrast,
// warm candle light against a deep umber room. No neon, no gray-on-gray.
//
// Pure module (no DOM/Pixi state) so the scene view-model and tests can share it.

/** Pixi colours are 24-bit ints; CSS mirrors live in styles.css. */
export const INK = 0x241812; // warm near-black outline
export const INK_SOFT = 0x3a2a1f;

// The room, by environmental phase (deepens the shadow when the table is silent,
// warms toward candlelight as it awakens).
export const ROOM = {
  silentTop: 0x1a1310,
  silentBottom: 0x120c09,
  wakingTop: 0x2a1d15,
  wakingBottom: 0x180f0a,
  actingTop: 0x3a2717,
  actingBottom: 0x1d130c,
};

// Warm light sources.
export const LAMP = 0xf2b25a; // hanging lamp / candle core
export const LAMP_SOFT = 0xe89a44;
export const GLOW = 0xffd98a; // emitted warmth (window, halo)
export const EMBER = 0xff9d4d;

// The clarity/awareness signal — a calm teal-green, the colour of "seeing".
export const CLARITY = 0x86c9a0;
export const CLARITY_BRIGHT = 0xa8e6bf;

// The player: warm brass candlelight, never a cold accent.
export const YOU = 0xf0c057;
export const YOU_SOFT = 0xc79a3e;

// Furniture / wood.
export const WOOD = 0x6b4a2e;
export const WOOD_DARK = 0x4a3120;
export const WOOD_LIGHT = 0x8a6238;
export const CLOTH = 0xb98a4e; // tablecloth / warm linen

// A small, confident cast palette for clothing so silhouettes stay distinct.
// Muted, earthen, screen-print inks — each character gets one.
export const GARMENTS: number[] = [
  0xc56a4a, // terracotta
  0xcf9b52, // ochre
  0x5f7488, // dusty blue
  0x7d4f63, // plum
  0x7c7b4a, // olive
  0xa2483d, // brick red
  0x4f7061, // pine
  0x9a6b3f, // caramel
  0x86556e, // mauve
  0x557089, // slate blue
  0xb07a3e, // amber brown
  0x6d6b8a, // muted indigo
];

// Skin tones (warm, varied, screen-print flat).
export const SKINS: number[] = [
  0xe6b98f, 0xc98f63, 0xa86c44, 0xe0aa80, 0xbb865a, 0x915832,
  0xd9a373, 0xcf9a6c, 0xb07a4e, 0xe3b487, 0xa9713f, 0xc38a5b,
];

// Hair inks.
export const HAIRS: number[] = [
  0x2a1c12, 0x4a2f1c, 0x6b4a2a, 0x3a3a3f, 0x836b52, 0x1e1512,
  0x5a3a22, 0x2f2622, 0x7a6650, 0x3d2a1c, 0x25201e, 0x55381f,
];

/** Linear blend between two 24-bit colours; t in [0,1]. */
export function mix(a: number, b: number, t: number): number {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** A person's warmth colour: fearful slate → clear teal as awareness rises. */
export function warmth(aw: number): number {
  return mix(0x6a6d75, CLARITY_BRIGHT, aw);
}

/** Deterministic small hash so a character's palette is stable across frames. */
export function pick<T>(arr: T[], seed: number): T {
  return arr[((seed % arr.length) + arr.length) % arr.length];
}
