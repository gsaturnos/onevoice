// Single source of truth for the kitchen-table cast: 12 distinct neighbours and a
// layered-SVG builder that draws each one as a screen-print / cut-paper bust in
// three awareness states (afraid → listening → clear). Distinct BY SHAPE, not
// colour: body girth, shoulder width, head shape, hair, headwear, garment cut,
// prop, posture and expression all vary per person, so a colour-blind player (or
// a greyscale print) still tells them apart. Ordinary neighbours — no heroes,
// mascots or soldiers. Translated from the approved reference sheets, never copied.
//
// Used by tools/gen-characters.mjs (rendered to the sprite atlas) and mirrored at
// runtime through the generated manifest. Pure string output, no DOM.

export const STATES = ['afraid', 'listening', 'clear'];

// --- palette (kept in sync with src/render/palette.ts hex values) ---
const INK = '#241812';
const INK2 = '#3a2a1f';
const GLOW = '#ffd98a';
const CLARITY = '#a8e6bf';

// Twelve neighbours. Every field is chosen to make the SILHOUETTE distinct.
// build: {h: height mult, girth: torso width mult, sh: shoulder slope, neck: len}
// head: 'round'|'oval'|'long'|'square'|'soft'
export const CAST = [
  { id: 'nurse',      role: 'nurse',        age: 'adult', skin: '#a86c44', hair: { style: 'curlyShort', color: '#2a1c12' },
    build: { h: 1.0, girth: 0.98, sh: 0.5, neck: 1 }, head: 'round',
    garment: { kind: 'scrubs', color: '#4f7a7e', color2: '#3c5f63' }, headwear: 'none', glasses: false,
    prop: 'stethoscope', mobility: 'none', player: true },
  { id: 'postman',    role: 'retired postman', age: 'elder', skin: '#7a4e2e', hair: { style: 'bald', color: '#d8d2c4' },
    build: { h: 1.08, girth: 0.9, sh: 0.35, neck: 1.15 }, head: 'long',
    garment: { kind: 'vest', color: '#4a5a72', color2: '#33465e' }, headwear: 'flatcap', glasses: false,
    prop: 'satchel', mobility: 'cane', player: false },
  { id: 'bookseller', role: 'bookseller',   age: 'adult', skin: '#e3b487', hair: { style: 'bunGlasses', color: '#a2482d' },
    build: { h: 0.94, girth: 0.9, sh: 0.55, neck: 1 }, head: 'oval',
    garment: { kind: 'cardigan', color: '#4f7061', color2: '#3a564b' }, headwear: 'none', glasses: true,
    prop: 'books', mobility: 'wheelchair', player: false },
  { id: 'baker',      role: 'baker',        age: 'adult', skin: '#cf9a6c', hair: { style: 'moustache', color: '#2f2622' },
    build: { h: 0.98, girth: 1.22, sh: 0.6, neck: 0.8 }, head: 'round',
    garment: { kind: 'apronBaker', color: '#c8bca6', color2: '#8a6238' }, headwear: 'bakerHat', glasses: false,
    prop: 'bread', mobility: 'none', player: false },
  { id: 'student',    role: 'student',      age: 'young', skin: '#c98f63', hair: { style: 'wavyMed', color: '#25201e' },
    build: { h: 0.92, girth: 0.88, sh: 0.5, neck: 1.05 }, head: 'soft',
    garment: { kind: 'hoodie', color: '#5f7488', color2: '#3a4a5a' }, headwear: 'headphones', glasses: false,
    prop: 'notebook', mobility: 'none', player: false },
  { id: 'mechanic',   role: 'mechanic',     age: 'adult', skin: '#bb865a', hair: { style: 'shaggyBeard', color: '#4a2f1c' },
    build: { h: 1.02, girth: 1.12, sh: 0.62, neck: 0.85 }, head: 'square',
    garment: { kind: 'overalls', color: '#43526a', color2: '#8a6238' }, headwear: 'cap', glasses: false,
    prop: 'wrench', mobility: 'none', player: false },
  { id: 'gardener',   role: 'market gardener', age: 'adult', skin: '#d9a373', hair: { style: 'headscarfHair', color: '#3a2a1c' },
    build: { h: 0.9, girth: 1.18, sh: 0.66, neck: 0.85 }, head: 'round',
    garment: { kind: 'apronMarket', color: '#8a9a6a', color2: '#7d4f63' }, headwear: 'headscarf', glasses: false,
    prop: 'crate', mobility: 'none', player: false },
  { id: 'farmer',     role: 'old farmer',   age: 'elder', skin: '#b07a4e', hair: { style: 'beardLong', color: '#cfc6b4' },
    build: { h: 1.12, girth: 0.9, sh: 0.4, neck: 1.1 }, head: 'long',
    garment: { kind: 'workJacket', color: '#5b6a4a', color2: '#7c5a34' }, headwear: 'strawHat', glasses: false,
    prop: 'pitchfork', mobility: 'none', player: false },
  { id: 'musician',   role: 'musician',     age: 'young', skin: '#915832', hair: { style: 'locs', color: '#1e1512' },
    build: { h: 1.0, girth: 0.92, sh: 0.5, neck: 1.05 }, head: 'oval',
    garment: { kind: 'scarfJacket', color: '#8a556e', color2: '#a2483d' }, headwear: 'none', glasses: false,
    prop: 'guitar', mobility: 'none', player: false },
  { id: 'carpenter',  role: 'carpenter',    age: 'adult', skin: '#c38a5b', hair: { style: 'shortBeard', color: '#5a3a22' },
    build: { h: 1.04, girth: 1.06, sh: 0.6, neck: 0.9 }, head: 'square',
    garment: { kind: 'apronTool', color: '#9a6b3f', color2: '#6b4a2e' }, headwear: 'cap', glasses: false,
    prop: 'tools', mobility: 'none', player: false },
  { id: 'librarian',  role: 'retired librarian', age: 'elder', skin: '#e6b98f', hair: { style: 'curlyGrey', color: '#b8b0a0' },
    build: { h: 0.9, girth: 0.98, sh: 0.55, neck: 0.95 }, head: 'soft',
    garment: { kind: 'cardiganElder', color: '#7d4f63', color2: '#5a3a48' }, headwear: 'none', glasses: true,
    prop: 'booksSatchel', mobility: 'none', player: false },
  { id: 'florist',    role: 'florist',      age: 'elder', skin: '#a9713f', hair: { style: 'headwrap', color: '#2a1c12' },
    build: { h: 0.92, girth: 1.05, sh: 0.62, neck: 0.9 }, head: 'round',
    garment: { kind: 'shawl', color: '#b07a3e', color2: '#557089' }, headwear: 'headwrap', glasses: false,
    prop: 'flowers', mobility: 'none', player: false },
];

