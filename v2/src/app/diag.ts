// Dev-only on-screen diagnostic (shown with ?diag). It reports, conclusively,
// which visual tier is drawing each character: the AUTHORED raster set, the
// SVG cast atlas, or — for a manifest/page that fails outright — the fully
// procedural fallback. Not part of gameplay; only mounted when ?diag is
// present, and it never touches the core.

import type { AtlasDiagnostics } from '@render/assets/characterAtlas';
import type { AuthoredDiagnostics } from '@render/assets/authoredCast';

export interface CombinedDiagnostics {
  atlas: AtlasDiagnostics;
  authored: AuthoredDiagnostics;
}

export function showArtDiagnostic(d: CombinedDiagnostics): void {
  const { atlas, authored } = d;
  const atlasOk = atlas.available;
  const authoredOn = authored.authoredIds.length + authored.placeholderIds.length > 0;

  const el = document.createElement('div');
  el.id = 'art-diag';

  const atlasRows: Array<[string, string]> = [
    ['source', atlasOk ? 'SVG ATLAS' : atlas.forcedFallback ? 'PROCEDURAL (forced)' : 'PROCEDURAL FALLBACK'],
    ['manifest', atlas.manifestOk ? `ok (HTTP ${atlas.httpStatus})` : `FAILED${atlas.httpStatus != null ? ` (HTTP ${atlas.httpStatus})` : ''}`],
    ['resolution', atlas.pageKey ? `${atlas.pageKey} ×${atlas.pageScale} (dpr ${atlas.dpr})` : '—'],
    ['textures', `${atlas.texturesResolved}/${atlas.framesInManifest} frames`],
    ['characters', `${atlas.charactersResolved}/${atlas.charactersExpected} complete`],
  ];
  if (atlas.missing.length) atlasRows.push(['missing', atlas.missing.join(', ')]);
  if (atlas.error) atlasRows.push(['error', atlas.error]);

  const authoredRows: Array<[string, string]> = [
    ['manifest', authored.forcedOff ? 'off (?noauthored)' : authored.manifestOk ? `ok (HTTP ${authored.httpStatus})` : (authored.error ? `absent (${authored.error})` : `FAILED${authored.httpStatus != null ? ` (HTTP ${authored.httpStatus})` : ''}`)],
    ['declared', `${authored.charactersDeclared} characters`],
    ['authored', authored.authoredIds.length ? authored.authoredIds.join(', ') : '—'],
    ['placeholder', authored.placeholderIds.length ? authored.placeholderIds.join(', ') : '—'],
  ];
  if (authored.failedIds.length) authoredRows.push(['failed→SVG', authored.failedIds.join(', ')]);

  el.innerHTML =
    `<div class="hd ${atlasOk ? 'ok' : 'bad'}">ART · SVG ATLAS ${atlasOk ? 'LOADED' : 'FALLBACK'}</div>` +
    atlasRows.map(([k, v]) => `<div class="r"><span>${k}</span><b>${v}</b></div>`).join('') +
    `<div class="hd ${authoredOn ? 'ok' : 'dim'}" style="margin-top:8px">AUTHORED RASTER ${authoredOn ? '(' + (authored.authoredIds.length + authored.placeholderIds.length) + '/' + authored.charactersDeclared + ')' : '— none shipped yet'}</div>` +
    authoredRows.map(([k, v]) => `<div class="r"><span>${k}</span><b>${v}</b></div>`).join('');

  const css = document.createElement('style');
  css.textContent = `
    #art-diag{position:fixed;top:10px;left:10px;z-index:9999;font:12px/1.4 ui-monospace,Menlo,monospace;
      background:rgba(12,9,7,0.92);color:#e9dcc6;border:1px solid #3a2c20;border-radius:8px;padding:8px 10px;
      box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:380px;pointer-events:none}
    #art-diag .hd{font-weight:700;letter-spacing:.5px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #3a2c20}
    #art-diag .hd.ok{color:#a8e6bf}
    #art-diag .hd.bad{color:#d98a6a}
    #art-diag .hd.dim{color:#9a8c78}
    #art-diag .r{display:flex;justify-content:space-between;gap:14px}
    #art-diag .r span{color:#9a8c78}
    #art-diag .r b{color:#f3e9d8;font-weight:600;text-align:right;word-break:break-all}`;
  document.head.appendChild(css);
  document.body.appendChild(el);
}
