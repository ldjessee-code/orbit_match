# Phase status

Updated 2026-10-11.

| Phase | State |
| --- | --- |
| 0 Hygiene, proof table, guard, test harness | done on `review` |
| 1 System schema and the Tau Ceti fixture | done on `review` |
| 2 Quiet-orrery SVG viewer | done on `review` |
| 3 Interaction | not started |
| 4 Optional three.js page | not started |
| 5 Builder writes version 2 | not started |

Order approved 2026-10-10. Choices are in `docs/DECISIONS_20261008.md`.

Proof commands that exit 0 at the end of phase 0:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File tests\hooks.tests.ps1
node --test "test/**/*.js"
```

`node --test test/` on Node 24 tries to load the `test` directory as a module and exits 1. The quoted glob is the command that runs the files. The builder's picture is unchanged. Phase 0 did not edit `site/`. Phase 1 adds `site/js/schema.js` and `site/data/`. Phase 2 adds the quiet and holo plates, the SVG viewer, and `tools/serve-site.mjs` on port 8131. The home page links to the viewer. Pages still deploys `main` only, so the live site does not change until Doug merges.
