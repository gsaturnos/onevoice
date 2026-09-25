// The kitchen, in layers. `back` holds the wall, window, hanging lamp, shelves and
// the table's back edge + surface; `front` holds the near table rim and the
// foreground atmosphere. The renderer seats the cast BETWEEN the two so people sit
// into the table. The room warms by environmental phase and keeps a persistent
// warm "trace" once the table has acted together. Procedural — no image assets.

import { Container, Graphics } from 'pixi.js';
import { ROOM, LAMP, GLOW, WOOD, WOOD_DARK, WOOD_LIGHT, CLOTH, INK, EMBER, mix } from './palette';
import { STAGE_W, STAGE_H } from './scene';
import type { Phase } from './scene';

export class Room {
  readonly back = new Container();
  readonly front = new Container();

  private wall = new Graphics();
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
    // window (upper left) — warms with the room
    b.addChild(this.sideWindows);
    b.addChild(this.window);
    this.buildShelves(b);
    b.addChild(this.lampPool);
    this.buildLampFixture(b);
    b.addChild(this.shaft);
    this.buildTableBack(b);
    this.buildTableTop(b);
    b.addChild(this.flame);
    b.addChild(this.lantern);
    this.paintWall();
  }

  private buildFront(): void {
    this.buildTableFront(this.front);
    this.buildForeground(this.front);
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
    // floor line + boards
    const floorY = 372;
    w.rect(0, floorY, STAGE_W, STAGE_H - floorY).fill({ color: mix(WOOD_DARK, bot, 0.4) });
    for (let x = 40; x < STAGE_W; x += 70) {
      w.moveTo(x, floorY).lineTo(x - 18, STAGE_H).stroke({ width: 1, color: INK, alpha: 0.25 });
    }
    w.moveTo(0, floorY).lineTo(STAGE_W, floorY).stroke({ width: 2, color: INK, alpha: 0.4 });

    // lamp warmth pool over the table, brightening with warmth
    const lp = this.lampPool;
    lp.clear();
    const cx = 360, cy = 250;
    for (let i = 8; i >= 1; i--) {
      const r = i * 34;
      lp.ellipse(cx, cy, r, r * 0.72).fill({ color: GLOW, alpha: (0.03 + 0.05 * this.warmT) * (1 - i / 9) });
    }

    // window glow by warmth
    this.paintWindow();
  }

  private paintWindow(): void {
    const warm = this.warmT;
    const g = this.window;
    g.clear();
    const wx = 70, wy = 70, ww = 150, wh = 120;
    // frame
    g.rect(wx - 8, wy - 8, ww + 16, wh + 16).fill({ color: mix(WOOD_DARK, WOOD, 0.5) }).stroke({ width: 2, color: INK, alpha: 0.6 });
    // night sky → warm dawn as the room awakens
    const sky = mix(0x11151f, 0x3a2a20, warm);
    g.rect(wx, wy, ww, wh).fill({ color: sky });
    // interior warm light spilling on the glass
    g.rect(wx, wy, ww, wh).fill({ color: GLOW, alpha: 0.05 + 0.35 * warm });
    // panes
    g.moveTo(wx + ww / 2, wy).lineTo(wx + ww / 2, wy + wh)
      .moveTo(wx, wy + wh / 2).lineTo(wx + ww, wy + wh / 2)
      .stroke({ width: 3, color: mix(WOOD_DARK, WOOD, 0.5) });
    // a couple of stars fade as dawn warms
    g.circle(wx + 30, wy + 26, 1.3).circle(wx + 108, wy + 40, 1).fill({ color: 0xdfe6ff, alpha: 0.6 * (1 - warm) });

    // neighbouring windows across a courtyard: dark when silent, warm when awakening
    const sw = this.sideWindows;
    sw.clear();
    const lit = this.phase === 'silent' ? 0 : this.phase === 'awakening' ? 0.5 : 1;
    const spots = [[520, 60], [572, 60], [520, 108], [612, 92], [560, 120]];
    spots.forEach(([x, y], i) => {
      const on = lit > 0 && (i / spots.length) <= lit + 0.05;
      sw.rect(x, y, 30, 34).fill({ color: on ? mix(0x2a1d13, GLOW, 0.5 + 0.4 * warm) : 0x1a140f })
        .stroke({ width: 1.5, color: INK, alpha: 0.5 });
      sw.moveTo(x + 15, y).lineTo(x + 15, y + 34).moveTo(x, y + 17).lineTo(x + 30, y + 17)
        .stroke({ width: 1, color: INK, alpha: 0.4 });
    });

    // soft light shaft from the window onto the floor
    const sh = this.shaft;
    sh.clear();
    sh.moveTo(wx + 10, wy + wh).lineTo(wx + ww, wy + wh).lineTo(wx + ww + 120, 372).lineTo(wx - 30, 372)
      .closePath().fill({ color: GLOW, alpha: 0.03 + 0.06 * warm });
  }

  private buildShelves(b: Container): void {
    const g = new Graphics();
    const y = 150;
    g.rect(250, y, 150, 7).fill({ color: WOOD }).stroke({ width: 1.5, color: INK, alpha: 0.5 });
    // jars / tins as paper-cut shapes
    const jar = (x: number, c: number, h: number): void => {
      g.rect(x, y - h, 16, h).fill({ color: c }).stroke({ width: 1.5, color: INK, alpha: 0.5 });
      g.rect(x - 1, y - h - 3, 18, 4).fill({ color: mix(c, INK, 0.4) });
    };
    jar(262, mix(EMBER, INK, 0.3), 22);
    jar(286, mix(CLOTH, INK, 0.2), 30);
    jar(312, mix(WOOD_LIGHT, INK, 0.2), 18);
    jar(340, mix(0x7c7b4a, INK, 0.2), 26);
    jar(366, mix(0x5f7488, INK, 0.2), 20);
    b.addChild(g);
  }

  private buildLampFixture(b: Container): void {
    const g = new Graphics();
    g.moveTo(360, 0).lineTo(360, 150).stroke({ width: 2, color: INK, alpha: 0.6 }); // cord
    // shade
    g.moveTo(330, 176).lineTo(390, 176).lineTo(378, 150).lineTo(342, 150).closePath()
      .fill({ color: mix(WOOD_DARK, INK, 0.2) }).stroke({ width: 2, color: INK, alpha: 0.7 });
    b.addChild(g);
    // bulb glow lives in `flame` so it can flicker
  }

  private buildTableBack(b: Container): void {
    const g = new Graphics();
    const cx = 360, cy = 292, rx = 250, ry = 104;
    // full ellipse top surface
    g.ellipse(cx, cy, rx, ry).fill({ color: WOOD }).stroke({ width: 3, color: INK, alpha: 0.7 });
    // tablecloth centre
    g.ellipse(cx, cy, rx * 0.66, ry * 0.6).fill({ color: mix(CLOTH, WOOD, 0.2), alpha: 0.92 });
    g.ellipse(cx, cy, rx * 0.66, ry * 0.6).stroke({ width: 1.5, color: mix(CLOTH, GLOW, 0.4), alpha: 0.4 });
    b.addChild(g);
  }

  private buildTableTop(b: Container): void {
    const g = new Graphics();
    const cx = 360, cy = 292;
    // the focal oil lamp at the centre of the table
    g.rect(cx - 9, cy - 6, 18, 16).fill({ color: mix(WOOD_LIGHT, GLOW, 0.3) }).stroke({ width: 1.5, color: INK, alpha: 0.6 }); // base
    g.moveTo(cx - 7, cy - 6).lineTo(cx - 4, cy - 20).lineTo(cx + 4, cy - 20).lineTo(cx + 7, cy - 6).closePath()
      .fill({ color: mix(0xf0e4c8, GLOW, 0.3), alpha: 0.85 }).stroke({ width: 1.2, color: INK, alpha: 0.4 }); // glass chimney
    // bread, cups, a folded paper around it (paper-cut)
    g.ellipse(cx - 120, cy + 8, 26, 12).fill({ color: mix(WOOD_LIGHT, EMBER, 0.4) }).stroke({ width: 1.5, color: INK, alpha: 0.5 }); // bread board
    const cup = (x: number, y: number, c: number): void => {
      g.ellipse(x, y, 9, 5).fill({ color: c }).stroke({ width: 1.2, color: INK, alpha: 0.5 });
    };
    cup(cx + 96, cy + 6, mix(CLOTH, 0xffffff, 0.4));
    cup(cx + 150, cy - 8, mix(0x5f7488, 0xffffff, 0.3));
    cup(cx - 60, cy - 18, mix(0xc56a4a, 0xffffff, 0.3));
    g.moveTo(cx + 40, cy + 14).lineTo(cx + 74, cy + 20).lineTo(cx + 70, cy + 30).lineTo(cx + 36, cy + 24).closePath()
      .fill({ color: 0xe9ddc4, alpha: 0.9 }).stroke({ width: 1, color: INK, alpha: 0.4 }); // paper
    b.addChild(g);
  }

  private buildTableFront(front: Container): void {
    const g = new Graphics();
    const cx = 360, cy = 292, rx = 250, ry = 104;
    // near rim: a wooden band along the front of the ellipse, drawn over the
    // seated figures so they read as sitting at the table.
    g.moveTo(cx - rx, cy)
      .bezierCurveTo(cx - rx, cy + ry + 18, cx + rx, cy + ry + 18, cx + rx, cy)
      .lineTo(cx + rx, cy + 14)
      .bezierCurveTo(cx + rx, cy + ry + 30, cx - rx, cy + ry + 30, cx - rx, cy + 14)
      .closePath()
      .fill({ color: WOOD_DARK })
      .stroke({ width: 3, color: INK, alpha: 0.7 });
    g.moveTo(cx - rx + 8, cy + ry - 6)
      .bezierCurveTo(cx - 120, cy + ry + 14, cx + 120, cy + ry + 14, cx + rx - 8, cy + ry - 6)
      .stroke({ width: 2, color: mix(WOOD, GLOW, 0.3), alpha: 0.3 });
    front.addChild(g);
  }

  private buildForeground(front: Container): void {
    const g = new Graphics();
    // vignette: dark inked corners frame the scene without hard borders
    const edge = 90;
    for (let i = 0; i < 6; i++) {
      const a = 0.05 * (1 - i / 6);
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
      // a lantern brought to the table stays lit — the persistent consequence
      const cx = 360, cy = 214;
      l.moveTo(cx, 176).lineTo(cx, cy - 16).stroke({ width: 1.5, color: INK, alpha: 0.5 });
      l.rect(cx - 12, cy - 16, 24, 30).fill({ color: mix(WOOD_DARK, GLOW, 0.2) }).stroke({ width: 2, color: INK, alpha: 0.7 });
      l.rect(cx - 8, cy - 12, 16, 22).fill({ color: GLOW, alpha: 0.85 });
      for (let i = 4; i >= 1; i--) l.circle(cx, cy - 2, i * 12).fill({ color: GLOW, alpha: 0.06 * (1 - i / 5) });
    }
  }

  update(tMs: number, reduceMotion: boolean): void {
    // ease warmth, repaint only when it moves enough to matter
    const before = this.warmT;
    this.warmT += (this.warmTarget - this.warmT) * 0.06;
    if (Math.abs(this.warmT - before) > 0.004) {
      this.paintWall();
    }
    // lamp flame flicker
    const f = this.flame;
    f.clear();
    const flick = reduceMotion ? 1 : 0.9 + Math.sin(tMs / 90) * 0.06 + Math.sin(tMs / 37) * 0.04;
    // hanging bulb
    const bx = 360, by = 168;
    for (let i = 5; i >= 1; i--) f.circle(bx, by, i * 7 * flick).fill({ color: GLOW, alpha: 0.10 * (1 - i / 6) });
    f.circle(bx, by, 6).fill({ color: mix(LAMP, 0xffffff, 0.4) });
    // table oil-lamp flame, grows with warmth
    const cx = 360, cy = 292;
    const fh = (6 + 10 * this.warmT) * flick;
    f.moveTo(cx, cy - 20 - fh).quadraticCurveTo(cx + 5, cy - 20, cx, cy - 16)
      .quadraticCurveTo(cx - 5, cy - 20, cx, cy - 20 - fh).fill({ color: EMBER, alpha: 0.9 });
    f.moveTo(cx, cy - 18 - fh * 0.6).quadraticCurveTo(cx + 2.5, cy - 19, cx, cy - 16)
      .quadraticCurveTo(cx - 2.5, cy - 19, cx, cy - 18 - fh * 0.6).fill({ color: mix(LAMP, 0xffffff, 0.5) });
    for (let i = 4; i >= 1; i--) f.circle(cx, cy - 20, i * 9 * (0.5 + this.warmT)).fill({ color: GLOW, alpha: 0.05 * (1 - i / 5) });
  }
}
