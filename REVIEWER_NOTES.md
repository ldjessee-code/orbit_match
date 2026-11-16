# Developer notes for the reviewers

Feedback from development to the code reviewers about `CODE_REVIEW.md`: Doug's decisions on open questions, his new requests, and the tests the next review should write. Development does not edit `CODE_REVIEW.md` or the review tests. The reviewers decide how to fold these notes in.

Started 2026-11-09. The site code was unchanged from `b5f0624`.

## Fixed on 2026-11-09, not committed yet

Step 1 of the review's order of work, except CI. The reviewers' tests for these now pass:

| Finding | What changed |
| --- | --- |
| C4, H8 | `esc()` escapes `>` and `'`, and the drag label is escaped. `xml()` escapes quotes. A file's colors must match a color pattern, and theme values that could leave an attribute are dropped |
| C2 | The builder writes version 2 from the file it opened, and changes only the fields that were edited. `migrateV1toV2` merges into an existing `orbit` |
| C5, H17, H18 | A file is read and checked in full before the editor changes. Save, and an open that would replace unsaved work, ask: back up and continue, continue without a backup, or cancel. The Save prompt lists the changes. File inputs are cleared after each pick |
| H3 | Air fields update only their note. Redraws keep open panels and focus |
| H9, H15 | Deep-linked systems keep their own draft. Remove asks, and takes the bodies that orbit it along. New system and Undo buttons |
| H11 (part) | `#` comment lines and a byte-order mark are handled. A CSV with no stars says so |
| H13, M25 | A typo in a number stops the save and names the field. Rewording the epoch changes only its label |
| H14 | Randomize all asks before replacing existing angles, names the locked ones, and can fill blank angles only |
| H16 | Any edit, including a moon or an angle, counts as work. Choosing a star asks when bodies or star facts were edited |
| H19 | Fields for the star's name, radius, and x, y, z |
| M14 | The dev server answers a malformed URL with 400 and redirects `/viewer` to `/viewer/` |
| M15 | Data files name their sources relative to the Turquenish project |
| M29 | A star map link is applied once, at load, and asks before replacing a draft |
| M34, M35 | A moon card's period no longer gives it a distance from the star. A failed deep link restores the draft |
| L18, L27 | Fixed along the way: Save reports success, and blocked storage no longer stops the builder |

**Choices the tests left open:**

- Choosing a new star does not ask when only card fields (faction, concept, port, and so on) were typed. The H9 test expects those cleared on a star change. It asks when bodies or star facts were edited, as H16 requires. Undo brings the old system back either way. Doug may want card fields to prompt too.
- Prompts are `<dialog>` elements with three buttons, not `window.confirm`, so they can offer a backup. Escape means Cancel.
- The builder now refuses a file that the viewers' schema refuses, such as a negative angle (H7). Before, the builder dropped the bad value silently. When H7 starts normalizing angles, the builder will accept those files again.
- "Back up and continue" saves two files in a row. Chrome and Edge may ask once per site to allow several downloads.
- A Content-Security-Policy `<meta>` is on the builder and the SVG viewer, as C4 suggested. The 3D page has none yet because of its inline import map and unpkg. Do this with H4.

**Older tests changed to match approved behavior:**

- `test/orbit-angles.test.js`: two tests read angles from the body and moons from `moons`, which is the version 1 shape. They now read `orbit` and the moon's own body (C2, Phase 5 decision).
- `test/ladyt-angles.test.js`, `test/schema.test.js`: the expected `lore.source` paths are now the relative names (M15). The snapshot drops `lore.source` after an exact check of `Turquenish/systems/tauCet/Tau_Cet_system_v2.md`. The stability file's `source` is locked to that same path.

**Behavior with no test yet**, for the next review: the Undo button, New system, the change list in the Save prompt, bringing back edits to a deep-linked system, the backup file names and contents, the policy `<meta>` tags, and Escape cancelling a prompt.

**Still open from Step 1:** CI. "H11: NASA planet columns are read" is the planet import, which section 9 puts in Step 5.

## Decisions

### Keep every decimal. Round only for display (review item L9)

Decided 2026-11-09. If the data has the accuracy, keep it. Loading, saving, positions, and transfer math use the full value. Only read-only text on screen is rounded, and 2 decimals is fine there for angles.

L9 is therefore a bug, and its existing test stays. The rounding is in `finishAngle` (`site/js/kepler.js:25`). `schema.js` and `builder-link.js` both call it through `parseAngleDeg`, so the viewers, transfers, and saved files all get the rounded value today.

For scale: 2 decimals would be accurate enough for play. The worst error, 0.005°, is about 13,000 km at 1 AU and does not grow over time. That is not a reason to throw away data.

**Tests to write:**

- 359.996 stays 359.996 on load, instead of becoming 0.
- `perihelion_longitude_deg` and `reference_direction.deg` keep their decimals.
- The builder shows a stored angle with all its decimals (`angleText` in `builder-link.js`), so editing a field does not cut them.
- An angle typed in the builder saves with all its decimals (`exportManualBody`).
- Guard: 360 still becomes 0.
- Any read-only angle text shows 2 decimals.
- Apply the same rule to other numbers. M8 already covers the builder rounding AU to 3 places.

### Der Eindringling is meant to be dense

Answered 2026-11-09. Its 7.19 g/cm³ is intended. It is a captured, metal-rich core of a rogue planet or moon, slowed by the giants and then captured by Kakakiko. Do not report it as a finding.

Suggested, not decided: add a note or composition field to `tc5b` in `site/data/tau-ceti.system.json`, so the intent is in the data.

## To add: retrograde (backward) orbits

Requested 2026-11-09. The app must handle bodies that orbit backward. Captured moons often do, and Neptune's Triton is the usual example. The Der Eindringling capture story makes this a likely choice for this setting.

What the code does today (read, not run):

- A negative `period_days` is treated as no period. `positionFromAngles` in `kepler.js` then freezes the body at its epoch angle. `render-svg.js:78` falls back to 365.25 days, `render-svg.js:235` to 1 day, and `scene-model.js:212` to its own fallback. None of them run the orbit backward.
- `i_deg` is parsed in `schema.js` and never used (review item M27). The usual way to mark a retrograde orbit, an inclination above 90°, therefore has no effect either.
- The builder has no field for direction or inclination.

**Decide first:** how a file says "backward". Options are a negative period, `i_deg` above 90 (the standard, and what NASA's `pl_orbincl` would give), or a separate flag. Supporting `i_deg` is the most standard. Accepting a negative period as well would be friendly.

**Tests to write:**

- A retrograde body's angle decreases with time in the shared position code, in the SVG viewer, and in the 3D viewer.
- A retrograde body returns to its epoch angle after one period, and is at the epoch angle at day 0.
- A retrograde moon around a planet works the same way.
- The builder can enter, save, and reload a retrograde orbit with no loss.
- The validator added for H7 accepts it and does not report it as an error.
- Transfers to or from a retrograde body use its real motion. Both the Hohmann and the fusion figures depend on where the body will be.
- The drawn orbit path matches where the body actually is.
