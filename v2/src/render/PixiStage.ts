// The renderer. It OBSERVES read-only snapshots and draws the kitchen scene; it
// owns no game state and never advances the simulation. The app drives it: sync()
// reflects the current snapshot instantly, and the play*() sequences animate a
// transition the app has already committed to the core (animation shows state,
// never decides it). Composition: world → [room.back, threads, characters,
// room.front, fx.overlay]; a gentle camera frames the action.

import { Application, Container } from 'pixi.js';
import type { Snapshot } from '@core/types';
import { clearThreshold } from '@core/insight';
import { Room } from './Room';
import { Character, identityFor } from './Character';
import { CharacterAtlas } from './assets/characterAtlas';
import { AuthoredCast } from './assets/authoredCast';
import { Fx, type Pt } from './Fx';
import { buildScene, envState, type SceneModel } from './scene';
import { tween, type Motion } from './anim';
import { STAGE_W, STAGE_H } from './scene';
import type { AtlasDiagnostics } from './assets/characterAtlas';
import type { AuthoredDiagnostics } from './assets/authoredCast';

// The resting camera crops a little empty wall off the top and frames the cast.
const HOME = { cx: 360, cy: 276, z: 1.1 };

export class PixiStage {
  readonly app: Application;
  private world = new Container();
  private charLayer = new Container();
  private room = new Room();
  private motion: Motion = { reduced: false, speed: 1 };
  private fx = new Fx(this.motion);
  private chars = new Map<number, Character>();
  private atlas: CharacterAtlas = CharacterAtlas.unavailable();
  private authored: AuthoredCast = AuthoredCast.unavailable();
  private scene: SceneModel | null = null;
  private ready = false;
  private selected: number | null = null;
  private selectCb: (idx: number) => void = () => {};
  private cam = { x: 0, y: 0, z: 1 };

  constructor() {
    this.app = new Application();
  }

  async init(
    host: HTMLElement,
    reduceMotion = false,
    opts: { forceFallback?: boolean; forceNoAuthored?: boolean } = {},
  ): Promise<void> {
    this.motion.reduced = reduceMotion;
    await this.app.init({
      width: STAGE_W,
      height: STAGE_H,
      background: 0x120c09,
      antialias: true,
      resolution: Math.min(2, globalThis.devicePixelRatio || 1),
      autoDensity: true,
    });
    host.appendChild(this.app.canvas);
    // Load both raster tiers in parallel; each is independently graceful — a
    // missing/broken manifest or image never blocks the first frame, and a
    // character with no authored art simply renders from the SVG atlas instead
    // (and one with neither renders the fully procedural bust). ?noatlas forces
    // both off (full procedural fallback); ?noauthored forces just the authored
    // tier off, so the SVG atlas is what's compared against.
    [this.atlas, this.authored] = await Promise.all([
      CharacterAtlas.load(undefined, opts.forceFallback ? { force: 'fallback' } : {}),
      AuthoredCast.load(undefined, (opts.forceFallback || opts.forceNoAuthored) ? { force: 'off' } : {}),
    ]);
    this.charLayer.sortableChildren = true;
    // Layer order: room backdrop & lighting → relationship threads → the CAST →
    // the low table rim (occludes only the base) → transient signal/bloom effects.
    // Persistent lighting sits behind the cast so nothing crosses faces.
    this.world.addChild(this.room.back, this.fx.threads, this.charLayer, this.room.front, this.fx.overlay);
    this.app.stage.addChild(this.world);
    this.applyCam(HOME.cx, HOME.cy, HOME.z);
    this.ready = true;
    this.app.ticker.add(() => this.tick());
  }

  /** Dev-only: how each raster tier resolved (authored / SVG-atlas / procedural). */
  get diagnostics(): { atlas: AtlasDiagnostics; authored: AuthoredDiagnostics } {
    return { atlas: this.atlas.diagnostics, authored: this.authored.diagnostics };
  }

  setReduceMotion(on: boolean): void { this.motion.reduced = on; }
  setSpeed(n: number): void { this.motion.speed = n; }
  onSelect(cb: (idx: number) => void): void { this.selectCb = cb; }

  /** Build (or rebuild) the cast for a snapshot. Called once per level load. */
  build(s: Snapshot): void {
    this.charLayer.removeChildren();
    this.chars.clear();
    this.scene = buildScene(s);
    for (const sa of this.scene.agents) {
      const ag = s.agents[sa.idx];
      const id = identityFor(sa.idx, ag.nm, ag.role, sa.isPlayer);
      const c = new Character(sa.idx, id, sa.scale, this.motion.reduced, this.atlas, this.authored);
      c.position.set(sa.x, sa.y);
      c.zIndex = Math.round(sa.y);
      c.on('pointertap', () => this.selectCb(sa.idx));
      this.charLayer.addChild(c);
      this.chars.set(sa.idx, c);
    }
    this.sync(s, this.selected);
  }

