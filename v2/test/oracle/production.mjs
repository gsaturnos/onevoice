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
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
// The golden baseline is PINNED in version control (Decision 3: golden-master
// source under version control) so parity runs hermetically in CI with no git
// ref access. Refresh it with `npm run refresh-baseline`.
const PINNED = resolve(HERE, '../golden/staging-index.html');
const GIT_BASELINE = 'origin/staging:index.html';

function loadSource() {
  const override = process.env.OV_BASELINE_FILE;
  if (override) return readFileSync(override, 'utf8');
  if (existsSync(PINNED)) return readFileSync(PINNED, 'utf8');
  // fallback for a fresh checkout without the pin: read the live baseline.
  return execSync(`git show ${GIT_BASELINE}`, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

// Slice a balanced `{...}` (or `[...]`/`(...)`) region starting at `from`.
// Comment-aware: `//` and `/* */` are skipped so an apostrophe inside a comment
// (e.g. "a circle's") does not corrupt quote/bracket tracking.
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
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) i = src.length; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; continue; }
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

/** Extract the body of the `cv.addEventListener('click', e => { ... })` handler. */
export function extractClickHandler(src) {
  const anchor = src.indexOf("cv.addEventListener('click'");
  if (anchor < 0) throw new Error('click handler not found');
  const braceOpen = src.indexOf('{', src.indexOf('=>', anchor));
  const braceClose = balancedFrom(src, braceOpen);
  return src.slice(braceOpen + 1, braceClose); // inner body only
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

const DATA = ['NAMES', 'ROLES', 'STAKES', 'TRAITS', 'CORE', 'PRO_DEFAULTS', 'N_PRO', 'LEVELS', 'WIN_MAP', 'WIN_GENERIC']
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
let proDone=[],campProgress=0,winGenIdx=0;
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
function sOpp(){}
function sNear(){}
function sWarn(){}
function sKnock(){}
function sLoss(){}
function pname(i){ return ag[i].nm+', '+ag[i].role; }
function updateActionLabels(){}
function showEnd(){}
function showEpilogue(){}
function failDiag(){return '';}
function awardEmbers(){return 0;}
function sDilemma(){}
const cv = _el;
let __rng = Math.random;         // the injectable turn-level entropy stream
function __ovrand(){ return __rng(); }
`;

// RNG seam: production draws turn-level entropy through BOTH rand() and direct
// Math.random(). We textually route every `Math.random` in the EXTRACTED
// functions to __ovrand (the injectable stream) so oracle and V2 draw the same
// sequence. initGame's layout RNG is mulberry32 (not Math.random) and is
// untouched, so createGame parity is unaffected.
const seam = (s) => s.replace(/Math\.random\b/g, '__ovrand');
const FNS = (n) => seam(FN(n));

// OPPS/DILEMMAS make/build bodies draw entropy (rand + a direct Math.random in
// the traitor dilemma), so seam them too. Defined after `seam` is in scope.
const DATA2 = ['OPPS', 'DILEMMAS']
  .map((n) => `const ${n}=${seam(extractConstRHS(src, n))};`)
  .join('\n');

// The mural/link/letter completion logic lives in the canvas click handler.
// Wrap its real body as a callable so the oracle exercises production code.
const CLICK_FN = `function _click(e){${seam(extractClickHandler(src))}}`;

const API = `
function _snapshot(){
  return {
    ag: ag.map(a=>({...a})),
    links: links.map(l=>[...l]),
    nbr: nbr.map(x=>[...x]),
    player, turn, energy, rig, floor, inf, risk, defected, over, wins,
    docActive, postTrail,
    built: built.map(b=>[...b]),
    weak: [...weak],
    murals: murals.map(m=>({...m})),
    spies: spies.map(s=>({...s})),
    reinfThresholds: [...reinfThresholds],
    reinfPending, crackIn,
    crackZone: crackZone?{...crackZone}:null,
    shelterTurns, shelterIdx, boostTurns, witnessedOnce, interrogated,
    lastCrackTurn, lastWinTurn, lives,
    pulses: pulses.length,
    oppExpired,
    opp: opp?{...opp}:null,
    firedDilemmas: [...firedDilemmas],
    pending: !!pendingDilemma,
    heirMul: {...heirMul},
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
  markAllMet(){ ag.forEach(a=>{ a.met = true; }); return _snapshot(); },
  setRng(fn){ __rng = fn; },
  setTarget(i){ target = i; },
  setEnergy(n){ energy = n; },
  setInf(n){ inf = n; },
  act(type){ act(type); return _snapshot(); },
  endTurn(){ endTurn(); return _snapshot(); },
  resolveDilemma(which){ resolveDilemma(which); return _snapshot(); },
  // Two-step UI actions: act() toggles the mode, the canvas click completes it.
  // getBoundingClientRect() returns {left:0,top:0,width:720,height:440}, so
  // clientX/Y map straight to game coords (mx=x, my=y).
  clickAt(mode, x, y){
    muralMode = mode === 'mural';
    linkMode = mode === 'link';
    letterMode = mode === 'letter';
    _click({ clientX: x, clientY: y });
    return _snapshot();
  },
  levelCount(){ return LEVELS.length; },
  levelIsPro(idx){ return !!LEVELS[idx].pro; },
};
`;

const body = [
  "'use strict';",
  GLOBALS,
  DATA,
  DATA2,
  FN('mulberry32'),
  FN('rebuildNbr'),
  STUBS,
  FNS('rand'),
  FNS('infBonus'),
  FNS('linkReach'),
  FNS('lkey'),
  FNS('inSurv'),
  FNS('localAwAround'),
  FNS('orgRingSet'),
  FNS('muralCost'),
  FNS('triggerDefection'),
  FNS('freeZones'),
  FNS('inTriangle'),
  FNS('inAnyZone'),
  FNS('checkObjective'),
  FNS('winOutcome'),
  FNS('setHeirBoon'),
  FNS('boonText'),
  FNS('tickOpp'),
  FNS('maybeSpawnOpp'),
  FNS('maybeFireDilemma'),
  FNS('resolveDilemma'),
  FNS('initGame'),
  FNS('act'),
  FNS('endTurn'),
  CLICK_FN,
  API,
].join('\n');

// eslint-disable-next-line no-new-func
const factory = new Function(body);

/** Build an oracle instance backed by real production code. */
export function makeOracle() {
  return factory();
}
