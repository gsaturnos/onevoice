// Core domain types. No DOM, no Pixi — these describe the game, not its view.

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

/** Everything the simulation carries between turns. Pure data. */
export interface GameState {
  level: LevelDef;
  lvlIdx: number;
  legacy: LegacyState;
  rngState: number;

  agents: Agent[];
  links: Link[];
  built: Array<[number, number]>;
  neighbors: number[][]; // adjacency derived from links

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

  over: boolean;
  won: boolean;
}

/**
 * Player-facing actions. The parity phase ports these incrementally; the demo
 * app currently drives only `talk` and `endTurn`.
 */
export type Action = { kind: 'talk'; target: number } | { kind: 'endTurn' };

/** A read-only view handed to render/ui. They must never mutate it. */
export type Snapshot = Readonly<GameState>;
