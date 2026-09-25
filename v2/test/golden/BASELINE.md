# Golden baseline — pinned staging snapshot

`staging-index.html` is a verbatim, version-controlled copy of the production
game that serves as the parity oracle's source (ARCHITECTURE §7.3, Decision 3).
Pinning it makes the golden-master tests hermetic — they run in CI with no
access to git refs — and fixes the parity reference to a known commit rather
than a moving branch.

- **Pinned commit:** `staging` @ `353d9b3ea5700a2cdbf2c3e16c1369c158a17e17`
- **Consumed by:** `v2/test/oracle/production.mjs` (runs this file's real
  `initGame`/`act`/`endTurn` in a headless sandbox) and
  `v2/tools/extract-content.mjs` (extracts the typed content modules).

## Refreshing the baseline

Only when the intended parity reference on `staging` changes, and as a
deliberate, reviewed step (it re-baselines every golden-master test):

```
cd v2
npm run refresh-baseline   # re-pins the snapshot AND re-extracts content
npm test                   # regenerate/confirm parity against the new baseline
```

Never edit `staging-index.html` by hand — it must stay byte-identical to the
production build it mirrors.
