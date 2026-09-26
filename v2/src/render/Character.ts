// One person at the table, drawn as an inked bust. Identity (garment, skin, hair,
// a role prop, a silhouette variant) is fixed at construction so a character is
// recognisable frame to frame; awareness drives posture (slumped → upright),
// expression (downcast → open), warmth, and a clarity halo — state shown by
// shape and light, not colour alone. Pure view object: it holds no game state and
// is told everything through setAwareness / setSelected / playReact.

import { Container, Graphics, Sprite } from 'pixi.js';
import { INK, INK_SOFT, GARMENTS, SKINS, HAIRS, GLOW, CLARITY_BRIGHT, YOU, mix, pick } from './palette';
import type { CharacterAtlas } from './assets/characterAtlas';
import type { AwarenessState } from './assets/atlasMath';
import { castIdFor } from './castIds';

export type PropKind =
  | 'care' | 'apron' | 'book' | 'music' | 'brim' | 'cap' | 'scarf' | 'plain';

export interface Identity {
  castId: string; // stable neighbour id → sprite-atlas frames + fallback shape
  garment: number;
  skin: number;
  hair: number;
  prop: PropKind;
  variant: number; // 0..2 shoulder/head silhouette variant
  hairVol: number; // 0..2 hair volume
  isPlayer: boolean;
}

const PROP_BY_ROLE: Array<[RegExp, PropKind]> = [
  [/nurse|doctor|pharmac/, 'care'],
  [/baker|cook|waiter|shopkeeper|vendor|barber|butcher/, 'apron'],
  [/teacher|librarian|student|clerk/, 'book'],
  [/music/, 'music'],
  [/farmer|fisher|garden/, 'brim'],
  [/driver|mechanic|electric|weld|carpenter|janitor|plumber/, 'cap'],
  [/seamstress|painter|tailor/, 'scarf'],
];

