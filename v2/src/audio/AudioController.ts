// Procedural sound via the Web Audio API — no audio assets. A warm room ambience
// (music bus) and short interaction cues (sfx bus) sit on independent gains so the
// player can mute either. Nothing sounds until the first user gesture resumes the
// context (browser autoplay policy). Adapter layer: no DOM beyond AudioContext,
// no imports of other adapters.

type Ctx = AudioContext;

export class AudioController {
  private ctx: Ctx | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambience: { stop: () => void } | null = null;
  private musicOn = true;
  private sfxOn = true;
  private started = false;

  /** Call from a user gesture. Safe to call repeatedly. */
  resume(): void {
    try {
      if (!this.ctx) {
        const AC = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext });
        const Impl = AC.AudioContext || AC.webkitAudioContext;
        if (!Impl) return;
        this.ctx = new Impl();
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain.gain.value = this.musicOn ? 0.18 : 0;
        this.sfxGain.gain.value = this.sfxOn ? 0.5 : 0;
        this.musicGain.connect(this.ctx.destination);
        this.sfxGain.connect(this.ctx.destination);
      }
      void this.ctx.resume();
      if (!this.started) {
        this.started = true;
        this.startAmbience();
      }
    } catch {
      /* audio unavailable — the game is fully playable silent */
    }
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.musicGain && this.ctx) this.ramp(this.musicGain.gain, on ? 0.18 : 0, 0.2);
  }
  setSfx(on: boolean): void {
    this.sfxOn = on;
    if (this.sfxGain) this.sfxGain.gain.value = on ? 0.5 : 0;
  }
  isMusicOn(): boolean { return this.musicOn; }
  isSfxOn(): boolean { return this.sfxOn; }

  // ---- cues ----

  /** Soft selection tick. */
  select(): void {
    this.blip(520, 0.06, 'triangle', 0.25);
  }

  /** A warm two-note conversation motif. */
  talk(): void {
    this.blip(392, 0.14, 'sine', 0.5);
    this.later(90, () => this.blip(523, 0.18, 'sine', 0.5));
  }

  /** Gentle shimmer as awareness spreads overnight. */
  propagation(steps: number): void {
    const notes = [523, 587, 659, 698, 784];
    for (let i = 0; i < Math.min(steps, notes.length); i++) {
      this.later(i * 110, () => this.blip(notes[i], 0.16, 'sine', 0.3));
    }
  }

  /** Near-ready ping — a single hopeful note. */
  nearReady(): void {
    this.blip(659, 0.12, 'sine', 0.35);
  }

  /** The cascade: a rising arpeggio that blooms into a warm chord. */
  cascade(): void {
    const arp = [392, 494, 587, 659, 784, 880];
    arp.forEach((f, i) => this.later(i * 120, () => this.blip(f, 0.4, 'triangle', 0.5)));
    this.later(arp.length * 120, () => this.chord([392, 494, 587, 784], 1.4));
  }

  /** Resolution cue at level end. */
  resolution(win: boolean): void {
    if (win) this.chord([523, 659, 784], 1.6);
    else this.chord([294, 349, 392], 1.4);
  }

  // ---- engine ----

  private startAmbience(): void {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc1.type = 'sawtooth';
    osc2.type = 'sine';
    osc1.frequency.value = 98; // low, warm
    osc2.frequency.value = 146.83;
    filt.type = 'lowpass';
    filt.frequency.value = 340;
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain).connect(filt.frequency);
    const pad = ctx.createGain();
    pad.gain.value = 0.5;
    osc1.connect(filt);
    osc2.connect(filt);
    filt.connect(pad).connect(this.musicGain);
    osc1.start();
    osc2.start();
    lfo.start();
    this.ambience = {
      stop: () => { try { osc1.stop(); osc2.stop(); lfo.stop(); } catch { /* noop */ } },
    };
  }

  private blip(freq: number, dur: number, type: OscillatorType, peak: number): void {
    if (!this.ctx || !this.sfxGain || !this.sfxOn) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private chord(freqs: number[], dur: number): void {
    if (!this.ctx || !this.sfxGain || !this.sfxOn) return;
    for (const f of freqs) this.blip(f, dur, 'sine', 0.28);
  }

  private ramp(param: AudioParam, to: number, dur: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(to, t + dur);
  }

  private later(ms: number, fn: () => void): void {
    setTimeout(fn, ms);
  }

  dispose(): void {
    this.ambience?.stop();
    try { void this.ctx?.close(); } catch { /* noop */ }
  }
}