  /** Reflect the snapshot with no animation (posture, warmth, env, threads). */
  sync(s: Snapshot, selected: number | null): void {
    if (!this.ready || !this.scene) return;
    this.selected = selected;
    const th = clearThreshold(s);
    for (const sa of this.scene.agents) {
      const c = this.chars.get(sa.idx);
      const ag = s.agents[sa.idx];
      if (!c) continue;
      c.setAwareness(ag.aw, ag.aw >= th && sa.idx !== s.player);
      c.setSelected(sa.idx === selected);
    }
    const env = envState(s);
    this.room.setEnv(env.phase, env.t);
    this.drawThreads(s);
  }

  private posMap(): Map<number, Pt> {
    const m = new Map<number, Pt>();
    if (this.scene) for (const sa of this.scene.agents) m.set(sa.idx, { x: sa.x, y: sa.y });
    return m;
  }

  private drawThreads(s: Snapshot): void {
    // Relationship lines show SELECTIVELY — only the selected person's links, as a
    // reading/action preview. At rest the network stays hidden so faces read clean.
    const focus = new Set<number>();
    if (this.selected != null) {
      focus.add(this.selected);
      for (const j of s.neighbors[this.selected] || []) focus.add(j);
    }
    this.fx.drawThreads(s.links, this.posMap(), focus);
    // dim the unrelated cast slightly while someone is selected, to spotlight the tie
    for (const [idx, c] of this.chars) {
      c.setDim(this.selected != null && !focus.has(idx));
    }
  }

  setSelected(idx: number | null, s: Snapshot): void {
    this.sync(s, idx);
    if (idx != null && !this.motion.reduced) {
      const p = this.scene?.byIdx.get(idx);
      if (p) void this.cameraTo(p.x, p.y - 40, 1.22);
    } else {
      void this.cameraTo(HOME.cx, HOME.cy, HOME.z);
    }
  }

  // Keep the camera's focal point far enough from the room's own edges that a
  // zoomed-in pan never uncovers the canvas's bare background past STAGE_W/H —
  // a character seated near the row's edge would otherwise leave a dead void
  // on one side once the camera follows their selection.
  private clampFocus(cx: number, cy: number, z: number): { cx: number; cy: number } {
    const halfW = STAGE_W / (2 * z);
    const halfH = STAGE_H / (2 * z);
    return {
      cx: Math.min(Math.max(cx, halfW), STAGE_W - halfW),
      cy: Math.min(Math.max(cy, halfH), STAGE_H - halfH),
    };
  }

  // ---- animated sequences (called after the app commits the action) ----

  async playTalk(from: number, to: number): Promise<void> {
    const a = this.scene?.byIdx.get(from);
    const b = this.scene?.byIdx.get(to);
    if (!a || !b) return;
    await this.cameraTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 30, HOME.z + 0.12);
    await this.fx.signal(a, b);
    this.chars.get(to)?.playReact();
    await this.fx.pause(160);
  }

  async playPropagation(flows: Array<{ from: number; to: number; strength: number }>): Promise<void> {
    await this.fx.settle();
    const pos = this.posMap();
    const list = flows
      .map((f) => ({ from: pos.get(f.from), to: pos.get(f.to), strength: f.strength }))
      .filter((f): f is { from: Pt; to: Pt; strength: number } => !!f.from && !!f.to);
    // stagger a little so the spread reads as travelling outward
    const groups = chunk(list, 4);
    for (const g of groups) await this.fx.flows(g);
  }

  async pulseNearReady(idxs: number[]): Promise<void> {
    for (const i of idxs) this.chars.get(i)?.playReact();
    await this.fx.pause(120);
  }

  async playCascade(joined: number[], trace: boolean): Promise<void> {
    const pos = this.posMap();
    const pts = joined.map((i) => pos.get(i)).filter((p): p is Pt => !!p);
    const center = { x: HOME.cx, y: 280 };
    await this.cameraTo(center.x, center.y, HOME.z + 0.08);
    await this.fx.cascade(center, pts);
    if (trace) this.room.setTrace(true);
    for (const i of joined) this.chars.get(i)?.playReact();
    await this.cameraTo(HOME.cx, HOME.cy, HOME.z);
  }

  private async cameraTo(cx0: number, cy0: number, z: number): Promise<void> {
    const { cx, cy } = this.clampFocus(cx0, cy0, z);
    if (this.motion.reduced) { this.applyCam(cx, cy, z); return; }
    const s0 = { ...this.cam };
    const tx = STAGE_W / 2 - cx * z;
    const ty = STAGE_H / 2 - cy * z;
    await tween(420, (t) => {
      this.cam.x = s0.x + (tx - s0.x) * t;
      this.cam.y = s0.y + (ty - s0.y) * t;
      this.cam.z = s0.z + (z - s0.z) * t;
      this.world.position.set(this.cam.x, this.cam.y);
      this.world.scale.set(this.cam.z);
    }, this.motion);
  }

  private applyCam(cx0: number, cy0: number, z: number): void {
    const { cx, cy } = this.clampFocus(cx0, cy0, z);
    this.cam = { x: STAGE_W / 2 - cx * z, y: STAGE_H / 2 - cy * z, z };
    this.world.position.set(this.cam.x, this.cam.y);
    this.world.scale.set(this.cam.z);
  }

  private tick(): void {
    if (!this.ready) return;
    const now = performance.now();
    this.room.update(now, this.motion.reduced);
    for (const c of this.chars.values()) c.idle(now);
    this.charLayer.sortChildren();
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
