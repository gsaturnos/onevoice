// The interface, in accessible HTML/CSS so the scene can dominate. It shows only
// what matters — the situation, objective, turn, energy, the selected person, one
// contextual action, and end-turn — plus sound/skip controls. It reads snapshots
// through core selectors/insight and emits intent through callbacks; it never
// mutates game state. Controls are real buttons (keyboard + >=44px touch targets).

import type { Snapshot } from '@core/types';
import { objectiveProgress, talkableTargets } from '@core/selectors';
import { previewTalk, clearThreshold } from '@core/insight';
import { applyPortrait } from './portrait';

export interface HudCallbacks {
  onSelect: (idx: number) => void;
  onTalk: (idx: number) => void;
  onEndTurn: () => void;
  onToggleMusic: () => void;
  onToggleSfx: () => void;
  onSkip: () => void;
}

const AW_WORDS: Array<[number, string]> = [
  [0.7, 'clear'],
  [0.5, 'listening'],
  [0.3, 'uneasy'],
  [0, 'afraid'],
];

function awWord(aw: number): string {
  for (const [th, w] of AW_WORDS) if (aw >= th) return w;
  return 'afraid';
}

export class Hud {
  private root: HTMLElement;
  private opening = '';
  private busy = false;
  private changes: string[] = [];
  private suggestion = '';

  constructor(host: HTMLElement, private readonly cb: HudCallbacks) {
    this.root = host;
    this.root.classList.add('hud');
  }

  setOpening(text: string): void { this.opening = text; }
  setSuggestion(text: string): void { this.suggestion = text; }
  showChanges(items: string[]): void { this.changes = items.slice(0, 3); }
  setBusy(b: boolean): void { this.busy = b; }

  render(s: Snapshot, selected: number | null, audio: { music: boolean; sfx: boolean }): void {
    const prog = objectiveProgress(s);
    const targets = talkableTargets(s);
    const th = clearThreshold(s);
    const clearNow = s.agents.filter((a, i) => i !== s.player && !a.inc && !a.gone && a.aw >= th).length;

    const showOpening = s.turn === 1 && !s.over && this.changes.length === 0;

    this.root.innerHTML = `
      <div class="topbar">
        <div class="brand">One&nbsp;Voice <span class="tag">· the kitchen table</span></div>
        <div class="meters">
          <span class="meter" title="Turn"><b>Evening</b> ${s.turn}/${s.level.maxT}</span>
          <span class="meter energy" title="Energy this evening" aria-label="Energy ${s.energy} of 3">${'●'.repeat(Math.max(0, s.energy))}${'○'.repeat(Math.max(0, 3 - s.energy))} <span class="mlabel">moments</span></span>
        </div>
      </div>

      <div class="objective" role="status">
        <span class="odot ${clearNow >= prog.need ? 'done' : ''}"></span>
        <span class="otext">${prog.text}</span>
        <span class="ocount"><b>${Math.min(prog.have, prog.need)}</b>/${prog.need}</span>
      </div>

      ${showOpening ? `<p class="opening">${this.opening}</p>` : ''}

      ${this.changes.length ? `
        <div class="changed" role="status" aria-label="What changed">
          <h3>What changed</h3>
          <ul>${this.changes.map((c) => `<li>${c}</li>`).join('')}</ul>
        </div>` : ''}

      <div id="card" class="card" aria-live="polite"></div>

      <div class="roster" role="group" aria-label="People you can reach from your seat"></div>

      ${this.suggestion && !s.over ? `<p class="hint">${this.suggestion}</p>` : ''}
      ${s.over ? `<p class="result ${s.won ? 'win' : 'loss'}">${s.won ? 'The table is awake. Word will travel from here.' : 'The evening ended before enough could see. Try again.'}</p>` : ''}

      <div class="controls">
        <button id="end" class="primary" ${s.over || this.busy ? 'disabled' : ''}>End the evening →</button>
        ${this.busy ? `<button id="skip" class="ghost">Skip ▸▸</button>` : ''}
      </div>

      <div class="settings">
        <button id="music" class="toggle ${audio.music ? 'on' : ''}" aria-pressed="${audio.music}">${audio.music ? '♪ Music on' : '♪ Music off'}</button>
        <button id="sfx" class="toggle ${audio.sfx ? 'on' : ''}" aria-pressed="${audio.sfx}">${audio.sfx ? '♫ Sound on' : '♫ Sound off'}</button>
      </div>
    `;

    this.renderCard(s, selected, targets);
    this.renderRoster(s, selected, targets);

    (this.root.querySelector('#end') as HTMLButtonElement)?.addEventListener('click', () => !this.busy && this.cb.onEndTurn());
    (this.root.querySelector('#skip') as HTMLButtonElement)?.addEventListener('click', () => this.cb.onSkip());
    (this.root.querySelector('#music') as HTMLButtonElement)?.addEventListener('click', () => this.cb.onToggleMusic());
    (this.root.querySelector('#sfx') as HTMLButtonElement)?.addEventListener('click', () => this.cb.onToggleSfx());
  }

