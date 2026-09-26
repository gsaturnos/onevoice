#!/usr/bin/env node
// Generates ONE clearly-marked placeholder authored-raster character (see
// docs/v2/authored-character-art-spec.md §13) to prove the authored pipeline —
// loading, scale/anchor, state-swap crossfade, portrait rendering, and
// per-character fallback — before any final illustration exists. The output is
// unmistakably a placeholder (a dashed frame + baked-in "PLACEHOLDER" label on
// every pixel, not just a manifest flag) and must never be read as a quality
// bar for the real art.
//
// DEV-ONLY (not run in CI): needs a Chromium via playwright-core. The generated
// images + manifest are committed, so the app and CI never need a browser.
//   PW_EXECUTABLE=/path/to/headless_shell node tools/gen-authored-placeholder.mjs

import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../public/art/authored');
mkdirSync(OUT, { recursive: true });
const EXE = process.env.PW_EXECUTABLE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const CAST_ID = 'baker'; // a non-player character, so player-only aura logic is untouched by this proof
const STATES = ['afraid', 'listening', 'clear'];
const FIGURE = { w: 480, h: 600 };
const PORTRAIT = { w: 440, h: 560 };
const ANCHOR = { x: 0.5, y: 0.6444 };

// A simple, deliberately plain grey mannequin — legible per state, never mistaken
// for finished art. `t` = 0 afraid .. 1 clear drives posture (hunched → open).
function figureSvg(w, h, state) {
  const t = state === 'afraid' ? 0 : state === 'listening' ? 0.5 : 1;
  const cx = w / 2;
  const seatY = h * ANCHOR.y;
  const headR = w * 0.09;
  const headY = h * 0.22;
  const shoulderY = headY + headR * 1.6;
  const lean = (1 - t) * w * 0.02; // a slight forward hunch when afraid
  const armL = t > 0.75
    ? `M ${cx - w * 0.13} ${shoulderY + 10} Q ${cx - w * 0.24} ${shoulderY - h * 0.05} ${cx - w * 0.3} ${shoulderY - h * 0.1}` // open
    : t > 0.25
      ? `M ${cx - w * 0.13} ${shoulderY + 10} Q ${cx - w * 0.2} ${shoulderY - h * 0.06} ${cx - w * 0.24} ${headY + headR * 0.3}` // hand toward ear
      : `M ${cx - w * 0.13} ${shoulderY + 10} Q ${cx - w * 0.08} ${shoulderY + h * 0.1} ${cx + w * 0.02} ${shoulderY + h * 0.12}`; // hugging in
  const armR = t > 0.75
    ? `M ${cx + w * 0.13} ${shoulderY + 10} Q ${cx + w * 0.24} ${shoulderY - h * 0.05} ${cx + w * 0.3} ${shoulderY - h * 0.1}`
    : `M ${cx + w * 0.13} ${shoulderY + 10} Q ${cx + w * 0.08} ${shoulderY + h * 0.1} ${cx - w * 0.02} ${shoulderY + h * 0.12}`;
  const torsoW = w * 0.34;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(${lean} 0)" fill="none" stroke="#8a8f98" stroke-width="${w * 0.012}" stroke-dasharray="${w * 0.02} ${w * 0.012}">
      <circle cx="${cx}" cy="${headY}" r="${headR}" fill="#6b7078" fill-opacity="0.55"/>
      <path d="M ${cx - torsoW / 2} ${shoulderY} Q ${cx} ${shoulderY - 6} ${cx + torsoW / 2} ${shoulderY} L ${cx + torsoW * 0.42} ${seatY} L ${cx - torsoW * 0.42} ${seatY} Z" fill="#6b7078" fill-opacity="0.4"/>
      <path d="${armL}"/>
      <path d="${armR}"/>
    </g>
    <rect x="${w * 0.03}" y="${h * 0.03}" width="${w * 0.94}" height="${h * 0.94}" fill="none" stroke="#d98a6a" stroke-width="${w * 0.01}" stroke-dasharray="${w * 0.03} ${w * 0.018}"/>
    <line x1="0" y1="${seatY}" x2="${w}" y2="${seatY}" stroke="#d98a6a" stroke-width="1.5" stroke-dasharray="6 6" opacity="0.6"/>
    <g transform="translate(${cx} ${h * 0.55}) rotate(-18)">
      <text text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-weight="700" font-size="${w * 0.09}" fill="#d98a6a" fill-opacity="0.55">PLACEHOLDER</text>
    </g>
    <text x="${cx}" y="${h * 0.97}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="${w * 0.032}" fill="#d98a6a">${CAST_ID} · figure · ${state}</text>
  </svg>`;
}

function portraitSvg(w, h, state) {
  const t = state === 'afraid' ? 0 : state === 'listening' ? 0.5 : 1;
  const cx = w / 2;
  const headR = w * 0.24;
  const headY = h * 0.42;
  const mouth = t > 0.75 ? 'M ' + (cx - headR * 0.5) + ' ' + (headY + headR * 0.45) + ' Q ' + cx + ' ' + (headY + headR * 0.75) + ' ' + (cx + headR * 0.5) + ' ' + (headY + headR * 0.45)
    : t > 0.25 ? `M ${cx - headR * 0.4} ${headY + headR * 0.5} L ${cx + headR * 0.4} ${headY + headR * 0.5}`
      : `M ${cx - headR * 0.4} ${headY + headR * 0.55} Q ${cx} ${headY + headR * 0.35} ${cx + headR * 0.4} ${headY + headR * 0.55}`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke="#8a8f98" stroke-width="${w * 0.012}" stroke-dasharray="${w * 0.02} ${w * 0.012}">
      <circle cx="${cx}" cy="${headY}" r="${headR}" fill="#6b7078" fill-opacity="0.55"/>
      <path d="M ${cx - w * 0.32} ${h * 0.94} Q ${cx} ${h * 0.68} ${cx + w * 0.32} ${h * 0.94} Z" fill="#6b7078" fill-opacity="0.4"/>
      <circle cx="${cx - headR * 0.35}" cy="${headY - headR * 0.1}" r="${headR * 0.07}" fill="#3a2c20" stroke="none"/>
      <circle cx="${cx + headR * 0.35}" cy="${headY - headR * 0.1}" r="${headR * 0.07}" fill="#3a2c20" stroke="none"/>
      <path d="${mouth}" stroke="#3a2c20" stroke-width="${w * 0.014}" stroke-dasharray="none"/>
    </g>
    <rect x="${w * 0.03}" y="${h * 0.03}" width="${w * 0.94}" height="${h * 0.94}" fill="none" stroke="#d98a6a" stroke-width="${w * 0.01}" stroke-dasharray="${w * 0.03} ${w * 0.018}"/>
    <g transform="translate(${cx} ${h * 0.55}) rotate(-18)">
      <text text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-weight="700" font-size="${w * 0.1}" fill="#d98a6a" fill-opacity="0.55">PLACEHOLDER</text>
    </g>
    <text x="${cx}" y="${h * 0.97}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="${w * 0.036}" fill="#d98a6a">${CAST_ID} · portrait · ${state}</text>
  </svg>`;
}

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

