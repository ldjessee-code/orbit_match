# Phase status 2026-10-10

| Phase | State |
| --- | --- |
| 0 Hygiene, proof table, guard, test harness | done in this working tree, commits on `review` |
| 1 System schema and the Tau Ceti fixture | not started |
| 2 Quiet-orrery SVG viewer | not started |
| 3 Interaction | not started |
| 4 Optional three.js page | not started |
| 5 Builder writes version 2 | not started |

Order approved 2026-10-10. Choices are in `docs/DECISIONS_20261008.md`.

Proof commands that exit 0 at the end of phase 0:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File tests\hooks.tests.ps1
node --test "test/**/*.js"
```

`node --test test/` on Node 24 tries to load the `test` directory as a module and exits 1. The quoted glob is the command that runs the files. The builder's picture is unchanged. `site/` is not part of phase 0.