  private renderCard(s: Snapshot, selected: number | null, targets: number[]): void {
    const card = this.root.querySelector('#card') as HTMLElement;
    if (selected == null || !s.agents[selected]) {
      card.innerHTML = `<p class="cue">Choose someone at the table — tap a face, or a name below.</p>`;
      return;
    }
    const a = s.agents[selected];
    const th = clearThreshold(s);
    const canTalk = targets.includes(selected) && !s.over && s.energy >= 1 && !this.busy;
    const pct = Math.round(a.aw * 100);
    const reachable = targets.includes(selected);

    let previewHtml = '';
    if (reachable) {
      const pv = previewTalk(s, selected);
      const after = Math.round(pv.after * 100);
      const carriers = pv.carriers.length;
      previewHtml = `
        <div class="preview">
          <div class="prow"><span>If you talk</span><span><b>${pct}%</b> → <b class="up">${after}%</b></span></div>
          ${pv.willClear ? `<div class="prow good">They would see clearly</div>` : ''}
          ${carriers ? `<div class="prow soft">They could carry it to ${carriers} other${carriers > 1 ? 's' : ''}</div>` : ''}
        </div>`;
    } else {
      previewHtml = `<p class="cue soft">You can't reach them from your seat yet — awareness travels along the lines between neighbours.</p>`;
    }

    card.innerHTML = `
      <div class="chead">
        <span class="portrait" id="portrait" aria-hidden="true"></span>
        <div>
          <div class="cname">${a.nm}${selected === s.player ? ' · you' : ''}</div>
          <div class="crole">${a.role}</div>
          <div class="cmood ${awWord(a.aw)}">${awWord(a.aw)}</div>
        </div>
      </div>
      <p class="stake">${a.stake}.</p>
      <div class="awrow" aria-label="Awareness ${pct} percent, ${awWord(a.aw)}">
        <span class="awbar"><span class="awfill" style="width:${Math.min(100, pct)}%"></span><span class="awmark" style="left:${Math.round(th * 100)}%"></span></span>
        <span class="awword">${awWord(a.aw)} · ${pct}%</span>
      </div>
      <p class="trait">${a.trait.hint}</p>
      ${selected === s.player ? '' : previewHtml}
      ${selected === s.player ? '' : `<button id="talk" class="primary" ${canTalk ? '' : 'disabled'}>Talk with ${a.nm}</button>`}
    `;

    const portrait = card.querySelector('#portrait') as HTMLElement | null;
    if (portrait) applyPortrait(portrait, selected, a.aw, a.nm);

    const talk = card.querySelector('#talk') as HTMLButtonElement | null;
    if (talk) {
      talk.addEventListener('click', () => canTalk && this.cb.onTalk(selected));
      if (canTalk) talk.focus();
    }
  }

  private renderRoster(s: Snapshot, selected: number | null, targets: number[]): void {
    const roster = this.root.querySelector('.roster') as HTMLElement;
    const th = clearThreshold(s);
    for (const j of targets) {
      const a = s.agents[j];
      const pct = Math.round(a.aw * 100);
      const b = document.createElement('button');
      b.className = 'person' + (j === selected ? ' sel' : '') + (a.aw >= th ? ' clear' : '');
      b.setAttribute('aria-label', `${a.nm}, ${a.role}. Awareness ${pct} percent, ${awWord(a.aw)}. ${j === selected ? 'Selected.' : 'Select to talk.'}`);
      b.setAttribute('aria-pressed', String(j === selected));
      b.innerHTML = `<span class="pname">${a.nm}</span><span class="ppct">${a.aw >= th ? '✓ ' : ''}${pct}%</span>`;
      b.addEventListener('click', () => this.cb.onSelect(j));
      roster.appendChild(b);
    }
  }
}
