// PixiJS renderer. It OBSERVES a read-only snapshot and draws it. It owns no
// game state and never advances the simulation — the boundary the architecture
// is built to prove. All art is procedural Graphics (no image assets).

import { Application, Container, Graphics } from 'pixi.js';
import type { Snapshot } from '@core/types';

export class PixiStage {
  readonly app: Application;
  private links = new Graphics();
  private figures = new Container();
  private ready = false;

  constructor(private readonly width = 720, private readonly height = 440) {
    this.app = new Application();
  }

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      width: this.width,
      height: this.height,
      background: '#15100f',
      antialias: true,
      resolution: Math.min(2, globalThis.devicePixelRatio || 1),
      autoDensity: true,
    });
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.links);
    this.app.stage.addChild(this.figures);
    this.ready = true;
  }

  /** Pure read of the snapshot → visuals. Called each frame. */
  update(s: Snapshot): void {
    if (!this.ready) return;
    this.drawLinks(s);
    this.drawFigures(s);
  }

  private drawLinks(s: Snapshot): void {
    const g = this.links;
    g.clear();
    for (const [i, j] of s.links) {
      const a = s.agents[i];
      const b = s.agents[j];
      if (a.gone || b.gone) continue;
      g.moveTo(a.x, a.y).lineTo(b.x, b.y);
    }
    g.stroke({ width: 1, color: 0xe8e4d8, alpha: 0.09 });
  }

  private drawFigures(s: Snapshot): void {
    const c = this.figures;
    c.removeChildren();
    s.agents.forEach((a, i) => {
      if (a.gone) return;
      const t = a.inc ? 0.85 : a.aw; // posture/warmth rises with awareness
      const col = warmthColor(t);
      const g = new Graphics();
      const h = 10 + 9 * t;
      g.moveTo(a.x, a.y).lineTo(a.x, a.y - h).stroke({ width: 3, color: col, cap: 'round' });
      g.circle(a.x, a.y - h - 4, 4 + 2 * t).fill({ color: col });
      if (i === s.player) {
        g.circle(a.x, a.y - 5, 18).stroke({ width: 2.5, color: 0x8d7bdb });
      }
      c.addChild(g);
    });
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}

/** grey (afraid) → green (aware). Mirrors the production awareness ramp. */
function warmthColor(t: number): number {
  const r = Math.round(106 + (79 - 106) * t);
  const g = Math.round(109 + (174 - 109) * t);
  const b = Math.round(117 + (141 - 117) * t);
  return (r << 16) | (g << 8) | b;
}
