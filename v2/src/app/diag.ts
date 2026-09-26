// Dev-only on-screen diagnostic (shown with ?diag). It reports, conclusively,
// whether the running build is drawing the AUTHORED CHARACTER ATLAS or the
// procedural fallback — the atlas request, the resolution the manifest selected,
// and whether every character texture resolved. Not part of gameplay; only mounted
// when ?diag is present, and it never touches the core.

import type { AtlasDiagnostics } from '@render/assets/characterAtlas';

export function showArtDiagnostic(d: AtlasDiagnostics): void {
  const ok = d.available;
  const el = document.createElement('div');
  el.id = 'art-diag';
  const rows: Array<[string, string]> = [
    ['source', ok ? 'AUTHORED ATLAS' : d.forcedFallback ? 'PROCEDURAL (forced)' : 'PROCEDURAL FALLBACK'],
    ['manifest', d.manifestOk ? `ok (HTTP ${d.httpStatus})` : `FAILED${d.httpStatus != null ? ` (HTTP ${d.httpStatus})` : ''}`],
    ['resolution', d.pageKey ? `${d.pageKey} ×${d.pageScale} (dpr ${d.dpr})` : '—'],
    ['page', d.pageSrc || '—'],
    ['textures', `${d.texturesResolved}/${d.framesInManifest} frames`],
    ['characters', `${d.charactersResolved}/${d.charactersExpected} complete`],
  ];
  if (d.missing.length) rows.push(['missing', d.missing.join(', ')]);
  if (d.error) rows.push(['error', d.error]);

  el.innerHTML =
    `<div class="hd ${ok ? 'ok' : 'bad'}">ART · ${ok ? 'ATLAS LOADED' : 'FALLBACK'}</div>` +
    rows.map(([k, v]) => `<div class="r"><span>${k}</span><b>${v}</b></div>`).join('');

  const css = document.createElement('style');
  css.textContent = `
    #art-diag{position:fixed;top:10px;left:10px;z-index:9999;font:12px/1.4 ui-monospace,Menlo,monospace;
      background:rgba(12,9,7,0.92);color:#e9dcc6;border:1px solid #3a2c20;border-radius:8px;padding:8px 10px;
      box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:340px;pointer-events:none}
    #art-diag .hd{font-weight:700;letter-spacing:.5px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #3a2c20}
    #art-diag .hd.ok{color:#a8e6bf}
    #art-diag .hd.bad{color:#d98a6a}
    #art-diag .r{display:flex;justify-content:space-between;gap:14px}
    #art-diag .r span{color:#9a8c78}
    #art-diag .r b{color:#f3e9d8;font-weight:600;text-align:right;word-break:break-all}`;
  document.head.appendChild(css);
  document.body.appendChild(el);
}
