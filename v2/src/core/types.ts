// Core domain types. No DOM, no Pixi — these describe the game, not its view.

import type { Rng } from './rng';

export type TraitId = 'talker' | 'gatherer' | 'artist' | 'online' | 'wary';

export interface Trait {
  id: TraitId;
  hint: string;
  talkMul: number;
  orgMul: number;
  muralMul: number;
  postMul: number;
}

export interface Agent {
  x: number;
  y: number;
  /** awareness 0..1 — how clearly this person sees the shared problem */
  aw: number;
  inc: boolean; // incumbent (the apparatus), not a civilian
  gone: boolean;
  waver: boolean; // an incumbent who is doubting (amber)
  def: boolean; // a defected incumbent (now spreads awareness)
  doubt: boolean; // seeded doubt — wavers more easily
  nm: string;
  role: string;
  stake: string;
  trait: Trait;
  met: boolean;
  betrayed: boolean;
  sheltered: boolean;
  press: number;
  events: string[];
}

/** undirected edge as index pair with a strength weight */
export type Link = [number, number, number];

export type ActionKind =
  | 'talk'
  | 'link'
  | 'org'
  | 'low'
  | 'mural'
  | 'post'
  | 'letter'
  | 'doc'
  | 'speak'
  | 'reach'
  | 'expose';

export type Objective =
  | { type: 'aware'; count: number; lvl: number; text: string }
  | { type: 'wins'; count: number; text: string }
  | { type: 'muralaware'; count: number; lvl: number; text: string }
  | { type: 'witness'; text: string }
  | { type: 'defect'; text: string }
  | { type: 'survive'; turn: number; count: number; lvl: number; text: string };

/** Defaults merged UNDER each level: D = { ...PRO_DEFAULTS, ...LEVELS[i] }. */
export interface LevelDefaults {
  winP: number;
  thresh: number;
  floorGain: number;
  crackP: number;
  crackR: number;
  surv: number;
  linkMax: number;
  waverAt: number;
}

/** A level exactly as authored in the staging LEVELS array (before defaults). */
export interface RawLevel {
  pro?: boolean;
  name: string;
  desc: string;
  N: number;
  rig: number;
  maxT: number;
  nInc: number;
  spies: number;
  reinforce: number;
  cracks?: boolean;
  twoClusters?: boolean;
  clusterCenter?: boolean;
  scriptedCrack?: number;
  /** allowed actions; absent means every action is permitted (late levels). */
  allowed?: ActionKind[];
  obj?: Objective;
  intro?: string;
  newActs?: string;
  // per-level overrides of the defaults
  winP?: number;
  thresh?: number;
  floorGain?: number;
  crackP?: number;
  crackR?: number;
  surv?: number;
  linkMax?: number;
  waverAt?: number;
}

/** A fully-resolved level: PRO_DEFAULTS merged under the raw level. */
export type LevelDef = LevelDefaults & RawLevel;

/** Legacy meta-progression flags that alter setup/mechanics (from ov11_legacy). */
export interface LegacyState {
  embers: number;
  owned: string[];
}

/** Heir-boon multipliers, reset on setup and re-derived on heir succession. */
export interface HeirMul {
  talk: number;
  org: number;
  muralTick: number;
  postAdd: number;
  risk: number;
}

/** An active opportunity window (campaign only). */
export interface Opp {
  id: 'gathering' | 'market' | 'visitor' | 'paper';
  turnsLeft: number;
  label: string;
  targetIdx?: number;
}

/**
 * A fired dilemma awaiting the player's choice. It blocks act()/endTurn until
 * resolved. `a`/`b` carry the two outcomes as pure state transforms.
 */
export interface PendingDilemma {
  id: string;
  a: DilemmaChoice;
  b: DilemmaChoice;
}
export interface DilemmaChoice {
  /** apply this choice's effects to the state in place; may draw entropy (traitor). */
  fx: (s: GameState, rng: Rng) => void;
}

/** Everything the simulation carries between turns. Pure data. */
export interface GameState {
  level: LevelDef;
  lvlIdx: number;
  legacy: LegacyState;
  rngState: number;

  agents: Agent[];
  links: Link[];
  built: Array<[number, number]>;
  weak: string[]; // keys (lkey) of half-strength links made by letters
  murals: Array<{ x: number; y: number }>;
  neighbors: number[][]; // adjacency derived from links
  /**
   * Count of animation "pulses" the production oracle accumulates (capped at
   * 12). Carried ONLY to reproduce the RNG draw sequence: production draws pulse
   * timing (Math.random) from the same turn-entropy stream as its mechanics, so
   * the reference oracle consumes those draws; V2 must consume them identically
   * to stay in parity. Not a gameplay value. See docs/v2/ARCHITECTURE.md §7.3.
   */
  pulseCount: number;
  heirMul: HeirMul;

  turn: number;
  energy: number;
  rig: number;
  floor: number;
  inf: number; // trust 0..100
  risk: number; // eyes 0..1
  wins: number;
  defected: number;
  player: number;

  spies: Array<{ x: number; y: number }>;
  reinfThresholds: number[];
  reinfPending: boolean;
  crackIn: number;
  crackZone: { x: number; y: number; r: number } | null;
  postTrail: number;
  docActive: boolean;
  shelterTurns: number;
  shelterIdx: number;
  boostTurns: number;
  freeLink: boolean;
  lastCrackTurn: number;
  lastWinTurn: number;
  interrogated: boolean;
  witnessedOnce: boolean;
  lives: number;

  opp: Opp | null;
  oppExpired: number;
  firedDilemmas: string[];
  pendingDilemma: PendingDilemma | null;

  over: boolean;
  won: boolean;
}

/**
 * Player-facing actions, all ported (Stage B/B+). Two-step UI actions carry the
 * resolved target/coordinate the UI picked. The demo app drives only `talk` and
 * `endTurn`.
 */
export type Action =
  | { kind: 'talk'; target: number }
  | { kind: 'org' }
  | { kind: 'low' }
  | { kind: 'post' }
  | { kind: 'doc' }
  | { kind: 'speak' }
  | { kind: 'reach' }
  | { kind: 'expose' }
  | { kind: 'link'; target: number }
  | { kind: 'letter'; target: number }
  | { kind: 'mural'; x: number; y: number }
  | { kind: 'endTurn' };

/** A read-only view handed to render/ui. They must never mutate it. */
export type Snapshot = Readonly<GameState>;