// per-state posture + expression tuning
function pose(state) {
  if (state === 'afraid') return { lean: 0.85, arm: 'hug', browIn: -6, gaze: 1.2, mouth: 'frown', eyeR: 1.5, bright: false, present: 0 };
  if (state === 'listening') return { lean: 0.4, arm: 'ear', browIn: -2, gaze: 0.2, mouth: 'level', eyeR: 1.9, bright: false, present: 0 };
  return { lean: 0.0, arm: 'open', browIn: 0, gaze: 0, mouth: 'smile', eyeR: 1.9, bright: true, present: 1 };
}

function mix(aHex, bHex, t) {
  const a = parseInt(aHex.slice(1), 16), b = parseInt(bHex.slice(1), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  t = Math.max(0, Math.min(1, t));
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
}

// ---- shared defs (ink roughen, halftone, paper) referenced by frames ----
export function defs() {
  return `<defs>
    <filter id="ink"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" xChannelSelector="R" yChannelSelector="G"/></filter>
    <pattern id="ht" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(20)"><circle cx="2.5" cy="2.5" r="1" fill="#000"/></pattern>
    <radialGradient id="cheek" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ff9d4d" stop-opacity="0.5"/><stop offset="1" stop-color="#ff9d4d" stop-opacity="0"/></radialGradient>
  </defs>`;
}

// draw one arm+sleeve+hand at (sx,sy) shoulder, reaching to (hx,hy) hand.
function arm(sx, sy, hx, hy, w, garment, skin) {
  const midx = (sx + hx) / 2 + (hx - sx) * 0.05;
  const midy = (sy + hy) / 2 + 8;
  return `<path d="M ${sx} ${sy} Q ${midx} ${midy} ${hx} ${hy}" fill="none" stroke="${garment}" stroke-width="${w}" stroke-linecap="round"/>`
    + `<circle cx="${hx}" cy="${hy}" r="${w * 0.42}" fill="${skin}" stroke="${INK}" stroke-width="1.4"/>`;
}

function hair(style, color, skin) {
  switch (style) {
    case 'bald': return `<path d="M -13 -63 C -8 -70 8 -70 13 -63" fill="none" stroke="${mix(skin, INK, 0.15)}" stroke-width="2"/>`;
    case 'curlyShort': return `<path d="M -16 -58 C -20 -78 20 -78 16 -58 C 12 -70 -12 -70 -16 -58 Z" fill="${color}"/><circle cx="-12" cy="-68" r="6.5" fill="${color}"/><circle cx="12" cy="-68" r="6.5" fill="${color}"/><circle cx="0" cy="-74" r="7.5" fill="${color}"/>`;
    case 'bunGlasses': return `<path d="M -15 -57 C -17 -74 17 -74 15 -57 C 10 -66 -10 -66 -15 -57 Z" fill="${color}"/><circle cx="0" cy="-77" r="6" fill="${color}"/>`;
    case 'moustache': return `<path d="M -15 -58 C -14 -70 14 -70 15 -58 C 8 -65 -8 -65 -15 -58 Z" fill="${color}"/><path d="M -8 -47 C -4 -44 4 -44 8 -47" stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    case 'wavyMed': return `<path d="M -16 -55 C -22 -80 22 -80 16 -55 C 14 -72 -14 -72 -16 -55 Z" fill="${color}"/><path d="M -16 -55 C -19 -46 -18 -40 -15 -37" stroke="${color}" stroke-width="5" fill="none"/><path d="M 16 -55 C 19 -46 18 -40 15 -37" stroke="${color}" stroke-width="5" fill="none"/>`;
    case 'shaggyBeard': return `<path d="M -16 -56 C -20 -76 20 -76 16 -56 C 12 -68 -12 -68 -16 -56 Z" fill="${color}"/><path d="M -14 -50 C -12 -38 12 -38 14 -50 C 8 -44 -8 -44 -14 -50 Z" fill="${color}"/>`;
    case 'beardLong': return `<path d="M -14 -58 C -12 -70 12 -70 14 -58 C 8 -66 -8 -66 -14 -58 Z" fill="${color}"/><path d="M -13 -50 C -14 -32 14 -32 13 -50 C 8 -42 -8 -42 -13 -50 Z" fill="${color}"/>`;
    case 'shortBeard': return `<path d="M -15 -57 C -15 -71 15 -71 15 -57 C 9 -64 -9 -64 -15 -57 Z" fill="${color}"/><path d="M -13 -50 C -11 -40 11 -40 13 -50 C 7 -45 -7 -45 -13 -50 Z" fill="${color}"/>`;
    case 'locs': return `<path d="M -16 -56 C -18 -76 18 -76 16 -56 C 12 -68 -12 -68 -16 -56 Z" fill="${color}"/>${[-15, -8, 0, 8, 15].map((x, i) => `<rect x="${x - 2}" y="${-60 + (i % 2) * 2}" width="4" height="${18 + (i % 3) * 6}" rx="2" fill="${color}"/>`).join('')}`;
    case 'curlyGrey': return `<path d="M -16 -57 C -20 -76 20 -76 16 -57 C 12 -68 -12 -68 -16 -57 Z" fill="${color}"/><circle cx="-13" cy="-67" r="6" fill="${color}"/><circle cx="13" cy="-67" r="6" fill="${color}"/><circle cx="-4" cy="-74" r="6" fill="${color}"/><circle cx="7" cy="-73" r="6" fill="${color}"/>`;
    case 'headscarfHair': return `<path d="M -15 -58 C -12 -66 12 -66 15 -58" fill="none" stroke="${color}" stroke-width="4"/>`;
    case 'headwrap': return `<path d="M -15 -58 C -12 -64 12 -64 15 -58" fill="none" stroke="${color}" stroke-width="3"/>`;
    default: return '';
  }
}

function headwear(kind, color) {
  switch (kind) {
    case 'flatcap': return `<path d="M -17 -66 C -17 -78 17 -78 17 -68 L 24 -66 C 18 -62 -16 -62 -17 -66 Z" fill="${color}" stroke="${INK}" stroke-width="1.6"/>`;
    case 'bakerHat': return `<path d="M -14 -70 C -20 -92 20 -92 14 -70 Z" fill="#efe7d6" stroke="${INK}" stroke-width="1.4"/><rect x="-15" y="-72" width="30" height="6" rx="3" fill="#efe7d6" stroke="${INK}" stroke-width="1.2"/>`;
    case 'cap': return `<path d="M -15 -68 C -15 -82 15 -82 15 -68 Z" fill="${color}" stroke="${INK}" stroke-width="1.6"/><ellipse cx="9" cy="-67" rx="13" ry="4" fill="${color}" stroke="${INK}" stroke-width="1.2"/>`;
    case 'strawHat': return `<ellipse cx="0" cy="-70" rx="30" ry="8" fill="#c9a86a" stroke="${INK}" stroke-width="1.6"/><path d="M -14 -72 C -14 -90 14 -90 14 -72 Z" fill="#d8ba7c" stroke="${INK}" stroke-width="1.4"/><path d="M -14 -74 L 14 -74" stroke="#a2482d" stroke-width="3"/>`;
    case 'headscarf': return `<path d="M -18 -60 C -20 -80 20 -80 18 -60 C 16 -70 -16 -70 -18 -60 Z" fill="${color}" stroke="${INK}" stroke-width="1.6"/><path d="M 15 -60 C 24 -54 24 -44 18 -40 L 14 -52 Z" fill="${color}" stroke="${INK}" stroke-width="1.4"/><circle cx="-8" cy="-70" r="1.6" fill="#f3ece0"/><circle cx="4" cy="-74" r="1.6" fill="#f3ece0"/>`;
    case 'headwrap': return `<path d="M -18 -62 C -22 -84 22 -84 18 -62 C 14 -74 -14 -74 -18 -62 Z" fill="${color}" stroke="${INK}" stroke-width="1.6"/><path d="M -16 -78 L 16 -70 M -16 -70 L 16 -80" stroke="${mix(color, '#000', 0.25)}" stroke-width="2" opacity="0.6"/><path d="M 14 -66 C 22 -62 20 -52 14 -50" fill="${color}" stroke="${INK}" stroke-width="1.2"/>`;
    case 'headphones': return `<path d="M -18 -58 C -18 -84 18 -84 18 -58" fill="none" stroke="${INK2}" stroke-width="3"/><rect x="-22" y="-60" width="8" height="12" rx="3" fill="${INK2}"/><rect x="14" y="-60" width="8" height="12" rx="3" fill="${INK2}"/>`;
    default: return '';
  }
}

// prop drawn relative to the bust; some hide when the person opens up (present).
function prop(kind, spec, p, sw, hands) {
  const g = spec.garment.color, gd = mix(g, INK, 0.5);
  switch (kind) {
    case 'stethoscope': return `<path d="M -9 -30 C -14 -14 -10 2 -2 6 M 9 -30 C 14 -14 10 2 2 6" fill="none" stroke="${INK2}" stroke-width="2.4"/><circle cx="0" cy="10" r="4.5" fill="#c9ccd2" stroke="${INK}" stroke-width="1.4"/><rect x="-2" y="18" width="4" height="10" rx="2" fill="#e8ddc9" stroke="${INK}" stroke-width="1" opacity="${1 - p.present * 0.2}"/>`;
    case 'satchel': return `<path d="M ${sw - 4} -6 L ${sw + 16} 6 L ${sw + 12} 34 L ${sw - 8} 26 Z" fill="${mix('#6b4a2e', INK, 0.2)}" stroke="${INK}" stroke-width="1.6"/><path d="M ${sw - 4} -6 C ${sw - 18} -20 ${-6} -22 ${-2} -14" fill="none" stroke="${INK2}" stroke-width="2.4"/>`;
    case 'books': return p.present ? `<rect x="-38" y="4" width="20" height="14" rx="1.5" fill="${gd}" stroke="${INK}" stroke-width="1.5" transform="rotate(-8 -28 11)"/>` : `<g transform="translate(0,${p.arm === 'hug' ? -2 : 2})"><rect x="-16" y="2" width="32" height="12" rx="1.5" fill="${gd}" stroke="${INK}" stroke-width="1.5"/><rect x="-13" y="-8" width="26" height="11" rx="1.5" fill="${mix(g, GLOW, 0.3)}" stroke="${INK}" stroke-width="1.4"/></g>`;
    case 'booksSatchel': return `<rect x="-15" y="0" width="30" height="12" rx="1.5" fill="${gd}" stroke="${INK}" stroke-width="1.5"/><rect x="-12" y="-9" width="24" height="10" rx="1.5" fill="${mix(g, GLOW, 0.3)}" stroke="${INK}" stroke-width="1.4"/><path d="M ${sw - 6} -4 C ${-4} -18 ${-2} -14 ${-2} -10" fill="none" stroke="${INK2}" stroke-width="2"/>`;
    case 'bread': return `<ellipse cx="0" cy="12" rx="20" ry="10" fill="#c58a44" stroke="${INK}" stroke-width="1.6"/><path d="M -12 8 L -8 16 M -2 6 L 2 16 M 8 8 L 12 16" stroke="${mix('#c58a44', INK, 0.4)}" stroke-width="1.6"/>`;
    case 'notebook': return `<rect x="-15" y="-2" width="28" height="20" rx="1.5" fill="${mix(g, '#f3ece0', 0.5)}" stroke="${INK}" stroke-width="1.5"/><path d="M -10 4 L 8 4 M -10 9 L 8 9 M -10 14 L 2 14" stroke="${INK2}" stroke-width="1"/>`;
    case 'wrench': return p.present ? `<path d="M -34 8 L -20 -2 M -36 4 a4 4 0 1 1 5 6 Z" stroke="#b7bcc4" stroke-width="4" fill="none" stroke-linecap="round"/>` : `<path d="M 8 24 L 20 -6 M 6 26 a5 5 0 1 0 7 3 Z" stroke="#b7bcc4" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    case 'crate': return `<rect x="-22" y="6" width="44" height="20" rx="2" fill="#8a6238" stroke="${INK}" stroke-width="1.8"/><path d="M -22 12 L 22 12" stroke="${INK}" stroke-width="1.2"/><circle cx="-10" cy="4" r="5" fill="#a2483d"/><circle cx="2" cy="2" r="5" fill="#c96a3a"/><circle cx="13" cy="4" r="4.5" fill="#7c7b4a"/><path d="M -6 -2 C -8 -8 -2 -8 -4 -2 M 6 -2 C 4 -9 10 -8 8 -2" stroke="#4f7061" stroke-width="2.4" fill="none"/>`;
    case 'pitchfork': return `<path d="M ${sw + 8} 40 L ${sw + 2} -74" stroke="#6b4a2e" stroke-width="3.4"/><path d="M ${sw - 6} -74 L ${sw - 6} -88 M ${sw + 2} -74 L ${sw + 2} -90 M ${sw + 10} -74 L ${sw + 10} -88" stroke="#9aa0a6" stroke-width="2.6"/>`;
    case 'guitar': return `<ellipse cx="-2" cy="16" rx="16" ry="20" fill="#b5793a" stroke="${INK}" stroke-width="1.8"/><circle cx="-2" cy="16" r="5" fill="${INK2}"/><rect x="-4" y="-30" width="5" height="30" fill="#7c5a34" stroke="${INK}" stroke-width="1.2"/>`;
    case 'tools': return `<path d="M -16 -6 L 16 -6 L 13 40 L -13 40 Z" fill="${mix(g, '#3a2a1f', 0.2)}" stroke="${INK}" stroke-width="1.6"/><rect x="-13" y="0" width="7" height="16" rx="1" fill="#6b4a2e"/><rect x="-3" y="0" width="7" height="16" rx="1" fill="#8a6238"/><path d="M 6 2 L 10 16" stroke="#b7bcc4" stroke-width="3" stroke-linecap="round"/>`;
    case 'flowers': return `<path d="M -12 24 L -6 4 M 0 24 L 0 2 M 12 24 L 6 4" stroke="#4f7061" stroke-width="2.4"/><circle cx="-6" cy="0" r="5" fill="#e0a58c"/><circle cx="0" cy="-3" r="5.5" fill="#f0c057"/><circle cx="6" cy="0" r="5" fill="#a2483d"/><circle cx="-6" cy="0" r="1.6" fill="${INK2}"/><circle cx="0" cy="-3" r="1.6" fill="${INK2}"/><circle cx="6" cy="0" r="1.6" fill="${INK2}"/>`;
    default: return '';
  }
}

function headShape(kind, skin) {
  const st = `fill="${skin}" stroke="${INK}" stroke-width="2.2"`;
  switch (kind) {
    case 'long': return `<path d="M -13 -58 C -13 -72 13 -72 13 -58 C 13 -44 8 -40 0 -40 C -8 -40 -13 -44 -13 -58 Z" ${st}/>`;
    case 'square': return `<path d="M -14 -60 C -14 -71 14 -71 14 -60 L 13 -50 C 13 -43 -13 -43 -13 -50 Z" ${st}/>`;
    case 'oval': return `<ellipse cx="0" cy="-57" rx="13" ry="16" ${st}/>`;
    case 'soft': return `<path d="M -14 -57 C -14 -70 14 -70 14 -57 C 14 -46 8 -42 0 -42 C -8 -42 -14 -46 -14 -57 Z" ${st}/>`;
    default: return `<circle cx="0" cy="-58" r="15" ${st}/>`;
  }
}

function face(p, skin) {
  const ey = -60, my = -49, dx = p.gaze;
  let s = '';
  // cheeks warm in the clear state
  if (p.bright) s += `<circle cx="0" cy="-53" r="12" fill="url(#cheek)"/>`;
  // eyes (small rounds; gaze lowers when afraid)
  s += `<circle cx="${-6 + dx * 0}" cy="${ey + p.gaze}" r="${p.eyeR}" fill="${INK}"/><circle cx="${6}" cy="${ey + p.gaze}" r="${p.eyeR}" fill="${INK}"/>`;
  if (p.bright) s += `<circle cx="-6.6" cy="${ey - 0.7}" r="0.7" fill="${GLOW}"/><circle cx="5.4" cy="${ey - 0.7}" r="0.7" fill="${GLOW}"/>`;
  // brows: inner-raised worry when afraid, level otherwise
  if (p.mouth === 'frown') s += `<path d="M -9 ${ey - 3} L -3 ${ey - 6} M 9 ${ey - 3} L 3 ${ey - 6}" stroke="${INK2}" stroke-width="1.6"/>`;
  else if (p.mouth === 'level') s += `<path d="M -9 ${ey - 5} L -3 ${ey - 5} M 3 ${ey - 5} L 9 ${ey - 5}" stroke="${INK2}" stroke-width="1.4" opacity="0.7"/>`;
  // mouth
  if (p.mouth === 'frown') s += `<path d="M -5 ${my + 1} C 0 ${my - 2} 0 ${my - 2} 5 ${my + 1}" stroke="${INK2}" stroke-width="2" fill="none"/>`;
  else if (p.mouth === 'level') s += `<path d="M -6 ${my} C 0 ${my + 2} 0 ${my + 2} 6 ${my}" stroke="${INK2}" stroke-width="2" fill="none"/>`;
  else s += `<path d="M -7 ${my - 1} C 0 ${my + 5} 0 ${my + 5} 7 ${my - 1}" stroke="${INK2}" stroke-width="2.4" fill="none"/>`;
  return s;
}

function glasses() {
  return `<g stroke="${INK}" stroke-width="1.6" fill="none"><circle cx="-6" cy="-59" r="5"/><circle cx="6" cy="-59" r="5"/><path d="M -1 -59 L 1 -59 M -11 -60 L -14 -61 M 11 -60 L 14 -61"/></g>`;
}

// Build one bust as inner SVG markup, centred so the head sits near y=-58 and the
// torso base near y=+60 (matching the runtime Character coordinate system).
export function buildBust(spec, state) {
  const p = pose(state);
  const b = spec.build;
  const skin = spec.skin;
  const g = spec.garment.color, g2 = spec.garment.color2 || mix(g, INK, 0.3);
  // cool the garment a touch when afraid (light, not the sole cue)
  const gW = mix('#7d8088', g, Math.min(1, 0.45 + (state === 'afraid' ? 0.2 : 0.7)));
  const sw = Math.round((27 + b.sh * 8) * b.girth); // shoulder half-width
  const baseY = 60;
  const leanR = (p.lean * 6).toFixed(1);
  const leanY = (p.lean * 5).toFixed(1);

  let s = '';
  // ground/seat shadow
  s += `<ellipse cx="0" cy="${baseY + 4}" rx="${sw + 4}" ry="9" fill="#000" opacity="0.26"/>`;

  // wheelchair (drawn behind the body) or cane hint
  if (spec.mobility === 'wheelchair') {
    s += `<g stroke="${INK}" stroke-width="2.4" fill="none"><circle cx="${-sw + 4}" cy="46" r="20"/><circle cx="${-sw + 4}" cy="46" r="7" fill="${mix(g, INK, 0.4)}"/></g>`
      + `<rect x="${-sw - 6}" y="6" width="8" height="42" rx="3" fill="${mix('#6b6b75', INK, 0.3)}" stroke="${INK}" stroke-width="1.4"/>`;
  }

  s += `<g transform="rotate(${leanR}) translate(0 ${leanY})" filter="url(#ink)">`;
  // torso / garment cut
  s += torso(spec.garment.kind, sw, gW, g2, skin);
  // halftone shade on the shadow side
  s += `<path d="M 3 -8 C ${sw - 6} -8 ${sw - 2} 24 ${sw - 4} ${baseY} L 3 ${baseY} Z" fill="url(#ht)" opacity="0.13"/>`;

  // back arm + prop-in-hand depending on pose
  const handsClose = p.arm !== 'open';
  // arms
  if (p.arm === 'hug') {
    s += arm(-sw + 4, -6, -6, 20, 9 * b.girth, gW, skin);
    s += arm(sw - 4, -6, 6, 16, 9 * b.girth, gW, skin);
  } else if (p.arm === 'ear') {
    s += arm(-sw + 4, -6, -10, 22, 9 * b.girth, gW, skin); // resting
    s += arm(sw - 4, -6, 12, -50, 8.5 * b.girth, gW, skin); // hand cupped to ear
  } else { // open
    s += arm(-sw + 4, -6, -12, 24, 9 * b.girth, gW, skin);
    s += arm(sw - 4, -6, sw + 20, -8, 8.5 * b.girth, gW, skin); // open outward
  }

  // prop (chest-held, or presented when open)
  s += prop(spec.prop, spec, p, sw, handsClose);

  // neck
  const neckLen = 14 * b.neck;
  s += `<rect x="-6" y="${-46}" width="12" height="${neckLen}" rx="3" fill="${mix(skin, INK, 0.16)}"/>`;
  // head (shape varies)
  s += headShape(spec.head, skin);
  // hair, then headwear over it
  s += hair(spec.hair.style, spec.hair.color, skin);
  s += headwear(spec.headwear, spec.garment.color2 || g2);
  // face + glasses
  s += face(p, skin);
  if (spec.glasses) s += glasses();

  s += `</g>`;
  // Note: the clarity halo and selection ring are drawn at runtime (tied to the
  // real in-game threshold), so they are deliberately NOT baked into the frame.
  return s;
}

function torso(kind, sw, g, g2, skin) {
  const base = (fill) => `<path d="M ${-sw} 6 C ${-sw - 4} -20 -14 -34 0 -34 C 14 -34 ${sw + 4} -20 ${sw} 6 L ${sw - 2} 60 L ${-(sw - 2)} 60 Z" fill="${fill}" stroke="${INK}" stroke-width="2.4"/>`;
  switch (kind) {
    case 'scrubs': return base(g) + `<path d="M -8 -30 L 0 -20 L 8 -30" fill="none" stroke="${INK}" stroke-width="2"/><path d="M 0 -20 L 0 40" stroke="${mix(g, INK, 0.35)}" stroke-width="1.4" opacity="0.5"/>`;
    case 'vest': return base(g) + `<path d="M -8 -28 L -14 60 M 8 -28 L 14 60" stroke="${mix(g, INK, 0.4)}" stroke-width="2" fill="none"/><path d="M -9 -28 L 0 -14 L 9 -28 L 4 8 L -4 8 Z" fill="#dfe1e6" opacity="0.85"/><path d="M -1 -12 L 1 8" stroke="${g2}" stroke-width="4"/>`; // shirt + tie
    case 'cardigan': return base(g) + `<path d="M -6 -28 L -6 60 M 6 -28 L 6 60" stroke="${mix(g, INK, 0.4)}" stroke-width="2"/><path d="M -6 -26 L 0 -16 L 6 -26 L 3 6 L -3 6 Z" fill="#efe7d6" opacity="0.85"/>`;
    case 'apronBaker': return base('#dfe1e6') + `<path d="M -16 -8 L 16 -8 L 13 60 L -13 60 Z" fill="${g}" stroke="${INK}" stroke-width="1.6"/><path d="M -16 -8 L -7 -26 M 16 -8 L 7 -26" stroke="${INK}" stroke-width="1.8" fill="none"/><rect x="-9" y="26" width="18" height="12" fill="none" stroke="${g2}" stroke-width="1.4"/>`;
    case 'hoodie': return base(g) + `<path d="M -13 -30 C -6 -20 6 -20 13 -30" fill="none" stroke="${g2}" stroke-width="3"/><path d="M -2 -22 L -2 4 M 2 -22 L 2 4" stroke="${g2}" stroke-width="2"/><rect x="-14" y="20" width="28" height="12" rx="4" fill="${mix(g, INK, 0.18)}"/>`; // pocket
    case 'overalls': return base('#cdbf9f') + `<path d="M ${-sw + 6} 2 L ${sw - 6} 2 L ${sw - 8} 60 L ${-sw + 8} 60 Z" fill="${g}" stroke="${INK}" stroke-width="1.8"/><path d="M -12 2 L -14 -28 M 12 2 L 14 -28" stroke="${g}" stroke-width="5"/><rect x="-11" y="12" width="22" height="16" fill="none" stroke="${g2}" stroke-width="1.6"/><circle cx="-13" cy="-2" r="2" fill="${g2}"/><circle cx="13" cy="-2" r="2" fill="${g2}"/>`;
    case 'apronMarket': return base(g) + `<path d="M -15 -6 L 15 -6 L 12 60 L -12 60 Z" fill="${mix(g, '#efe7d6', 0.55)}" stroke="${INK}" stroke-width="1.6"/><path d="M -15 -6 L -6 -24 M 15 -6 L 6 -24" stroke="${INK}" stroke-width="1.8" fill="none"/><path d="M -12 30 L 12 30" stroke="${g2}" stroke-width="3"/>`;
    case 'workJacket': return base(g) + `<path d="M -7 -28 L -10 60 M 7 -28 L 10 60" stroke="${mix(g, INK, 0.4)}" stroke-width="2"/><path d="M -7 -26 L 0 -16 L 7 -26 L 3 4 L -3 4 Z" fill="${mix(g2, '#efe7d6', 0.4)}"/><rect x="-13" y="14" width="9" height="12" fill="none" stroke="${g2}" stroke-width="1.4"/>`;
    case 'scarfJacket': return base(g) + `<path d="M -13 -30 C -6 -18 6 -18 13 -30 L 9 -12 C 3 -6 -3 -6 -9 -12 Z" fill="${g2}" stroke="${INK}" stroke-width="1.6"/><path d="M 7 -12 L 12 24" stroke="${g2}" stroke-width="5" stroke-linecap="round"/>`;
    case 'apronTool': return base(g) + `<path d="M -16 -6 L 16 -6 L 13 60 L -13 60 Z" fill="${mix(g, INK, 0.2)}" stroke="${INK}" stroke-width="1.6"/><path d="M -16 -6 L -6 -24 M 16 -6 L 6 -24" stroke="${INK}" stroke-width="1.8" fill="none"/><rect x="-13" y="6" width="26" height="10" fill="none" stroke="${g2}" stroke-width="1.4"/>`;
    case 'cardiganElder': return base(g) + `<path d="M -6 -28 L -6 60 M 6 -28 L 6 60" stroke="${mix(g, INK, 0.4)}" stroke-width="2"/><path d="M -6 -26 L 0 -16 L 6 -26 L 3 8 L -3 8 Z" fill="#efe7d6" opacity="0.85"/><circle cx="0" cy="18" r="2" fill="${g2}"/><circle cx="0" cy="30" r="2" fill="${g2}"/>`;
    case 'shawl': return base(g) + `<path d="M ${-sw} 2 C -10 -10 10 -10 ${sw} 2 L ${sw - 4} 30 C 0 20 0 20 ${-sw + 4} 30 Z" fill="${g2}" stroke="${INK}" stroke-width="1.6" opacity="0.92"/><path d="M ${-sw + 6} 24 L ${sw - 6} 24" stroke="${mix(g2, INK, 0.3)}" stroke-width="1.4" opacity="0.5"/>`;
    default: return base(g);
  }
}

// portrait = a tighter, taller-detail bust used for the close-up (reuses buildBust).
export function frameBox() { return { w: 150, h: 200, cx: 75, cy: 128 }; }
