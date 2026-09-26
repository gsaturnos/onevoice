// The effects layer: relationship threads between seats, the warm signal a talk
// sends, the overnight propagation shimmer, and the cascade bloom. It draws only
// from coordinates the renderer hands it and returns promises so the app can
// sequence sound and UI alongside. No game state here.

import { Container, Graphics } from 'pixi.js';
import { GLOW, CLARITY_BRIGHT, YOU, mix } from './palette';
import { tween, wait, type Motion } from './anim';
import { STAGE_W, STAGE_H } from './scene';

export interface Pt { x: number; y: number }

export class Fx {
  readonly threads = new Container(); // relationship lines (under characters)
  readonly overlay = new Container(); // signals, bloom (over characters)

  constructor(private readonly motion: Motion) {}

  /**
   * Redraw relationship threads SELECTIVELY: only the ties touching `focus` (the
   * selected person and their neighbours) are drawn, as a warm action-preview. With
   * no focus the layer is cleared, so the resting scene shows no web across faces.
   */
  drawThreads(links: Array<[number, number, number]>, pos: Map<number, Pt>, focus: Set<number>): void {
    const g = this.threads;
    g.removeChildren();
    if (focus.size === 0) return;
    const hot = new Graphics();
    for (const [i, j] of links) {
      if (!focus.has(i) && !focus.has(j)) continue;
      const a = pos.get(i);
      const b = pos.get(j);
      if (!a || !b) continue;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 + 12; // slight sag, like a shared thread
      hot.moveTo(a.x, a.y - 24).quadraticCurveTo(mx, my, b.x, b.y - 24);
    }
    hot.stroke({ width: 2.4, color: GLOW, alpha: 0.55 });
    g.addChild(hot);
  }

  /** A warm mote travels from the speaker to the listener. */
  async signal(from: Pt, to: Pt): Promise<void> {
    const g = new Graphics();
    this.overlay.addChild(g);
    const cx = (from.x + to.x) / 2;
    const cy = Math.min(from.y, to.y) - 46; // arc up between them
    await tween(560, (t) => {
      const x = quad(from.x, cx, to.x, t);
      const y = quad(from.y - 30, cy, to.y - 30, t);
      g.clear();
      g.circle(x, y, 6).fill({ color: mix(YOU, GLOW, 0.4), alpha: 0.95 });
      g.circle(x, y, 12).fill({ color: GLOW, alpha: 0.25 });
      // a fading tail
      const tx = quad(from.x, cx, to.x, Math.max(0, t - 0.12));
      const ty = quad(from.y - 30, cy, to.y - 30, Math.max(0, t - 0.12));
      g.circle(tx, ty, 4).fill({ color: GLOW, alpha: 0.2 });
    }, this.motion);
    // a small bloom at the listener
    await tween(260, (t) => {
      g.clear();
      g.circle(to.x, to.y - 30, 8 + t * 16).stroke({ width: 2 * (1 - t), color: CLARITY_BRIGHT, alpha: 0.8 * (1 - t) });
    }, this.motion);
    g.destroy();
  }

  /** A quieter shimmer along a link, for overnight propagation. */
  async flow(from: Pt, to: Pt, strength: number): Promise<void> {
    const g = new Graphics();
    this.overlay.addChild(g);
    await tween(460, (t) => {
      const x = from.x + (to.x - from.x) * t;
      const y = (from.y - 30) + ((to.y - 30) - (from.y - 30)) * t;
      g.clear();
      g.circle(x, y, 3 + 3 * strength).fill({ color: CLARITY_BRIGHT, alpha: 0.7 * (1 - t * 0.3) });
      g.circle(x, y, 8).fill({ color: CLARITY_BRIGHT, alpha: 0.15 });
    }, this.motion);
    g.destroy();
  }

  /** Run several flows together (overnight diffusion happens at once). */
  async flows(list: Array<{ from: Pt; to: Pt; strength: number }>): Promise<void> {
    if (!list.length) return;
    await Promise.all(list.map((f) => this.flow(f.from, f.to, f.strength)));
  }

  /** The emotional payoff: light sweeps the room from a centre outward. */
  async cascade(center: Pt, points: Pt[]): Promise<void> {
    const g = new Graphics();
    this.overlay.addChild(g);
    // 1. a bright ring blooms outward across the whole scene
    await tween(900, (t) => {
      g.clear();
      const r = t * 640;
      g.circle(center.x, center.y, r).stroke({ width: 22 * (1 - t), color: GLOW, alpha: 0.5 * (1 - t) });
      g.circle(center.x, center.y, r * 0.7).stroke({ width: 12 * (1 - t), color: CLARITY_BRIGHT, alpha: 0.4 * (1 - t) });
      // a warm wash rising over everything
      g.rect(0, 0, STAGE_W, STAGE_H).fill({ color: GLOW, alpha: 0.18 * Math.sin(t * Math.PI) });
    }, this.motion);
    // 2. sparks lift from each person who joined
    await tween(700, (t) => {
      g.clear();
      for (const p of points) {
        const y = p.y - 30 - t * 30;
        g.circle(p.x, y, 3 * (1 - t) + 1).fill({ color: GLOW, alpha: 0.9 * (1 - t) });
      }
      g.rect(0, 0, STAGE_W, STAGE_H).fill({ color: GLOW, alpha: 0.12 * (1 - t) });
    }, this.motion);
    g.destroy();
  }

  /** A brief settle wash used when a turn ends. */
  async settle(): Promise<void> {
    const g = new Graphics();
    this.overlay.addChild(g);
    await tween(360, (t) => {
      g.clear();
      g.rect(0, 0, STAGE_W, STAGE_H).fill({ color: 0x0a0806, alpha: 0.16 * Math.sin(t * Math.PI) });
    }, this.motion);
    g.destroy();
  }

  async pause(ms: number): Promise<void> {
    await wait(ms, this.motion);
  }
}

function quad(a: number, b: number, c: number, t: number): number {
  const u = 1 - t;
  return u * u * a + 2 * u * t * b + t * t * c;
}
