# Orbit Match: star-system display, design spec

Written 2026-09-29 (ET) for Doug. The repo was read on PC-NorCal, read-only (`C:\Users\DougJ\Documents\GitHub\orbit_match`, HEAD `1b4892c`). Nothing in the repo was changed.

**Scope change (2026-09-29, from Doug):** phase 1 is the **graphic only**, a static rendered picture. Click cards, zoom, animation, and edit links move to later phases. They are kept here so the design stays in one place.

Concept mockup: `concept_tau-ceti-tilted_20260929.png` (and `.svg`), in the same folder. It was drawn by a small Node script (`concept_generator_20260929.mjs`) using the math in this spec. The local image model could not help, because only text models are installed (see section 11).

---

## 1. What the repo is today

| Question | Finding |
| --- | --- |
| Stack | A static web page. HTML, CSS, and vanilla JavaScript under `site/`, deployed to GitHub Pages by `.github/workflows/pages.yml`. There is no build step, no `package.json`, and no server. BRIEF.md says to use ordinary script tags, make it open from disk, and keep the first picture as an **SVG** that stays readable with WebGL off, with 3D later. |
| AGENTS.md | **None.** `TODO_PORTS.md` says to fold its todos into AGENTS.md once that file exists. |
| Tests | **None.** `site/manual/orbit.js` is UMD, so it already exports to Node through `module.exports`. That means `node --test` works with no install. PC-NorCal has Node v24.20.0. |
| Data model | This is the system JSON saved by `site/manual/manual.js` (`systemRecord()`): `{ orbit_match: 1, kind: "system", star: {hostname, setting_name, spectype, mass_solar, lum_log, teff_k, radius_solar, x_ly,y_ly,z_ly}, known_planet_count, card: {...}, arrivals: [...], bodies: [...] }`. The file is `<host>.system.json`. |
| Body record | `{ id: "b" + 7 random chars, kind: planet/moon/asteroid/belt/jumpgate/station/staryard, name, period, unit: years/days, au, gravity, atmosphere, water, temperature, day, population, government, tech, concept, pressure, o2, co2, moons: [...], generated }`. All values are **strings** from form inputs. A moon has the same fields plus `distanceKm` and a period around its planet (in days by default). |
| Orbit data | Only the **semi-major axis (au) and period**, linked by Kepler's third law using the star's mass. There is **no eccentricity, no phase or longitude, no inclination, and no body radius**. Gravity and the other facts are free text. |
| Body editing page | **No page per body.** The builder `site/manual/` edits every body as a card on one page. Cards carry `data-body="<id>"`, but there is no URL anchor that focuses a single body. The draft autosaves to localStorage key `orbit-match-manual`. |
| Orbit math present | In `orbit.js`: `periodToAu` and `auToPeriodYears` (Kepler 3), `bodyAu`, `luminosity`, `goldilocks` (0.95 to 1.67 × √L AU), `starColor`, `airAdvice`, and zone warnings. **There is no transfer math yet.** The README promises ballpark, close, and accurate transfers, but BRIEF build steps 2 to 4 are still unbuilt. |
| Other versioned formats | `handoff: 1` (BRIEF.md), `config: 1` (`site/config.json`), `orbit_match: 1` (system file). None is documented in a formats doc yet. |
| tau Ceti data | The repo has no saved tau Ceti system file. The sibling `jumpgate_starroute/data/raw/PSCompPars_2026.09.25…csv` has tau Cet **g** (20.00 d, 0.133 AU, 1.18 R⊕), **h** (49.41 d, 0.243 AU, 1.19 R⊕), and **f** (636.13 d, 1.334 AU, 1.81 R⊕), with star mass 0.783 M☉ and type G8.5V. There are no Turquenish names for the planets yet. |

## 2. Goals

1. One picture of a whole star system, readable at a glance. It starts from the whole-system view (zoom comes in phase 2).
2. The camera is tilted **45 to 70 degrees above the system plane**. The default is 58°. It is never straight down.
3. The star is the largest single object. Sizes are **compressed** (√, capped), so small planets and moons stay visible.
4. Relative positions are roughly right. Planets sit at **positions along their orbits**, not in a row. Fast bodies show that they move (static motion trails in phase 1, animation in phase 2).
5. It is not cartoonish and not necessarily 100% accurate, but every planet is **distinguishable**.
6. Transfer overlays: a **Hohmann** transfer, and a **constant-thrust brachistochrone** for reactionless ships at **¼ to 5/4 g**.
7. Later: a usable interface for setting up transfers and watching the system move.

