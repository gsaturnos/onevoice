// Tiny promise-based tween helper. Timing is decoupled from game state — these
// only move pixels — so accelerating, skipping, or honouring reduced-motion can
// never change the simulation. `Motion.speed` is read live each frame (so the app
// can fast-forward mid-sequence) and `reduced` collapses a tween to its end state.

export interface Motion {
  reduced: boolean;
  speed: number; // 1 = normal; the app raises this to accelerate / skip
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Run `fn` with an eased 0→1 param over `ms`, then resolve. */
export function tween(ms: number, fn: (t: number) => void, m: Motion): Promise<void> {
  if (m.reduced || ms <= 0) {
    fn(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const start = performance.now();
    let last = start;
    let elapsed = 0;
    const step = (now: number): void => {
      elapsed += (now - last) * Math.max(1, m.speed);
      last = now;
      const t = Math.min(1, elapsed / ms);
      fn(easeInOut(t));
      if (t >= 1) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export function wait(ms: number, m: Motion): Promise<void> {
  return tween(ms, () => {}, m);
}
