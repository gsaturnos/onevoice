// The kitchen, in layers. `back` holds the wall, window, hanging lamp, shelves, a
// soft backdrop that lifts the cast off the wall, and the table's surface; `front`
// holds the near table rim and a light framing vignette. The renderer seats the
// cast BETWEEN the two, behind a LOW foreground table, so figures can be drawn
// large without the table crossing their faces, hands or props. The room warms by
// environmental phase and keeps a persistent "trace" once the table has acted
// together. Procedural — no image assets.

import { Container, Graphics } from 'pixi.js';
import { ROOM, LAMP, GLOW, WOOD, WOOD_DARK, WOOD_LIGHT, CLOTH, INK, EMBER, mix } from './palette';
import { STAGE_W, STAGE_H, TABLE } from './scene';
import type { Phase } from './scene';

const T = TABLE; // { cx, cy, rx, ry } — the low near table

export class Room {
  readonly back = new Container();
  readonly front = new Container();

  private wall = new Graphics();
  private backdrop = new Graphics(); // soft pool that separates figures from wall
  private lampPool = new Graphics();
  private window = new Graphics();
  private sideWindows = new Graphics();
  private flame = new Graphics();
  private lantern = new Graphics(); // persistent trace, lit after the cascade
  private shaft = new Graphics();

  private warmT = 0; // eased environmental warmth
  private warmTarget = 0;
  private phase: Phase = 'silent';
  private trace = false;

  constructor() {
    this.buildBack();
    this.buildFront();
  }

  private buildBack(): void {
    const b = this.back;
    b.addChild(this.wall);
    b.addChild(this.sideWindows);
    b.addChild(this.window);
    this.buildShelves(b);
    b.addChild(this.backdrop);
    b.addChild(this.lampPool);
    this.buildLampFixture(b);
    b.addChild(this.shaft);
    this.buildTableSurface(b);
    this.buildTableItems(b);
    b.addChild(this.flame);
    b.addChild(this.lantern);
    this.paintWall();
  }

  private buildFront(): void {
    this.buildTableRim(this.front);
    this.buildVignette(this.front);
  }

  private paintWall(): void {
    const top = mix(ROOM.silentTop, ROOM.actingTop, this.warmT);
    const bot = mix(ROOM.silentBottom, ROOM.actingBottom, this.warmT);
    const w = this.wall;
    w.clear();
    // banded vertical gradient (paper-cut steps read as screen-print)
    const bands = 10;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      w.rect(0, (STAGE_H * i) / bands, STAGE_W, STAGE_H / bands + 1).fill({ color: mix(top, bot, t) });
    }

    // a soft warm backdrop behind the cast so lit figures separate from the wall
    const bd = this.backdrop;
    bd.clear();
    const bx = 360, by = 250;
    for (let i = 9; i >= 1; i--) {
      const rx = i * 46, ry = i * 26;
      bd.ellipse(bx, by, rx, ry).fill({ color: mix(0x120b07, GLOW, 0.05 + 0.05 * this.warmT), alpha: 0.10 * (1 - i / 10) });
    }

    // lamp warmth pool spilling down over the group from the hanging bulb
    const lp = this.lampPool;
    lp.clear();
    const cx = 360, cy = 210;
    for (let i = 8; i >= 1; i--) {
      const r = i * 40;
      lp.ellipse(cx, cy, r, r * 0.82).fill({ color: GLOW, alpha: (0.024 + 0.05 * this.warmT) * (1 - i / 9) });
    }

