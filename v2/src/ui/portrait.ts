// A ui-local portrait: renders an authored character bust from the sprite atlas as
// a CSS background-sprite, so the selected-person card shows a real face, hair,
// garment, prop and current afraid/listening/clear expression — not a placeholder.
//
// The ui layer may not import the renderer, so this reads the same public manifest
// the renderer uses (character order === manifest.characters order === seat index).
// Everything degrades gracefully: if the atlas is unavailable (or forced off for a
// fallback review), it draws a quiet initial-tile instead of the glowing circle.

interface Frame { x: number; y: number; w: number; h: number; }
interface Manifest {
  cell: { w: number; h: number };
  pages: Record<string, { src: string; scale: number }>;
  frames: Record<string, Frame>;
  characters: Array<{ id: string; role: string }>;
}

type State = 'afraid' | 'listening' | 'clear';

const PORTRAIT_H = 172; // logical display height of the bust, in CSS px

function base(): string {
  try {
    return (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
  } catch { return '/'; }
}

let disabled = false;
let manifestPromise: Promise<Manifest | null> | null = null;
let sheet: { manifest: Manifest; pageUrl: string; pageW: number; pageH: number } | null = null;

/** Disable the authored portrait (dev `?noatlas`) so the card uses the fallback. */
export function disablePortraits(): void { disabled = true; }

function loadManifest(): Promise<Manifest | null> {
  if (disabled) return Promise.resolve(null);
  if (!manifestPromise) {
    manifestPromise = fetch(`${base()}art/characters.manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
      .then((m) => {
        if (!m) return null;
        // highest-resolution page for a crisp close-up
        const key = m.pages['2x'] ? '2x' : Object.keys(m.pages)[0];
        const page = m.pages[key];
        if (!page) return null;
        let maxX = 0, maxY = 0;
        for (const f of Object.values(m.frames)) { maxX = Math.max(maxX, f.x + f.w); maxY = Math.max(maxY, f.y + f.h); }
        sheet = { manifest: m, pageUrl: `${base()}art/${page.src}`, pageW: maxX, pageH: maxY };
        return m;
      })
      .catch(() => null);
  }
  return manifestPromise;
}

// warm the manifest as soon as the module loads (non-blocking)
void loadManifest();

function stateFor(aw: number): State {
  if (aw < 0.35) return 'afraid';
  if (aw < 0.7) return 'listening';
  return 'clear';
}

function paintFallback(el: HTMLElement, name: string): void {
  el.className = 'portrait fallback';
  el.style.cssText = '';
  el.textContent = (name.trim()[0] || '·').toUpperCase();
}

/**
 * Render the authored bust for `seatIdx` at awareness `aw` into `el`. Safe to call
 * every render; it no-ops to the fallback tile if the atlas is not available.
 */
export function applyPortrait(el: HTMLElement, seatIdx: number, aw: number, name: string): void {
  if (disabled || !sheet) {
    paintFallback(el, name);
    // if the manifest is still loading, upgrade once it lands
    if (!disabled && !sheet) void loadManifest().then(() => { if (sheet) applyPortrait(el, seatIdx, aw, name); });
    return;
  }
  const { manifest, pageUrl, pageW, pageH } = sheet;
  const char = manifest.characters[seatIdx];
  const frame = char && manifest.frames[`${char.id}.${stateFor(aw)}`];
  if (!char || !frame) { paintFallback(el, name); return; }
  const f = PORTRAIT_H / frame.h; // display px per logical px
  el.className = 'portrait bust ' + stateFor(aw);
  el.textContent = '';
  el.style.width = `${Math.round(frame.w * f)}px`;
  el.style.height = `${Math.round(frame.h * f)}px`;
  el.style.backgroundImage = `url("${pageUrl}")`;
  el.style.backgroundSize = `${pageW * f}px ${pageH * f}px`;
  el.style.backgroundPosition = `${-frame.x * f}px ${-frame.y * f}px`;
  el.style.backgroundRepeat = 'no-repeat';
}
