# Orbit Match: System Viewer, design spec v4

Written 2026-09-30 (ET) for Doug. v4 is v3 plus the round-4 changes in §00 below. v1, v2 and v3 are kept unchanged in `F:\Dropbox\TheCourt\research-grok\orbit-match-system-view\`. Where §00 and the older text disagree, §00 wins.

## 00. What changed in v4 (round 4, with LadyT's 2026-09-30 corrections)

1. **Star: tau Ceti is G8V** (lore `Tau_Cet_system_v2.md` v2.26; T_eff 5,320 K, metal-poor), not G8.5V. Display colour **`#ffe0a0`**: pale yellow with a slight orange tint, a touch warmer than the Sun (G2 ≈ `#fff0c0`), **not red**. The star-sphere gradient runs `#fffaf0` → `#ffe0a0` → `#f3c983` (no deep orange edge). The §4 row G5–G9 becomes `#ffe0a0`, and G8V is the reference entry.
2. **Interface theme** (new §7a). It is a per-system / per-hardware *interface* scheme, not a faction or flag colour. Two themes: **Empire-style** and **Mardat-style**. The mockups use Empire-style, and variant b shows one Mardat-style override (Der's mines).
3. **Giants** (lore v2.26): tC 6 **"Croquet Ball"** (proposed, pending Doug), a **striped** Saturn-size giant; tC 7 **Cue Ball** (Locked), a **very pale, near-white blue** ringed ice giant with **one round near-black storm**; tC 8, name `TBD`, a **dark, dusty** ice giant. Labels use these names and show "name proposed" or "name TBD". Body display colours: Croquet Ball stripes cream `#f1e3bf` / tan `#b68d5c`; Cue Ball `#f3f9fd` over `#b9d3e6`, storm `#101318`; tC 8 `#3d3630` / `#1c1916`. The renderer gets a `surface` field: `bands` (stripe list), `spot` (x, y, r, colour), `dust`. Plain bodies keep the gradient.
4. **Tilt is now stated as elevation above the orbital plane** (Doug's round-4 wording, e.g. "~70° from the plane"). The ellipse ratio is **ry/rx = sin(elevation)**. v3's "58° from overhead" is the same picture as **32° elevation** (ratio 0.53). Mockup variants: **a = 70°** (0.94, rounder), **b = 32°** (0.53, the v3 look), **c = 20°** (0.34, flatter). The slider range becomes **15–75° elevation**, default 32° until Doug picks one. §2's formula becomes `sy = cy − Y·sin(elev)`.
5. **Body-size preset** `body_scale: 1.0 | 1.3 | 1.6` (medium, large, largest). The star radius goes 64 / 84 / 100 px, and the close-up Kakakiko 62 / 78 / 93 px. `holo_level: 0 | 1 | 2` adds latitude wires (1), then scan-lines on spheres, a glow rim and a projector-cone backdrop (2). The mockups pair a = 1.3/1, b = 1.0/0, c = 1.6/2.
6. **Occlusion.** At low elevation the inner planets pass in front of and behind the star. Draw far-side bodies (screen y above the star centre) before the star, and near-side bodies after it. Below a ratio of 0.5, the inner schematic radius grows to `(R_star + 10) / 0.5` so the inner orbits clear the star disc. The star's name sits on the star disc.
7. **Framing.** The close-up auto-fit uses `S = min(0.00135, (W/2 − 110)/465,000 km, (H/2 − pad)/(465,000 km · ratio))`, so rounder views shrink to fit. Variant a uses pad 130, which keeps the L4 label clear of a bottom-right legend.
8. **Legend corner** is varied across the mockups: a = BR, b = TR, c = TL. Cards take the other three corners.

Concept images v4 (by `concept_generator_v4_20260930.mjs`): `concept_tauceti-turquenish-system_20260930_v4{a,b,c}.png` and `concept_kakakiko-closeup_20260930_v4{a,b,c}.png`, each with an SVG.

---

*v3 text follows. Superseded where §00 says so.*

v3 replaced v2.

v3 changes the look (a holo nav display), the zoom (a continuous slider), and the drives (the Turquenish Empire uses fusion only). It adds callout cards and a legend-corner setting. Everything not restated here is as in v2: the repo facts (§1), the Turquenish sources and body table (§4), the `orbit_match: 2` schema (§5), the time-parametric positions (§6), and Hohmann (§11.1).

The repo was read-only (HEAD `1b4892c`). Nothing in it was changed.

Concept images, drawn from this spec's math by `concept_generator_v3_20260929.mjs`:
- `concept_tauceti-turquenish-system_20260929_v3.png`: whole system, schematic distances, 3 callouts plus the legend.
- `concept_kakakiko-closeup_20260929_v3.png`: tilted 58°. A Turquenish Empire shuttle is raising its orbit to L5, a mass-driver stream runs from Der to L4, and there are 3 callouts plus the legend.

## 0. What changed from v2 (Doug's round-3 answers)

1. **Style.** A **holo-projection navigation display** like a ship's nav system, not realism. The star and planets are **much larger** in the whole-system view, to show relative positions at a glance.
   - True distances show through a **distance-mode toggle** and/or **hover readouts** (§3). Which of these to use is **still open**.
2. **Drives.** The **Turquenish Empire** (the faction) has **no reactionless drive**. Its default is **fusion at 0.01 g, constant while reaction mass lasts** (§9).
   - Other powers in the setting may have reactionless drives. ¼–5/4 g stays in the spec as an **other-power profile**.
   - The mockups show Turquenish Empire fusion and Hohmann only.
3. **Epoch.** A relative label: **"T+0 (circa 1600 yrs hence)"**, tagged placeholder. There is no calendar date.
4. **Zoom.** **One continuous slider with no named stops**, plus **auto-fit framing** to whatever targets the user picks (§5).
5. **Cards.** Pop-up cards connect to their object with a **light, partly transparent callout line** (§7). There are at most 3 in each view.
6. **Close-up.** Tilted about 58° (the angle is now defined from overhead, §2). It shows:
   - a ship mid-course raising its orbit from Kakakiko to L5, with its card in a corner;
   - railgun slugs from Der to L4, drawn as a dotted stream;
   - the legend in another corner.

   The **legend corner** is user-selectable; the control is not designed yet (§7).
7. **Star colour** follows spectral class. There is a table in §4. tau Ceti (**G8V**, v4) is pale yellow with a slight orange tint.

## 1. Page and purpose (unchanged from v2)
- The page is the **System Viewer** (`site/viewer/`). Its siblings are **Orbital Object Details** (the existing builder, `site/manual/`) and a possible **Lore Review** page.
- The first job of the visual is to inspire Doug and make him think through the interface.
- Phase 1 is a **static SVG**, built tests first.

## 2. Camera: tilt is measured from overhead (a correction)
- In v2, "58° above the plane" gave an ellipse ratio of sin 58° = 0.85. On screen that reads as nearly top-down, which is why the v2 close-up looked flat to Doug.
- v3 defines **tilt = the angle away from straight down**, in the range 45–70°, default **58°**. The orbit ellipse ratio is **ry/rx = cos(tilt)**: 0.71 at 45°, **0.53 at 58°**, and 0.34 at 70°.
- That matches the tilted reference image. Doug's original "45–70° above the plane" is kept as the numeric range, but the angle is now measured from overhead. See open question 1.
- The projection stays orthographic: `sx = cx + X`, `sy = cy − Y·cos(tilt)`. The far side is drawn above the centre, and discs stay circles.
- **Depth cue** (optional, on by default): the size of each body and label is scaled by ±8% from the near edge to the far edge.

## 3. Holo nav-display style

**Palette and surface:**
- A near-black navy background (`#02060d` to `#071726`, radial vignette).
- A faint scan-line overlay at about 3.5% opacity, a thin frame, and corner brackets.
- Sparse, dim background stars.

**Grid and orbits:**
- The primary line colour comes from the interface theme (§7a). Empire-style is light blue `#7FD3FF` (est.). v3 used holo cyan `#5fe3ff`.
- A polar holo grid on the plane: rings every ~55 px and 24 spokes, at 3–8% opacity.
- Each orbit is two strokes: a 4 px glow at 10% plus a 1 px line at 45%.

**Bodies:** translucent holo spheres.
- A gradient in the body's own colour (from §10 of v2), with a cyan rim at 55% opacity.
- Faint equator and meridian wire ellipses, and a soft halo.
- The body's real identity colour stays visible, so planets remain distinguishable.
- Rings are drawn as a tilted ellipse.
- Structures use line icons: yard + funnel, cylinder cluster (Haven), diamond (Watch).

**Star:** a disc in its spectral colour (§4), with a glow, a corona, and two thin corona rings.

**Text:** a monospace font (Consolas / Cascadia Mono), uppercase names, letter-spaced, with a dim second line for the designation.

**Transfer colours:**

| Transfer | Colour and stroke |
| --- | --- |
| Hohmann | mint `#5fffc0`, dashed |
| Turquenish Empire fusion | violet `#c49bff`. Burns are thick and glowing, coasting is thin or dotted, the planned part is dashed |
| Other-power reactionless | amber `#ffb347` |
| Mass-driver slugs | pale metal rectangles with an amber edge, drawn as a dotted stream |

Ghost rings mark departure and arrival.

**Sizes, whole-system view (schematic):**
- The star radius is 6.4% of min(W, H), about 64 px at 1000 px tall.
- Planets use `r = 8 + 5·(R/R⊕)^0.4`, about 10–18 px.
- The star is always the largest object, and the first ring clears the star by 34 px or more.

**Distance modes** (`distance_mode` in the view file):
- **`schematic` (default).** Ring radii are a monotone blend of rank order and log(a): `u_i = (i/(n−1) + λ·(ln a_i − ln a_1)/(ln a_n − ln a_1)) / (1+λ)`, with λ = 0.45. The knots are every orbit plus each belt edge.
  - Any radius in between (transfer arcs, the habitable zone) is placed by **log-linear interpolation between knots**. The mapping is monotone and radial-only, so Hohmann arcs stay tangent at the apsides.
  - This mode gives large bodies room.
- **`log`.** v2's log compression.
- **`linear`.** True scale, useful only when zoomed in.

**True distances: toggle or hover (open, spec both).**
- **Toggle.** A distance-mode switch (SCHEMATIC / TRUE) in the legend. It re-lays the rings with animation in phase 2.
- **Hover.** Hovering a ring or body shows a readout tag with the true value: "0.71 AU", or "251,350 km (e 0.20)" for a moon. Cards always show true values.
- In a static SVG, the mockup shows one example hover tag (on Kakakiko's ring) and the toggle state in the legend.

## 4. Star colour by spectral class (display colours)

`starDisplayColor(spectype, teff)`:
1. Parse the class letter and subclass.
2. If there is no class, use T_eff.
3. Interpolate between the rows below, in RGB, by subclass.
4. Luminosity classes III and I brighten by 10%.

The colours are display-tuned from blackbody colour and deliberately more saturated than a true blackbody, so G and K stars read warm. This is a new function; `OrbitManual.starColor` in `orbit.js` stays unchanged.

| Class | T_eff (K) | Display colour | Reads as |
| --- | --- | --- | --- |
| O | ≥ 30,000 | `#9db4ff` | blue |
| B | 10,000–30,000 | `#b5c7ff` | blue-white |
| A | 7,500–10,000 | `#dfe6ff` | white, blue tint |
| F | 6,000–7,500 | `#fbf6ea` | warm white |
| G0–G4 | 5,600–6,000 | `#fff0c8` | pale yellow (Sun, G2 ≈ `#fff0c0`) |
| G5–G9 | 5,200–5,600 | `#ffe0a0` | **pale yellow, slight orange tint (tau Ceti G8V ≈ `#ffe0a0`; warmer than the Sun, not red)** |
| K0–K4 | 4,700–5,200 | `#ffc97a` | light orange |
| K5–K9 | 3,900–4,700 | `#ffad5c` | orange |
| M0–M4 | 3,200–3,900 | `#ff9148` | orange-red |
| M5–M9 | 2,400–3,200 | `#ff7a3a` | red-orange |
| L | 1,300–2,400 | `#e0552c` | deep red |
| T / Y | < 1,300 | `#b0405a` / `#7a3a5a` | magenta-brown |
| D (white dwarf) | any | `#e8eeff` | blue-white |

## 5. Zoom: a continuous slider plus auto-fit framing
- **Slider.** It maps position s ∈ [0, 1] to zoom Z = Z_max^s, with log steps. Z = 1 is the whole system. Z_max makes the smallest child orbit in the system (Shudder's pericentre) fill the viewport. There are no named stops.
- **Auto-fit framing.** The user picks targets: both ends of a Hohmann, a set of planets, a moon and a Lagrange point, a ship. Then:
  1. The **frame** is the lowest common ancestor of the targets: the star for planets, Kakakiko for Der + L4.
  2. The **extent** is the bounding box of the targets' positions in that frame over the relevant time span. For a transfer that means the whole path and both ghosts; for bodies, their current positions plus their orbit rings when "whole orbit" is chosen.
  3. **Fit.** Choose the centre and Z so the projected box, with 8% margin and room for the cards, fills the viewport. The slider jumps to that Z, and the user can then slide freely.
- **Scale regime follows Z** (the v2 two-stage function, now continuous and unnamed):
  - While the framed extent is larger than the local ring gap, it is **spread**: distances scale with Z and sizes stay fixed.
  - Below that, it **focuses**: the geometry blends from schematic or log to linear (weight w = smoothstep in ln Z), and sizes grow as `(Z/Z_s)^β`.
  - Z_s is the zoom where the framed subsystem's nearest outside ring leaves the viewport. It is computed, not a named stop.
- **Level of detail.**
  - Structures fade in as the framed extent approaches their parent's child-orbit scale.
  - Labels thin out by priority: star, then planets, then moons, then structures.
  - Belts thin out.
- In phase 1 there is no slider. The CLI takes `--frame <ids>` or `--zoom Z` and renders statically. The math is tested now.

## 6. Time
- There is **no hard date.** The epoch is labelled **"T+0 (circa 1600 yrs hence)"** and tagged placeholder. The label is set in the system file's `epoch.label`. Times display as T+days (for example "T+6 d").
- Every position, ship, and slug is a function of t (as in v2 §6). The **time multiplier** is phase 2. The L3/L4/L5 structures **co-orbit with Der** in every frame.

## 7. Callout cards and the legend
- **At most 3 cards per view**, set by `callouts: [{target, fields?}]` in the view file. In phase 2 they open on click.
- **Callout line.** A 1 px line at **~42% opacity** in the card's accent colour. It runs from the edge of the card nearest the target, with one dogleg, and ends in a small open ring on the object. It must not cross the legend. It may cross orbits, and is drawn under the bodies' labels.
- **Card panel.**
  - The panel, border and callout colours come from the interface theme (§7a). v3 used a dark translucent panel (`#06141f` at 72%).
  - Title: UPPERCASE NAME · designation.
  - 3–5 lines of true values. Placeholders are marked "(placeholder)".
  - A link line, "[ Open in Orbital Object Details ]", active in phase 2.
- **Card placement.**
  - Cards go in the free corners that are **not** the legend corner.
  - Each card takes the free corner nearest its target.
  - With a 4th card, the farthest card moves to an edge midpoint. Cards never cover the framed targets. If they would, the auto-fit shrinks the extent.
- **What each card type shows:**

  | Card | Contents |
  | --- | --- |
  | Body | kind, orbit (a, e, P), size, mass, density, gravity, moons or structures |
  | Ship | drive profile, phase (burning, coasting, planned), from → to, elapsed and ETA, Δv used / budget, reaction mass left |
  | Transfer | each mode's time and Δv, the window, and "arrival matched" |
  | Mass-driver stream | shot type, time of flight, slugs in flight |
  | Star | class, mass, luminosity, temperature, habitable zone |

- **Legend corner.** `legend_corner: "tl" | "tr" | "bl" | "br"` (default `bl`). It is saved in the view file and in localStorage (`orbit-match-viewer`). The control is undecided: a corner picker in the legend header, a settings menu, or dragging the legend.
  - The legend holds the line key, the distance mode and its toggle state, the size note, the epoch label, and a placeholder note.

## 7a. Interface theme (new in v4)

Source: `Projects/Turquenish/review/visual_style_sheet_DRAFT.md`. Its canon lines are Locked 2026-09-29, and its hex swatches are all **(est.)**. LadyT clarified on 2026-09-30 that these are **clothing and system-interface schemes, not faction or flag colours**.

- **Setting:** `interface_theme: "empire" | "mardat" | "legacy" | "mixed"`, on the system (default for its displays). Any body, structure or ship may carry its own `interface_theme` override for its hardware. The viewer uses the framed system's theme for the chrome, and each card uses its target's override if it has one.
- **Who uses which** (data, not code):
  - **Empire-style:** the Turquenish Empire, and **the Faith**.
  - **Mardat-style:** the Mardat Coalition, and **the Industrial Hegemony**.
  - **Unaligned systems:** keep an older (`legacy`) scheme, or run mixed hardware (`mixed`: per-object overrides, with the chrome falling back to `legacy`). The legacy palette is `TBD`; until then it uses the v3 dark-cyan look.
- **Example override:** some of **Der's mining runs Mardat hardware and software** (lore v2.26 §347). `tc5b` mining gets `interface_theme: "mardat"`, and its card renders Mardat-style inside an Empire-style view (mockup v4b).
- **Empire-style (est. swatches):**
  - white paneling `#EEF1F5` for the bezel, cards and legend (cards at ~90% opacity);
  - dark text `#12202b` / `#4b5d6c` on panels;
  - lit accents in light blue `#7FD3FF` and green `#6EE7A8` for callout lines, card outlines (2 px, soft glow), status LEDs and corner brackets;
  - a full-colour, lighted display area inside the bezel, with holo lines in light blue.
  - Which accent marks which state is `TBD` in canon. The mockups use blue for bodies and stations, and green for routes, ships and streams (placeholder).
- **Mardat-style (est. swatches):** darker and higher contrast.
  - medium-gray paneling `#6B6F76`, with a near-black display ground `#0A0C10` inside cards;
  - accents in bright dark red `#C0142B` (callout lines, outlines) and deep dark blue `#0B2A6F` (title bars, fills);
  - light text `#f1f2f4` / `#b8bcc2`.
- **Theme tokens** (one object per theme): `panel, panelOpacity, text, textSub, accentA, accentB, line, bezel, displayGround`. Swapping the object re-skins the chrome without touching scene data. Body colours, route colours (Hohmann green, fusion violet, slugs) and the star colour are data and do not change with the theme.
- Persist it as `interface_theme` in the view file (a per-user override of the system default), and in localStorage.

## 8. Mass-driver stream (Der → L4)
- The shots follow LadyT's doc: backward shots from Der's leading apex, **~70 m/s beyond Der's escape speed**, onto a one-orbit phasing ellipse. The slug period is `P_s = (5/6)·P_Der`, so after one slug orbit Der has moved 300° and the launch point is L4.
- Check: at 400,000 km, v_circ is 1,025.6 m/s and v_apo on the phasing ellipse is 957 m/s. The difference is **68.6 m/s**, matching the lore's "~70 m/s".
- **Model.** Each slug is launched at t_L with Der's velocity minus 68.6 m/s along Der's velocity (v∞ backward). It is then propagated two-body around Kakakiko by Kepler (μ = G(M_K + M_Der)). Der's gravity after escape is ignored.
  - A snapshot at time t shows every slug with 0 ≤ t − t_L ≤ P_s, launched every `interval_days` (placeholder 0.6 d).
  - The concept gives P_s = **23.55 d** and 40 slugs in flight.
- **Data.** A new stream object, time-parametric like everything else:

  ```json
  { "id": "md1", "kind": "stream", "parent": "tc5",
    "from": "tc5b", "to": "l4",
    "shot": { "dv_ms": 68.6, "direction": "retrograde" },
    "interval_days": 0.6 }
  ```

## 9. Drives and transfers

### 9.1 Profiles

| Profile | Who | Acceleration | Limits and notes |
| --- | --- | --- | --- |
| `fusion` (**default**) | **Turquenish Empire** | **0.01 g constant** (0.005–0.01 allowed) | Burns only while reaction mass lasts: `budget_dv_kms`, or `exhaust_kms` + `mass_ratio`, with Δv = v_e·ln(m0/mf). The accelerator loop's exhaust speed is adjustable (lore §2). |
| `ion` | Turquenish Empire (cargo) | very low | Hohmann or spiral legs |
| `reactionless` | **other powers only** | 0.25–1.25 g | Not available to Turquenish Empire ships. There is no reaction-mass limit. Kept in the spec but off by default, and not shown in the mockups. |
| `railgun` | infrastructure | an impulse only | used by the mass-driver stream |

Validation: a Turquenish Empire ship given `reactionless` is an error. Use `faction: "turquenish-empire"` on ship objects, with the same faction id the star map uses.

### 9.2 Hohmann
Unchanged from v2 §11.1. Reference: Kakakiko → Gas Giant takes **480.8 d**, Δv **8.21 + 5.72 km/s**.

### 9.3 Matched-velocity constant thrust with a reaction-mass limit (burn–coast–burn)
- This is gravity-free, in the common-parent frame.
- Burn a1 for t_b, coast, then burn a2 for t_b, arriving at time T. With `Δr = r_T − r0 − v0·T` and `Δv = v_T − v0`:
  - `a1 = (Δr/t_b − Δv/2) / (T − t_b)`
  - `a2 = Δv/t_b − a1`
  - t_b = T/2 recovers v2's two-phase formula (no coast).
- **Minimum time.**
  - Set `t_b = min(T/2, budget/(2·a_max))`.
  - Find the smallest T with max(|a1|, |a2|) ≤ a_max, by bracketing and then bisecting to 1 s.
  - Check that the Δv used, `(|a1| + |a2|)·t_b`, is ≤ the budget.
  - If no T within the search window works, report "insufficient reaction mass".
- **Rest-to-rest check:** `t_c = (d − a·t_b²) / (a·t_b)` and T = 2·t_b + t_c.
- **Concept result** (placeholder phases, 150 km/s placeholder budget): **Turquenish Empire fusion 0.01 g, Kakakiko → Gas Giant, matched, takes 82.3 d**, with two 8.85 d burns and Δv 132.5 km/s. Compare Hohmann at 481 d. Star gravity at 0.71 AU is 0.00094 g, about 9% of 0.01 g, so this transfer is **flagged `gravityNotNegligible`** and labelled "ballpark". A later phase integrates it with gravity.
- **Flags** (as in v2): `gravityNotNegligible` when the parent's gravity at an endpoint is > 1% of a_max, and `nearParent`.

### 9.4 Low-thrust orbit raise with gravity (new; used for the shuttle to L5)
- Inside a planet's gravity well at 0.01 g, gravity dominates, so a gravity-free model is wrong there.
- The **spiral** mode integrates thrust + gravity with RK4 (adaptive step, about 0.2% of the local period):
  1. Tangential thrust at a_max until the osculating apoapsis reaches the target radius.
  2. Coast to apoapsis.
  3. At apoapsis, a circularize/match burn: a short 0.01 g burn in phase 2. The mockup stops at arrival.
  4. The departure phase is chosen so apoapsis falls on the target's position at arrival. For an L-point target, this is solved by rotating the precomputed path.
- **Concept result:** low orbit (7,028 km) → 400,000 km at 0.01 g. The burn takes **15.4 h** (Δv **5.43 km/s**), then there is a coast to apoapsis. Arrival is at **157.5 h** (6.6 d).
  - The ship in the mockup is 113 h into the trip and coasting.
  - Its early spiral turns lie inside Kakakiko's enlarged disc. That is correct, and the card explains the phase.
- **Check:** the Edelbaum Δv for a circle-to-circle spiral is |v1 − v2| = 7.74 − 1.03 = **6.71 km/s** (μ = G(M_K + M_Der)). The burn-then-coast strategy needs less (5.43 km/s + the match burn at apoapsis). Tests check energy growth and the apoapsis stop condition, not Edelbaum equality.

### 9.5 Other-power reactionless (kept for completeness)
The v2 two-phase matched model at 0.25–1.25 g, with no budget. Reference: 1 AU rest to rest at 1 g takes 2.859 d.

## 10. Data needed (additions to v2 §5)
- `epoch.label`: "T+0 (circa 1600 yrs hence)", tagged placeholder.
- Ships (phase 1: static, from the view file):

  ```json
  { "id": "shuttle1", "kind": "ship", "name": "(placeholder)",
    "faction": "turquenish-empire", "parent": "tc5",
    "drive": { "profile": "fusion", "accel_g": 0.01, "budget_dv_kms": 9.0 },
    "leg": { "mode": "spiral", "from": { "orbit_km": 7028 }, "to": "l5",
             "depart_days": -4.72 } }
  ```

- Streams: as in §8.
- The view file bumps to **`orbit_match_view: 3`**, adding:
  - `tilt_deg` (replaces `elevation_deg`, measured from overhead);
  - `distance_mode`;
  - `frame: {targets: [...], whole_orbits: bool} | {zoom, center}`;
  - `callouts` (at most 3);
  - `legend_corner`;
  - `style: "holo"`.

  Readers accept only version 3. Version 2 was never shipped.

## 11. Phased plan
- **Phase 1, the static SVG MVP (brief v3):**
  - `docs/FORMATS.md` (system format version 2 with ships and streams, view format version 3) and AGENTS.md.
  - The fixture, and the tests-first library: positions(t), streams, the spiral, burn–coast–burn, framing, scale, star colour, and cards.
  - A holo renderer.
  - Two static renders (the system and the Kakakiko close-up, as in the mockups).
  - The static System Viewer page.
- **Phase 2, interaction and time:**
  - The zoom slider plus click-to-frame.
  - Click cards (at most 3 pinned) with the Orbital Object Details link.
  - The distance toggle and/or hover readouts, and the legend-corner control.
  - The **time multiplier**, animating orbits, co-orbiting L-points, ships, and slugs.
- **Phase 3, transfer setup:**
  - Pick targets and a profile, search windows, and save ships and legs.
  - Cross-frame legs, and full gravity integration for all legs.
  - The builder writes version 2.
- **Phase 4, polish:**
  - Optional WebGL, the Lore Review page, the gate, and inclinations.

## 12. Open questions for Doug (v3; see the v4 report for the round-4 questions)
1. **Tilt angle.** v3 measures the 45–70° tilt **from straight down** (58° → ellipse ratio 0.53, as in the new mockups). v2 measured it from the plane (ratio 0.85), which looked top-down. Is the new look right, or should the default tilt be steeper or shallower?
2. **True distances.** A SCHEMATIC/TRUE **toggle**, **hover readouts**, or both? The mockups show both: the toggle state in the legend and one hover tag.