    this.paintWindow();
  }

  private paintWindow(): void {
    const warm = this.warmT;
    const g = this.window;
    g.clear();
    const wx = 56, wy = 56, ww = 128, wh = 100;
    g.rect(wx - 8, wy - 8, ww + 16, wh + 16).fill({ color: mix(WOOD_DARK, WOOD, 0.5) }).stroke({ width: 2, color: INK, alpha: 0.6 });
    const sky = mix(0x11151f, 0x3a2a20, warm);
    g.rect(wx, wy, ww, wh).fill({ color: sky });
    g.rect(wx, wy, ww, wh).fill({ color: GLOW, alpha: 0.05 + 0.32 * warm });
    g.moveTo(wx + ww / 2, wy).lineTo(wx + ww / 2, wy + wh)
      .moveTo(wx, wy + wh / 2).lineTo(wx + ww, wy + wh / 2)
      .stroke({ width: 3, color: mix(WOOD_DARK, WOOD, 0.5) });
    g.circle(wx + 26, wy + 22, 1.3).circle(wx + 92, wy + 34, 1).fill({ color: 0xdfe6ff, alpha: 0.6 * (1 - warm) });

    // neighbouring windows across a courtyard: dark when silent, warm when awakening
    const sw = this.sideWindows;
    sw.clear();
    const lit = this.phase === 'silent' ? 0 : this.phase === 'awakening' ? 0.5 : 1;
    const spots = [[556, 46], [606, 46], [556, 96], [648, 78]];
    spots.forEach(([x, y], i) => {
      const on = lit > 0 && (i / spots.length) <= lit + 0.05;
      sw.rect(x, y, 28, 32).fill({ color: on ? mix(0x2a1d13, GLOW, 0.5 + 0.4 * warm) : 0x1a140f })
        .stroke({ width: 1.5, color: INK, alpha: 0.5 });
      sw.moveTo(x + 14, y).lineTo(x + 14, y + 32).moveTo(x, y + 16).lineTo(x + 28, y + 16)
        .stroke({ width: 1, color: INK, alpha: 0.4 });
    });

    // soft light shaft from the window (kept faint so it never crosses the cast)
    const sh = this.shaft;
    sh.clear();
    sh.moveTo(wx + 8, wy + wh).lineTo(wx + ww, wy + wh).lineTo(wx + ww + 70, 300).lineTo(wx - 20, 300)
      .closePath().fill({ color: GLOW, alpha: 0.02 + 0.04 * warm });
  }

  private buildShelves(b: Container): void {
    const g = new Graphics();
    const y = 120;
    g.rect(250, y, 130, 6).fill({ color: WOOD }).stroke({ width: 1.5, color: INK, alpha: 0.5 });
    const jar = (x: number, c: number, h: number): void => {
      g.rect(x, y - h, 14, h).fill({ color: c }).stroke({ width: 1.5, color: INK, alpha: 0.5 });
      g.rect(x - 1, y - h - 3, 16, 4).fill({ color: mix(c, INK, 0.4) });
    };
    jar(262, mix(EMBER, INK, 0.3), 20);
    jar(286, mix(CLOTH, INK, 0.2), 26);
    jar(312, mix(WOOD_LIGHT, INK, 0.2), 16);
    jar(338, mix(0x7c7b4a, INK, 0.2), 22);
    b.addChild(g);
  }

  private buildLampFixture(b: Container): void {
    const g = new Graphics();
    // a short-corded pendant lamp lifted ABOVE the back row of heads
    g.moveTo(360, 0).lineTo(360, 100).stroke({ width: 2, color: INK, alpha: 0.55 });
    g.moveTo(338, 122).lineTo(382, 122).lineTo(374, 100).lineTo(346, 100).closePath()
      .fill({ color: mix(WOOD_DARK, INK, 0.2) }).stroke({ width: 2, color: INK, alpha: 0.7 });
    b.addChild(g);
    // bulb glow lives in `flame` so it can flicker
  }

  private buildTableSurface(b: Container): void {
    const g = new Graphics();
    // the near table: a low, shallow ellipse the cast sits behind
    g.ellipse(T.cx, T.cy, T.rx, T.ry).fill({ color: WOOD }).stroke({ width: 3, color: INK, alpha: 0.7 });
    // a soft runner down the middle (kept subtle so the table doesn't dominate)
    g.ellipse(T.cx, T.cy, T.rx * 0.5, T.ry * 0.62).fill({ color: mix(CLOTH, WOOD, 0.25), alpha: 0.55 });
    b.addChild(g);
  }

  private buildTableItems(b: Container): void {
    const g = new Graphics();
    const cx = T.cx, cy = T.cy - 6;
    // focal oil lamp at the centre of the table
    g.rect(cx - 9, cy - 6, 18, 16).fill({ color: mix(WOOD_LIGHT, GLOW, 0.3) }).stroke({ width: 1.5, color: INK, alpha: 0.6 });
    g.moveTo(cx - 7, cy - 6).lineTo(cx - 4, cy - 20).lineTo(cx + 4, cy - 20).lineTo(cx + 7, cy - 6).closePath()
      .fill({ color: mix(0xf0e4c8, GLOW, 0.3), alpha: 0.85 }).stroke({ width: 1.2, color: INK, alpha: 0.4 });
    // bread board, cups, a folded paper around it (paper-cut, along the near edge)
    g.ellipse(cx - 190, cy + 10, 26, 11).fill({ color: mix(WOOD_LIGHT, EMBER, 0.4) }).stroke({ width: 1.5, color: INK, alpha: 0.5 });
    const cup = (x: number, y: number, c: number): void => {
      g.ellipse(x, y, 9, 5).fill({ color: c }).stroke({ width: 1.2, color: INK, alpha: 0.5 });
    };
    cup(cx + 150, cy + 8, mix(CLOTH, 0xffffff, 0.4));
    cup(cx + 232, cy - 2, mix(0x5f7488, 0xffffff, 0.3));
    cup(cx - 92, cy - 6, mix(0xc56a4a, 0xffffff, 0.3));
    g.moveTo(cx + 54, cy + 12).lineTo(cx + 92, cy + 18).lineTo(cx + 88, cy + 28).lineTo(cx + 50, cy + 22).closePath()
      .fill({ color: 0xe9ddc4, alpha: 0.85 }).stroke({ width: 1, color: INK, alpha: 0.4 });
    b.addChild(g);
  }

  private buildTableRim(front: Container): void {
    const g = new Graphics();
    // the near wooden rim: a low band drawn over the base of the seated figures so
    // they read as sitting at the table, without rising over torsos or props.
    g.moveTo(T.cx - T.rx, T.cy)
      .bezierCurveTo(T.cx - T.rx, T.cy + T.ry + 14, T.cx + T.rx, T.cy + T.ry + 14, T.cx + T.rx, T.cy)
      .lineTo(T.cx + T.rx, T.cy + 12)
      .bezierCurveTo(T.cx + T.rx, T.cy + T.ry + 26, T.cx - T.rx, T.cy + T.ry + 26, T.cx - T.rx, T.cy + 12)
      .closePath()
      .fill({ color: WOOD_DARK })
      .stroke({ width: 3, color: INK, alpha: 0.7 });
    g.moveTo(T.cx - T.rx + 8, T.cy + T.ry - 6)
      .bezierCurveTo(T.cx - 150, T.cy + T.ry + 10, T.cx + 150, T.cy + T.ry + 10, T.cx + T.rx - 8, T.cy + T.ry - 6)
      .stroke({ width: 2, color: mix(WOOD, GLOW, 0.3), alpha: 0.3 });
    front.addChild(g);
  }

  private buildVignette(front: Container): void {
    const g = new Graphics();
    // a light inked frame — enough to focus the eye, not enough to hide edge figures
    const edge = 70;
    for (let i = 0; i < 5; i++) {
      const a = 0.03 * (1 - i / 5);
      g.rect(0, 0, STAGE_W, edge - i * 14).fill({ color: 0x000000, alpha: a });
      g.rect(0, STAGE_H - (edge - i * 14), STAGE_W, edge).fill({ color: 0x000000, alpha: a });
      g.rect(0, 0, edge - i * 14, STAGE_H).fill({ color: 0x000000, alpha: a });
      g.rect(STAGE_W - (edge - i * 14), 0, edge, STAGE_H).fill({ color: 0x000000, alpha: a });
    }
    front.addChild(g);
  }

  setEnv(phase: Phase, t: number): void {
    this.phase = phase;
    this.warmTarget = t;
  }

  /** Keep the room warm once the table has acted together. */
  setTrace(on: boolean): void {
    if (on === this.trace) return;
    this.trace = on;
    const l = this.lantern;
    l.clear();
    if (on) {
      // a lantern set on the table stays lit — the persistent consequence
      const cx = T.cx + 120, cy = T.cy - 18;
      l.rect(cx - 11, cy - 14, 22, 28).fill({ color: mix(WOOD_DARK, GLOW, 0.2) }).stroke({ width: 2, color: INK, alpha: 0.7 });
      l.rect(cx - 7, cy - 10, 14, 20).fill({ color: GLOW, alpha: 0.85 });
      for (let i = 4; i >= 1; i--) l.circle(cx, cy, i * 11).fill({ color: GLOW, alpha: 0.06 * (1 - i / 5) });
    }
  }

  update(tMs: number, reduceMotion: boolean): void {
    const before = this.warmT;
    this.warmT += (this.warmTarget - this.warmT) * 0.06;
    if (Math.abs(this.warmT - before) > 0.004) {
      this.paintWall();
    }
    const f = this.flame;
    f.clear();
    const flick = reduceMotion ? 1 : 0.9 + Math.sin(tMs / 90) * 0.06 + Math.sin(tMs / 37) * 0.04;
    // hanging bulb (above the cast)
    const bx = 360, by = 116;
    for (let i = 5; i >= 1; i--) f.circle(bx, by, i * 6 * flick).fill({ color: GLOW, alpha: 0.09 * (1 - i / 6) });
    f.circle(bx, by, 5).fill({ color: mix(LAMP, 0xffffff, 0.4) });
    // table oil-lamp flame, grows with warmth
    const cx = T.cx, cy = T.cy - 6;
    const fh = (6 + 10 * this.warmT) * flick;
    f.moveTo(cx, cy - 20 - fh).quadraticCurveTo(cx + 5, cy - 20, cx, cy - 16)
      .quadraticCurveTo(cx - 5, cy - 20, cx, cy - 20 - fh).fill({ color: EMBER, alpha: 0.9 });
    f.moveTo(cx, cy - 18 - fh * 0.6).quadraticCurveTo(cx + 2.5, cy - 19, cx, cy - 16)
      .quadraticCurveTo(cx - 2.5, cy - 19, cx, cy - 18 - fh * 0.6).fill({ color: mix(LAMP, 0xffffff, 0.5) });
    for (let i = 4; i >= 1; i--) f.circle(cx, cy - 20, i * 8 * (0.5 + this.warmT)).fill({ color: GLOW, alpha: 0.045 * (1 - i / 5) });
  }
}
