# Grok Build brief v2: Orbit Match System Viewer, phase 1 (static graphic)

Date: 2026-09-29. Repo: `C:\Users\DougJ\Documents\GitHub\orbit_match`. The design is in `spec_orbit-match-system-view_20260929_v2.md` in the job folder `F:\Dropbox\TheCourt\research-grok\orbit-match-system-view\`. That folder also holds the concept images `concept_tauceti-turquenish-system_20260929.png` and `concept_kakakiko-closeup_20260929.png`, and the throwaway generator that drew them, `concept_generator_v2_20260929.mjs`. You can read the generator for its math. Do not copy it wholesale: the product must follow the spec's structure and the tests.

This brief replaces brief v1, which is kept for history.

## Run rules (read first)
- **Where it runs.** Grok Build runs unattended in a **visible pwsh (PowerShell 7) window**, at the repo root. Use pwsh syntax.
- **No git writes.** Do not run `add`, `commit`, `stash`, `checkout`, `reset`, `branch`, `push`, or `tag`. `git status` and `git diff` (read-only) are fine.
- **No installs.** No npm, pip, or package.json dependencies. Node ≥ 20 built-ins only (`node:test`, `node:assert/strict`, `node:fs`, `node:path`, `node:module`).
- **Tests first.** Write every test below before any implementation. Run them, confirm they fail, and save the log. Then implement.
- **Graphic only.** No click, zoom, pan, animation, or time controls. Those are phase 2. The zoom and time **functions** are built and tested now; only their UI waits.
- **Existing files.**
  - Do not edit `site/manual/*`, `site/index.html`, `site/js/*`, `site/css/*`, `BRIEF.md`, `INTERCONNECT.md`, or `TODO_PORTS.md`.
  - You may edit only `README.md` (one short section) and `.gitignore` (add `out/`).
- **House style.** No build step, UMD modules, plain `<script>` tags, and it must work from `file://`. No network calls, and no external URLs in the SVG output.
- **Do not invent lore.** Use only the fixture values listed here. Mark every value you choose yourself as `"placeholder"` in `canon`.
- **When stuck.** Write the problem into the run report and continue.

## Decided approach
- **SVG.** Plain SVG with a hand-written orthographic tilt, no three.js. Reason: it fits BRIEF.md (no build step, readable without WebGL), and the same pure JS renders in Node for the tests and the CLI.
- **Modules.** All of these are UMD under `site/viewer/`:
  - `positions.js` (`OrbitPositions`)
  - `transfer.js` (`OrbitTransfer`)
  - `scale.js` (`OrbitScale`)
  - `scene.js` (`OrbitScene`)
  - `render-svg.js` (`OrbitSvg`)
  - `formats.js` (`OrbitFormats`)
- **Reuse.** Use `site/manual/orbit.js` (`OrbitManual`) for `bodyAu`, `luminosity`, `goldilocks`, and `starColor`.

## Test list (write these first)
- **Where.** Test files go in `test/`. Run them with `node --test test/`. Helpers go in `test/util.mjs`: `approx`, a tiny tag-stack XML checker, and `integrateTwoPhase`, which steps a two-phase thrust profile with Euler steps of dt ≤ T/20000.
- **Constants.** μ☉ = 1.32712440018e20, GM⊕ = 3.986004418e14, AU = 1.495978707e11 m, g0 = 9.80665, day = 86400 s.
- **Fixture.** `F` means `test/fixtures/tauceti-turquenish.system.json`.

**A. Formats** (`test/formats.test.mjs`)
1. `loadSystem(F)` accepts `orbit_match: 2`. It returns 8 planets, 2 moons, 3 structures, 2 belts, and the star.
2. `loadSystem` accepts `test/fixtures/v1-minimal.system.json` (`orbit_match: 1`, string fields, nested moons). It rejects a file with no version, or with version ≥ 3, with a clear message.
3. `migrateV1toV2(v1)`:
   - Nested moons become flat bodies with `parent`.
   - `au` becomes `orbit.a_au`, and `distanceKm` becomes `orbit.a_km`.
   - `period`+`unit` becomes `orbit.period_days` (years × 365.25).
   - Facts move under `facts`.
   - Ids are kept. The result passes `validateSystem`.
4. `validateSystem` errors when:
   - a body has both `a_au` and `a_km`, or has two mass fields;
   - a `parent` id does not exist;
   - there is a parent cycle;
   - e is outside [0, 1);
   - an anchor has a bad point name.

   It warns (does not error) when radius, mass, and density disagree by more than 5%.
5. Numeric strings (for example "0.71") parse as numbers. Empty strings count as missing. Unknown keys are ignored.
6. A missing `period_days` is derived. Kakakiko: 247.4 ± 0.3 d from a = 0.71 AU and 0.78 M☉. Der: 28.36 ± 0.1 d from 400,000 km and μ = GM⊕·(1.045 + 0.01045).
7. The density is derived: Shudder 2.8 ± 0.05 g/cm³ from its radius and mass, and Der 7.2 ± 0.1.
8. `loadView`:
   - Defaults: `orbit_match_view: 2`, elevation 58, `log`, epoch 0, `trail_days` 5, preset `system`, no transfers.
   - It rejects any other version.
   - Elevation is clamped to 45–70, with a warning.
   - `accel_g` outside its profile's range is an error: reactionless 0.25–1.25, fusion 0.005–0.01.
9. `parseViewHash("#preset=focus:tc5&el=60&t=12&xfer=tc5>tc6:hohmann&xfer=tc5>tc6:thrust:reactionless:1")` equals the same view written as JSON. Bodies can be named by id or by exact name.
10. `site/viewer/sample-tauceti.js` holds exactly the same data as F.
11. Regression: every current `OrbitManual` export still exists with the same name.

**B. Positions over time** (`test/positions.test.mjs`)

12. Kepler solver: |E − e sin E − M| < 1e−12 for e ∈ {0, 0.2, 0.6, 0.9} and 50 values of M.
13. Periodicity: `pos(id, t + P) = pos(id, t)` within 1e−9 relative, for every orbiting body in F.
14. A moon's position is the parent's position plus its local Kepler position. `|pos(tc5b) − pos(tc5)|` stays within [388,000, 412,000] km over one Der period. Shudder stays within [201,080, 301,620] ± 50 km.
15. Shudder's distance to Kakakiko has its minimum at 201,080 ± 100 km and its maximum at 301,620 ± 100 km. This checks that eccentricity is handled.
16. Lagrange anchors:
    - |L4 − Kakakiko| = |Der − Kakakiko| within 1e−9 relative.
    - The angle from Der to L4 is +60° (leading, in the direction of motion), to L5 is −60°, and to L3 is 180°, within 1e−9 rad.
    - This holds at 20 sample times, so the anchors co-orbit.
17. Resonance: at every Shudder–Der conjunction in 10 Der periods (conjunction = equal **mean** longitudes, found by root-finding), Shudder's mean anomaly is within 1° of 0 (pericenter).
18. Velocity: `vel(id, t)` matches a central finite difference of `pos` within 1e−6 relative, for a planet, a moon, and L4.
19. Frames: `rel(id, focus, t) = pos(id, t) − pos(focus, t)`. For `focus = tc5`, the Kakakiko position is (0, 0).
20. Determinism: a body with no `mean_anomaly_deg` gets a hash phase that is stable across runs and tagged `placeholder`. Eight synthetic ids are not all within any 90° sector.
21. Trails: the trail angle is 360° × trail_days / P, capped at 40° at zoom 1. In F, the trail angles run Gane > Hornstooth > Husk > Sable > Kakakiko.

**C. Scale and two-stage zoom** (`test/scale.test.mjs`)

22. ρ(r) is strictly increasing on 0.01–100 AU for `log` and for `sqrt`. The star disc plus the gap is < ρ(innermost a).
23. Fit at Z = 1: the outermost belt edge (50 AU) and every orbit fit inside 1600×1000 and 1000×1000, minus the margins, at elevations 45, 58, and 70.
24. Zoom-1 sizes:
    - The star is larger than any body. Every body is ≥ 3 px.
    - A larger radius never gives a smaller disc.
    - Where neighbouring discs would overlap, they shrink, never below the minimum. The rings do not move.
25. **Stage 1:** for Z in [1, Z1], `size(body, Z)` equals `size(body, 1)` exactly, and the screen distance from the focus equals Z × the zoom-1 distance, within 1e−9.
26. **Z1:** for focus `tc5`, Z1 equals min(W/2, (H/2)/sin el) / min(the gap in ρ to Sable, the gap in ρ to the Sombrero inner edge), within 1e−9. It is clamped to ≥ 2.
27. **Stage 2:**
    - `size` is continuous at Z1 (the jump is < 1e−9) and strictly increasing on (Z1, Z2].
    - At Z2, Kakakiko's radius is 4.5% of min(W, H), within 0.5 px.
    - The blend weight w is 0 at Z1, 1 at Z2, and increases monotonically in between.
28. **At Z2 the geometry is true:** the ratio of Shudder's apocentre to its pericentre on screen, measured in plane space before the tilt, is 1.5 ± 0.01, which is (1+e)/(1−e). The outermost child radius (Der's apocentre, or the L-points) fills 85% ± 1% of the viewport half-height after the tilt.
29. The stage-2 moon size ratio Shudder/Der is 0.85^0.7 ± 0.01. The focus disc is < 0.6 × Shudder's pericentre on screen.
30. Level of detail: structure opacity is 0 below Z1, 1 at 1.5 × Z1 and above, and increases monotonically in between. At Z = 1, only planets, belts, and the star carry labels.

**D. Projection** (`test/projection.test.mjs`)

31. A projected circle has ry/rx = sin(el) within 1e−9. A point on the far side (+Y) projects above the centre. Discs keep a single `r`.
32. Scene draw order: background, grid, habitable zone, belts, far halves of orbits, star, near halves of orbits, transfers, bodies (far to near), labels, legend.

**E. Hohmann** (`test/hohmann.test.mjs`)

33. Earth → Mars (1 → 1.524 AU, 1 M☉): TOF 258.9 ± 0.5 d, Δv 2.946 ± 0.01 and 2.650 ± 0.01 km/s. The reverse trip gives the same TOF with the Δv pair swapped.
34. Kakakiko → Gas Giant (0.71 → 2.8 AU, 0.78 M☉): TOF 480.8 ± 0.5 d, Δv 8.21 ± 0.03 and 5.72 ± 0.03 km/s.
35. Planet frame: from Kakakiko low orbit (7,028 km) to 400,000 km, with μ = GM⊕ × 1.045: TOF 5.17 ± 0.02 d, Δv 3.09 ± 0.02 and 0.83 ± 0.02 km/s.
36. The window: `nextWindow` returns the first t ≥ t0 where the target leads by π − n2·TOF, within 0.1°. The Earth/Mars synodic period is 779.9 ± 1.5 d.
37. The mapped arc starts within 0.5 px of the departure body at the window time, and ends within 0.5 px of the target at window + TOF. This is tested in both presets, with a target at L5 in the close-up.
38. Same body, or equal radii, returns `{ error: "no transfer" }`. Endpoints with different parents return `{ error: "cross-frame leg: phase 3" }`.

**F. Constant thrust, matched arrival** (`test/thrust.test.mjs`)

39. `twoPhase(r0, v0, rT, vT, T)` returns a1 and a2. Integrating them with `integrateTwoPhase` reaches rT within 1e−6·|Δr| + 1 m and vT within 1e−6·|Δv| + 1e−3 m/s, for 10 random cases with a fixed seed.
40. Rest to rest, fixed target 1 AU away:
    - Minimum T at 1 g = 2.859 ± 0.005 d, peak 1,211 ± 2 km/s.
    - At 0.25 g, 5.718 ± 0.01 d. At 1.25 g, 2.557 ± 0.005 d.
    - T(0.25 g) / T(1 g) = 2 within 1e−9.
41. A pure velocity change at the same point: Δv = 10 km/s at 1 g gives T = 3,059.1 ± 0.5 s, and max(|a1|, |a2|) = a_max within 1e−9 relative.
42. Moving targets:
    - `matched(dep, tgt, t0, a)` finds the minimum T to 1 s. At T − 60 s, the required acceleration exceeds a_max.
    - The end state equals the target's `pos` and `vel` at t0 + T, within the tolerances in test 39.
43. Throttle: given T_user = 1.5 × T_min, the peak |a| is < a_max, and the end state is still matched.
44. Outputs: the flip is at T/2. The flip angle is the angle between a1 and a2. The thrust-time is (|a1| + |a2|)·T/2. The peak speed is |v0 + a1·T/2|.
45. Flags:
    - `gravityNotNegligible` is true for fusion 0.01 g departing from Kakakiko low orbit, and false for reactionless 1 g from Kakakiko to the Gas Giant.
    - `nearParent` is true for a path passing within 0.02 AU of the star.
46. Sanity check against the lore: fusion 0.01 g from Kakakiko (at rest in the planet frame) to L3 takes between 34 and 40 h. The lore gives about 35 h rest to rest.

**G. Render and CLI** (`test/render.test.mjs`)

47. Both preset SVGs are well-formed XML (checked with the util checker). Each has `xmlns` and a `viewBox`. None has a `<script>`, an `http`, or an external `href`.
48. The system preset has one `data-body-id` element for each planet and belt, a star element, labels for the 8 planets and 2 belts, a ring element for Ice Giant 1, and a habitable-zone band.
49. The close-up preset has Kakakiko, Shudder, and Der as spheres. L3, L4, and L5 are icons with `data-anchor`. Shudder's orbit path is non-circular: its maximum and minimum radius in plane space differ by at least 40%. Its perigee and apogee markers are present.
50. Transfer layers:
    - `class="xfer-hohmann"` is dashed.
    - `class="xfer-thrust"` has a `data-profile`, with one path per acceleration.
    - Each thrust path has a flip tick.
    - `class="ghost"` markers appear at departure and arrival.
    - A flagged transfer has `data-flag`.
51. The legend text contains the computed rounded values (days, Δv, peak speed), the scale phrases ("log-compressed" at zoom 1, "linear" in the close-up), and "placeholder" whenever a placeholder value affects the picture.
52. Rendering the same inputs twice gives byte-identical SVG.
53. The CLI: `node tools/render-system.mjs <system> [--view <view>] [--preset system|focus:<id>] [--el N] [--t DAYS] --out <file>` exits 0 on the fixtures. It exits non-zero with a clear message on a bad file.

## Fixture values (use exactly these; `canon` tags as shown)
`test/fixtures/tauceti-turquenish.system.json`, `orbit_match: 2`.

**Star.** hostname "tau Cet", setting_name "Tau Ceti", G8V, mass_solar 0.78, lum_solar 0.488, lum_log −0.3116, teff_k 5320, radius_solar 0.793.

**Epoch.** `t0_days` 0, tagged placeholder.

**Source.** Every body's `source` is `"Turquenish SoT systems/tauCet/Tau_Cet_system_v2.md §<section>"`.

**Planets** (parent null):

| id | name | a_au | e | radius_km | mass_earth | mean_anomaly_deg (placeholder) | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tc1 | Gane | 0.133 | 0 | 2820 | 0.06 | 40 | e tagged tbd; style rock-hot |
| tc2 | Hornstooth | 0.243 | 0 | 3110 | 0.08 | 150 | |
| tc3 | Husk | 0.34 | 0 | 3350 | 0.10 | 260 | |
| tc4 | Sable | 0.538 | 0.1 | 7900 | 2 | 330 | argp_deg 0 (placeholder); style basalt, albedo 0.07 |
| tc5 | Kakakiko | 0.71 | 0 | 6628 | 1.045 | 95 | surface_g 0.967, rotation_h 34, axial_tilt_deg 12, style ocean |
| tc6 | The Gas Giant | 2.8 | 0 | 58200 | 95 | 55 | style gas |
| tc7 | Ice Giant 1 | 5.5 | 0 | 24600 | 17 | 230 | rings true, style ice |
| tc8 | Ice Giant 2 | 9.2 | 0 | 24000 | 15 | 120 | radius_km and mass_earth tagged **placeholder** |

**Moons** (parent tc5):
- **tc5b "Der Eindringling":** a_km 400000, e 0.03, argp_deg 0 (placeholder), mean_anomaly_deg 180 (placeholder), radius_km 1274.5, mass_kg 6.243e22, density_gcc 7.2.
- **tc5a "Shudder":** a_km 251350, e 0.20, argp_deg 30 (placeholder), radius_km 1083.5, mass_kg 1.491e22, density_gcc 2.8. `resonance {with: "tc5b", ratio: [2,1], conjunction_at: "pericenter"}`.

**Structures** (parent tc5; anchor lagrange, primary tc5, secondary tc5b):
- l4 "L4 Yard + Goliath Funnel", point L4, icon yard
- l5 "L5 Haven", point L5, icon haven
- l3 "L3 Watch Station", point L3, icon watch

**Belts** (parent null):
- b1 "The Sombrero", a_inner_au 1.1, a_outer_au 1.6
- b2 "Outer Wall", a_inner_au 10, a_outer_au 50

**Other fixture files:**
- `test/fixtures/v1-minimal.system.json`: a tiny version-1 file with 2 planets and 1 nested moon, written as the builder writes it (strings, `unit`, `distanceKm`).
- `test/fixtures/tauceti.view.json`, `orbit_match_view: 2`:
  - elevation 58, `log`, t 0, preset `system`.
  - Transfers: tc5→tc6 hohmann; tc5→tc6 thrust reactionless [1]; tc5→tc6 thrust fusion [0.01].
  - `closeup` block: preset focus:tc5; transfers low-orbit(7028 km)→l5 hohmann, and tc5→l3 thrust fusion [0.01].

## Directions (in this exact order)
1. **Preflight.** Open a visible pwsh window at the repo root. Create `out/` if needed. Run `node --version` and `git status --short`, and save both to `out/preflight.txt`. Stop if Node is older than 20.
2. **Read.** Read `README.md`, `BRIEF.md`, `TODO_PORTS.md`, `site/manual/orbit.js`, and `site/manual/manual.js` (`blankBody`, `blankMoon`, `systemRecord`, `loadSystem`, `saveLocal`). Then read spec v2 and look at the two concept PNGs. Edit none of them.
3. **Create `AGENTS.md`** at the repo root with:
   - a project summary in 3 lines;
   - the house rules: no build step, UMD and script tags, `node --test test/`, no git writes by agents;
   - the line "Data formats: see `docs/FORMATS.md`";
   - page map: `site/viewer/` is the System Viewer, `site/manual/` is Orbital Object Details, and a Lore Review page is planned;
   - a `## Todos` section copying `TODO_PORTS.md`'s todo list word for word. Leave that file in place.
4. **Create `docs/FORMATS.md`.** Document each format with its version key, a field table, and an example:
   - `orbit_match: 1` (exactly as `systemRecord()` writes it today);
   - `orbit_match: 2` (spec §5 in full, with the canon vocabulary and the migration rules);
   - `orbit_match_view: 2` and its hash form;
   - `handoff: 1` and `config: 1`.

   Also state the reader rules: reject unknown major versions, ignore unknown keys, and accept numeric strings.
5. **Create the fixtures.** Write the files listed under "Fixture values" and `site/viewer/sample-tauceti.js` (`window.OrbitViewerSample = {...}`).
6. **Write all 53 tests**, plus `test/util.mjs`. Run `node --test test/ *>&1 | Tee-Object out/test-log-before.txt`. Everything should fail except test 11. That is expected.
7. **Implement `formats.js`:** load, validate, migrate, `loadView`, `parseViewHash`, and derived period and density. Make group A pass.
8. **Implement `positions.js`:** Kepler, `pos`/`vel`/`rel`, the parent chain, Lagrange anchors, resonance phasing, hash phases, and trails. Make group B pass.
9. **Implement `transfer.js`:** Hohmann, `nextWindow`, synodic period, `hohmannArc`, `twoPhase`, `matched` (minimum time and throttle), and the flags. Make groups E and F pass.
10. **Implement `scale.js`:** ρ maps, fit, zoom-1 sizes, `Z1`, `Z2`, the blend weight w, `size(body, Z)`, child offsets, and level-of-detail opacity. Make group C pass.
11. **Implement `scene.js` and `render-svg.js`:**
    - `scene.js`: projection, draw order, the two presets, transfers mapped through scale and projection, labels with simple vertical de-overlap, and the legend.
    - `render-svg.js`: the look from the spec and the concepts. A dark gradient background with deterministic stars, a dim grid, a faint habitable-zone band, speckled belts, thin tinted orbits, the star's glow, spheres lit from the star, and rings. Pale porous Shudder and dark metallic Der. Structure icons, a teal dashed Hohmann arc, an amber reactionless path, a violet fusion path, flip ticks, ghost rings, trails, and one legend box.
    - Make groups D and G pass, except the CLI test.
12. **Implement `tools/render-system.mjs`.** Render:
    - `out/tauceti_system.svg` (preset system, with the three tc5→tc6 transfers);
    - `out/tauceti_kakakiko.svg` (focus:tc5, with the close-up transfers);
    - `out/tauceti_system_el45.svg` and `out/tauceti_system_el70.svg`.

    Test 53 should now pass.
13. **Build the System Viewer page.** Create `site/viewer/index.html` and `site/viewer/view.js`.
    - Header, footer, and theme match `site/manual/index.html`. The title is "System Viewer · Orbit Match".
    - Nav links: "Orbital Object Details" goes to `../manual/`. "Lore Review (planned)" is shown disabled.
    - It has one "Open a system" file input.
    - Where the system comes from, in order: the file input; the builder draft in localStorage `orbit-match-manual`, read-only and migrated from v1; then the embedded tau Ceti sample.
    - The hash picks the preset and transfers. It shows the SVG with no interaction.
    - Script order: `../manual/orbit.js`, `formats.js`, `positions.js`, `transfer.js`, `scale.js`, `scene.js`, `render-svg.js`, `view.js`.
14. **Doc touches.** In `README.md`, add a 3–4 line "System Viewer" section: the link, the hash parameters, and "formats in docs/FORMATS.md". In `.gitignore`, add `out/`. Change nothing else.
15. **Final run.**
    - Run `node --test test/ *>&1 | Tee-Object out/test-log-after.txt`. All 53 tests must pass.
    - Run `git status --short` and save the output to `out/git-status-after.txt`.
    - Confirm that the only modified existing files are README.md and .gitignore.
16. **Write `out/RUN_REPORT.md`:**
    - the files created and changed;
    - the test counts before and after;
    - the numbers produced (the three tc5→tc6 transfers, the close-up transfers, Z1 and Z2 for tc5);
    - every placeholder used;
    - anything skipped;
    - manual checks for Doug: double-click `site/viewer/index.html`; open `#preset=focus:tc5`; confirm the tilt, the scattered positions, Shudder's eccentric orbit, L3/L4/L5 on Der's orbit, and the arcs landing on the ghost rings.

    Then stop. Do not commit.

## Done means
- All 53 tests pass, and the before log shows they failed first.
- `out/tauceti_system.svg` and `out/tauceti_kakakiko.svg` read like the two concept PNGs. Exact styling may differ; the geometry must follow the spec.
- `AGENTS.md` and `docs/FORMATS.md` exist, with versioned formats (`orbit_match` 1/2, `orbit_match_view` 2).
- No git writes, no installs, and no existing page behavior changed.
