# Grok Build brief: Orbit Match system view, phase 1 (static graphic)

Date: 2026-09-29. Repo: `C:\Users\DougJ\Documents\GitHub\orbit_match`. The spec is `spec_orbit-match-system-view_20260929.md` in the same folder as this brief (`F:\Dropbox\TheCourt\research-grok\orbit-match-system-view\`). The concept picture is `concept_tau-ceti-tilted_20260929.png`, next to it.

## Run rules (read first)
- Grok Build runs this **unattended in a visible PowerShell 7 (pwsh) window** at the repo root. Use pwsh syntax.
- **No git writes.** No `git add`, `commit`, `stash`, `checkout`, `reset`, `branch`, or `push`. `git status` and `git diff` are allowed, read-only.
- **No installs.** No `npm install`, no package.json dependencies, no pip. Use the Node built-ins only (`node:test`, `node:assert`, `node:fs`, `node:path`, `node:module`). Node ≥ 20 is required. PC-NorCal has v24.
- **Tests first.** Write the whole test list below as real tests **before** any implementation file. Run the tests, confirm they fail, and save that log. Only then implement.
- **Graphic only.** No click handlers, zoom, pan, or animation. Those are phase 2.
- **Do not change existing behavior.** Leave `site/manual/*`, `site/index.html`, `site/js/*`, `site/css/*`, and `BRIEF.md` untouched. The only existing files you may edit are `README.md` (one short section) and `.gitignore` (add `out/`).
- Keep the house style: no build step, ordinary `<script>` tags, and UMD modules like `site/manual/orbit.js`. It must work from `file://` and from GitHub Pages. No network requests and no external URLs in the SVG.
- If you get stuck on something, write it down in the run report and move on. Do not invent data.

## Recommended approach (decided)
Plain SVG with a hand-written orthographic tilt projection. Do not use three.js. Reason: BRIEF.md requires no build step, script tags, and an SVG picture that works with WebGL off. The same pure JS then produces the SVG string in Node for the tests and the CLI.

## Test list (write these first)
Test files go in `test/` and run with `node --test test/`. Load the UMD modules through `createRequire`. Numbers use the tolerances given. `AU = 1.495978707e11 m`, `μ☉ = 1.32712440018e20 m³/s²`, `g0 = 9.80665 m/s²`, and 1 day = 86400 s.

**A. Formats and loading** (`test/formats.test.mjs`)
1. `loadSystem(json)` accepts `test/fixtures/tau-ceti.system.json` (`orbit_match: 1`) and returns the star plus 3 planets, 1 moon, and 1 station.
2. It rejects a file with no `orbit_match` key, or with `orbit_match > 1`, with a clear error message (not a crash).
3. A body with only `period` (and `unit`) gets its AU from `OrbitManual.bodyAu` using the star mass. A body with only `au` works too. A body with neither is left out of the layout and listed in `scene.skipped` by name or id.
4. String numbers from the builder ("0.133") parse. Blank strings count as missing.
5. `loadView(json)`: with no view, the defaults apply (elevation 58, scale "log", epoch 0, trail_days 5, all layers on, no transfers).
6. The view rejects `orbit_match_view` ≠ 1. It clamps `elevation_deg` to 45 to 70 and records a warning. It ignores unknown keys.
7. `parseViewHash("#el=60&scale=sqrt&epoch=10&xfer=g>f:hohmann&xfer=h>f:thrust:0.25,1")` gives the same object as the equivalent view JSON. Bodies can be referred to by id, by exact name, or by the NASA letter suffix.
8. The fixture JSON and `site/view/sample-tau-ceti.js` (the embedded copy used from `file://`) hold identical data.
9. Regression: `OrbitManual` still exports every name it exports today (`num, parseCsv, luminosity, goldilocks, starColor, convertPeriod, airAdvice, periodYears, periodToAu, auToPeriodYears, bodyAu, placeHz, withZones, visualZones, physicalZone, warningsFor, YEAR_DAYS`).

**B. Scale** (`test/scale.test.mjs`)
10. The distance map ρ(a) is strictly increasing over 0.01 to 100 AU in the log, sqrt, and linear modes.
11. The star disc radius + gap is < ρ(innermost a). The star never covers the first ring.
12. Fit: for elevation 45, 58, and 70, and for viewports 1600×1000 and 1000×1000, the outermost ring's projected ellipse fits inside the viewport minus the margin on both axes.
13. Size map: the star radius is > every body radius. Every planet is ≥ 5 px and every moon ≥ 3 px. A larger `radius_earth` never gives a smaller disc. Without `radius_earth`, the kind defaults apply.
14. Collision rule: two synthetic planets on nearly equal orbits get their radii reduced so the discs do not overlap radially, and never below the minimums. The ring positions themselves do not move.

**C. Positions and motion** (`test/layout.test.mjs`)
15. Determinism: the same system and view give an identical scene, and a byte-identical SVG, across two runs.
16. The phase is `θ0 + 2π t/P`. With `epoch_days = P`, the body is back at θ0 (within 1e-9 rad). `phase_deg`, if present, overrides the hash.
17. Not in a row: for 8 synthetic planets with default ids, the phases are not all within one 90° sector, and no two share a phase within 1°.
18. A moon's local ring radius is > the parent disc radius + 4 px and < half the gap to the nearest neighboring planet ring. Several moons are ordered by `distanceKm`.
19. Trails: the trail angle is 360° × trail_days / P, capped at 40°. For the fixture, g's trail angle > h's > f's.
20. Orbits are circles in plane space. Bodies of kind station, jumpgate, or staryard get `shape: "icon"`, and planets and moons get `shape: "sphere"`.
21. Colors: all planets in the fixture have different fills. Planets next to each other in orbit order differ by RGB distance ≥ 60. `water ≥ 50` gives a blue-family hue. An explicit `color` overrides the rule.

**D. Projection and depth** (`test/projection.test.mjs`)
22. A projected circular orbit has `ry/rx = sin(elevation)` to within 1e-9.
23. A point on the far side (+Y) projects above the star (smaller screen y). Body discs stay circles (a single `r`, not rx/ry).
24. Draw order in the scene: background, grid, hz band, far orbit halves, star, near orbit halves, transfers, bodies (far to near), labels, legend.

**E. Hohmann** (`test/hohmann.test.mjs`)
25. Earth→Mars (r1 = 1 AU, r2 = 1.524 AU, M = 1): TOF = 258.9 ± 0.5 d, |Δv1| = 2.946 ± 0.01 km/s, |Δv2| = 2.650 ± 0.01 km/s.
26. Mars→Earth gives the same TOF and the same |Δv| pair in reverse order.
27. tau Ceti g→f (0.133 → 1.334 AU, M = 0.783): TOF = 129.65 ± 0.1 d, Δv1 = 25.19 ± 0.05, Δv2 = 13.10 ± 0.05 km/s.
28. Window: the required lead is `π − 2π·TOF/P2`. `nextWindow` returns the first t ≥ epoch at which the target's lead equals it to within 0.1°. The synodic period for Earth/Mars (P from Kepler 3) is 779.9 ± 1.5 d.
29. Geometry: after compression and projection, the sampled arc's first point is within 0.5 px of the departure body's position at the window time, and its last point is within 0.5 px of the target's position at the window time + TOF.
30. The same body, or equal radii, returns `{ error: "no transfer" }`. A moon or station endpoint uses its parent's (or its own) heliocentric orbit and sets `note: "planet-level"`.

**F. Constant thrust** (`test/thrust.test.mjs`)
31. A fixed target 1 AU away: at 1 g, T = 2.859 ± 0.005 d and peak speed 1211 ± 2 km/s. At 0.25 g, T = 5.718 ± 0.01 d. At 1.25 g, T = 2.557 ± 0.005 d.
32. T(0.25 g) / T(1 g) = 2 to within 1e-12 for a fixed target.
33. Moving target: the iteration converges (|ΔT| < 1 s) in 20 steps or fewer. The end point equals the target's position at t0 + T to within 1e-9 AU.
34. `accel_g` outside 0.25 to 1.25 gives a clear error.
35. The flip point is at the path midpoint in distance, at time T/2.
36. Flags: `gravityNotNegligible` is set when star gravity at the start is > 1% of the thrust (test with a synthetic body at 0.005 AU from a 1 M☉ star). `nearStar` is set when the line passes within max(3 × star radius, 0.02 AU) of the star.
37. For the fixture h→f at epoch 0, 1 g is faster than the Hohmann g→f by more than 30×. This is a sanity check.

**G. SVG render** (`test/render.test.mjs`)
38. The output is well-formed XML (a small tag-stack checker in `test/util.mjs`), with `xmlns`, a `viewBox`, and no `<script>`, no `http` URLs, and no external `href`.
39. There is one element per laid-out body with `data-body-id`, one star element, and a `<text>` label for every named body.
40. The transfer layer has `class="xfer-hohmann"` (dashed), `class="xfer-thrust"` (one path per acceleration), a flip tick per thrust path, and ghost markers (`class="ghost"`) at the departure and arrival positions.
41. The legend text contains the rounded values from the math (for the fixture: "130 d", "25.2", "13.1", and the thrust days to 1 decimal place) and the phrase "log-compressed".
42. The CLI (`node tools/render-system.mjs test/fixtures/tau-ceti.system.json --view test/fixtures/tau-ceti.view.json --out out/test-render.svg`) exits 0 and writes a file that passes test 38. Bad input exits non-zero with a message.

## Directions (do them in this exact order)
1. **Preflight.** In the visible pwsh window at the repo root, run `node --version` and `git status --short`, and save both outputs to `out/preflight.txt`. Create `out/` if it is missing. Stop if Node is older than 20.
2. **Read.** Read `README.md`, `BRIEF.md`, `TODO_PORTS.md`, `site/manual/orbit.js`, and `site/manual/manual.js` (especially `blankBody`, `blankMoon`, `systemRecord`, `loadSystem`, and `saveLocal`). Then read the spec and look at the concept PNG. Do not edit any of them.
3. **Create `AGENTS.md`** at the repo root. It holds:
   - The project in 3 lines.
   - The house rules: no build step, UMD and script tags, `node --test test/`, and no git writes by agents.
   - "Data formats are defined in `docs/FORMATS.md`."
   - A `## Todos` section that copies the todo list from `TODO_PORTS.md` word for word. Leave `TODO_PORTS.md` in place.
4. **Create `docs/FORMATS.md`.** It documents, each with its version key and an example:
   - `orbit_match: 1`, the system file exactly as `systemRecord()` writes it today, including the body and moon fields. Mark `radius_earth`, `phase_deg`, `ecc`, and `color` as **reserved/optional, read-if-present, not written** (candidates for v2).
   - `handoff: 1` (copied from BRIEF.md).
   - `config: 1`.
   - The new `orbit_match_view: 1` (spec section 10) and its hash-parameter form.
   - The rule: readers reject unknown major versions with a message and ignore unknown keys.
5. **Create the fixtures.**
   - `test/fixtures/tau-ceti.system.json` in `orbit_match: 1` format:
     - Star: hostname "tau Cet", spectype "G8.5V", mass_solar 0.783, lum_log −0.284.
     - Planets, as builder-style strings with unit "days": "tau Ceti g" (period "20.00", au "0.133", radius_earth 1.18), "tau Ceti h" ("49.41", "0.243", 1.19), and "tau Ceti f" ("636.13", "1.334", 1.81).
     - A moon on f: "f I (fixture)", period "9", distanceKm "400000", concept "Test fixture, not canon".
     - A station: "Highport (fixture)", au "1.0", kind "station", concept "Test fixture, not canon".
     - Use fixed ids "g", "h", "f", "fI", and "hp".
   - `test/fixtures/tau-ceti.view.json`: elevation 58, log, epoch 0, transfers g→f hohmann and h→f thrust [0.25, 1].
   - `site/view/sample-tau-ceti.js`: the same system as `window.OrbitViewSample = {...}`.
6. **Write every test in the list above.** Also write `test/util.mjs` (the XML checker and the approx helper). Run `node --test test/ *>&1 | Tee-Object out/test-log-before.txt`. Everything except test 9 should fail because the modules do not exist yet. That is expected.
7. **Implement `site/view/transfer.js`** (UMD, global `OrbitTransfer`): constants, `hohmann`, `nextWindow`, `synodic`, `brachistochrone` (with the moving-target iteration and flags), and `hohmannArcPoints`. Run the E and F tests until they pass.
8. **Implement `site/view/systemview.js`** (UMD, global `OrbitView`): `loadSystem`, `loadView`, `parseViewHash`, `distanceMap`, `fit`, `sizeMap`, `phase`, `layout` (bodies, moons, belts, icons, trails, colors, hz band, skipped), `project`, and `buildScene` (the draw-ordered primitives, plus transfers mapped through the compression and projection). Reuse `OrbitManual` (`bodyAu`, `luminosity`, `goldilocks`, `starColor`) through `require` in Node and the global in the browser. Run the A to D tests until they pass.
9. **Implement `site/view/render-svg.js`** (UMD, global `OrbitSvg`): `renderSvg(scene)` returns a string. Use the look in the spec and concept:
   - A dark gradient background with sparse deterministic stars.
   - A dim plane grid and a faint hz annulus.
   - Thin, tinted orbits.
   - A star glow, and spheres lit from the star.
   - Labels with leader lines.
   - A teal dashed Hohmann with chevrons, and amber thrust lines with flip ticks.
   - Ghost rings, and one legend box.
   Run the G tests.
10. **Implement `tools/render-system.mjs`**: `node tools/render-system.mjs <system.json> [--view <view.json>] [--el N] [--out <file.svg>]`. Then render `out/tau-ceti_system-view.svg` from the fixtures. Also render `out/tau-ceti_el45.svg` and `out/tau-ceti_el70.svg`.
11. **Implement the static page** `site/view/index.html` + `site/view/view.js`:
    - Header, footer, and theme like `site/manual/index.html`.
    - One file input, "Open a system".
    - On load it uses, in order: the URL hash view parameters; a system from the file input; the builder draft in localStorage `orbit-match-manual` (read-only, never written); the embedded tau Ceti sample.
    - It injects the SVG. No click, zoom, or animation.
    - Load order: `../manual/orbit.js`, `transfer.js`, `systemview.js`, `render-svg.js`, `view.js`.
12. **Small doc touches:**
    - `README.md`: add a 3-line "System view" section linking `site/view/` and naming the hash parameters.
    - `.gitignore`: add `out/`.
    - Nothing else.
13. **Final run.**
    - Run `node --test test/ *>&1 | Tee-Object out/test-log-after.txt`. All tests must pass.
    - Run `git status --short` and save the output to `out/git-status-after.txt`.
    - Confirm that no existing file other than README.md and .gitignore shows as modified.
14. **Write `out/RUN_REPORT.md`:**
    - The files created and changed.
    - The test counts, before and after.
    - The tau Ceti numbers produced (Hohmann TOF/Δv/window, and thrust T and peak speed per acceleration).
    - Anything skipped or uncertain.
    - The manual checks for Doug: open `site/view/index.html` by double-clicking it, check the tilt, check that the planets are not in a row, check that the transfer arcs touch the ghost rings.
    Then stop. Do not commit.

## Done means
- All 42 tests pass with `node --test test/`, and there is a before log showing they failed first.
- `out/tau-ceti_system-view.svg` looks like the concept:
  - A tilted plane with ellipse orbits.
  - The star largest and inside the first ring.
  - Three distinguishable planets at separate phases, with trails longest on g.
  - A moon ring on f, and the station icon.
  - The Hohmann g→f dashed arc landing on the arrival ghost.
  - The ¼ g and 1 g thrust lines with flip ticks.
  - A legend with days and Δv.
- AGENTS.md and docs/FORMATS.md exist, and the formats are versioned.
- No git writes, no installs, and no existing page behavior changed.
