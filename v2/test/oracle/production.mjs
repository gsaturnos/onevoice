// Golden-master oracle (Decision 3 / ARCHITECTURE §7.3).
//
// This runs the PRODUCTION game's OWN simulation code, extracted verbatim from
// the stable `staging` baseline, inside a headless closure that mirrors the
// production IIFE's lexical scope. DOM / audio / render / coach side-effects are
// stubbed to no-ops; the numeric simulation runs unchanged. Because it executes
// real production source (not a re-transcription), it independently catches any
// divergence in the V2 port.
//
// Determinism seam: production seeds initial layout with mulberry32, but its
// turn-level events use unseeded Math.random() via rand(). The harness routes
// rand() through an injectable stream (`setRng`) so oracle and V2 draw the same
// entropy for action/endTurn parity. Stage A (createGame) does not need the
// seam — initGame is already fully seeded.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASELINE = 'origin/staging:index.html';

function loadSource() {
  const override = process.env.OV_BASELINE_FILE;
  if (override) return readFileSync(override, 'utf8');
  return execSync(`git show ${BASELINE}`, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

// Slice a balanced `{...}` (or `[...]`/`(...)`) region starting at `from`.
function balancedFrom(src, from) {
  let i = from;
  let depth = 0;
  let quote = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error('unbalanced region');
}

/** Extract the full source text of `function <name>(...) { ... }`. */
export function extractFn(src, name) {
  const re = new RegExp(`function\\s+${name}\\s*\\(`, 'g');
  const m = re.exec(src);
  if (!m) throw new Error(`function ${name} not found`);
  const parenOpen = src.indexOf('(', m.index);
  const parenClose = balancedFrom(src, parenOpen);
  const braceOpen = src.indexOf('{', parenClose);
  const braceClose = balancedFrom(src, braceOpen);
  return src.slice(m.index, braceClose + 1);
}

/** Extract the RHS text of `const <name> = <RHS>;`. */
export function extractConstRHS(src, name) {
  const decl = new RegExp(`const\\s+${name}\\s*=`, 'g');
  const m = decl.exec(src);
  if (!m) throw new Error(`const ${name} not found`);
  let i = m.index + m[0].length;
  while (' \n\r\t'.includes(src[i])) i++;
  const start = i;
  let depth = 0;
  let quote = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '[' || c === '{' || c === '(') depth++;
    else if (c === ']' || c === '}' || c === ')') depth--;
    else if (c === ';' && depth === 0) break;
  }
  return src.slice(start, i).trim();
}

const src = loadSource();

const DATA = ['NAMES', 'ROLES', 'STAKES', 'TRAITS', 'CORE', 'PRO_DEFAULTS', 'N_PRO', 'LEVELS']
  .map((n) => `const ${n}=${extractConstRHS(src, n)};`)
  .join('\n');

const FN = (n) => extractFn(src, n);

// Production's own global declarations, copied so the extracted functions see
// exactly the scope they were written against (DOM consts excluded).
const GLOBALS = `
let D=null,lvlIdx=0,W=720,H=440,NN=74;
let ag=[],links=[],built=[],weak=new Set(),nbr=[],murals=[],turn=1,energy=3,rig=0,floor=0.05,wins=0,inf=0;
let player=-1,risk=0,lives=0,crackIn=-1,crackZone=null,over=false,target=-1,interrogated=false,linkMode=false,muralMode=false,letterMode=false,defected=0;
let spies=[],reinfThresholds=[],reinfPending=false,postTrail=0,docActive=false,journal=[],fallenThisRun=[];
let firedDilemmas=[],shelterTurns=0,shelterIdx=-1,boostTurns=0,freeLink=false,lastCrackTurn=-99,lastWinTurn=-99;
let epiEvents=[],startName='',startRole='',firstWinSeen=false,inf30Told=false,inf40Told=false,witnessedOnce=false,hopeBonus=0;
let opp=null,nearMissTold=false,freeZoneTold=false,embersAwarded=false,pendingDilemma=null;
let floaters=[],rippleAnims=[],nearMisses=[],pops={},shake={mag:0,t0:0},vignette=null,pulses=[];
let coachIdx=0,heirMul={talk:1,org:1,muralTick:1,postAdd:0,risk:1},stageR={risk:true,inf:true,rigflo:true},previewAct=null,actionCounts={},oppExpired=0;
let legacyOwned=[];
`;

const STUBS = `
const _el={innerHTML:'',textContent:'',value:'',style:new Proxy({},{get:()=>'',set:()=>true}),classList:{add(){},remove(){},toggle(){}},addEventListener(){},removeEventListener(){},appendChild(){},setAttribute(){},querySelector(){return _el;},querySelectorAll(){return [];},getContext(){return _ctx;},focus(){},getBoundingClientRect(){return {left:0,top:0,width:720,height:440};}};
const _ctx=new Proxy({},{get:(t,p)=>{if(p in t)return t[p];const f=()=>{};t[p]=f;return f;}});
function $(){return _el;}
function nowMs(){return 0;}
function has(id){return legacyOwned.includes(id);}
function getFallen(){return [];}
function setFallen(){}
function getAttempts(){return 0;}
function setAttempts(){}
function saveProgress(){}
function setButtons(){}
function coachShow(){}
function coachEvent(){}
function ui(){}
function renderRoster(){}
function renderCampaign(){}
function log(){}
function hintOnce(){}
function rosterNote(){}
function addFloat(){}
function addRipple(){}
function addNearMiss(){}
function addPop(){}
function doShake(){}
function doVignette(){}
function sTalk(){}
function sWin(){}
function sVictory(){}
function sChain(){}
function checkTrustMilestones(){}
let __rng=Math.random;
function rand(a,b){return a+__rng()*(b-a);}
`;

const API = `
function _snapshot(){
  return {
    ag: ag.map(a=>({...a})),
    links: links.map(l=>[...l]),
    nbr: nbr.map(x=>[...x]),
    player, turn, energy, rig, floor, inf, risk, defected, over, wins,
    spies: spies.map(s=>({...s})),
    reinfThresholds: [...reinfThresholds],
  };
}
return {
  newGame(idx, opts){
    opts = opts || {};
    legacyOwned = opts.owned || [];
    __rng = opts.rng || Math.random;
    lvlIdx = idx;
    D = Object.assign({}, PRO_DEFAULTS, LEVELS[idx]);
    initGame();
    return _snapshot();
  },
  snapshot: _snapshot,
  setRng(fn){ __rng = fn; },
  levelCount(){ return LEVELS.length; },
  levelIsPro(idx){ return !!LEVELS[idx].pro; },
};
`;

const body = [
  "'use strict';",
  GLOBALS,
  DATA,
  FN('mulberry32'),
  FN('rebuildNbr'),
  STUBS,
  FN('initGame'),
  API,
].join('\n');

// eslint-disable-next-line no-new-func
const factory = new Function(body);

/** Build an oracle instance backed by real production code. */
export function makeOracle() {
  return factory();
}
