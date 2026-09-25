// Composition root. It holds the single mutable reference to the immutable
// snapshot, routes input through the pure reducers, and choreographs render + ui +
// audio around each committed transition. The core stays authoritative: every
// animation reflects a state the reducer already produced (talk/endTurn), and a
// preview is the reducer run on a copy. Selection and presentation live here, not
// in the core.

import { createGame } from '@core/state';
import { applyAction } from '@core/simulation';
import type { GameState, Snapshot } from '@core/types';
import { objectiveProgress, talkableTargets } from '@core/selectors';
import { previewTalk, newlyClear, propagationFlows, clearThreshold } from '@core/insight';
import { nearReady } from '@render/scene';
import { PixiStage } from '@render/PixiStage';
import { Hud } from '@ui/Hud';
import { AudioController } from '@audio/AudioController';

const prefersReduced =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

async function boot(): Promise<void> {
  const stageHost = document.getElementById('stage')!;
  const hudHost = document.getElementById('hud')!;

  let state: GameState = createGame(0);
  let selected: number | null = null;
  let busy = false;

  const audio = new AudioController();
  const stage = new PixiStage();
  await stage.init(stageHost, prefersReduced);

  const hud = new Hud(hudHost, {
    onSelect: (idx) => select(idx),
    onTalk: (idx) => void talk(idx),
    onEndTurn: () => void endTurn(),
    onToggleMusic: () => { audio.setMusic(!audio.isMusicOn()); draw(); },
    onToggleSfx: () => { audio.setSfx(!audio.isSfxOn()); draw(); },
    onSkip: () => stage.setSpeed(14),
  });

  stage.build(state);
  stage.onSelect((idx) => select(idx));
  hud.setOpening(openingLine(state));

  // resume audio on the first gesture (autoplay policy)
  const wake = (): void => { audio.resume(); window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake); };
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', wake);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { selected = null; stage.setSelected(null, state); draw(); }
  });

  function draw(): void {
    hud.setBusy(busy);
    hud.setSuggestion(suggestion(state));
    hud.render(state, selected, { music: audio.isMusicOn(), sfx: audio.isSfxOn() });
  }

  function select(idx: number): void {
    if (busy) return;
    selected = idx;
    stage.setSelected(idx, state);
    audio.select();
    hud.showChanges([]);
    draw();
  }

  async function withBusy(fn: () => Promise<void>): Promise<void> {
    busy = true;
    draw();
    try { await fn(); }
    finally { busy = false; stage.setSpeed(1); draw(); }
  }

  async function talk(idx: number): Promise<void> {
    if (busy || state.over) return;
    if (!talkableTargets(state).includes(idx) || state.energy < 1) return;
    const prev: Snapshot = state;
    const pv = previewTalk(prev, idx);
    const next = applyAction(prev, { kind: 'talk', target: idx });
    state = next;
    await withBusy(async () => {
      audio.talk();
      await stage.playTalk(prev.player, idx);
      stage.sync(state, selected);
      const cleared = newlyClear(prev, next);
      const changes: string[] = [`${prev.agents[idx].nm} listened — now ${Math.round(next.agents[idx].aw * 100)}%.`];
      if (pv.willClear) changes.push(`${prev.agents[idx].nm} sees clearly now.`);
      else if (pv.carriers.length) changes.push(`They can carry it to ${pv.carriers.length} other${pv.carriers.length > 1 ? 's' : ''} overnight.`);
      // a modest payoff if a connected pair crossed together on this talk
      if (cleared.length >= 2 && connected(next, cleared)) {
        audio.cascade();
        await stage.playCascade(cleared, false);
      }
      hud.showChanges(changes);
    });
  }

  async function endTurn(): Promise<void> {
    if (busy || state.over) return;
    const prev: Snapshot = state;
    const next = applyAction(prev, { kind: 'endTurn' });
    state = next;
    await withBusy(async () => {
      const flows = propagationFlows(prev, next);
      audio.propagation(flows.length);
      await stage.playPropagation(flows.map((f) => ({ from: f.from, to: f.to, strength: Math.min(1, f.amount * 8) })));
      stage.sync(state, selected);

      const ready = nearReady(next);
      if (ready.length) { audio.nearReady(); await stage.pulseNearReady(ready); }

      const cleared = newlyClear(prev, next);
      const changes: string[] = [];
      if (flows.length) changes.push(`Word travelled to ${countGains(prev, next)} more overnight.`);
      for (const i of cleared.slice(0, 2)) changes.push(`${next.agents[i].nm} sees clearly now.`);
      if (changes.length < 3 && ready.length) changes.push(`${ready.length} ${ready.length > 1 ? 'are' : 'is'} almost there.`);

      if (next.over && next.won) {
        audio.cascade();
        const joined = next.agents
          .map((a, i) => ({ a, i }))
          .filter(({ a, i }) => i !== next.player && !a.inc && !a.gone && a.aw >= clearThreshold(next))
          .map(({ i }) => i);
        await stage.playCascade(joined, true);
        audio.resolution(true);
      } else if (next.over) {
        audio.resolution(false);
      } else if (cleared.length >= 2 && connected(next, cleared)) {
        audio.cascade();
        await stage.playCascade(cleared, false);
      }
      hud.showChanges(changes.slice(0, 3));
    });
  }

  // auto-select the most promising neighbour so a new player immediately has a
  // named person and a meaningful choice in front of them.
  const first = bestTarget(state);
  if (first != null) select(first);
  else draw();
}

