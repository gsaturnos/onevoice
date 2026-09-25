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
import { Fx, type Pt } from './Fx';
import { buildScene, envState, type SceneModel } from './scene';
import { tween, type Motion } from './anim';
import { STAGE_W, STAGE_H } from './scene';

export class PixiStage {
  readonly app: Application;
  private world = new Container();
  private charLayer = new Container();
  private room = new Room();
  private motion: Motion = { reduced: false, speed: 1 };
  private fx = new Fx(this.motion);
  private chars = new Map<number, Character>();
  private scene: SceneModel | null = null;
  private ready = false;
  private selected: number | null = null;
  private selectCb: (idx: number) => void = () => {};
  private cam = { x: 0, y: 0, z: 1 };

  constructor() {
    this.app = new Application();
  }

  async init(host: HTMLElement, reduceMotion = false): Promise<void> {
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
    this.charLayer.sortableChildren = true;
    this.world.addChild(this.room.back, this.fx.threads, this.charLayer, this.room.front, this.fx.overlay);
    this.app.stage.addChild(this.world);
    this.ready = true;
    this.app.ticker.add(() => this.tick());
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
      const c = new Character(sa.idx, id, sa.scale, this.motion.reduced);
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
    const focus = new Set<number>();
    if (this.selected != null) {
      focus.add(this.selected);
      for (const j of s.neighbors[this.selected] || []) focus.add(j);
    }
    this.fx.drawThreads(s.links, this.posMap(), focus);
    // reduce unrelated visual noise while someone is selected
    for (const [idx, c] of this.chars) {
      c.alpha = this.selected == null || focus.has(idx) ? c.alpha : Math.min(c.alpha, 0.5);
    }
  }

  setSelected(idx: number | null, s: Snapshot): void {
    this.sync(s, idx);
    if (idx != null && !this.motion.reduced) {
      const p = this.scene?.byIdx.get(idx);
      if (p) void this.cameraTo(p.x, p.y - 20, 1.06);
    } else {
      void this.cameraTo(STAGE_W / 2, STAGE_H / 2, 1);
    }
  }

  // ---- animated sequences (called after the app commits the action) ----

  async playTalk(from: number, to: number): Promise<void> {
    const a = this.scene?.byIdx.get(from);
    const b = this.scene?.byIdx.get(to);
    if (!a || !b) return;
    await this.cameraTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 20, 1.08);
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
    const center = { x: STAGE_W / 2, y: 270 };
    await this.cameraTo(center.x, center.y, 1.12);
    await this.fx.cascade(center, pts);
    if (trace) this.room.setTrace(true);
    for (const i of joined) this.chars.get(i)?.playReact();
    await this.cameraTo(STAGE_W / 2, STAGE_H / 2, 1);
  }

  private async cameraTo(cx: number, cy: number, z: number): Promise<void> {
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

  private applyCam(cx: number, cy: number, z: number): void {
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
