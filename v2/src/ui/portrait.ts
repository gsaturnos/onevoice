// A ui-local portrait: shows the selected person's face in the HUD card. Prefers
// the AUTHORED raster portrait (illustrator-supplied, larger, more expressive —
// see docs/v2/authored-character-art-spec.md) when the manifest has one; falls
// back to the SVG-atlas bust cropped from its sprite sheet; falls back again to a
// quiet initial tile if neither is available. This mirrors the renderer's own
// authored → atlas → procedural tiering, kept independently here because the ui
// layer may not import the renderer.
//
// Both manifests are read directly (no code import from render/) and are always
// fixed-length, seat-ordered arrays (index === agent index === seat), so a plain
// array lookup by index resolves the same character both here and in the scene.

interface Frame { x: number; y: number; w: number; h: number; }
interface AtlasManifest {
  cell: { w: number; h: number };
  pages: Record<string, { src: string; scale: number }>;
  frames: Record<string, Frame>;
  characters: Array<{ id: string; role: string }>;
}

type State = 'afraid' | 'listening' | 'clear';
interface ResVariant { '1x'?: string; '2x'?: string; }
interface AuthoredEntry {
  id: string;
  status?: 'authored' | 'placeholder';
  portrait?: Partial<Record<State, ResVariant>>;
}
interface AuthoredManifestLite {
  portraitCanvas: { w: number; h: number };
  characters: AuthoredEntry[];
}

const PORTRAIT_H = 224; // logical display height of the portrait, in CSS px — "substantially larger"

function base(): string {
  try {
    return (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
  } catch { return '/'; }
}

let atlasDisabled = false;
let authoredDisabled = false;
let atlasPromise: Promise<AtlasManifest | null> | null = null;
let authoredPromise: Promise<AuthoredManifestLite | null> | null = null;
let atlasSheet: { manifest: AtlasManifest; pageUrl: string; pageW: number; pageH: number } | null = null;
let authoredSheet: AuthoredManifestLite | null = null;

/** Disable the SVG-atlas portrait (dev `?noatlas`) so the card uses the initial tile. */
export function disablePortraits(): void { atlasDisabled = true; authoredDisabled = true; }
/** Disable only the authored-raster portrait (dev `?noauthored`) — atlas still used. */
export function disableAuthoredPortraits(): void { authoredDisabled = true; }

function loadAtlas(): Promise<AtlasManifest | null> {
  if (atlasDisabled) return Promise.resolve(null);
  if (!atlasPromise) {
    atlasPromise = fetch(`${base()}art/characters.manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<AtlasManifest>) : null))
      .then((m) => {
        if (!m) return null;
        const key = m.pages['2x'] ? '2x' : Object.keys(m.pages)[0];
        const page = m.pages[key];
        if (!page) return null;
        let maxX = 0, maxY = 0;
        for (const f of Object.values(m.frames)) { maxX = Math.max(maxX, f.x + f.w); maxY = Math.max(maxY, f.y + f.h); }
        atlasSheet = { manifest: m, pageUrl: `${base()}art/${page.src}`, pageW: maxX, pageH: maxY };
        return m;
      })
      .catch(() => null);
  }
  return atlasPromise;
}

function loadAuthored(): Promise<AuthoredManifestLite | null> {
  if (authoredDisabled) return Promise.resolve(null);
  if (!authoredPromise) {
    authoredPromise = fetch(`${base()}art/authored/manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<AuthoredManifestLite>) : null))
      .then((m) => { authoredSheet = m; return m; })
      .catch(() => null);
  }
  return authoredPromise;
}

// warm both manifests as soon as the module loads (non-blocking)
void loadAtlas();
void loadAuthored();

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

function paintAtlas(el: HTMLElement, seatIdx: number, state: State): boolean {
  if (!atlasSheet) return false;
  const { manifest, pageUrl, pageW, pageH } = atlasSheet;
  const char = manifest.characters[seatIdx];
  const frame = char && manifest.frames[`${char.id}.${state}`];
  if (!char || !frame) return false;
  const f = PORTRAIT_H / frame.h;
  el.className = 'portrait bust ' + state;
  el.textContent = '';
  el.style.width = `${Math.round(frame.w * f)}px`;
  el.style.height = `${Math.round(frame.h * f)}px`;
  el.style.backgroundImage = `url("${pageUrl}")`;
  el.style.backgroundSize = `${pageW * f}px ${pageH * f}px`;
  el.style.backgroundPosition = `${-frame.x * f}px ${-frame.y * f}px`;
  el.style.backgroundRepeat = 'no-repeat';
  return true;
}

/** True if this seat has a usable authored portrait (any state resolves an image). */
function paintAuthored(el: HTMLElement, seatIdx: number, state: State): boolean {
  const entry = authoredSheet?.characters[seatIdx];
  const variant = entry?.portrait?.[state] ?? entry?.portrait?.listening;
  const src = variant?.['2x'] ?? variant?.['1x'];
  if (!entry || !src) return false;
  const { w, h } = authoredSheet!.portraitCanvas;
  const width = Math.round(PORTRAIT_H * (w / h));
  const placeholder = entry.status === 'placeholder';
  el.className = 'portrait authored ' + state + (placeholder ? ' placeholder' : '');
  el.textContent = '';
  el.style.width = `${width}px`;
  el.style.height = `${PORTRAIT_H}px`;
  el.style.backgroundImage = `url("${base()}art/authored/${src}")`;
  el.style.backgroundSize = 'cover';
  el.style.backgroundPosition = 'center';
  el.style.backgroundRepeat = 'no-repeat';
  return true;
}

/**
 * Render the person's portrait for `seatIdx` at awareness `aw` into `el`, in
 * tier order: authored raster → SVG-atlas bust → a quiet initial tile. Safe to
 * call on every render; each tier no-ops to the next if its manifest hasn't
 * loaded yet or doesn't cover this character, and upgrades once it does.
 */
export function applyPortrait(el: HTMLElement, seatIdx: number, aw: number, name: string): void {
  const state = stateFor(aw);
  if (!authoredDisabled && paintAuthored(el, seatIdx, state)) return;
  if (!atlasDisabled && paintAtlas(el, seatIdx, state)) return;
  paintFallback(el, name);
  // Upgrade once whichever manifest is still in flight lands — guarded so a
  // manifest that resolves to "absent" (404, or simply not shipped yet) never
  // re-triggers itself; only a manifest that actually loaded re-renders.
  if (!authoredDisabled && !authoredSheet) {
    void loadAuthored().then(() => { if (authoredSheet) applyPortrait(el, seatIdx, aw, name); });
  }
  if (!atlasDisabled && !atlasSheet) {
    void loadAtlas().then(() => { if (atlasSheet) applyPortrait(el, seatIdx, aw, name); });
  }
}
