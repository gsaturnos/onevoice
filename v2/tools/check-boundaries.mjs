#!/usr/bin/env node
// Dependency-boundary enforcement (ARCHITECTURE §2.1, Decision 6).
//
// Zero-dependency, offline check that the module layering holds:
//   core/     → may import only core/ and content/; NO DOM/Pixi/adapters, and
//               no window/document/localStorage/performance/Math.random.
//   content/  → may import only core/ (types). No adapters, DOM, or Pixi.
//   render/ ui/ audio/ persistence/ → may import core/ + content/, but NEVER
//               each other.
//   app/      → may import anything (the composition root).
//
// Exits non-zero and prints every violation. Wired into CI and `npm run lint`.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../src');

const ADAPTERS = ['render', 'ui', 'audio', 'persistence'];

// layer → set of layers it may depend on (besides itself)
const ALLOW = {
  core: ['core', 'content'],
  content: ['core', 'content'],
  render: ['core', 'content', 'render'],
  ui: ['core', 'content', 'ui'],
  audio: ['core', 'content', 'audio'],
  persistence: ['core', 'content', 'persistence'],
  app: ['core', 'content', 'render', 'ui', 'audio', 'persistence', 'app'],
};

// forbidden runtime globals per layer (source-text scan)
const FORBIDDEN_GLOBALS = {
  core: [/\bwindow\b/, /\bdocument\b/, /\blocalStorage\b/, /\bperformance\b/, /\bMath\.random\b/, /\bPIXI\b/],
  content: [/\bwindow\b/, /\bdocument\b/, /\blocalStorage\b/, /\bMath\.random\b/, /\bPIXI\b/],
};

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts') && !p.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function layerOf(file) {
  const rel = relative(SRC, file);
  return rel.split(/[\\/]/)[0];
}

// Blank out comments and string/template contents so the forbidden-global scan
// only sees actual code (narrative content and doc comments may mention DOM).
function stripCommentsAndStrings(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      i++;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === q) { i++; break; }
        i++;
      }
      out += ' ';
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// Resolve an import specifier to a layer name, or null if external (npm) / unknown.
function specifierLayer(spec, file) {
  if (spec.startsWith('@')) {
    const m = spec.match(/^@(core|content|render|ui|audio|persistence)\b/);
    return m ? m[1] : null; // other @-scoped = npm package
  }
  if (spec.startsWith('.')) {
    const abs = resolve(dirname(file), spec);
    const rel = relative(SRC, abs);
    if (rel.startsWith('..')) return null;
    return rel.split(/[\\/]/)[0];
  }
  return '__npm__'; // bare import: an npm package
}

const IMPORT_RE = /(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const violations = [];

for (const file of walk(SRC)) {
  const layer = layerOf(file);
  const allowed = ALLOW[layer];
  const text = readFileSync(file, 'utf8');
  const rel = relative(SRC, file);

  // 1. import boundaries
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(text))) {
    const spec = m[1] || m[2];
    if (!spec) continue;
    const target = specifierLayer(spec, file);
    if (target === '__npm__' || target === null) {
      // npm import: only forbidden for core/content (they must stay pure).
      if ((layer === 'core' || layer === 'content') && target === '__npm__') {
        violations.push(`${rel}: ${layer}/ must not import npm package "${spec}"`);
      }
      continue;
    }
    if (allowed && !allowed.includes(target)) {
      if (ADAPTERS.includes(layer) && ADAPTERS.includes(target)) {
        violations.push(`${rel}: adapter ${layer}/ must not import adapter ${target}/ ("${spec}")`);
      } else {
        violations.push(`${rel}: ${layer}/ must not import ${target}/ ("${spec}")`);
      }
    }
  }

  // 2. forbidden runtime globals (scan code only, not comments/strings)
  const globals = FORBIDDEN_GLOBALS[layer];
  if (globals) {
    const code = stripCommentsAndStrings(text);
    for (const re of globals) {
      if (re.test(code)) violations.push(`${rel}: ${layer}/ must not use ${re.source}`);
    }
  }
}

if (violations.length) {
  console.error(`Dependency-boundary check FAILED (${violations.length}):`);
  for (const v of violations) console.error('  ✖ ' + v);
  process.exit(1);
}
console.log('Dependency-boundary check passed.');