export function identityFor(idx: number, name: string, role: string, isPlayer: boolean): Identity {
  let seed = 2166136261;
  for (const ch of name + role) {
    seed ^= ch.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  seed = (seed >>> 0) + idx * 2654435761;
  let prop: PropKind = 'plain';
  for (const [re, kind] of PROP_BY_ROLE) if (re.test(role)) { prop = kind; break; }
  return {
    castId: castIdFor(idx),
    garment: pick(GARMENTS, idx),
    skin: pick(SKINS, (seed >>> 3) ^ idx),
    hair: pick(HAIRS, (seed >>> 7) + idx),
    prop,
    variant: (seed >>> 11) % 3,
    hairVol: (seed >>> 13) % 3,
    isPlayer,
  };
}

export class Character extends Container {
  private lean = new Container(); // pivoted body that straightens with awareness
  private torso = new Graphics();
  private head = new Container();
  private face = new Graphics();
  private halo = new Graphics();
  private ring = new Graphics(); // selection ring
  private sparks = new Container();
  private sprite?: Sprite;       // authored atlas bust, when available
  private ghost?: Sprite;        // outgoing frame during a state crossfade
  private readonly useSprite: boolean;

  private aw = 0;
  private clear = false;
  private leanTarget = 0.9; // 0 = upright, 1 = slumped
  private leanNow = 0.9;
  private selected = false;
  private selLift = 0;
  private reactT = 0;
  private readonly phase: number;

  constructor(
    readonly idx: number,
    private readonly id: Identity,
    private readonly baseScale: number,
    private readonly reduceMotion: boolean,
    private readonly atlas?: CharacterAtlas,
  ) {
    super();
    this.useSprite = !!atlas && atlas.has(id.castId);
    this.phase = (idx * 1.7) % (Math.PI * 2);
    this.scale.set(baseScale);
    this.addChild(this.ring);
    this.lean.addChild(this.torso);
    this.head.addChild(this.face);
    this.lean.addChild(this.head);
    this.addChild(this.lean);
    this.addChild(this.sparks);
    this.addChild(this.halo);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    // a generous hit area (centred on the bust) so canvas taps stay easy; the
    // HUD roster provides the guaranteed >=44 CSS px controls for touch/keyboard.
    this.hitArea = { contains: (x: number, y: number) => x * x + (y + 32) * (y + 32) < 50 * 50 };
    if (this.useSprite) this.buildSprite();
    else this.build();
  }

  /** Authored path: one atlas bust whose texture swaps with awareness state. */
  private buildSprite(): void {
    const a = this.atlas!;
    const s = new Sprite();
    s.anchor.set(a.anchor.x, a.anchor.y);
    this.sprite = s;
    this.applySpriteState('afraid', true);
    this.lean.addChild(s);
    if (this.id.isPlayer) {
      const aura = new Graphics();
      aura.circle(0, -58, 30).fill({ color: YOU, alpha: 0.12 });
      this.addChildAt(aura, 0);
    }
  }

  private applySpriteState(state: AwarenessState, instant: boolean): void {
    const a = this.atlas!;
    const tex = a.texture(this.id.castId, state);
    if (!this.sprite || !tex) return;
    if (!instant && !this.reduceMotion && this.sprite.texture !== tex) {
      // gentle crossfade: keep the old frame as a fading ghost above the new one
      this.ghost?.destroy();
      const g = new Sprite(this.sprite.texture);
      g.anchor.set(this.sprite.anchor.x, this.sprite.anchor.y);
      g.scale.copyFrom(this.sprite.scale);
      this.lean.addChild(g);
      this.ghost = g;
      const born = performance.now();
      const fade = (): void => {
        const k = Math.min(1, (performance.now() - born) / 260);
        g.alpha = 1 - k;
        if (k < 1) requestAnimationFrame(fade);
        else { g.destroy(); if (this.ghost === g) this.ghost = undefined; }
      };
      requestAnimationFrame(fade);
    }
    this.sprite.texture = tex;
    this.sprite.scale.set(a.localScaleFor(tex));
  }

  /** Draw the fixed silhouette once. */
  private build(): void {
    const g = this.torso;
    const sw = 26 + this.id.variant * 3; // shoulder half-width
    // coat / torso — a broad inked shape, occluded at the base by the table rim.
    g.moveTo(-sw, 6)
      .bezierCurveTo(-sw - 4, -20, -14, -34, 0, -34)
      .bezierCurveTo(14, -34, sw + 4, -20, sw, 6)
      .lineTo(sw - 2, 48)
      .lineTo(-(sw - 2), 48)
      .closePath()
      .fill({ color: this.id.garment })
      .stroke({ width: 2, color: INK, alpha: 0.9 });
    // collar / shoulder shading for a hand-inked feel
    g.moveTo(-sw + 5, -6).bezierCurveTo(-10, -20, 10, -20, sw - 5, -6)
      .stroke({ width: 2, color: mix(this.id.garment, INK, 0.45), alpha: 0.6 });

    // a role prop layered on the torso
    this.buildProp(g, sw);

    // neck + head
    const hg = new Graphics();
    hg.rect(-6, -46, 12, 14).fill({ color: mix(this.id.skin, INK, 0.15) }); // neck
    hg.circle(0, -58, 15).fill({ color: this.id.skin }).stroke({ width: 2, color: INK, alpha: 0.85 });
    // hair
    this.buildHair(hg);
    this.head.addChildAt(hg, 0);
    this.head.position.set(0, 0);

    this.drawFace();
    if (this.id.isPlayer) {
      // a quiet brass candle-warmth the player always carries
      const aura = new Graphics();
      aura.circle(0, -58, 30).fill({ color: YOU, alpha: 0.12 });
      this.addChildAt(aura, 0);
    }
  }

  private buildProp(g: Graphics, sw: number): void {
    switch (this.id.prop) {
      case 'care': // white cap + care cross
        g.rect(-13, -74, 26, 8).fill({ color: 0xf3ece0 }).stroke({ width: 1.5, color: INK, alpha: 0.6 });
        g.rect(-3, -20, 6, 16).fill({ color: 0xf3ece0 });
        g.rect(-8, -14, 16, 5).fill({ color: 0xc0503f });
        g.rect(-2.5, -18, 5, 12).fill({ color: 0xc0503f });
        break;
      case 'apron':
        g.moveTo(-16, -6).lineTo(16, -6).lineTo(13, 48).lineTo(-13, 48).closePath()
          .fill({ color: mix(this.id.garment, 0xf3ece0, 0.6), alpha: 0.9 });
        g.moveTo(-16, -6).lineTo(-6, -26).moveTo(16, -6).lineTo(6, -26)
          .stroke({ width: 2, color: INK, alpha: 0.5 });
        break;
      case 'book':
        g.rect(-14, 20, 28, 12).fill({ color: mix(this.id.garment, INK, 0.5) }).stroke({ width: 1.5, color: INK, alpha: 0.6 });
        g.moveTo(0, 20).lineTo(0, 32).stroke({ width: 1.5, color: GLOW, alpha: 0.5 });
        break;
      case 'music':
        g.ellipse(sw - 2, 20, 10, 13).fill({ color: mix(this.id.garment, INK, 0.4) }).stroke({ width: 1.5, color: INK, alpha: 0.6 });
        g.moveTo(sw + 4, 12).lineTo(sw + 16, -20).stroke({ width: 3, color: INK_SOFT });
        break;
      case 'brim': // wide brimmed hat
        g.ellipse(0, -70, 26, 7).fill({ color: mix(this.id.garment, INK, 0.55) }).stroke({ width: 1.5, color: INK, alpha: 0.6 });
        g.rect(-12, -80, 24, 12).fill({ color: mix(this.id.garment, INK, 0.55) });
        break;
      case 'cap':
        g.moveTo(-14, -70).bezierCurveTo(-14, -82, 14, -82, 14, -70).closePath()
          .fill({ color: mix(this.id.garment, INK, 0.5) }).stroke({ width: 1.5, color: INK, alpha: 0.6 });
        g.ellipse(6, -69, 12, 4).fill({ color: mix(this.id.garment, INK, 0.5) });
        break;
      case 'scarf':
        g.moveTo(-13, -44).bezierCurveTo(-6, -32, 6, -32, 13, -44).lineTo(9, -30)
          .bezierCurveTo(3, -24, -3, -24, -9, -30).closePath()
          .fill({ color: mix(this.id.garment, GLOW, 0.4) }).stroke({ width: 1.5, color: INK, alpha: 0.5 });
        break;
      default:
        break;
    }
  }

  private buildHair(hg: Graphics): void {
    if (this.id.prop === 'brim' || this.id.prop === 'cap' || this.id.prop === 'care') {
      // hat covers the crown; just side hair
      hg.moveTo(-15, -58).bezierCurveTo(-17, -50, -15, -46, -11, -46)
        .stroke({ width: 4, color: this.id.hair, alpha: 0.9 });
      hg.moveTo(15, -58).bezierCurveTo(17, -50, 15, -46, 11, -46)
        .stroke({ width: 4, color: this.id.hair, alpha: 0.9 });
      return;
    }
    const v = this.id.hairVol;
    const top = -72 - v * 3;
    hg.moveTo(-16, -56)
      .bezierCurveTo(-18, top, 18, top, 16, -56)
      .bezierCurveTo(12, -66, -12, -66, -16, -56)
      .closePath()
      .fill({ color: this.id.hair });
    if (v === 2) {
      hg.circle(-12, -66, 7).circle(12, -66, 7).circle(0, top + 4, 8).fill({ color: this.id.hair });
    }
  }

  /** Face is redrawn when the awareness bucket changes (cheap; a few strokes). */
  private drawFace(): void {
    const f = this.face;
    f.clear();
    const open = this.aw; // 0 worried/downcast → 1 open and warm
    const eyeY = -60;
    const mouthY = -50;

    // eyes are always small rounds (never angry slashes); they lift a touch and
    // gain a catch-light as the person comes to trust.
    const eyeDrop = open < 0.35 ? 1.2 : 0; // gaze lowered when afraid
    f.circle(-6, eyeY + eyeDrop, open < 0.35 ? 1.5 : 1.9)
      .circle(6, eyeY + eyeDrop, open < 0.35 ? 1.5 : 1.9)
      .fill({ color: INK, alpha: open < 0.35 ? 0.75 : 0.95 });
    if (open > 0.7) {
      f.circle(-6.6, eyeY - 0.6, 0.6).circle(5.4, eyeY - 0.6, 0.6).fill({ color: GLOW }); // hope
    }

    if (open < 0.35) {
      // worried brows: inner ends raised (sad/anxious, not the inner-down of anger)
      f.moveTo(-9, eyeY - 3).lineTo(-3, eyeY - 6)
        .moveTo(9, eyeY - 3).lineTo(3, eyeY - 6)
        .stroke({ width: 1.6, color: INK_SOFT, alpha: 0.7 });
      // small uncertain frown
      f.moveTo(-5, mouthY + 1).bezierCurveTo(0, mouthY - 2, 0, mouthY - 2, 5, mouthY + 1)
        .stroke({ width: 2, color: INK_SOFT, alpha: 0.8 });
    } else if (open < 0.7) {
      // steady, considering — a small level mouth
      f.moveTo(-6, mouthY).bezierCurveTo(0, mouthY + 2, 0, mouthY + 2, 6, mouthY)
        .stroke({ width: 2, color: INK_SOFT, alpha: 0.85 });
    } else {
      // open, warm smile
      f.moveTo(-7, mouthY - 1).bezierCurveTo(0, mouthY + 4, 0, mouthY + 4, 7, mouthY - 1)
        .stroke({ width: 2.4, color: INK_SOFT });
    }
  }

  setAwareness(aw: number, clear: boolean): void {
    const bucket = (v: number): number => (v < 0.35 ? 0 : v < 0.7 ? 1 : 2);
    const changed = bucket(aw) !== bucket(this.aw) || clear !== this.clear;
    this.aw = aw;
    this.clear = clear;
    this.leanTarget = 1 - Math.min(1, aw * 1.15); // upright as awareness rises
    if (this.useSprite) {
      // posture, expression and warmth are baked per state frame; halo still tracks
      // the real in-game clarity threshold, not the sprite bucket.
      if (changed) {
        this.applySpriteState(this.atlas!.state(aw), false);
        this.drawHalo();
      }
    } else {
      // warmth tint: cool/dim when afraid, natural when awake
      this.lean.tint = mix(0x9fa2ab, 0xffffff, Math.min(1, 0.35 + aw));
      if (changed) {
        this.drawFace();
        this.drawHalo();
      }
    }
  }

  private drawHalo(): void {
    const h = this.halo;
    h.clear();
    if (this.clear) {
      // a small steady ring of light above the head — "seeing clearly", by shape
      h.circle(0, -58, 22).stroke({ width: 2, color: CLARITY_BRIGHT, alpha: 0.55 });
      h.circle(0, -58, 26).stroke({ width: 1, color: CLARITY_BRIGHT, alpha: 0.25 });
    }
  }

  setSelected(on: boolean): void {
    this.selected = on;
    const r = this.ring;
    r.clear();
    if (on) {
      r.ellipse(0, -30, 40, 52).stroke({ width: 2.5, color: YOU, alpha: 0.9 });
      r.ellipse(0, -30, 46, 58).stroke({ width: 1.5, color: YOU, alpha: 0.3 });
    }
    this.zIndex = on ? 1000 : 0;
  }

  playReact(): void {
    this.reactT = 1;
    const s = new Graphics();
    s.moveTo(0, -84).lineTo(2.5, -78).lineTo(9, -77).lineTo(4, -72).lineTo(5.5, -65)
      .lineTo(0, -69).lineTo(-5.5, -65).lineTo(-4, -72).lineTo(-9, -77).lineTo(-2.5, -78)
      .closePath()
      .fill({ color: GLOW });
    this.sparks.addChild(s);
    const born = performance.now();
    const anim = (): void => {
      const k = Math.min(1, (performance.now() - born) / 700);
      s.y = -k * 20;
      s.alpha = 1 - k;
      s.scale.set(0.6 + k * 0.8);
      if (k < 1) requestAnimationFrame(anim);
      else s.destroy();
    };
    if (this.reduceMotion) { s.alpha = 0; s.destroy(); }
    else requestAnimationFrame(anim);
  }

  /** Per-frame idle + easing toward posture/selection targets. */
  idle(tMs: number): void {
    // ease posture and selection lift
    this.leanNow += (this.leanTarget - this.leanNow) * 0.12;
    const liftTarget = this.selected ? 1 : 0;
    this.selLift += (liftTarget - this.selLift) * 0.15;

    const breath = this.reduceMotion ? 0 : Math.sin(tMs / 1300 + this.phase) * 1.1;
    const react = this.reactT > 0 ? this.reactT : 0;
    if (this.reactT > 0) this.reactT = Math.max(0, this.reactT - 0.04);

    if (this.useSprite) {
      // posture is baked per state frame — keep only breathing, selection lift, react
      this.lean.rotation = -react * 0.04;
      this.lean.y = breath - this.selLift * 6 - react * 3;
      this.head.y = 0;
    } else {
      // slump: lean forward and drop the head; awake: sit tall
      this.lean.rotation = this.leanNow * 0.12 - react * 0.05;
      this.lean.y = this.leanNow * 6 + breath - this.selLift * 6 - react * 3;
      this.head.y = this.leanNow * 4;
    }
    const s = this.baseScale * (1 + this.selLift * 0.06 + react * 0.03);
    this.scale.set(s);
    this.alpha = 0.62 + 0.38 * Math.min(1, 0.4 + this.aw) + this.selLift * 0.0;
  }
}