async function shoot(svgFn, w, h, scale, outPath) {
  const pw = w * scale, ph = h * scale;
  const ctx = await browser.newContext({ viewport: { width: pw, height: ph }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  // draw directly at the target pixel size (all coordinates inside svgFn are
  // relative to the w/h it's given), so no post-hoc scaling/regex is needed.
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}
  svg{display:block}</style>${svgFn(pw, ph)}`;
  await page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(html), { waitUntil: 'networkidle' });
  await new Promise((r) => setTimeout(r, 150));
  const pngBuf = await page.screenshot({ omitBackground: true });
  const webpDataUrl = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.85);
  }, pngBuf.toString('base64'));
  const webpBuf = Buffer.from(webpDataUrl.split(',')[1], 'base64');
  writeFileSync(outPath, webpBuf);
  await ctx.close();
  return webpBuf.length;
}

const manifest = {
  version: 1,
  figureCanvas: FIGURE,
  portraitCanvas: PORTRAIT,
  anchor: ANCHOR,
  states: STATES,
  characters: [],
  attribution: {
    title: 'One Voice — kitchen-table cast (authored)',
    source: 'external illustration, approved reference direction',
    thirdParty: 'none',
  },
};

// The fixed 12-slot, seat-ordered roster (mirrors castIds.ts) — every entry is
// present so index-based lookup (renderer + ui/portrait.ts) stays consistent;
// only CAST_ID gets real (placeholder) art in this phase.
const CAST_IDS = [
  'nurse', 'postman', 'bookseller', 'baker', 'student', 'mechanic',
  'gardener', 'farmer', 'musician', 'carpenter', 'librarian', 'florist',
];

let totalBytes = 0;
for (const id of CAST_IDS) {
  if (id !== CAST_ID) { manifest.characters.push({ id, figure: {}, portrait: {} }); continue; }
  const entry = { id, status: 'placeholder', figure: {}, portrait: {} };
  for (const state of STATES) {
    for (const [tag, scale] of [['1x', 1], ['2x', 2]]) {
      const figName = `${id}.figure.${state}@${tag}.webp`;
      const n1 = await shoot((w, h) => figureSvg(w, h, state), FIGURE.w, FIGURE.h, scale, join(OUT, figName));
      entry.figure[state] = { ...entry.figure[state], [tag]: figName };
      totalBytes += n1;

      const portName = `${id}.portrait.${state}@${tag}.webp`;
      const n2 = await shoot((w, h) => portraitSvg(w, h, state), PORTRAIT.w, PORTRAIT.h, scale, join(OUT, portName));
      entry.portrait[state] = { ...entry.portrait[state], [tag]: portName };
      totalBytes += n2;
      console.log(`${figName} (${(n1 / 1024).toFixed(0)}KB)  ${portName} (${(n2 / 1024).toFixed(0)}KB)`);
    }
  }
  manifest.characters.push(entry);
}
await browser.close();

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`manifest.json  characters: ${manifest.characters.length}  total: ${(totalBytes / 1024).toFixed(0)}KB`);
