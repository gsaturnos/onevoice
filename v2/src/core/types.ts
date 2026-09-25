// Core domain types. No DOM, no Pixi — these describe the game, not its view.

export interface Trait {
  id: 'talker' | 'gatherer' | 'artist' | 'online' | 'wary';
  hint: string;
  talkMul: number;
}

export interface Agent {
  x: number;
  y: number;
  /** awareness 0..1 — how clearly this person sees the shared problem */
  aw: number;
  inc: boolean; // incumbent (the apparatus), not a civilian
  gone: boolean;
  nm: string;
  role: string;
  stake: string;
  trait: Trait;
  met: boolean;
}

/** undirected edge as index pair with a strength weight */
export type Link = [number, number, number];

export interface LevelDef {
  name: string;
  n: number;
  rig: number; // fear (slows diffusion)
  maxT: number;
  linkMax: number;
  allowed: ActionKind[];
  objective: { type: 'aware'; count: number; level: number; text: string };
}

export type ActionKind = 'talk' | 'link' | 'org' | 'low';

export type Action =
  | { kind: 'talk'; target: number }
  | { kind: 'endTurn' };

export interface GameState {
  level: LevelDef;
  seed: number;
  rngState: number;
  agents: Agent[];
  links: Link[];
  neighbors: number[][]; // adjacency derived from links
  turn: number;
  energy: number;
  rig: number;
  inf: number; // trust
  player: number;
  over: boolean;
  won: boolean;
}

/** A read-only view handed to render/ui. They must never mutate it. */
export type Snapshot = Readonly<GameState>;