## 3. What to take from each reference image

### A. `star system display_tilted_but not right positions.jpg` (NASA-style tilted solar system)
**Keep**
- The tilted camera. Circular orbits read as ellipses, which gives the plane depth. This is the core look Doug wants.
- A faint grid on the orbital plane (rings and spokes) that sells the tilt. Keep it very dim.
- A dominant, glowing star, and planets drawn as small shaded spheres (lit side, dark limb).
- The belt drawn as scattered specks along a ring, and rings drawn on ringed bodies.

**Avoid**
- All planets in a neat row or line (the "not right positions" problem). Each body gets its own phase.
- A sun so big that it swallows the inner orbits. The star disc must end inside the first orbit ring.
- Bright, thick white orbit lines and a dense grid that compete with the bodies.
- Photographic textures as a requirement. Shaded gradients are enough for phase 1.

### B. `System display overhead prototype.jpg` (HUD "astrogation view")
**Keep**
- The transfer path as a **highlighted arc with a direction cue**, plus a ship or arrival marker. This is the key overlay idea.
- Labels with thin leader lines, and name plus one short data line per body.
- Moons shown as a small local orbit ring around their planet.
- Planets that each read differently (lava, temperate, ice).
- A compact legend or "transfer log" panel with days and Δv. Phase 1 has one small legend. Cards come in phase 2.

**Avoid**
- The straight-down camera.
- Many panels covering the map. At most one legend box in phase 1.
- Sci-fi chrome and made-up jargon. The labels should be plain.
- A "Hohmann" arc that is not tangent to either orbit. Ours is computed.
- Heavy glows on everything.

### C. `Solar_system_map_cartoonish.webp` (Outer Wilds planetary chart)
**Keep**
- Instant **distinguishability**: each body has its own color identity, and labels are clean.
- A thin **color tint on each orbit line** that matches its body, used lightly.
- Moons shown near their parent with a small ring.
- Plenty of empty space around each body.

**Avoid**
- Flat cartoon art, thick outlines, and stylized silhouettes.
- Bodies lined up in a row, sizes with no meaning, and a sun cut off at the edge of the frame.

## 4. Camera, projection, and layout rules

- **Plane coordinates.** The star is at the origin. A body at true distance `a` (AU) and angle `θ` has true position `(a cos θ, a sin θ)` in the plane.
- **Radial compression (display distance).** Only the radius changes. The angle is kept, so relative directions stay right.
  - Default mode `log`: `ρ(a) = R_in + K · ln(1 + a / a0)`, with `a0 = 0.1 AU` by default (or 0.5 × the innermost `a` if that is smaller).
  - Mode `sqrt`: `ρ = R_in + K · √a`. Mode `linear` is for checks only.
  - `ρ` must be strictly increasing in `a`, so orbit order is kept.
  - `R_in` > the star's disc radius plus a gap, so the star never covers the first orbit.
  - Radial-only compression keeps a transfer arc **tangent** to both orbit rings at the apsides, because dr/dθ = 0 there before and after mapping.
- **Fit.** `K` is chosen so the outermost ring (plus its label margin) fits the viewport on both axes: horizontal `ρmax ≤ W/2 − margin`, vertical `ρmax · sin(el) ≤ H/2 − margin`. If a legend box is shown, the system center shifts right to make room for it.
- **Tilt (projection).** Phase 1 uses an orthographic tilt: `sx = cx + X`, `sy = cy − Y · sin(el)`, where `(X, Y)` is the compressed plane position. The far side (+Y) is drawn above the star.
  - The elevation `el` is clamped to 45° to 70°, default 58°.
  - A circular orbit becomes an ellipse with `ry / rx = sin(el)`.
  - Body discs stay **circles**, because spheres do not squash.
  - Mild perspective is optional and comes later.
