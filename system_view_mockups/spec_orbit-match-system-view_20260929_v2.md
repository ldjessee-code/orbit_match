# Orbit Match: System Viewer, design spec v2

Written 2026-09-29 (ET) for Doug. v2 replaces v1 (`spec_orbit-match-system-view_20260929.md`, kept unchanged in the same folder). The repo was read-only (`C:\Users\DougJ\Documents\GitHub\orbit_match`, HEAD `1b4892c`); nothing in it was changed.

Concept images (drawn from this spec's math by `concept_generator_v2_20260929.mjs`, not by an image model):
- `concept_tauceti-turquenish-system_20260929.png`: the whole Turquenish tau Ceti system at zoom 1.
- `concept_kakakiko-closeup_20260929.png`: Kakakiko at zoom stage 2, with both moons and L3/L4/L5.

## 0. What changed from v1 (Doug's answers, 2026-09-29)

1. **Schema extension.** `orbit_match: 2` adds optional orbit and physical fields per body: distance from the star, or from the parent for moons; size, mass, density, eccentricity, and more. It also adds parent links, anchored structures (Lagrange points), belts, and canon tags. It is documented in `docs/FORMATS.md` (section 5). orbit_match owns this JSON; the lore doc stays lore.
2. **Two-stage zoom.** Stage 1 spreads distances while sizes stay fixed. Past a threshold, stage 2 scales bodies too and focuses on one subsystem (section 8).
3. **Matched-velocity constant thrust.** Transfers now arrive matched to the target's velocity, for reactionless (not inertialess) ships. Rest-to-rest is a special case (section 11).
4. **Turquenish tau Ceti.** Bodies, orbits, moons, and the L3/L4/L5 structures come from LadyT's setting doc. Missing values are labelled placeholders (section 4).
5. **Name and siblings.** The page is the **System Viewer**. Its siblings are **Orbital Object Details**, which is the existing builder in `site/manual/`, and possibly a **Lore Review** page. The first job of the visual is to inspire Doug and make him think through the interface.
6. **Time-parametric from the start.** Every position is a function of time t. The L3/L4/L5 structures co-orbit with Der. A **time multiplier** (watching orbits and ships advance) is in phase 2 (section 6, section 15).

Phase 1 is still **a static SVG graphic only, written tests first**.

## 1. Repo facts (unchanged from v1, short)

- **Stack.** A static site: HTML, CSS, and vanilla JS under `site/`, published to GitHub Pages. No build step, no `package.json`, no server, no tests, and no AGENTS.md. `site/manual/orbit.js` is UMD, so `node --test` can load it directly. PC-NorCal has Node v24.
- **System file today.** `orbit_match: 1`, written by `manual.js`'s `systemRecord()`. Bodies hold string fields: `id`, `kind`, `name`, `period` + `unit`, `au`, free-text facts, and nested `moons[]` (each moon has `distanceKm`).
  - There is no eccentricity, phase, size, or mass.
- **Body editing.** The builder is one page of body cards (`data-body=<id>`). There is no per-body URL yet.
- **Math in the repo.** Kepler's third law (`periodToAu`, `auToPeriodYears`, `bodyAu`), `luminosity`, `goldilocks`, `starColor`, and `airAdvice`. There is **no transfer math** yet.

## 2. Goals

1. The **System Viewer** shows the whole system first, and the user can zoom into any subsystem. Zoom is phase 2; phase 1 renders fixed zoom presets.
2. The camera is tilted 45–70° above the system plane (default 58°), never straight down.
3. The star is the largest object at zoom 1. Sizes are compressed so small worlds and moons stay visible.
4. Bodies sit at time-correct positions along their orbits, not in a row. Motion shows as trails in the static picture and as animation later.
5. The look is not cartoonish, and every body is distinguishable.
6. The overlays show Hohmann transfers and constant-thrust transfers with matched arrival, for reactionless ships (¼ to 5/4 g) and for Turquenish fusion drives (0.005–0.01 g).
7. The picture inspires, and it forces the interface questions: what a click shows, what a zoom level hides, and how a transfer is set up.

## 3. Reference images

The v1 notes still apply. In short:
- **Tilted NASA-style image.** Keep: the tilt, the faint plane grid, a glowing star, shaded spheres, and belts drawn as specks. Avoid: a neat row of planets, and a sun that swallows the inner orbits.
- **HUD overhead image.** Keep: the transfer arc with markers, labels with leader lines, moon rings, and one small legend. Avoid: the straight-down view, panel clutter, and a fake Hohmann arc.
- **Outer Wilds chart.** Keep: instant distinguishability and tinted orbit lines. Avoid: flat cartoon art, outlines, and the row layout.

## 4. Turquenish tau Ceti: sources and body data

### Sources used (read-only)

| Source | Used for |
| --- | --- |
| `F:\Dropbox\Projects\Turquenish\systems\tauCet\Tau_Cet_system_v2.md` (Draft v2.25, 2026-09-28) | **Primary.** §4 star; §5 system table; §6.1–6.8 bodies; §6.5 Kakakiko, Shudder, Der Eindringling, and the L3/L4/L5 stations; §7 belts; §7a physical values; §8 transit times; §2 drive canon. |
| `F:\Dropbox\Projects\Turquenish\SOURCE_OF_TRUTH.md` and `F:\Dropbox\Projects\_platform\TURQUENISH_SOURCE.md` | Confirmed that `/Projects/Turquenish/` is the writable setting source of truth. The listed owner is "notDoug (Personal)", which I took to be LadyT. |
| Not used as data | `Tau_Cet_system.md` and `Tau_Cet_system_ORIGINAL_20260928.md` (the superseded original), and `review/Tau_Cet_review_20260928.md` (headings only). |

The doc tags values as *Locked*, *(est.)*, *(real)*, *(fiction)*, *(narrative)*, or `TBD`. Those tags carry into the schema's `canon` field. **Placeholder** marks a value that I chose for display and that is not in the doc.

### Star
tau Ceti: G8V, M = 0.78 M☉, L = 0.488 L☉, R = 0.793 R☉, T_eff = 5,320 K (all *real*). The habitable zone is 0.68–1.22 AU (*est.*).

### Bodies (heliocentric)

| id | Name | Kind | a (AU) | e | Radius | Mass | Notes / tags |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tc1 | Gane (tC 1) | planet | **0.133** | TBD → 0 | ~2,820 km | ~0.06 M⊕ | hot bare rock (est.) |
| tc2 | Hornstooth (tC 2) | planet | **0.243** | TBD → 0 | ~3,110 km | ~0.08 M⊕ | hot bare rock (est.) |
| tc3 | Husk (tC 3) | planet | **0.34** | TBD → 0 | ~3,350 km | ~0.10 M⊕ | stripped bare rock (Locked) |
| tc4 | Sable (tC 4) | planet | 0.538 | **≈0.1** | ~7,900 km | **2 M⊕** | black basalt, albedo 0.07 (Locked) |
| tc5 | Kakakiko (tC 5) | planet | **0.71** | TBD → 0 | 6,628 km | 1.045 M⊕ | ocean super-Earth; 0.967 G (Locked); 34 h day; 12° tilt |
| b1 | The Sombrero | belt | **1.1–1.6** | – | – | – | dust and asteroids (fiction) |
| tc6 | The Gas Giant (tC 6) | planet | **~2.8** | TBD → 0 | 58,200 km | 95 M⊕ | Saturn-size (est.) |
| tc7 | Ice Giant 1 (tC 7) | planet | **~5.5** | TBD → 0 | 24,600 km | 17 M⊕ | Neptune-like, **ringed** |
| tc8 | Ice Giant 2 (tC 8) | planet | **~9.2** | TBD → 0 | **placeholder 24,000 km** | **placeholder 15 M⊕** | physical values TBD in the doc |
| b2 | Outer Wall | belt | **10–50** | – | – | – | matches the real debris disk (real) |

### Kakakiko subsystem (planet-centred)

| id | Name | Kind / anchor | Orbit | Physical | Tags |
| --- | --- | --- | --- | --- | --- |
| tc5a | Shudder (Moon I) | moon | a 251,350 km, **e 0.20** (perigee 201,080, apogee 301,620 km), P 14.18 d | Ø 2,167 km, **2.8 g/cm³**, 1.491×10²² kg | est.; 2:1 resonance with Der, at perigee at each conjunction (Locked concept) |
| tc5b | Der Eindringling | moon | a 400,000 km, e 0.03, P 28.36 d | Ø 2,549 km, **7.2 g/cm³**, 6.243×10²² kg (**1/100 of the planet**) | Locked ratio; tidally locked |
| l4 | L4 Yard + Goliath Funnel | structure, Lagrange L4 of (tc5, tc5b) | co-orbits with Der, **leading by 60°** | a funnel 2 km wide × 7.5 km long; the yards are a scaffold complex | Locked |
| l5 | L5 Haven | structure, Lagrange L5 | co-orbits with Der, **trailing by 60°** | O'Neill cluster and Gateway Spaceport; 2.2 M residents (about 1.3 M present) | Locked |
| l3 | L3 Watch Station | structure, Lagrange L3 | opposite Der, about 400,000 km out | crew of about 20 | Locked |

These are "the eccentric, low-density moon and a second moon of similar diameter but much more mass". Shudder is 85% of Der's diameter at about 1/4.2 of its mass.

**Placeholders.**
- Orbital phases at the epoch, and the orientations of periapsis, for every body. The doc gives none.
- The eccentricities marked TBD, drawn as 0.
- Ice Giant 2's size and mass.
- The epoch date.
- The gate location (doc: `TBD`).

## 5. Schema extension: `orbit_match: 2` (to go in `docs/FORMATS.md`)

Principles:
- Version 2 is a superset of version 1 in meaning.
- Readers accept 1 and 2, reject anything higher with a clear message, and ignore unknown keys.
- In v2, numbers are JSON numbers. Readers also accept numeric strings, because the builder writes strings.
- Moons and structures are **flat bodies with a `parent`**, not nested lists.

```json
{
  "orbit_match": 2,
  "kind": "system",
  "epoch": { "t0_days": 0, "label": "placeholder epoch", "canon": "placeholder" },
  "star": { "hostname": "tau Cet", "setting_name": "Tau Ceti", "spectype": "G8V",
            "mass_solar": 0.78, "lum_solar": 0.488, "lum_log": -0.3116,
            "teff_k": 5320, "radius_solar": 0.793, "x_ly": null, "y_ly": null, "z_ly": null },
  "known_planet_count": 3, "card": { }, "arrivals": [ ],
  "bodies": [
    { "id": "tc5", "name": "Kakakiko", "designation": "tC 5", "kind": "planet", "parent": null,
      "orbit":    { "a_au": 0.71, "period_days": null, "e": null, "i_deg": 0,
                    "argp_deg": null, "mean_anomaly_deg": 250, "retrograde": false },
      "physical": { "radius_km": 6628, "mass_earth": 1.045, "density_gcc": 5.12,
                    "surface_g": 0.967, "rotation_h": 34, "axial_tilt_deg": 12,
                    "albedo": 0.3, "rings": false },
      "facts":    { "atmosphere": "Breathable, 1.5 atm", "water": "95.8%", "concept": "..." },
      "look":     { "color": null, "style": "ocean" },
      "canon":    { "orbit.a_au": "locked", "orbit.mean_anomaly_deg": "placeholder",
                    "physical.surface_g": "locked", "physical.mass_earth": "est" },
      "source":   "Turquenish SoT systems/tauCet/Tau_Cet_system_v2.md §6.5" },
    { "id": "tc5a", "name": "Shudder", "kind": "moon", "parent": "tc5",
      "orbit": { "a_km": 251350, "e": 0.20, "period_days": 14.18 },
      "physical": { "radius_km": 1083.5, "mass_kg": 1.491e22, "density_gcc": 2.8 },
      "resonance": { "with": "tc5b", "ratio": [2, 1], "conjunction_at": "pericenter" } },
    { "id": "l4", "name": "L4 Yard + Goliath Funnel", "kind": "structure", "parent": "tc5",
      "anchor": { "type": "lagrange", "primary": "tc5", "secondary": "tc5b", "point": "L4" } },
    { "id": "b1", "name": "The Sombrero", "kind": "belt", "parent": null,
      "orbit": { "a_inner_au": 1.1, "a_outer_au": 1.6 } }
  ]
}
```

Field rules:
- **Distance.** Give exactly one of `orbit.a_au` or `orbit.a_km`. The distance is measured from the parent: the star when `parent` is null, otherwise the parent body.
- **Period.** `period_days` is optional. If it is missing, it is derived from Kepler with μ = G(M_parent + M_body). A moon needs the parent's mass, or else its own period.
- **Mass and density.** Give at most one of `mass_earth`, `mass_kg`, or `mass_solar`. `density_gcc` is derived when radius and mass are both present. If all three are given and disagree by more than 5%, the loader gives a warning, not an error.
- **Orbit elements.** `e` (0 ≤ e < 1, default 0); `i_deg` (default 0; phase 1 draws everything in the plane); `argp_deg` (the angle of periapsis in the plane); `mean_anomaly_deg` at `epoch.t0_days`.
  - A missing `mean_anomaly_deg` falls back to a deterministic hash of `id`, and the value is tagged placeholder.
- **Resonance.** `resonance` may set a body's phase from a partner's. For `ratio: [p, q]` with `conjunction_at: "pericenter"`, the inner body's mean longitude is λ_in = (p/q)·λ_out − ((p/q) − 1)·ϖ_in. For 2:1 that gives λ_in = 2λ_out − ϖ_in, which puts the moon at pericenter at every conjunction. This overrides `mean_anomaly_deg`.
- **Anchor.** A body with `anchor` has no `orbit`. Anchor types:
  - `lagrange`: points L1–L5 of (primary, secondary).
  - `fixed`: a fixed offset, used for gates or markers.
  - L4 and L5 are the secondary's position rotated ±60° about the primary. L3 is 180°, at the secondary's current radius.
  - L1 and L2 sit at r_s(1 ∓ (μ/3)^{1/3}), on the line through the primary and the secondary.
- **Kinds.** `planet, moon, asteroid, belt, structure, station, jumpgate, staryard`. For a belt, the orbit holds `a_inner_*` and `a_outer_*`.
- **Canon.** `canon` maps field paths to tags: `locked, est, derived, real, fiction, narrative, tbd, placeholder`. The tags match the lore doc's own. Placeholders are drawn dimmed or marked in the legend.
- **Migration from version 1.**
  - A nested moon becomes a body with `parent` set to the planet's id.
  - `au` becomes `orbit.a_au`, and `distanceKm` becomes `orbit.a_km`.
  - `period` + `unit` becomes `orbit.period_days`.
  - The free-text facts move to `facts`.
  - `generated` is kept.
  - `migrateV1toV2()` is pure and tested.
- **Writers.** The builder keeps writing version 1 until it is updated, which is out of phase 1 scope. The viewer reads both versions.

## 6. Time-parametric position model

- One function gives every position: `pos(id, t_days)`. It returns the body's position in the **star frame**:
  - For an orbit: `pos(parent, t) + kepler(orbit, t)`.
  - For an anchor: `lagrange(primary, secondary, point, t)`.
  - For the star: (0, 0).
- `vel(id, t)` is analytic for Kepler orbits and follows the same parent chain.
- Kepler: M = M0 + 2π(t − t0)/P. Solve M = E − e sin E by Newton's method to 1e−12. Then x = a(cos E − e), y = a√(1−e²) sin E, rotated by `argp_deg`.
- Rendering at zoom level Z with focus f uses **frame-relative** positions, `pos(id, t) − pos(f, t)`. So the close-up is planet-centred, and the planet's motion around the star is removed.
- Transfers are sampled over time. A later ship object will be `state(ship, t)` along a stored trajectory, so the phase 2 time multiplier just advances t. That means `t_view = t0 + multiplier × wall-clock`.
- Trails: the arc swept in the last `trail_days`, drawn fading. At zoom 1 trails are capped at 40°. In the close-up the concept uses 1.5 days, so the L4 and L5 trails show them co-orbiting with Der.

## 7. Camera and projection (unchanged from v1)
- The projection is an orthographic tilt: `sx = cx + X`, `sy = cy − Y·sin(el)`, with `el` clamped to 45–70° (default 58°).
- The far side is drawn above the centre. Discs stay circles.
- Draw order: background, grid, habitable-zone band, belts, far half of each orbit, star, near half of each orbit, transfers, bodies (far to near), labels, legend.

## 8. Two-stage zoom scale function

Notation:
- Z ≥ 1 is the zoom (Z = 1 is the whole system) and f is the focus body (default: the star).
- ρ(r) is the compressed radial map at zoom 1:
  - log: `R_in + K·ln(1 + r/a0)`, with a0 = 0.1 AU.
  - Alternatively sqrt: `R_in + K·√r`.
  - Fit to the viewport as in v1.
- r_px(1) is each body's zoom-1 disc radius.
- Children (moons and structures) at zoom 1 sit on **fixed-pixel rings** around their parent: `r_parent + 5 px + 4 px × index`. This keeps them findable at zoom 1, though not to scale.

**Stage 1, spread (1 ≤ Z ≤ Z1).** Distances grow and sizes stay fixed.
- `screen(p) = C + Z · (ρ-map(p) − ρ-map(p_f))`.
- `size(body, Z) = r_px(1)`.
- Planets stay findable against the backdrop, and crowded inner orbits separate.

**Threshold Z1 (per focus).** The zoom at which the focus is alone on screen:
- `Z1 = min(W/2, (H/2)/sin el) / min(ρ(a_f) − ρ(a_inner neighbour), ρ(a_outer neighbour) − ρ(a_f))`
- That is, the nearest neighbouring ring has reached the viewport edge. Clamp to ≥ 2.

**Stage 2, focus (Z1 < Z ≤ Z2).** Bodies scale, and the geometry turns true.
- Blend weight: `w = smoothstep((ln Z − ln Z1) / (ln Z2 − ln Z1))`.
- Child offset: `offset = (1 − w) · fixedRing(Z) + w · s2 · r_true_km`. Here s2 is chosen so the outermost child orbit (apocentre, or an anchor radius) fills 85% of the viewport half-height after tilt.
- **Linear distances at Z2**, so eccentric orbits show their true shape (Shudder's e = 0.2 ellipse).
- Size: `size(body, Z) = r_px(1) · (Z/Z1)^β`, with `β = ln(r_target / r_px(1)) / ln(Z2/Z1)`.
  - r_target for the focus is 4.5% of min(W, H).
  - Children use `c·R_km^0.7`, with c set so the focus lands on its target. That keeps the moon-to-moon ratio honest: Shudder/Der is 0.85 in diameter.
  - Sizes are capped so the focus disc is < 0.6 × the smallest child pericentre.
- Z2 = Z1 × 8 by default.

**Visibility and level of detail.**
- Non-focus bodies simply leave the screen.
- Structures (anchors) fade in over Z ∈ [Z1, 1.5·Z1].
- Child labels appear once Z ≥ Z1.
- Belts thin out to avoid clutter.
- At zoom 1, only planets, belts, and the star are labelled.

**Properties (tested).**
- Every function is continuous in Z.
- Size is constant on [1, Z1] and strictly increasing on (Z1, Z2].
- Screen distances grow monotonically with Z.
- At Z2, child geometry matches the true geometry to within 1%.

Phase 1 renders **two presets**: `system` (Z = 1) and `focus=tc5` (Z = Z2). The functions are tested at intermediate Z so that phase 2's zoom can be interactive with no new math.

## 9. Sizes
- Zoom 1: `r_px = 2.6 + 1.9·√(R/R⊕)`.
- The star is `clamp(1.6 × largest body, 24, 0.7 × (R_in − gap))`. It is always the largest object and never covers the first ring.
- If two neighbouring rings are closer than their two discs, the discs shrink, never below the minimum. The rings do not move.
- The stage-2 sizes are in section 8. The legend always states the scaling.

## 10. Distinguishable, not cartoonish
- A muted, realistic palette with no outlines. Each body is lit by a gradient from the star's direction.
- The colour comes from `look.color`, then `look.style` (ocean, basalt, rock, gas, ice), then the facts, then a hashed palette. Neighbours must differ by RGB distance ≥ 60.
- Rings are drawn for `physical.rings: true`, as Ice Giant 1 has.
- Der reads as dark and metallic; Shudder reads as pale, porous rock. That makes density visible, which is the point.
- Structures use icons: yard = frame + funnel, haven = cylinder cluster, watch = diamond.

## 11. Transfers and the math

Constants: μ☉ = 1.32712440018e20 m³/s² (so μ = μ☉·M★); GM⊕ = 3.986004418e14; AU = 1.495978707e11 m; g0 = 9.80665 m/s².

A transfer is computed **in the frame of the common parent**: the star for planet↔planet, or the planet for moon, L-point, or low orbit. A leg between different frames (a moon to another planet) is phase 3.

### 11.1 Hohmann (ballpark)
- The math is as in v1: a_t, TOF = π√(a_t³/μ), the Δv1 and Δv2 magnitudes, the window lead φ = π − n2·TOF, and the synodic period.
- The arc is sampled in true coordinates and then mapped, with ghost markers at departure and arrival.
- Works around the star and around a planet.

### 11.2 Constant thrust with matched arrival (reactionless, not inertialess)
The ship keeps its momentum. The drive supplies an acceleration |a| ≤ a_max; reactionless drives need no propellant. The ship departs with the departure body's state (r0, v0) at t0. It must arrive at t0 + T with the target's state (r_T, v_T), matching both position and velocity. Gravity is neglected, and the loader flags when that is unsafe (below).

**Two-phase model** (accelerate, flip, decelerate, with the direction free in each half):
- Let `Δr = r_T(t0+T) − r0 − v0·T` and `Δv = v_T(t0+T) − v0`.
- Constant a1 on [0, T/2] and constant a2 on [T/2, T] must satisfy:
  - `a1 + a2 = 2Δv/T`
  - `3a1 + a2 = 8Δr/T²`
- Solving: `a1 = 4Δr/T² − Δv/T` and `a2 = 3Δv/T − 4Δr/T²`.
- **Minimum time:** the smallest T with `max(|a1|, |a2|) ≤ a_max`. Find it by bracket doubling, then bisection to 1 s. The target moves, so each trial T re-evaluates r_T and v_T.
- **"Thrust as needed":** given a longer T chosen by the user, the same formulas give the lower thrust required (a throttle-down).
- **Outputs:**
  - T, the flip at T/2, and the flip turn angle between a1 and a2.
  - The peak speed relative to the departure frame, |v0 + a1·T/2|.
  - The thrust-time `(|a1| + |a2|)·T/2`. For reaction drives this is the Δv budget; for reactionless drives it is informational.
  - The path: two parabolic arcs. It is not a straight line, because v0 drifts it.
- **Checks:**
  - Rest to rest (v0 = v_T = 0, fixed target) reduces to `T = 2√(d/a)`.
  - A pure velocity change at the same point gives `T = 3|Δv|/a` in this model. The true optimum, with continuously steered thrust, is somewhat shorter. The spec accepts the two-phase model for ballpark and notes it.
- **Flags:**
  - `gravityNotNegligible` when the local gravity of the parent at the start or end is > 1% of a_max.
  - `nearParent` when the path passes within max(3 × parent radius, 0.02 AU) of the star, or 3 planet radii of a planet.
  - A flagged transfer is drawn dashed-amber with a "ballpark" note. Phase 3 integrates the path numerically with gravity.

**Drive profiles** (named in the view spec):

| Profile | Acceleration | Notes |
| --- | --- | --- |
| `reactionless` | 0.25–1.25 g | Doug's requirement. The lore says other powers have these; the Turquenish do not (see open question 1). |
| `fusion` (Turquenish) | 0.005–0.01 g | A reaction drive; reports the Δv budget. Per lore §2. |
| `ion` | Hohmann or spiral only | Cargo. |

### 11.3 Reference numbers (from the concept math; placeholder phases)
- **Hohmann Kakakiko → Gas Giant** (0.71 → 2.8 AU, 0.78 M☉): TOF **480.8 d**, Δv **8.21 + 5.72 km/s**. The next window is +187 d at the concept's phases.
- **Reactionless 1 g, matched, Kakakiko → Gas Giant:** **4.3 d**, peak about 1,800 km/s.
- **Fusion 0.01 g, matched, same trip:** **45.9 d**, thrust-time about 373 km/s. That is far beyond a plausible fusion budget, which is itself useful for the interface: it should warn.
- **Ion cargo Hohmann, Kakakiko low orbit (7,028 km) → 400,000 km:** **5.17 d**, Δv 3.09 + 0.83 km/s. This matches the lore's "~5.2 d".
- **Fusion shuttle 0.01 g, Kakakiko (at rest in the planet frame) → L3, matched:** **36.4 h**. The lore's rest-to-rest figure is 35.2 h for 393,000 km, so they are consistent; the L3 station's ~1.03 km/s makes the difference.
- **Analytic checks:**
  - Earth → Mars Hohmann: 258.9 d, Δv 2.946 + 2.650 km/s.
  - 1 AU rest to rest at 1 g: 2.859 d, peak 1,211 km/s.
  - Pure Δv of 10 km/s at 1 g: T = 3,059 s.

## 12. Later interaction (phase 2+, recorded now)

**Click card:**
- Name, kind, and parent.
- Orbit (a, e, P, and the current distance).
- Physical values: size, mass, density, gravity.
- Facts, with the air advice.
- Canon tags. Placeholders are called out.

**Card links:**
- "Open in Orbital Object Details" goes to `manual/#body=<id>`; the builder needs a scroll-to-card hook.
- "Lore" goes to the Lore Review page, if it is built.
- "Plan transfer from/to here".

**Zoom:** the section 8 functions, driven by the wheel or pinch, with the focus set by double-click.

## 13. Data needed

| Needed | Source |
| --- | --- |
| Distances, periods, parents | v2 `orbit`, `parent`; v1 `au`/`period`/`moons` through the migration |
| Size, mass, density | v2 `physical`. Otherwise kind defaults, tagged placeholder |
| Phases, eccentricity, argument of periapsis | v2 `orbit`. Otherwise a hash phase and e = 0, tagged placeholder |
| Structures at L-points | v2 `anchor` |
| Belts | v2 `a_inner_*`/`a_outer_*` |
| View settings | `orbit_match_view: 2`: `{elevation_deg, scale, epoch_days, trail_days, preset: "system" or {focus, zoom}, transfers: [{from, to, mode: "hohmann" or "thrust", profile, accel_g: [...], depart_days}]}`. Also accepted as hash parameters. The version is bumped to 2 because presets and profiles were added. Version 1 of the view format was never shipped, so readers accept only 2. |

## 14. Library choice (unchanged)
Plain SVG with our own projection, no three.js. Reasons: no build step, script tags, opens from disk, and works with WebGL off, as BRIEF.md requires. The same pure JS renders in Node for the tests and the CLI.

## 15. Phased plan
- **Phase 1, the MVP static graphic** (see brief v2):
  - `docs/FORMATS.md` with version 2 of the system format and version 2 of the view format, plus `AGENTS.md`.
  - The Turquenish tau Ceti v2 fixture.
  - A tests-first library: positions(t), Lagrange anchors, resonance phasing, the two-stage zoom functions, projection, Hohmann, and matched-velocity thrust.
  - An SVG renderer and a CLI that write `out/tauceti_system.svg` (zoom 1) and `out/tauceti_kakakiko.svg` (stage 2).
  - A static **System Viewer** page, `site/viewer/`, with presets chosen by hash parameter and no interaction.
- **Phase 2, interactive viewing and time:**
  - Two-stage zoom and pan.
  - Click cards and the "Orbital Object Details" link, with the builder hook.
  - A **time multiplier**: play, pause, and ×1 up to ×1e6. It animates orbits, the **L3/L4/L5 structures co-orbiting with Der**, and ships along transfers.
  - A time readout.
- **Phase 3, transfer setup:**
  - Choose from, to, profile, and acceleration. Search for windows and compare options.
  - Save transfers and ships in the system file.
  - Legs across frames (planet ↔ moon ↔ other planet).
  - Integration with gravity, and optimal steering.
  - The builder writes version 2.
- **Phase 4, polish:**
  - Optional WebGL 3D with an SVG fallback.
  - Textures, a Lore Review page, the gate position, and inclinations.

## 16. Open questions for Doug (3)
1. **Drive canon.** LadyT's doc (§2) says the Turquenish have **no** reactionless drives: they use fusion at 0.005–0.01 g, and "0.1 g torch flight is not used". Reactionless drives belong to "some other powers". Should the viewer default to the fusion profile for tau Ceti, and show reactionless ¼–5/4 g as a foreign or other-power option? Or is the reactionless requirement meant to change the canon?
2. **Epoch and phases.** The doc has no orbital positions, periapsis angles, or epoch date, and several eccentricities are TBD. Is it fine to keep these as tagged placeholders in the fixture, or will you or LadyT pick an epoch (a Turquenish calendar date) and positions?
3. **Zoom stops.** Z1 is set automatically ("the neighbours just left the screen") and Z2 = 8 × Z1. Do you also want named snap stops (System / Inner system / Kakakiko) for the phase 2 controls?
