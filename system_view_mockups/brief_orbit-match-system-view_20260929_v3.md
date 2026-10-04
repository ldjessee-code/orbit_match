# Grok Build brief v3: Orbit Match System Viewer, phase 1 (static holo graphic)

Date: 2026-09-29. Repo: `C:\Users\DougJ\Documents\GitHub\orbit_match`.

- **Design:** `spec_orbit-match-system-view_20260929_v3.md`, which builds on spec v2 §4–§6. Read both.
- **Concept targets:** `concept_tauceti-turquenish-system_20260929_v3.png` and `concept_kakakiko-closeup_20260929_v3.png`.
- **Math reference:** `concept_generator_v3_20260929.mjs`, a throwaway script. Its math may guide you. Do not copy its structure; the product follows the modules and tests below.
- **Location:** all of these are in `F:\Dropbox\TheCourt\research-grok\orbit-match-system-view\`.

This brief replaces v1 and v2, which are kept for history.

## Run rules
- **Where it runs.** Unattended, in a **visible pwsh (PowerShell 7) window** at the repo root. Use pwsh syntax.
- **No git writes.** Do not run `add`, `commit`, `stash`, `checkout`, `reset`, `branch`, `push`, or `tag`. Read-only `git status` and `git diff` are fine.
- **No installs.** No npm, pip, or package.json. Use Node ≥ 20 built-ins only.
- **Tests first.** Write all the tests below, run them, confirm they fail, and save the log. Only then implement.
- **Graphic only.** No click, zoom UI, hover, toggle UI, legend-corner UI, or animation. The functions behind those features are built and tested now.
- **Hands off existing files.**
  - Do not edit `site/manual/*`, `site/index.html`, `site/js/*`, `site/css/*`, `BRIEF.md`, `INTERCONNECT.md`, or `TODO_PORTS.md`.
  - You may edit only `README.md` (a short section) and `.gitignore` (add `out/`).
- **Constraints.** UMD modules, plain script tags, works from `file://`. No network calls and no external URLs in the output.
- **No invented lore.** Use only the fixture values. Anything you choose is tagged `"placeholder"`.
- **Drive rule.** The Turquenish Empire (the faction) has no reactionless drive. Its default is fusion at 0.01 g, while reaction mass lasts. Reactionless is an other-power profile only.
- **When stuck.** Write the problem in the run report and continue.

## Approach
Plain SVG with a hand-written orthographic tilt; no three.js. Reason: no build step, works without WebGL, and the same code renders in Node for the tests.

**Modules** (all UMD, under `site/viewer/`):

| File | Global | Contents |
| --- | --- | --- |
| `formats.js` | `OrbitFormats` | load, validate, migrate, view, hash |
| `positions.js` | `OrbitPositions` | Kepler, pos/vel/rel, anchors, resonance, streams |
| `transfer.js` | `OrbitTransfer` | Hohmann, window, twoPhase, burn–coast–burn, spiral, flags |
| `scale.js` | `OrbitScale` | distance modes, sizes, slider, framing, regime |
| `color.js` | `OrbitColor` | star colour table, body colours |
| `scene.js` | `OrbitScene` | projection, draw order, callout placement, legend |
| `render-svg.js` | `OrbitSvg` | holo renderer |

Reuse `site/manual/orbit.js` for `bodyAu`, `luminosity`, and `goldilocks`.

## Test list (write first)
**Setup.**
- Run with `node --test test/`.
- Helpers go in `test/util.mjs`: `approx`, an XML tag-stack checker, `integrate` (Euler, dt ≤ T/20000, for thrust profiles), and a seeded random generator.
- Constants: μ☉ = 1.32712440018e20, GM⊕ = 3.986004418e14, AU = 1.495978707e11, g0 = 9.80665, day = 86400.
- `F` = `test/fixtures/tauceti-turquenish.system.json`. `V` = `test/fixtures/tauceti.view.json`.

**A. Formats** (`formats.test.mjs`)
1. `loadSystem(F)` (version 2) gives the star, 8 planets, 2 moons, 3 structures, 2 belts, 1 stream, and 1 ship. `epoch.label` is "T+0 (circa 1600 yrs hence)", tagged placeholder.
2. Version 1 loads (`v1-minimal.system.json`). A missing version, or version ≥ 3, fails with a clear message.
3. `migrateV1toV2`:
   - nested moons get `parent`;
   - `au` becomes `a_au`, and `distanceKm` becomes `a_km`;
   - `period`+`unit` becomes `period_days`;
   - facts go under `facts`;
   - ids are kept, and the result validates.
4. `validateSystem` errors when:
   - a body has both `a_au` and `a_km`, or two mass fields;
   - a `parent` is missing, or parents form a cycle;
   - e is outside [0, 1), or an anchor point is bad;
   - a stream's `from` or `to` is missing;
   - a ship with `faction: "turquenish-empire"` has profile `reactionless`.

   It warns when radius, mass, and density disagree by more than 5%.
5. Numeric strings parse, empty strings count as missing, and unknown keys are ignored.
6. Derived periods: Kakakiko 247.4 ± 0.3 d. Der 28.36 ± 0.1 d with μ = GM⊕ × (1.045 + 0.01045). Derived densities: Shudder 2.8 ± 0.05 and Der 7.2 ± 0.1 g/cm³.
7. `loadView`:
   - Requires `orbit_match_view: 3`.
   - Defaults: `tilt_deg` 58, `distance_mode` "schematic", `style` "holo", `legend_corner` "bl", no callouts, frame = whole system.
   - Tilt is clamped to 45–70 with a warning.
   - More than 3 callouts is an error.
   - `legend_corner` must be one of tl, tr, bl, br.
   - `accel_g` must be in its profile's range: fusion 0.005–0.01, reactionless 0.25–1.25.
8. `parseViewHash("#frame=tc5b,l4&tilt=60&dist=true&legend=tr&call=shuttle1&call=md1")` equals the matching view JSON. `dist=true` maps to `distance_mode: "log"`.
9. `site/viewer/sample-tauceti.js` equals F exactly.
10. Every current `OrbitManual` export still exists.

**B. Positions and time** (`positions.test.mjs`)

11. Kepler solver: |E − e sin E − M| < 1e−12 for e ∈ {0, 0.2, 0.6, 0.9}.
12. `pos(id, t + P) = pos(id, t)` within 1e−9 relative, for every orbiting body.
13. Moon distances over one period: Der within [388,000, 412,000] km, and Shudder between 201,080 ± 100 and 301,620 ± 100 km.
14. L3/L4/L5 are at Der's radius (within 1e−9), at +60°, −60°, and 180° from Der, at 20 sample times. So they co-orbit.
15. The 2:1 resonance: at every conjunction of equal mean longitudes over 10 Der periods, Shudder's mean anomaly is within 1° of 0.
16. `vel` matches a finite difference within 1e−6, for a planet, a moon, and L4.
17. `rel(tc5, tc5, t)` is (0, 0). Frames compose along the parent chain.
18. Hash phases for bodies with no `mean_anomaly_deg` are stable and tagged placeholder. Eight synthetic ids are not all within 90°.
19. Mass-driver stream `md1`:
    - The slug launch velocity is Der's velocity minus 68.6 m/s along Der's velocity direction.
    - The phasing period is P_s = 23.55 ± 0.1 d, which is (5/6)·P_Der within 0.5%.
    - A slug launched at t_L is within 2,000 km of L4's position at t_L + P_s.
20. `streamSnapshot(md1, t)` returns ceil(P_s/interval) ± 1 slugs, each launched within the last P_s days.
21. Trails: the angle is 360° × trail_days / P, capped at 40°, ordered Gane > Hornstooth > Husk > Sable > Kakakiko.

**C. Scale, framing, slider** (`scale.test.mjs`)

22. Schematic distances: the ring radii are strictly increasing through every orbit and belt-edge knot. Interpolation between knots is monotone. The habitable-zone edges fall between the knots around them.
23. Schematic fit: at Z = 1 every ring fits 1600×1000 and 1000×1000 minus the margins, for tilt 45, 58, and 70. The star radius is 6.4% of min(W, H) within 0.5 px, and the first ring is at least 34 px beyond the star's edge.
24. Holo sizes: `r = 8 + 5(R/R⊕)^0.4`. The star is the largest object. Overlapping neighbours shrink, never below 6 px, and the rings do not move.
25. The `log` and `linear` modes are monotone. `linear` at Z = 1 puts Gane inside the star disc, and the loader emits a warning to that effect. This proves the schematic default is needed.
26. Slider: `zoomFromSlider(0) = 1` and `zoomFromSlider(1) = Z_max`, and the mapping is log-linear. Z_max makes Shudder's pericentre ellipse fill 85% ± 1% of the viewport half-height.
27. Framing:
    - `frame(["tc5b", "l4"])` picks frame tc5.
    - `frame(["tc5", "tc6"])` picks the star.
    - The framed box plus an 8% margin fits the viewport and fills it on at least one axis within 1%.
28. Framing a transfer includes the whole path and both ghost positions.
29. Regime:
    - Sizes are constant for Z ≤ Z_s and continuous at Z_s.
    - The blend weight w goes from 0 to 1, monotonically.
    - At w = 1, the ratio of Shudder's screen apocentre to pericentre is 1.5 ± 0.01.
30. Level of detail: structure opacity is 0 when the framed extent is larger than 20 × the child-orbit scale, and 1 when it is 5 × or less. It is monotone in between.

**D. Colour and projection** (`color.test.mjs`, `projection.test.mjs`)

31. `starDisplayColor`:
    - "G8.5V" gives `#ffd98f` within ΔRGB 6.
    - "G2V" gives about `#fff0c0`.
    - "M4V" is redder than "K0V", which is redder than "G0V" (a higher R/B ratio each time).
    - T_eff alone (5320) gives the same result as "G8.5V" within ΔRGB 10.
    - Class III is brighter than class V.
32. Neighbouring planets differ by RGB distance ≥ 60. The body colour survives the holo rendering: the gradient's middle stop equals the body colour.
33. Tilt: a projected circle has ry/rx = cos(tilt) within 1e−9, giving 0.53 at 58°. The far side projects above the centre. Discs keep a single `r`. The depth cue scales sizes within ±8%.
34. Draw order: background, grid, habitable zone, belts, far halves of orbits, star, near halves of orbits, transfers and streams, bodies, labels, callout lines, cards, legend, scan-lines, frame.

**E. Transfers** (`hohmann.test.mjs`, `thrust.test.mjs`, `spiral.test.mjs`)

35. Earth → Mars Hohmann: 258.9 ± 0.5 d, Δv 2.946 and 2.650 ± 0.01 km/s. Kakakiko → Gas Giant: 480.8 ± 0.5 d, Δv 8.21 and 5.72 ± 0.03 km/s.
36. Kakakiko low orbit (7,028 km) → 400,000 km: 5.17 ± 0.02 d, Δv 3.09 and 0.83 ± 0.02 km/s. The Earth/Mars synodic period is 779.9 ± 1.5 d.
37. The mapped Hohmann arc starts and ends within 0.5 px of its ghost positions, in schematic mode as well. The arc is tangent to both rings at the apsides: the angle at each end is within 1°.
38. `twoPhase` and burn–coast–burn reach r_T and v_T when integrated (tolerances 1e−6·|Δr| + 1 m and 1e−6·|Δv| + 1e−3 m/s), for 10 seeded cases each. `bcb` with t_b = T/2 equals `twoPhase` exactly.
39. Burn–coast–burn rest to rest: d = 1 AU, a = 0.01 g, budget 100 km/s gives T = 2t_b + (d − a·t_b²)/(a·t_b), with t_b = budget/(2a), within 1 s. The Δv used is ≤ the budget + 1e−6.
40. The minimum-time search: `fusionMatched` finds T to 1 s. At T − 60 s the requirement fails, either by acceleration or by budget.
41. Insufficient reaction mass: a target that is too far for the budget within 10 years reports `{ error: "insufficient reaction mass" }`.
42. The fixture transfer, Turquenish Empire fusion 0.01 g Kakakiko → Gas Giant with budget 150 km/s, gives a T in the range 60–110 d at the fixture phases. The Δv used is ≤ 150 km/s. `gravityNotNegligible` is **true**, because star gravity at 0.71 AU is 0.00094 g, about 9% of a_max. The legend must say "ballpark".
43. Spiral (tc5, 7,028 km → apoapsis 400,000 km, 0.01 g, RK4):
    - The specific energy increases monotonically during the burn.
    - The burn ends when the osculating apoapsis reaches ≥ 400,000 km, within 0.5%.
    - The coast ends at apoapsis, where radial velocity changes from + to −.
    - The burn Δv is between 4.5 and 6.8 km/s, and ≤ the Edelbaum value of 6.71 km/s.
    - Total time is between 5 and 9 days.
    - Halving the step changes the arrival radius by less than 0.1%.
44. Spiral phasing: after rotating the path, the arrival point is within 1,000 km of L5's position at arrival.
45. Profiles: a `reactionless` ship with `faction: "turquenish-empire"` is rejected. An other-power ship at 1 g, rest to rest over 1 AU, takes 2.859 ± 0.005 d. Fusion outside 0.005–0.01 g is rejected.
46. Flags: `nearParent` is set for a path within 0.02 AU of the star.

**F. Cards and legend** (`cards.test.mjs`)

47. At most 3 cards are rendered. Cards go only in corners other than `legend_corner`. Each takes the free corner nearest its target.
48. Callout line: a single dogleg path from the card edge nearest the target to the target, ending in an open ring. Stroke opacity is between 0.35 and 0.5. It does not intersect the legend rectangle (segment and rectangle test).
49. The ship card shows the profile "Turquenish Empire fusion 0.01 g", its phase (burning, coasting, or planned) consistent with t, from → to, elapsed and ETA in hours, Δv used / budget, and "(placeholder)" for any placeholder value.
50. The legend contains the line key for every drawn layer, the text "SCHEMATIC", the epoch label, and "not to scale". It contains no "reactionless" line unless an other-power transfer is drawn.
51. Changing `legend_corner` to each of the 4 values moves the legend, and the cards re-place without overlapping it.

**G. Render and CLI** (`render.test.mjs`)

52. Both preset SVGs are well-formed, with `xmlns` and a `viewBox`, and no script, http, or external href.
53. The system render contains:
    - a star circle whose fill gradient includes the G8.5V colour;
    - 8 planet spheres, each with a `data-body-id` and a cyan rim;
    - Ice Giant 1's ring;
    - 2 belts and the habitable-zone band;
    - `xfer-hohmann` (dashed) and `xfer-fusion` (burn segments thick, coast dotted);
    - 3 cards and a legend at `bl`;
    - one hover-example tag reading "0.71 AU".
54. The close-up render contains:
    - Kakakiko, Shudder, and Der spheres;
    - Shudder's non-circular orbit with perigee and apogee marks;
    - L3, L4, and L5 icons with `data-anchor`;
    - `stream` slugs (at least 20 rectangles);
    - a ship glyph with `data-ship`;
    - `xfer-spiral` with the flown part solid and the remaining part dashed, and a ghost at the L5 arrival;
    - 3 cards, one of them the ship card in a corner;
    - the legend.
55. Rendering the same inputs twice gives byte-identical SVG.
56. CLI: `node tools/render-system.mjs <system> --view <view> [--frame ids] [--zoom Z] [--t DAYS] [--tilt N] [--legend tl|tr|bl|br] --out <file>` exits 0 on the fixtures, and non-zero with a clear message on bad input.

## Fixture values
The system fixture F is **v2 §4 and brief v2's table exactly**, with these changes:

**Epoch:** `{ "t0_days": 0, "label": "T+0 (circa 1600 yrs hence)" }`, tagged placeholder.

**Placeholder mean anomalies (deg):** Gane 40, Hornstooth 150, Husk 260, Sable 330, Kakakiko 95, Gas Giant 55, Ice Giant 1 230, Ice Giant 2 120, Der 180. Shudder's phase comes from the resonance (argp 30°, a placeholder).

**Star:** spectype `"G8.5V"` (the display colour test uses it; LadyT's doc says G8V), teff_k 5320.

**Stream:** `md1` (§8 of spec v3): from tc5b to l4, shot dv 68.6 m/s retrograde, interval_days 0.6 (placeholder).

**Ship:** `shuttle1` (§10 of spec v3):
- name "(placeholder)", faction turquenish-empire;
- fusion 0.01 g, budget 9.0 km/s (placeholder);
- a spiral leg from a 7,028 km orbit to l5, `depart_days` = −(0.72 × spiral duration) relative to the close-up time. Compute it once and store it rounded to 0.01 d.

**Also** keep `v1-minimal.system.json` from brief v2.

The view fixture V is `orbit_match_view: 3`, with two named presets:
- **`system`:**
  - tilt 58, schematic, t 0, legend bl;
  - transfers: tc5→tc6 hohmann, and tc5→tc6 fusion 0.01 g with budget 150;
  - callouts: tc5, the transfer, the star.
- **`closeup`:**
  - frame [tc5b, l4, l5, l3] with whole orbits, t 6.0, legend bl;
  - ship shuttle1 and stream md1;
  - callouts: shuttle1 (corner tl), md1, l3.

## Directions (in this exact order)
1. **Preflight.** Open a visible pwsh window at the repo root. Create `out/`. Save `node --version` and `git status --short` to `out/preflight.txt`. Stop if Node is older than 20.
2. **Read.** Read `README.md`, `BRIEF.md`, `TODO_PORTS.md`, `site/manual/orbit.js`, and `site/manual/manual.js` (`blankBody`, `blankMoon`, `systemRecord`, `loadSystem`, `saveLocal`). Then read spec v3 and spec v2 §4–§6, and look at both v3 concept PNGs. Edit none of them.
3. **Create `AGENTS.md`** with:
   - a summary in 3 lines;
   - the house rules: no build step, UMD and script tags, `node --test test/`, no git writes by agents;
   - "Data formats: `docs/FORMATS.md`";
   - page map: System Viewer is `site/viewer/`, Orbital Object Details is `site/manual/`, and Lore Review is planned;
   - the drive rule: Turquenish Empire = fusion; reactionless = other powers only;
   - a `## Todos` section copying `TODO_PORTS.md`'s todos word for word. Leave that file in place.
4. **Create `docs/FORMATS.md`.** Document, with version keys, field tables, and examples:
   - `orbit_match: 1` (as `systemRecord()` writes it today);
   - `orbit_match: 2` (spec v2 §5, plus ships, streams, and `epoch.label` from spec v3);
   - `orbit_match_view: 3` and its hash form;
   - `handoff: 1` and `config: 1`;
   - the reader rules;
   - the canon tag vocabulary.
5. **Fixtures.** Write F, V, `v1-minimal`, and `site/viewer/sample-tauceti.js`.
6. **Write all 56 tests** and `test/util.mjs`. Run `node --test test/ *>&1 | Tee-Object out/test-log-before.txt`. Everything should fail except test 10.
7. **Implement `formats.js`.** Make group A pass.
8. **Implement `positions.js`**, including streams. Make group B pass.
9. **Implement `transfer.js`:** Hohmann, window, twoPhase, burn–coast–burn with `fusionMatched`, the spiral (RK4) with phasing, profiles, and flags. Make group E pass.
10. **Implement `color.js` and `scale.js`.** Make groups C and D pass, except test 34.
11. **Implement `scene.js` and `render-svg.js`** in the holo style (spec v3 §3 and §7):
    - the dark navy vignette, scan-lines, frame, and corner brackets;
    - the polar grid, and glow-plus-line orbits;
    - holo spheres in the body colours with a cyan rim;
    - a star glow and corona in the spectral colour;
    - the mint dashed Hohmann arc, violet fusion burns (thick) and coasts (dotted), and a dashed planned spiral;
    - the slug stream, and structure icons;
    - at most 3 translucent cards with ~42%-opacity dogleg callout lines, and the legend in the configured corner.

    Make tests 34 and 47–55 pass.
12. **Implement `tools/render-system.mjs`.** Render `out/tauceti_system.svg` and `out/tauceti_kakakiko.svg` from V's presets, plus `out/tauceti_system_legend-tr.svg` and `out/tauceti_system_tilt45.svg`. Test 56 should pass.
13. **Build the System Viewer page:** `site/viewer/index.html` and `view.js`.
    - Title "System Viewer · Orbit Match".
    - Nav: "Orbital Object Details" goes to `../manual/`, and "Lore Review (planned)" is disabled.
    - One "Open a system" file input.
    - Source order: the file input, then the read-only builder draft (`orbit-match-manual`, migrated), then the embedded sample.
    - The hash selects the preset, frame, tilt, legend corner, and callouts.
    - A static SVG only.
14. **Doc touches.** `README.md` gets a 3–4 line "System Viewer" section. `.gitignore` gets `out/`. Nothing else.
15. **Final run.**
    - Run `node --test test/ *>&1 | Tee-Object out/test-log-after.txt`. All 56 tests pass.
    - Save `git status --short` to `out/git-status-after.txt`.
    - Only README.md and .gitignore may be modified among the existing files.
16. **Write `out/RUN_REPORT.md`:**
    - the files created and changed;
    - the test counts before and after;
    - the computed numbers: Hohmann, fusion T, burns, and Δv; spiral burn and arrival; slug period and count; Z_max;
    - every placeholder;
    - anything skipped;
    - manual checks for Doug: double-click `site/viewer/index.html`; confirm the tilt looks tilted (ratio 0.53); check the large bodies, the three translucent callouts, the legend corner, the slugs flowing Der → L4, and the ship card.

    Stop. Do not commit.

## Done means
- All 56 tests pass, and there is a before log showing they failed first.
- The two SVGs read like the v3 concept PNGs.
- AGENTS.md and FORMATS.md exist, with versioned formats (`orbit_match` 1/2, `orbit_match_view` 3).
- There were no git writes and no installs, and existing pages are unchanged.