- **Depth order (painter's algorithm).** The draw order is:
  1. Background.
  2. Plane grid.
  3. Goldilocks band.
  4. The far halves of the orbits.
  5. The star and its glow.
  6. The near halves of the orbits.
  7. Transfer overlays.
  8. Bodies, sorted far to near.
  9. Labels.
  10. Legend.
- **Moons.** A moon uses a local compressed ring around its parent. The ring radius is between `r_parent + 4 px` and half the gap to the neighboring planet rings, and several moons are ordered by `distanceKm`. The moon ring gets the same tilt ratio.
- **Belts.** A belt is a band of about 300 deterministic specks between `ρ(a − w)` and `ρ(a + w)`, where w defaults to 10% of a.
- **Stations, jumpgates, and staryards.** These get a small geometric icon (a diamond, a ring, or a square), not a sphere. They are placed like planets, or on the parent's moon ring if they have a parent later.
- **Goldilocks band.** A faint translucent annulus from `OrbitManual.goldilocks()` with a small caps label.

## 5. Scale (sizes)

- True size basis, in order of preference:
  1. An optional `radius_earth` on the body (new, see question 1).
  2. A kind default: planet 1.0 R⊕, moon 0.3, asteroid 0.1, belt none, station/gate/yard icon 6 px.
- Display radius: `r_px = r_min + k · R⊕^0.5`, clamped to `[r_min, r_maxBody]`. Defaults: planets `r_min = 5`, moons 3, `k = 6`.
- Star: `r_star = clamp(1.6 × r_maxBody, 24 px, 0.7 × (R_in − gap))`. It is always the largest object and never overlaps the first ring.
- Collision rule: if two neighboring rings are closer than the sum of their bodies' radii plus 2 px, the body radii on that pair shrink (down to `r_min`). The layout is never moved to fix it.
- The legend states the compression ("distances log-compressed, sizes √-compressed"), so nobody reads the picture as true scale.

## 6. Positions and motion (static)

- **Phase.** `θ(t) = θ0 + 2π · t / P`, where t is days from the view's `epoch_days` (default 0).
  - `θ0` comes from an explicit `phase_deg` if the body has one (reserved field).
  - Otherwise `θ0` is a deterministic hash of the body `id` (or `name` when there is no id).
  - The same file always gives the same picture, and bodies do not line up.
- **Orbits are circular in phase 1**, because the data model has no eccentricity. The concept first used NASA eccentricities and the Hohmann arc missed the eccentric target. With circles, the arc lands exactly on the target. Eccentric orbits plus a Lambert solver come in phase 3 (close fidelity).
- **"Faster objects move a little" in a still picture.** Each body gets a fading **motion trail** behind it covering the arc swept in the last `trail_days` (default 5 d), capped at 40°. Inner planets and moons get visible trails. Outer planets get almost none. In phase 2 this becomes gentle animation.

## 7. Distinguishable, not cartoonish

- The palette is muted and realistic. There are no outlines. Each body is a radial gradient lit from the star's direction, with its bright side toward the star and a dark limb.
- Color comes from the facts when they parse:
  - Water ≥ 50% → ocean blues.
  - Temperature hot (> 400 K or text like "hot" or "lava") → ochre, rust, or ember.
  - Cold (< 200 K or "ice" or "frozen") → pale cyan or white.
  - Otherwise a hashed pick from a curated palette of about 10 hues.
  - Neighbors in orbit order must differ by a minimum color distance (RGB Euclidean ≥ 60). If they are too close, take the next palette entry.
- An optional `color` on the body overrides all of this (reserved).
- Orbit lines are thin (1.2 px, about 35% opacity) and lightly tinted with the body's color.
- Labels: the name, plus one dim data line (`a AU · P d · R R⊕`), on a thin leader line. Labels are nudged vertically so they don't overlap each other.

## 8. Transfer overlays and the math

All transfer math lives in a pure JS module that Node tests can run. Constants: `μ☉ = 1.32712440018e20 m³/s²`, `μ = μ☉ · M★`, `AU = 1.495978707e11 m`, `g0 = 9.80665 m/s²`, and 1 day = 86 400 s. Phase 1 handles planet-level transfers only. A moon or station uses its parent's orbit, and moon-to-moon trips are phase 3.

### 8.1 Hohmann (ballpark fidelity)
- Transfer semi-major axis `a_t = (r1 + r2)/2`. Time of flight `TOF = π √(a_t³ / μ)`.
- `Δv1 = √(μ/r1) · (√(2 r2/(r1+r2)) − 1)` and `Δv2 = √(μ/r2) · (1 − √(2 r1/(r1+r2)))`. Report absolute values. The arrival burn is the "match" that BRIEF.md asks for.
- **Window.** The target must lead the departure body by `φ = π − n2 · TOF`, where `n2 = 2π/P2`. The next window is the first t ≥ epoch where the phase difference equals φ (to within 0.1°). This can be found analytically from the relative mean motion, and the synodic period is `1/|1/P1 − 1/P2|`.
- **Drawing.**
  - Sample the half ellipse in true AU: `r(ν) = a_t(1−e_t²)/(1+e_t cos ν)`, with ν from 0 to π, starting at the departure angle at the window time.
  - Map every point through the compression and projection.
  - Style: a teal dashed line, 2.2 px, with small chevrons for direction.
  - Dashed "ghost" rings mark the departure position (window time) and the arrival position (window + TOF).
  - Label: `g → f · 130 d · Δv 25.2 + 13.1 km/s · window +18 d`.
  - The live bodies stay at the view epoch. The ghosts show where they will be.
- Reference checks:
  - Earth→Mars (1 → 1.524 AU, 1 M☉): TOF 258.9 d, Δv 2.946 + 2.650 km/s.
  - tau Ceti g→f (0.783 M☉): TOF 129.65 d, Δv 25.19 + 13.10 km/s.

### 8.2 Constant thrust, reactionless (¼ to 5/4 g)
- Brachistochrone, rest to rest: accelerate for half the distance, flip, and decelerate. For distance d and acceleration a: `T = 2√(d/a)`, and the peak speed is `a·T/2`.
- **Moving target.** Iterate `T_{k+1} = 2√(|r_target(t0+T_k) − r_dep(t0)| / a)` until |ΔT| < 1 s (usually 3 to 5 iterations, 20 at most). The path is a straight line in true space from the departure point to the target's position at arrival.
- **Why a straight line is fine.** Star gravity is tiny next to the thrust (at 1 AU the Sun gives about 0.0006 g). The orbital velocity mismatch of a few tens of km/s is small against peak speeds of hundreds to thousands of km/s.
  - The tool **flags** a transfer where local star gravity is more than 1% of the thrust.
  - It also flags a transfer whose line passes closer than `max(3 × star radius, 0.02 AU)` to the star.
  - Velocity matching is in open question 3.
- **Drawing.**
  - A solid amber line, whose width and brightness scale with the acceleration, and a short perpendicular **flip tick** at the midpoint.
  - A ghost ring at the target's arrival position.
  - A family of accelerations (default ¼ g and 1 g) uses graded shades. The legend lists each one with days and peak speed.
  - After compression the straight line bends slightly. The legend says the view is compressed.
- Reference checks:
  - 1 AU fixed at 1 g: 2.859 d, peak 1 211 km/s. At ¼ g: 5.718 d. At 5/4 g: 2.557 d. T(¼ g) / T(1 g) = 2 exactly.
  - tau Ceti h→f at the concept epoch: 1 g about 3.0 d (peak about 1 274 km/s), ¼ g about 6.0 d (peak about 638 km/s).
  - Compare the Hohmann g→f: 130 d.

## 9. Click card (phase 2, recorded now)
- Name, kind, and the parent (for a moon).
- a (AU), period, and the goldilocks zone status (`OrbitManual.physicalZone`).
- Gravity, atmosphere with the air advice line (`airAdvice`), water, temperature, day, population, government, tech, and the high concept.
- Its moons as a list, and a thumbnail of its color.
- **"Edit this body"** opens `site/manual/#body=<id>`. The builder needs a small addition that scrolls to that card, opens it, and highlights it. Ids are stable once a system is saved.
- "Plan a transfer from here / to here" (phase 3).

## 10. Data needed from the existing model

| Needed | Source today | Gap and plan |
| --- | --- | --- |
| Star mass, luminosity, spectral type, temperature | `star.mass_solar`, `lum_log`, `spectype`, `teff_k` | None. Fall back to mass 1 and `luminosity()` as `orbit.js` does. |
| Body distance and period | `au` / `period` + `unit`, through `bodyAu()` | None. Bodies with neither are skipped and listed in the legend footnote. |
| Body id and name | `id`, `name` | None. Unnamed bodies get the label "Body 3". |
| Moons | `moons[]` with `period` (days) and `distanceKm` | None for layout. Order by distanceKm, falling back to period. |
| Size | none | Kind defaults, plus optional `radius_earth` (question 1). |
| Phase / eccentricity / color | none | A hash phase and circular orbits. `phase_deg`, `ecc`, and `color` are **reserved** for system format v2. Phase 1 may read them if present, but never writes them. |
| View settings | none | New versioned file `orbit_match_view: 1`: `{elevation_deg, scale: "log"/"sqrt", epoch_days, trail_days, show: {grid, hz, labels, legend}, transfers: [{from, to, mode: "hohmann"/"thrust", accel_g: [0.25, 1]}]}`. It can also be given as URL hash parameters. It is documented in `docs/FORMATS.md`, which AGENTS.md points to. |

## 11. Local image model check (PC-NorCal)
- Ollama 0.34.4 is installed. Its models are `qwen2.5-coder:1.5b`, `qwen3.8:27b`, and `qwen3.5:9b`, all text or code models. **None generates images.**
- ComfyUI is not running (port 8188 refused), and no ComfyUI, z_image_turbo, Stable Diffusion, or Forge install was found in the usual folders.
- Nothing was installed. The concept image was instead drawn from the spec math (Node on the agent box, rasterized with librsvg).
- If Doug later adds an image model (for example a z-image-turbo build for Ollama or ComfyUI), it fits phase 4, making subtle planet textures.

## 12. Library choice
**Plain SVG with our own projection, no three.js.**
- BRIEF.md already requires no build step, script tags, opening from disk, and an SVG picture that works with WebGL off.
- A static tilted view is a simple 2D projection. SVG gives crisp dashed arcs, text labels, and gradients.
- The same pure JS can emit an SVG string in Node, so tests and the CLI run with no browser and no install.
- three.js is worth reconsidering only for phase 4 (a free-orbit 3D camera or real textures). Even then, it should load as a script or ES module with an SVG fallback.

## 13. Open questions for Doug (5)
1. **Size data:** may system format v2 add optional `radius_earth` per body? Later also `ecc`, `phase_deg`, and `color`. Or should phase 1 get by with kind defaults only?
2. **Defaults:** is a 58° camera and `log` distance compression right, or should the default be `sqrt`, which spreads the outer system more and crowds the inner?
3. **Constant-thrust arrival:** is rest-to-rest (ignoring a few tens of km/s of orbital velocity) fine for ballpark, or must the ship arrive matched to the target's orbital velocity? And which accelerations should show by default: ¼ and 1 g, or ¼, ½, 1, and 5/4?
4. **tau Ceti names:** the NASA pull has only g, h, and f (no e). Use NASA letters until the Turquenish names exist, or do you have names or extra fictional bodies (moons, stations, a belt) to put in the fixture?
5. **Where it lives:** a new page `site/view/` linked from the builder, or a panel inside `site/manual/`? Phase 1 assumes a new page.

## 14. Phased plan
- **Phase 1, MVP (graphic only; the brief for this phase is in the same folder).**
  - Versioned formats doc and AGENTS.md.
  - A tau Ceti fixture.
  - A test-first pure JS library: scale, layout, projection, Hohmann, window, and brachistochrone.
  - An SVG renderer and a Node CLI that writes `out/tau-ceti_system-view.svg` with one Hohmann and a ¼ g / 1 g thrust family.
  - A static `site/view/` page that shows a system file, or the builder's draft, with transfers from URL hash parameters.
  - No click, zoom, or animation.
- **Phase 2, interactive viewing.**
  - Zoom and pan (SVG viewBox), starting from the whole-system view.
  - Click → card → "Edit this body" (`manual/#body=<id>` support in the builder).
  - Gentle animation of fast bodies, and a time slider.
- **Phase 3, transfer setup.**
  - Pick from, to, mode, and acceleration. Search for windows, and list the options.
  - Save transfers in the system file (v2).
  - Eccentric orbits, and a Lambert solver for close fidelity.
  - Moon and station legs.
- **Phase 4, polish.**
  - Optional WebGL/three.js 3D with an SVG fallback.
  - Subtle textures (possibly from a local image model).
  - Belts as particles, rings, and a comet.