/** Does the set contain at least one linked pair (a connected cluster)? */
function connected(s: Snapshot, set: number[]): boolean {
  const ss = new Set(set);
  for (const i of set) for (const j of s.neighbors[i] || []) if (ss.has(j)) return true;
  return false;
}

function countGains(prev: Snapshot, next: Snapshot): number {
  let n = 0;
  next.agents.forEach((a, i) => {
    if (i === next.player || a.inc || a.gone) return;
    if (a.aw - (prev.agents[i]?.aw ?? 0) > 0.02) n++;
  });
  return n;
}

/** The neighbour a talk would help most right now (closest to a clear win). */
function bestTarget(s: Snapshot): number | null {
  const th = clearThreshold(s);
  let best: number | null = null;
  let bestScore = -1;
  for (const j of talkableTargets(s)) {
    if (s.agents[j].aw >= th) continue;
    const pv = previewTalk(s, j);
    const score = (pv.willClear ? 1 : 0) + pv.delta + pv.carriers.length * 0.05;
    if (score > bestScore) { bestScore = score; best = j; }
  }
  return best ?? (talkableTargets(s)[0] ?? null);
}

function suggestion(s: Snapshot): string {
  if (s.over) return '';
  if (s.energy < 1) return 'Out of moments — end the evening and let what you said spread.';
  const prog = objectiveProgress(s);
  const remaining = Math.max(0, prog.need - Math.min(prog.have, prog.need));
  const t = bestTarget(s);
  if (t == null) return 'End the evening and let awareness travel the lines.';
  const a = s.agents[t];
  const pv = previewTalk(s, t);
  const who = a.trait.id === 'wary' ? `${a.nm} is wary — it takes patience` : `${a.nm} is close`;
  if (pv.willClear) return `Talk with ${a.nm} — one conversation could make it land.`;
  return remaining <= 1 ? `One more to reach. ${who}.` : `Start with ${a.nm}. ${who}.`;
}

function openingLine(s: Snapshot): string {
  // frame the evening around a real neighbour and their stake
  const t = talkableTargets(s);
  const j = t.length ? t.reduce((m, k) => (s.agents[k].stake.length > s.agents[m].stake.length ? k : m), t[0]) : s.player;
  const a = s.agents[j];
  return `Tonight ${a.nm} said the thing everyone feels but no one names — ${a.stake}. You have one evening at this table, and three moments to spend. Help three neighbours see it clearly.`;
}

boot().catch((err) => {
  const hud = document.getElementById('hud');
  if (hud) hud.textContent = 'The evening could not begin: ' + String(err);
  // eslint-disable-next-line no-console
  console.error(err);
});
