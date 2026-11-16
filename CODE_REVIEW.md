# Orbit Match code review

Reviewed 2026-11-04 at commit `b5f0624` on branch `review`, extended 2026-11-05, and rechecked 2026-11-06. No site code was changed. The additions are this file and two test files, listed in [section 11](#11-failing-tests-for-these-findings).

## Status check, 2026-11-06

**Every finding is still outstanding.** `HEAD` is still `b5f0624`, and no site code has changed since the review. All 114 original failing tests still fail, and their failure reasons were rechecked against the bugs they describe.

| Result | Count |
| --- | --- |
| Findings found fixed | 0 |
| Review claims corrected | 2 (L37 and M1, below) |
| New findings | 5 (M34, M35, L48, L49, L50) |
| Failing tests added | 86 |
| Review tests failing now | 200 |
| Older tests still passing | 132 of 132 |

The new findings that matter most are both data loss:

- **M34.** Editing a moon's period on its own card gives the moon a distance from the star. Shudder gets 3.272 AU.
- **M35.** If a deep link fails to load, the next edit replaces the saved draft with a blank system.

Corrections to this document:

- **L37.** The fusion burn was described as drawn 20% too long. It is drawn too short: 5 steps where the burn needs 7.1.
- **M1.** The 255,957-day figure is the search limit, not a computed trip. The fuel figure now matches the test.

Unnumbered Low items now have ids L19 to L47, so each can be tied to a test. [Section 11](#11-failing-tests-for-these-findings) has the full map and lists what still has no test.

## Bottom line

The foundations are good: clean orbital math, a tidy data format, a working SVG and 3D picture of Tau Ceti, and 132 passing tests. As a tool for a GM, though, it is not there yet. **Today it is a very good Tau Ceti viewer with a separate form beside it, and the two do not connect.**

The five problems that matter most:

1. **A system you build cannot be viewed.** The viewers only open files already deployed in `site/data/`.
2. **Saving can destroy data.** Opening Tau Ceti in the builder and saving it, then loading the result, loses every moon distance, every belt, and all eccentricity.
3. **The editor does not protect existing data.** It never offers a backup, and opening a file it cannot read empties the editor.
4. **The core feature has no controls.** There is no way to pick a trip. One trip, Kakakiko to Croquet Ball, is fixed in a data file, and the destination is not where the arc arrives.
5. **The app is not yet game-agnostic or setting-agnostic.** Tau Ceti is built into the code in more than a dozen places, NASA data supplies only a planet count, and there is no way to load a setting.

None of this needs a rewrite. The suggested order of work is in [section 9](#9-suggested-order-of-work).

## 1. How this was reviewed

| Check | Result |
| --- | --- |
| `tests\hooks.tests.ps1` | exit 0 |
| `node --test "test/**/*.js"` (Node 24.20) | exit 0, 132 of 132 pass |
| Read the site JS and HTML, hooks, server, workflow, and docs | done. `sky.js` and `ring-belt.js` were read in full in the second pass. CSS was searched and its colors checked, not read line by line |
| Test suite | style sampled, not read line by line |
| Scripts calling the real modules, with Tau Ceti data | suspected logic bugs run and measured |
| Headless Edge against the local server | clicks, playback, builder, offline, and phone width checked |
| Second pass, 2026-11-05 | 26 unusual or malformed systems through the loader and both renderers, solver accuracy, the fusion time against a scan of 224 trips, Tau Ceti's numbers against physics, every local file reference with exact case, and color contrast |
| Third pass, 2026-11-06 | Reran everything at the same commit. Read each failure's reason. Read `manual.js`, `render-svg.js`, `viewer.js`, `viewer3d.js`, `scene-model.js`, `schema.js`, `builder-link.js`, `orbit.js`, `kepler.js`, `playback.js`, `system-source.js`, and `display-angles.js` in full, and spot-checked `body-models.js`, `ring-belt.js`, and `sky.js`. Added tests for items that had none |

Each finding is marked:

- **Reproduced**: I ran it and saw the failure.
- **Code**: found by reading the code, not run.

**Not covered:** Firefox and Safari, a real GPU, the live Pages site, the Jumpgate side of the link, and the accuracy of the Python and REBOUND research in `tools/` and `tasks/`. The 3D runs used software rendering, so treat their request counts as a lower bound on rate, not a real-GPU figure.

**Severity:**

| Level | Meaning |
| --- | --- |
| Critical | Blocks the product's purpose or loses data |
| High | A main workflow is broken or misleading |
| Medium | A real bug with a narrower effect |
| Low | Polish and cleanup |

## 2. What is already good

- **The orbital core is correct where it counts.** `site/js/kepler.js` is small and readable. The solver handles eccentricity, and the 481-day Kakakiko to Croquet Ball Hohmann figure matches the design card.
- **The data format is thoughtful.** Separate AU and km fields, `canon` tags (`locked`, `est`, `fiction`), the `skipped` list, versioning, and a real crosswalk document. The canon tags suit a GM tool particularly well.
- **Scene logic is separated from rendering.** `buildScene` and the render functions can run in Node without a browser, which made this review much easier.
- **Fallbacks are considered.** A failed GLB leaves the sphere in place, and the SVG view still works without WebGL.
- **Some small things are done right.** Fixed-seed starfields, `aria-pressed` on playback buttons, Inward and Outward buttons as a keyboard route around dragging, and safe filename checks in `safeSystemFile` and `cleanModelPath`.
- **The builder's air advice is a real GM feature.** Partial-pressure logic with plain-language gear advice is the kind of thing a referee wants.
- **The process is disciplined.** Decisions are recorded, the `review` branch rule is clear, and there are no dependencies to install.

## 3. Critical findings

### C1. The builder and the viewers do not connect

**Reproduced. `site/viewer/viewer.js:230-249`, `site/viewer3d/viewer3d.js:872-891`, `site/js/builder-link.js:7`**

Viewers fetch only `../data/<name>.system.json`, and `site/data/` holds only Tau Ceti. There is no file picker in either viewer, and neither reads the builder's saved draft. Opening `?system=55-cnc` gives "The system file did not load. Open this page from the static server", which sends the user off in the wrong direction.

A visitor on the public site can build a system and download JSON, and then has nowhere to view it. On a static site they cannot add to `site/data/`.

**Fix:** Add "Open a system file" to both viewers, and a "View this system" button in the builder that passes the system through `localStorage` or `sessionStorage`. Loading must go through `loadSystem`, and C4 and H7 must be fixed first because this makes untrusted files reachable.

### C2. Saving from the builder destroys data

**Reproduced. `site/js/builder-link.js:177-214`, `:216-242`, `site/js/schema.js:63,69`, `site/manual/manual.js:760-810`**

The builder writes version 1. `migrateV1toV2` then replaces each body's `orbit` with one rebuilt from only `au`, `distanceKm`, and `period`. Loading Tau Ceti, saving, and reloading gave:

| Data | Before | After |
| --- | --- | --- |
| Kakakiko eccentricity | 0.0396 | gone |
| Shudder and Der distance | 151,060 and 240,000 km | gone |
| Haven, Yard, Watch | 54,076 km | gone |
| The Sombrero and Outer Wall belts | 1.1-1.6 and 10-52 AU | gone |
| Bodies with no distance | 0 of 16 | 7 of 16 |
| Star name, catalog ids, model, habitable zone edges | present | gone |
| `lore`, `rings_belts`, `sky` | present | gone |

The file saves without any warning, and `docs/FORMATS.md` promises that "unknown keys are kept".

**Fix:** Make the builder load through `schema.js` and write version 2, as Phase 5 approved. Keep the loaded record and change only edited fields, so unknown data survives. In `migrateV1toV2`, merge into an existing `orbit` instead of replacing it. Start with a failing test: load, save, load, then deep-compare.

### C3. The main feature has no user interface

**Reproduced. `site/data/tau-ceti.view.json:11`, `site/js/render-svg.js:457-485`**

The README says "ask for the trip from one to another" and describes three fidelities. In practice:

- There is no control for choosing a trip. Only the `transfer` entry in the view file sets one.
- Only Hohmann and a fixed "Fusion 0.01 g" exist. The 0.01 g and 150 km/s values are hard-coded at `render-svg.js:491`.
- "Close" and "Accurate" do not exist.
- There is no launch window. The arc starts wherever the origin is right now and ignores where the destination will be.
- Transfers need `a_au` on both ends, so no moon or station can be a start or end. That rules out most real trips, such as Haven to Shudder.

At the epoch, the Kakakiko to Croquet Ball arc arrives at longitude 188°. Croquet Ball will be at 93°, **a miss of 95°**. The project's one-line promise is arriving matched, and this picture shows the opposite without saying so.

**Fix:** See the transfer planner in [section 7](#7-feature-suggestions-for-gms). The next window is the first piece: search forward from the current clock for the first departure where the arc meets the destination.

### C4. A saved file or draft can run code in the builder

**Reproduced. `site/manual/manual.js:148`**

```js
'<button type="button" class="drag" aria-label="Drag ' + (body.name || "body") + '">Drag</button>'
```

`body.name` goes into `innerHTML` unescaped. A file with this as a body name ran its script in the test:

```text
"><img src=x onerror="window.__xss=1">
```

It stays in `localStorage` too, so it fires again on each visit. This matters because trading system files is what a GM community would do.

All `ldjessee-code.github.io` projects share one browser origin. A script run here could also read and change Jumpgate Starroute's stored data on that origin.

**Fix:** Use `esc()` on that line, and have `esc()` also escape `>` and `'`. Better still, build cards with `createElement` and `textContent`. Add a Content-Security-Policy `<meta>` tag as a backstop.

### C5. The editor does not protect existing data

**Reproduced. `site/manual/manual.js:719-733`, `:760-810`, `:887-896`, `:603-615`, `:684-711`**

**Requirement, from the project owner:** the system editor must let you change a system, save those changes, and load them again. If data already exists, it must ask about a backup first. It must only make changes, and must never destroy, remove, or corrupt data.

Today, none of the actions that replace data ask first:

| Action | What happens today |
| --- | --- |
| Save over a system that was opened | Writes the file with no backup offer |
| Open another file over unsaved edits | Replaces the edits with no warning |
| Open a file the app cannot read, such as `orbit_match: 3` | Accepted. The editor went from 16 bodies to 0, and the current work is gone |

`manual.js` has no backup code, and `loadSystem` in that file never calls `schema.js`, so nothing checks a file's version before the editor is cleared.

**Fix:** Before Save, and before anything replaces work in the editor, offer "Back up and continue", "Continue without a backup", and "Cancel". The backup should be the file exactly as it was opened, under a dated name. Validate a file fully before touching the editor, and leave the editor alone if it is refused. Show the list of changes in the Save prompt so the user can see that only their edits will be written.

## 4. High findings

### H1. 3D playback reloads every model on every frame

**Reproduced. `site/viewer3d/viewer3d.js:893`, `:785`, `:1176-1179`**

Every clock change calls `rebuild()`, which destroys the whole scene, makes it again, regenerates dust clouds of up to 24,000 points, and calls `scheduleBodyModels()`.

- One "+10 days" click sent **10 new GLB requests**.
- Five seconds of play sent **85**, under slow software rendering. A real GPU at 60 fps would attempt far more.
- From the code: `modelGeneration` discards any model that has not finished before the next frame, so bodies should stay plain spheres during play. Each rebuild also restarts the 4K sky load if it is still in flight.

**Fix:** Build once, then only update positions on a clock tick. Keep a `Map` of body id to mesh, and move each mesh, its label, and the transfer line. Call `rebuild()` only when the frame, theme, or system changes.

### H2. Clicks do nothing in the SVG viewer during playback

**Reproduced. `site/viewer/viewer.js:45-59`**

While paused, a click on Croquet Ball opened its card. While playing, **0 of 8 clicks registered**. Each frame replaces the whole SVG through `innerHTML`, about 800 elements, so the element under the mouse at press is gone at release and the browser never sends a click. Hover readouts are lost the same way, and listeners are re-added on every paint.

The string building is not the problem: `renderSvg` measured about 0.9 ms.

**Fix:** Render the static layers once and update only moving `cx`, `cy`, and label positions per tick. As a stopgap, skip repainting while the pointer is held down.

### H3. "World facts" collapses on every keystroke

**Reproduced. `site/manual/manual.js:524-526`, `:555-558`, `:504`, `:533`**

Typing in Surface pressure, Oxygen, or CO2 calls `renderStack()`, which rebuilds the cards with `<details>` closed. After one keystroke the panel had closed and focus had dropped to `<body>`. You cannot type "0.85" into that field without reopening the panel each time.

The moon version also passes a moon field name to code that only looks for planet fields, so it cannot restore focus. Changing a moon's unit moves focus to the planet's period field.

**Fix:** Update only the `.air-note` paragraph on these inputs. Generally, avoid full re-renders for field edits. Keep track of which panels are open across the re-renders that remain.

### H4. three.js comes from a CDN, and failure blames WebGL

**Reproduced. `site/viewer3d/index.html:10-17`, `site/viewer3d/scene-model.js:26`, `site/viewer3d/viewer3d.js:1336-1338`**

`AGENTS.md` says three.js is vendored under `site/`. It is loaded from unpkg, with no integrity check. The footer says "Local First". With unpkg blocked, a machine with working WebGL shows "WebGL is not available". GMs often run games with poor connections.

**Fix:** Vendor `three.module.js`, `OrbitControls`, and `GLTFLoader` under `site/vendor/` and point the import map at them. A vendored copy needs no install step. Give script load failure its own message. Remove the unused `THREE_MODULE_URL`.

### H5. The app never tells you what day it is

**Reproduced. `site/viewer3d/scene-model.js:407-421`, `site/js/render-svg.js:606`**

There is no day counter in either viewer, no date field, and no return-to-epoch button. After advancing 10 days, the 3D legend still read "T+0 (epoch) · 3629-01-01 00:00:01". The SVG legend says "Angles are for reading, not a date", which has been wrong since the angles were locked at that epoch.

A GM mainly needs to know "where is everything on this date?", so this is a core gap.

**Fix:** Show elapsed days and an in-world date in the dock. Add a go-to-date field and a reset to epoch. Since `game_datetime` is only a display string, let the setting declare its calendar, or start with "Epoch + N days". Change the legend note based on whether angles are locked.

### H6. Inward Hohmann arcs start in the wrong place in the SVG view

**Reproduced. `site/js/render-svg.js:467-470`**

The arc always starts at the inner radius. For Croquet Ball to Kakakiko, the path starts at x=1145, beside Kakakiko, while Croquet Ball is at x=1276. The 3D code handles this correctly in `site/viewer3d/transfer-arc.js`, so use the same rule. A shared function would prevent the mismatch.

### H7. System files are not validated, and errors are hidden

**Reproduced. `site/js/schema.js:98,156-182`, `site/viewer/viewer.js:267-269`, `site/viewer3d/viewer3d.js:1348-1351`**

| Input | What happens |
| --- | --- |
| `e: 1.5` | Accepted. Positions are `NaN` |
| Duplicate ids, a missing parent, a body that is its own parent | Accepted silently |
| `position_angle_deg: -30` | The whole file is rejected |
| Any load error | "Open this page from the static server" |

Negative angles are common in real catalog data, so normalize them to 0-360 instead of rejecting them. Both viewers catch the real error and discard it.

**Fix:** Add `validateSystem()` that returns a list of `{ path, severity, message }`. Show those messages to the user. Only fatal problems should stop a load. This also becomes the checker for shared files.

### H8. SVG attributes are not safely escaped

**Reproduced as markup. Not currently reachable. `site/js/render-svg.js:14-19`, `:132`, and others**

`xml()` does not escape quotes, and it is used inside attributes. `display.color` and theme colors are not escaped at all, and the output goes to `innerHTML`. A crafted color broke out of its attribute in the test.

Today only deployed files reach this code. C1 will change that, so fix it first: escape `"`, and accept colors only if they match a color pattern.

### H9. The builder overwrites work without warning

**Reproduced in part. `site/manual/manual.js:840-844`, `:319-345`**

- There is one draft slot. Opening a deep link from a viewer card and making one edit replaced the stored draft with Tau Ceti (reproduced).
- Choosing a new star keeps the old star's high concept, faction, port, services, fuel, arrivals, and epoch (code, `applyRow`).
- There is no New System button, no undo, and Remove has no confirmation (code).

**Fix:** Store drafts by system. Reset the header in `applyRow`. Add New, undo, and a confirmation or undo toast on Remove.

### H10. The builder cannot describe much of what the viewers draw

**Reproduced. `site/manual/manual.js:138-187`, `:238-241`, `site/js/builder-link.js:216-242`**

| Need | Builder today |
| --- | --- |
| Eccentricity | No field, so every built orbit is a circle. Longitude of perihelion has no effect without it |
| Belts | Offers `belt`, but has only one AU field. Viewers need inner and outer edges, so the belt never appears |
| Mass and radius | No fields |
| Moon opened from a lore file | Blank distance and period. Shudder shows nothing |
| `physical.surface_g` and other lore facts | Not mapped. Kakakiko's Gravity field is blank |
| Kind `structure` | Not in the list, so Haven displays as `planet` |
| Habitable zone | Calculated in the builder, never saved, so viewers draw none |
| Stations and gates | Offered as `station`, `jumpgate`, `staryard`, while viewers expect `structure` |

**Fix:** Define one list of kinds and one field map, shared by builder and schema. Show fields by kind: belts get inner and outer, stations get a parent and km distance.

### H11. NASA data supplies only a planet count

**Reproduced. `site/manual/manual.js:319-345`, `site/manual/orbit.js:54`**

The builder reads star columns and `sy_pnum`, then creates that many blank cards. No planet values are read, because `pl_orbsmax`, `pl_orbper`, `pl_orbeccen`, `pl_bmasse`, and `pl_rade` are not used. The GM has to retype published values.

CSV parsing also fails silently on common files. A NASA download that starts with `#` comment lines, or a file with a byte-order mark, gives **0 stars** and no error message.

**Fix:** Skip `#` lines, strip the BOM, and report row counts. See [section 7](#7-feature-suggestions-for-gms) for the import design.

### H12. Tau Ceti is built into the code

**Reproduced for the star cases. `docs/DECISIONS_20261008.md` says the viewer does not hardcode ids, names, or one star.**

| Location | What is hard-coded |
| --- | --- |
| `viewer/viewer.js:253`, `viewer3d/viewer3d.js:1071` | `tau-ceti.view.json` for every system, including transfer `tc5` to `tc6` |
| `viewer3d/viewer3d.js:354,363-364` | Cards link to the Tau Ceti builder even when viewing another system |
| `js/builder-link.js:7` | `SYSTEM_FILES` allows only `tau-ceti` |
| `js/viewer-state.js:6`, `js/playback.js:77` | Default system id |
| `viewer3d/scene-model.js:580` | A star with no `name` shows as "Tau Ceti", even if it has a `hostname`. The builder writes only `hostname`, so every built system would be labeled Tau Ceti in 3D |
| `viewer3d/body-models.js:4-17,85-91` | Any star with no `model` gets the Tau Ceti GLB, and ids such as `tc5` map to models |
| `viewer3d/body-models.js:120` | `KAKAKIKO_LAYERS` is the default layer list |
| `viewer3d/scene-model.js:35-42` | Only G stars have color logic, so an M5V star draws yellow |
| `viewer3d/light.js:1`, `viewer3d/viewer3d.js:914` | All starlight is 5344 K |
| `viewer3d/scene-model.js:44-67` | Mardat and Empire palettes are in code, not theme files |
| `viewer/viewer.js:47,254-256` | Only quiet, holo, and empire load, and `view.theme` is ignored |
| `viewer3d/scene-model.js:318` | `resonant_clumps_with_eight_ball_au` |
| `viewer3d/scene-model.js:100` | Band name `phoebe_like` |
| `viewer3d/scene-model.js:414` | "T+0 (circa 1600 yrs hence)" |
| `viewer3d/scene-model.js:961-963` | Pencil note names `Tau_Cet_system_v2.md` |
| `viewer3d/ring-belt.js:242-276` | `tc6`, `tc7`, `tc8` |
| HTML titles, home page, `site/index.html:38` | "Tau Ceti" text and the "Turquenish" link |

**Fix:** Move these into the system or view file. Reuse the `starColor` logic in `orbit.js` and derive star color and light from `teff_k`. A good acceptance test is the existing 55 Cnc fixture: it should open with no Tau Ceti text or assets.

### H13. A typo in a number erases the value on save

**Reproduced. `site/js/builder-link.js`, `plainNum` and `systemRecordFromManual`**

`plainNum` turns anything that is not a number into `null`. Typing `0.7x` into Mass and saving writes `mass_solar: null`, with no error, so the old value is lost. Angles already stop the save. Other numbers should too.

**Fix:** Refuse to save, name the body and the field, and keep the old value.

### H14. Randomize all overwrites locked angles without asking

**Reproduced. `site/manual/manual.js:684-711`**

One click on "Randomize all planets" replaced Kakakiko's position angle, 8.13°, which is tagged `locked` in the file. It does this for every planet and moon, with no prompt. Because the change is autosaved to the draft, the old values are gone from the editor too.

**Fix:** Fill only blank angles by default. Ask before replacing existing values, and name any `locked` ones.

### H15. Removing a planet leaves its moons orbiting nothing

**Reproduced. `site/manual/manual.js:609-615`**

Removing Kakakiko deletes that card only. Shudder, Der, Haven, Yard, and Watch stay, each with a `parent` that no longer exists, so the saved file is broken.

**Fix:** Ask first, name the bodies that depend on it, and remove them together or refuse. The save should also reject a missing parent, which H7's `validateSystem` would catch.

### H16. Moons, angles, and typed star data do not count as edits, so they can be deleted

**Reproduced. `site/manual/manual.js:313-317`, `:347-361`, `:370`, `:498-529`, `:537-551`**

A planet created from a star's planet count is marked `generated`. Only some fields clear that mark. Moon edits and angle edits return early, before `body.generated = false`. The code then treats that planet as blank.

| Action | What happens today |
| --- | --- |
| Add a moon to a generated planet, then lower Known planets | The planet and its moon are deleted with no prompt |
| Set only an angle, then choose a star | The angle is replaced with no prompt |
| Type mass and temperature by hand, then choose a star | The typed values are replaced with no prompt, because `edited()` never looks at the star header |

**Fix:** Clear `generated` on any change, including moons and angles. Make `edited()` check the star header and moons. This breaks your rule that the editor must never destroy data.

### H17. A file that fails halfway leaves two systems mixed together

**Reproduced. `site/manual/manual.js:760-802`, `:887-894`**

`loadSystem` replaces the star header first and reads the bodies last. A file with `card: { services: "fuel" }` throws in between. The status says "That file is not a system JSON", which sounds safe, but the header is already gone. Pressing Save then wrote **Other Star with 16 Tau Ceti bodies**.

This is different from C5, where a bad file is accepted and the editor empties. Here the file is refused and the data is still corrupted.

**Fix:** Build the new header and rows in local variables. Assign them to `state` only after everything has succeeded.

### H18. Picking the same file again does nothing

**Reproduced. `site/manual/manual.js:880-896`**

Neither file input is reset after use, and browsers do not fire `change` when the same file is chosen twice. So "open my file, make a mess, open it again to get back" silently does nothing. The same happens after editing the file in another program. This is the reload half of your change, save, and load requirement.

**Fix:** Set `systemFile.value = ""` and `fileInput.value = ""` after reading. Combine this with the C5 prompt, because reopening replaces work.

### H19. A star built by hand cannot be named

**Reproduced. `site/manual/index.html:47-125`, `site/manual/manual.js:124-128`, `:728`**

The star's name, `hostname`, can only come from the star list, a file, or a link. The search box looks like a name field but does not set it. There are also no fields for star radius or x, y, and z, though the file format has them and radius feeds the goldilocks calculation.

You said a system does not have to start from NASA, but a hand-built one saves with `star.hostname: ""`. Every such file is named `system.system.json`, and the page title stays "No star yet". The star list is also fetched from another site, so this is the normal path whenever that list is unavailable.

**Fix:** Add name, radius, and position fields to the star card. Use the name for the file.

## 5. Medium findings

| ID | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| M1 | `fusionMatched` returns an answer when it fails. An impossible trip returned 255,957 days using 51,051 m/s on a 10 m/s budget. That day count is the search limit (`guard < 40`), so every impossible trip reports it. `kepler.js:205-208` | Reproduced | Return `{ ok: false }` when no solution is found. The card's "No matched burn" text already exists |
| M2 | The fusion path and card ignore the clock. At day 0 and day 500 the fusion path is identical, while the Hohmann arc moves. `render-svg.js:491`, `:740` | Reproduced | Pass `tDays` into `fuse()`. The card call also omits `system`, so it ignores the reference direction |
| M3 | A moon with no period orbits once per day. Nothing derives a period from `a_km` and the parent's mass. `schema.js:83-88`, `render-svg.js:235` | Reproduced | Derive it when the parent has mass. Otherwise warn. Don't fall back to 1 day |
| M4 | `finite()` turns `null` and `""` into 0. A catalog row gets `mass_solar: 0`, `dist_pc: 0`, and `x_ly: 0`, ignoring `calculated_x: 10`. `system-source.js:63-66`. Not reachable from the UI yet | Reproduced | Use the null-safe `num()` from `schema.js` |
| M5 | SVG orbit rings are circles at `a`, while bodies follow ellipses, so bodies leave their rings. Barely visible for Tau Ceti, but obvious with eccentric exoplanets. `render-svg.js:190`. The 3D view is correct | Code | Sample the real path as the 3D code does |
| M6 | Bodies without `position_angle_deg` ignore `reference_direction.deg`, which contradicts `docs/FORMATS.md`. `render-svg.js:89` | Code | Apply the rotation on both paths |
| M7 | The jumpgate is not tied to Croquet Ball. Its derived period is 1937.67 days against 1939.48, so it drifts about 6° per century, and more if the partner is eccentric. `display-angles.js:42` | Calculated from the file's periods | Compute a Lagrange body from its partner's position plus 60° at each time |
| M8 | Builder rounds AU to 3 places, so a hot planet at 0.0154 AU becomes 0.015, a 2.6% error. Editing period or AU also overwrites the other, which can clobber lore values. `manual.js:482` | Code | Keep significant figures. Offer a lock on either field |
| M9 | SVG Zoom and Elevation are disabled, and azimuth has no control. `viewer/index.html:38-39`. Q2 in the decisions file made orbiting the camera a condition | Reproduced | Implement them or remove them. Disabled controls read as a bug |
| M10 | SVG usability: Cue Ball and Croquet Ball labels overlap, and The Sombrero's label collides with Kakakiko's. At 1400x900 the picture runs below the fold, and at 390 px the text is unreadable with no zoom | Reproduced (screenshots) | Add label collision handling, fit the SVG to the viewport, and add pan and zoom |
| M11 | Deep links don't respond to hash changes. Changing the hash on an open builder page leaves the old system in place. `manual.js:923` | Reproduced | Add a `hashchange` listener |
| M12 | Handoff formats disagree. `BRIEF.md` documents `{ handoff: 1, star: {...} }`, while the code reads a flat `kind: "system_handoff"` record. The builder's Open reads neither. `tag`, `imp`, and `exp` hash parameters are dropped | Code | Pick one format, document it, and have the builder accept it |
| M13 | `?jumpgate=` and the `localStorage` peer URL are documented as working, but no code reads them. No hand-back of `system_file` exists | Reproduced by search | Implement them or mark them planned |
| M14 | The dev server dies on a malformed URL: `/%E0%A4%A` exits the process with code 1. `/viewer` without a slash gives 404. `serve-site.mjs:20` | Reproduced | Wrap `decodeURIComponent` in try/catch, and redirect directories |
| M15 | A personal path is published: `F:\Dropbox\Projects\...` appears in `site/data/tau-ceti.system.json` and `tau-ceti.stability.json` | Reproduced | Store a relative name or a document title |
| M16 | `launch-tau-ceti.ps1`, the guard's default repo, and `AGENTS.md` point to `C:\Users\DougJ\Documents\GitHub\orbit_match`, which does not exist on this machine. The repo is at `F:\Projects\orbit_match` | Reproduced | Resolve from `$PSScriptRoot`, or update the paths |
| M17 | Guard gaps. `git --no-pager push origin main` and `git update-ref refs/heads/main HEAD` are allowed. So are shell writes outside the repo (`Set-Content`, `>`, `Move-Item`). A malformed event passes because the guard fails open. `orbit-guard.ps1:55,222` | Reproduced | Allow only known git forms. Fail closed. Add tests for these cases |
| M18 | Accessibility: SVG bodies and 3D objects can't be reached by keyboard, there is no text list of bodies as an alternative, context help is click-only, and no `prefers-reduced-motion` or `:focus-visible` CSS exists | Code | Add a selectable body list beside both viewers, which also helps every user. `audit-suite:audit-as-a11y-eng` could go deeper |
| M19 | Licensing is unclear. Root MIT covers the repo, while the footer reserves the Turquenish setting, and GLB and sky art have no stated license. Someone could read the lore and models as MIT | Code | Add a note saying what MIT covers, with art and lore licensed separately |
| M20 | A planet with a period but no distance vanishes. It counts as having a distance, so `skipped` stays empty, yet neither viewer draws it. Many NASA planets have `pl_orbper` and no `pl_orbsmax`, so this will matter as soon as H11 is fixed. A heliocentric body with only `a_km` vanishes the same way, and so does a moon with only `a_au`. `schema.js:76-81`, `scene-model.js:185-191` | Reproduced | Derive `a_au` from the period and star mass, and report anything that still cannot be drawn |
| M21 | `L5` is drawn at `L4`. The partner angle always gets +60°, so a body at L5 of a planet at 100° lands at 160°, not 40°. Tau Ceti's gate says "L4 or L5" and its point is still `tbd`, so a future decision would change nothing on screen. `display-angles.js:44` | Reproduced | Read `lagrange.point`. Show the guess as a guess when the point is not set |
| M22 | The fusion time is not always the shortest. The required thrust does not fall steadily with trip length, so the bisection can land on a later answer. Cue Ball to Gane at day 1000 reports **520.5 days**, while a 140.25-day trip meets the same limits. This hit 15 of 224 planet pairs and start dates tested. `kepler.js:202-214` | Reproduced | Scan trip lengths for the first one that works, then refine. Separate from M1, which is about no solution at all |
| M23 | The periapsis label is on the wrong side of the planet. It is placed on the +X axis and ignores the orbit's direction. Shudder's "120848 km" label sits **341 px** from its real periapsis on a 1600 px picture, and it reads as a point inside the orbit. `render-svg.js:302-306` | Reproduced | Place it with `perihelion_longitude_deg` and the reference direction |
| M24 | A moon with no `unit` shows as Days but loads as years. A `6.6` becomes 2,410.65 days, and switching the unit in the builder leaves the number unchanged. `schema.js:42`, `manual.js:206`, `orbit.js:110` | Reproduced | Use one default for moons in all three places |
| M25 | Rewording the epoch deletes its date. Any change to the Epoch text replaces the whole object with a string, which drops `game_datetime`, `t0_days`, and `canon: locked`. `builder-link.js:142-149` | Reproduced | Change only `label`. Add a separate date field |
| M26 | Sky and model paths accept remote addresses. `https://example.com/x.png` and `.glb` pass, and so does `javascript:alert(1)` as a sky path, though `CROSSWALK.md` says these are local paths. Harmless while only your files load. Once C1 lets people open shared files, a file can make a viewer contact any server. `sky.js:352-355`, `body-models.js:67-73` | Reproduced | Allow relative paths only, and reject anything with a scheme |
| M27 | Inclination, axial tilt, and rotation are parsed and never used. `i_deg`, `tilt_deg`, and `rotation_h` appear only in the number lists in `schema.js`. Every orbit is flat, rings always lie in the orbital plane, and Kakakiko's 12° tilt is not drawn. The 3D view therefore cannot show one of the things 3D is best at, and NASA supplies `pl_orbincl` | Reproduced | Apply inclination to orbit paths and tilt to models and rings. Until then, tell the user these fields are not drawn |
| M28 | Bodies that share a layer key share one switch. Two bodies with a `clouds` layer get two checkboxes that control the same value, and one body's default overrides the other's. `body-models.js:168-174`, `viewer3d.js:867` | Reproduced | Key layer state by body and key |
| M29 | Star map links overwrite work. `applyHashOverlay` runs again whenever a CSV loads, so a changed Faction went back to the link's value. Arriving on a `#h=1` link also skips the saved draft and then replaces it. This second path is not the one in H9. `manual.js:418`, `:847`, `:456` | Reproduced | Apply a link once, at load. Use the C5 prompt before replacing a draft |
| M30 | Changing the star's mass leaves every orbit inconsistent with no warning. Setting Tau Ceti to 1.5 solar masses kept Kakakiko's period at 247.4 days and its AU at 0.71, which no longer agree. `manual.js:469-472` | Reproduced | Warn, and offer to recalculate periods or distances. Respect locked values |
| M31 | More validation gaps, in addition to H7. A negative `a_au` gives a `NaN` period, and a negative star mass gives a `NaN` trip. Versions `0`, `-3`, and `1.5` are accepted. One `null` in `bodies` rejects the whole file. Any belt saved from the builder prints **`NaN–NaN AU`** in the legend. `schema.js:83-87`, `:185-193`, `render-svg.js:594` | Reproduced | Add these cases to `validateSystem()`, and skip belts with no edges in the legend |
| M32 | Handoff loading loses and repeats bodies. A belt in a handoff's `bodies` array is dropped, and a planet in both `planets` and `bodies` appears twice with the same id. `system-source.js:105-119` | Reproduced | Keep belts, and remove duplicates by id |
| M33 | A star appears once per CSV row. NASA tables have one row per planet, so a three-planet star was listed three times. Rows with only `sy_name` are dropped, although the search looks at that column. `orbit.js:60`, `manual.js:377-381` | Reproduced | Group rows by host. H11's import needs this anyway |
| M34 | **New.** Editing a moon's period on its own card gives it a distance from the star. Opened files list moons as top-level cards, and `syncOrbit` treats every card as a planet. Setting Shudder's period to 6.7 wrote `au: 3.272`. The unit also shows Years (M24), so the 6.7 days is read as 6.7 years. The value is saved and corrupts the moon. `manual.js:479-489`, `:560-561` | Reproduced | Skip `syncOrbit` for any body with a parent, and use the parent's mass if a moon's distance is derived. Part of the H10 field map |
| M35 | **New.** A deep link that fails to load leaves the editor blank and never restores the draft. The next edit saves over the draft, so the user's work is gone. This is a different path from H9 and M29. `manual.js:834-837`, `:840-844` | Reproduced | Call `restoreLocal` in the `catch`, and do not autosave until something has loaded |

## 6. Low findings

- **L1.** `airAdvice` treats a blank oxygen field as 0%, so entering only pressure reports a lethal atmosphere. Say "enter oxygen" instead.
- **L2.** `clockDays` gives `-t0_days` at elapsed 0, so a system with non-zero `t0_days` opens away from its own epoch.
- **L19.** Both viewers request `tau-ceti.handoff.json` on each load and get a 404. Harmless, but it clutters the console.
- **L20.** `viewer.js:47` and the SVG renderer ignore `legend_corner`, `distance_mode`, and the `grid` layer.
- **L21.** `render-svg.js:272` assumes every structure shares the first structure's orbit.
- **L22.** `render-svg.js:660` leaves an unused `kind` variable.
- **L23.** The 3D render loop runs continuously while idle, which costs battery on a laptop at the table. Measured at 2,880 draw calls in one idle second under software rendering. Render on demand.
- **L24.** `pointermove` raycasts into all GLB children on each event. Throttle it, or pick against simple spheres.
- **L25.** `jumpgate-ring-v4.glb` is 6 MB and all models total about 17 MB. 15.8 MB in 10 files were requested at start. Load on focus, or compress.
- **L26.** `readHeader` and `onStackInput` are bound to both `input` and `change`, so most edits run twice.
- **L27.** `restoreLocal` calls `localStorage.getItem` outside its `try`, so blocked storage throws. The rest of the script stops, and the star list never loads. `manual.js:848`
- **L28.** `viewer-state.js`: a playing tab ignores other tabs and overwrites them, including the clock of a different system. A paused tab is fine.
- **L29.** The dock leaves a 112 px gap above the picture, from reserved status lines.
- **L30.** The footer's `v2.0` is hand-written, and viewers have no footer.
- **L31.** The 3D controls are unusual (left drag pans, right drag rotates) and have no on-screen hint.
- **L32.** Help covers the builder only. Viewers have no `?` button, and the Help page does not explain transfers or the viewers.

### Low findings from the second pass

Reproduced, with a failing test:

- **L3.** The fallback starfield is 7.9 times denser at the poles, because stars are placed evenly by pixel. Every system without its own sky uses it. Pick latitude from `asin(2u - 1)`.
- **L4.** `isGlbRingNode` matches any name containing "ring", so a model part such as `SM_spring_tree` is hidden.
- **L5.** A moon with a stored angle but no period is in different places in the two viewers: 90° in 3D and 29.8° in SVG at day 30.25. SVG falls back to 365.25 days and 3D to 1 day. M3's fix should cover both.
- **L6.** The SVG legend is 1,176 px tall for 60 bodies on a 1,000 px picture. It runs out of room at about 48 rows, and the builder allows 40 planets before moons and belts.
- **L7.** `density: null` in `createRingBelt` means no points, because `Number(null)` is 0. This is the same mistake as M4. Not reachable from the UI yet.
- **L8.** A moon of a moon is dropped without warning during migration, though a comment in `builder-link.js` mentions nested moons.
- **L10.** A moon with `a_au` gets a period from the star's mass, 0.048 days in the test, not from its planet's mass.
- **L11.** `starColor` takes the first spectral letter anywhere in the text, so `unknown` is read as a K star and `TBD` as a T dwarf.
- **L12.** No page has an icon, so every page load gets a `favicon.ico` 404. There is also no `404.html`.
- **L13.** The builder's menu has no link to either viewer.
- **L14.** A bad angle stops the save with "position_angle_deg is not a valid angle." It does not say which of the bodies is wrong.
- **L15.** A trip from a body to itself draws an arc and reports 123.7 days. The C3 planner should block this.
- **L16.** The 3D view has a "True AU" mode and a warning for it, but no control. It can only be reached by editing the view file. In that mode tc1 to tc5 are inside the star, which has a scene radius of 0.7.
- **L17.** A planet's angle error stays on screen after the angle is fixed, if the card was redrawn in between. The redrawn `<p>` lacks the `data-angle-error` attribute that the moon version has. `manual.js:168`
- **L18.** Saving gives no confirmation. The status line still shows the previous message.

Reproduced in the third pass, with a failing test:

- **L9.** Every stored angle is rounded to 2 decimal places on load, so 12.3456 becomes 12.35, and 359.996 becomes 0. This may be deliberate, but it changes data the user entered, so it needs your decision under the no-corruption rule. If it is deliberate, delete the L9 test.
- **L33.** A missing star mass silently becomes 1 solar mass for periods and trips, in `schema.js:86`, `render-svg.js:463`, and `manual.js:92`, with nothing on screen. `CROSSWALK.md` says no mass is invented. Show "assumed 1 solar mass" at least.
- **L34.** An unnamed body has no label in either viewer, and `infoLines` returns `undefined` as its first line. The builder allows blank names.
- **L35.** In 3D, a transfer card left open when entering a close view reads "unknown", because `transfers` is empty there. Its link then points at `transfer:hohmann` as if it were a body.
- **L36.** Moonlets all sit on the +X axis in both viewers and never move with the clock.
- **L37.** The fusion burn is drawn with the wrong share of the path. `render-svg.js:477` divides by 40 while `sampleFusion` uses 48 steps, and `slice(0, burn)` loses one more step. The burn is drawn **too short**: 5 steps where it needs 7.1. The earlier note here said 20% too long, which was wrong.
- **L38.** During playback, each rebuild requests the sky image again until the first request finishes, because `equirectTex` is empty until then. If the image fails, this never stops: 3 clicks sent 3 more requests. This adds to H1. `viewer3d.js:1029-1035`
- **L39.** The 3D view has no `webglcontextlost` handler, so a laptop waking from sleep can leave a black canvas.
- **L40.** The 3D view resizes on window events only, not when the stage changes size. With a 600 px stage the canvas stayed 1,364 px wide.
- **L41.** The 3D page's menu link to the SVG viewer drops `?system=`, so it returns to Tau Ceti. The "SVG view" button keeps it. The SVG page has no menu link to 3D, only its "3D view" button.
- **L42.** The builder and the data disagree on Tau Ceti's goldilocks zone: 0.66 to 1.17 AU calculated, 0.68 to 1.22 AU in the file.
- **L43.** A file name is built from `\w`, so `τ Cet` saves as `_Cet.system.json`, which `safeSystemFile` then rejects.
- **L44.** Oxygen and CO2 have no range check. 150% oxygen gives advice with no error, and so does 60% oxygen plus 60% CO2.
- **L45.** `saveLocal` ignores a full `localStorage`, so the draft can stop saving with no warning.
- **L46.** `saveFile` revokes the object URL right after `click()`, and the link is never added to the page. This works in Edge but is a known risk in other browsers, which this review did not test.
- **L47.** The empire theme's card border is `#7FD3FF` on `#EEF1F5`, a contrast of 1.46:1. Mardat's accent on its panel is 1.38:1. Text contrast is fine in both.
- **L48.** **New.** The Hohmann card's leader line ignores the clock. `transferBlock` uses the epoch angle while the arc uses the current one, so at day 120 the line ends 262 px from the arc. `render-svg.js:739`
- **L49.** **New.** Changing a planet's Kind to `moon` hides its moons at the next redraw, with no prompt. They stay in the data with no card, so they cannot be edited or removed. The Kind change itself does not redraw, so the moons vanish later, on an unrelated action. `manual.js:197`, `:552-570`

Found by reading, with no test:

- **L50.** **New.** A body framed by double-click in 3D is not followed. `controls.target` is set once, so during playback the body moves away from the center of the view. `viewer3d.js:1266-1269`. Testing this needs the camera state, which the page does not expose.
- All Pages sites under `ldjessee-code.github.io` share one origin, so Orbit Match and Jumpgate share `localStorage`. C4 would therefore reach Jumpgate's stored data too. This comes from the hosting, so it cannot be tested here.

**A data question for you:** Der Eindringling works out to 7.19 g/cm³ from its mass and radius, denser than Earth and close to solid iron. Its values are tagged `est`, so this may be intended, but it is the one number in the file that looks odd.

### Code health

- **Duplication between viewers.** `render-svg.js` and `scene-model.js` each have their own `heliocentric`, `schematicMap`, `spotAt`, `usesAngle`, `referenceDeg`, `byId`, and `auText`. `viewer.js` and `viewer3d.js` duplicate `fetchJson`, `loadRequestedSystem`, `paintCrumbs`, `crumbText`, and `probeWebgl`. H6, M5, and M6 are the direct cost of this: one copy was fixed and the other was not. Extract `site/js/orbit-model.js` for position and transfer logic and `site/js/viewer-common.js` for the shared page code.
- **Backwards dependency.** The SVG fallback imports from `viewer3d/scene-model.js`. Move the shared parts to `site/js/`.
- **Large files.** `viewer3d.js` is 1,354 lines with more than 30 module-level variables. `manual.js` is a 939-line closure that mixes state, HTML strings, and events, which is why it has no real tests. Split out pure functions first.
- **Five escaping functions.** `xml`, `esc` (twice), and `crumbText` (twice) behave differently. Use one.
- **Two module styles.** Builder pages use classic scripts with `window.OrbitBuilderLink`, and viewers use ES modules. Decision Q3 chose modules, so finish moving `manual.js`.
- **Dead code.** `sky-ab-temp.js` is unused but marked for removal, and its tests and 1.2 MB of cube PNGs still ship. `detectLowResource`, `storedViewerMode`, the `orbit-match-viewer-mode` key, `window.OrbitKepler`, and `tau-ceti.stability.json` have no live reader.
- **Copied code in one file.** `mountDustBelts` repeats the body of `placeDustCloud` in `viewer3d.js`.
- **`site.js` and `shell.js`** do the same job.
- **`YEAR_DAYS`** and period math exist in three places.

## 7. Feature suggestions for GMs

Your stated goal is GURPS 4e or Traveller first, with the program staying neutral. The biggest wins, roughly in value order:

### Transfer planner

This is the product's identity, and it should be the next big feature.

- Pick any two bodies from a list, including moons and stations, plus a departure date.
- Pick a travel model:

  | Model | Used for | Math |
  | --- | --- | --- |
  | **Constant thrust, flip at midpoint** | Traveller and most GURPS ships | `t = 2 * sqrt(d / a)`, peak speed `sqrt(d * a)` |
  | Burn, coast, burn | Fuel-limited ships | Already in `fusionMatched` |
  | Hohmann | Low-tech and "hard" settings | Already present |

  The constant-thrust model is the single most useful addition, and it is missing today. Kakakiko to Croquet Ball at closest approach, about 2.09 AU, takes roughly 4.1 days at 1 G. It is simple enough to add first, and it answers the table's commonest question.
- Enter the drive as numbers the table already uses: acceleration in G and delta-v or fuel.
- Output: duration, arrival date, delta-v, peak speed, and a table of "if you leave on this date".
- A porkchop-style chart of departure date against trip time would show windows at a glance.
- A "current distance between bodies" readout for any two bodies on any date would help on its own.

### NASA and catalog import

- Keep a dated snapshot of the Exoplanet Archive's `pscomppars` table under `site/data/`, so the feature works offline and needs no server. I did not check whether the archive allows direct browser requests, so don't depend on a live call without testing it.
- On choosing a star, fill planets with `pl_orbsmax`, `pl_orbper`, `pl_orbeccen`, `pl_orblper`, `pl_bmasse`, `pl_rade`, and `pl_name`, each tagged `canon: real`.
- Handle gaps. Many planets lack eccentricity or radius, so derive and tag them `est`, using the existing canon system.
- Support more than one star. The format has a single `star`, but many exoplanet hosts are binaries, and `CROSSWALK.md` already notes 55 Cnc as one.
- Support retrograde orbits. A negative period is ignored today and replaced with a default, so a backward-orbiting moon cannot be described.
- Add a "Refresh from NASA" that shows differences and never overwrites `locked` fields.

### System creation assistant

The brief's layered generator with locks is the right idea.

- Add a "Generate" step per layer: star, orbits, worlds, moons, society. Each field gets a lock, reusing `canon: locked`.
- Use a seeded random generator so that a shared seed reproduces a system. `mulberry32` already exists in `sky.js`.
- Offer "Fill the gaps": keep NASA's real planets, and add plausible extra worlds and belts around them.
- Add stability warnings: orbits too close together, moons outside the Hill sphere, or inside the Roche limit.
- Add derived facts: surface gravity from mass and radius, blackbody temperature from luminosity and distance, year length, orbital speed. The manual `gravity` field stays as text today.

### Game-system neutrality

- Keep the plain facts as the source of truth, as the brief says.
- Add small **rules profile** JSON files in the same way as themes. Each maps plain facts to a game's display: Traveller's profile code, or a GURPS planetary record with G and Control Rating.
- Add exports: Traveller's UWP-style line, a GURPS Space-style block, and a neutral Markdown or PDF sheet. Keep them as derived output, and keep publisher rule text out of the repo, as `GAME_SYSTEMS.md` already says.
- Add custom fields per setting, so a table can record what its game needs without a code change.
- Add a jump-limit circle for games that use one: an option on each body, such as 100 diameters. It is a common Traveller question and cheap to draw.

### Lore and settings

- Define a **setting pack**: a folder or single JSON with `systems`, `themes`, `factions`, a calendar, a rules profile, and links to lore.
- Add a setting picker to the home page, and a "load a setting" file input.
- A calendar in the pack would solve H5 properly.
- Add a body notes field, with Markdown and player-visible or GM-only flags.

### At the table

- **Player view:** hide GM-only bodies and notes, and show a shareable link or a second window kept in sync by `BroadcastChannel`.
- **Printable handout:** system map plus body table.
- **Ship markers:** a named ship on a planned route, moving with the clock.
- **Bookmarks:** "the night the war started" as a saved date.
- **Top-down view:** elevation stops at 75°, so a flat map view is not possible. It is the easiest way to read angles at the table.
- **Export:** PNG and SVG of the current view. The render functions already produce SVG.
- **Offline install:** vendored three.js plus a service worker would make the "Local First" claim true.
- **System library:** a list of saved systems in IndexedDB, with import and export.

## 8. Docs, tests, CI, and repository

### Docs that no longer match the code

| Document | Says | Reality |
| --- | --- | --- |
| `docs/PHASE_STATUS_20261008.md` | Phases 3 to 5 "not started" | Phases 3 and 4 clearly shipped. Phase 5 did not |
| `AGENTS.md` | three.js is vendored | Loaded from unpkg |
| `README.md` | Three trip fidelities, in the present tense | Only a fixed Hohmann and fusion card |
| `README.md`, `BRIEF.md` | The system is handed back to Jumpgate | No such code |
| `BRIEF.md` | Ordinary script tags, opens from disk | ES modules, needs a server (decision Q3) |
| `BRIEF.md`, `TODO_PORTS.md` | Peer URL from `?jumpgate=`, then `localStorage` | Only `config.json` is read |
| `docs/DECISIONS_20261008.md` | Phase 5: the builder writes version 2 | It writes version 1, as `docs/FORMATS.md` says |
| `docs/DECISIONS_20261008.md` | Phase 4: "No `.glb`" | 12 GLBs ship, with no recorded change of decision |
| `docs/DECISIONS_20261008.md` | "Renderer does not bake one palette" | Mardat exists only in code |
| `docs/FORMATS.md` | "Unknown keys are kept" | Not by the builder (C2) |

A user-facing "what works today" list in the README would prevent most of this.

### Tests

The test count is healthy, and the pure modules are well covered. The weakness is that **every bug above passed a green suite**, for two reasons:

- Many UI tests read source files as text and check them with a regex, for example `assert.match(client, /starfieldSpec/)` in `test/viewer3d.test.js`. They prove a word exists, not that the feature works. `manual.js` is tested only this way.
- Nothing tests a full round trip or a real browser.

Add these first, each of which would have caught a finding here:

1. Builder load, save, load deep-compare (C2).
2. Hostile strings in every field, with an assertion that no element or attribute is created (C4, H8).
3. Inward and outward transfers start at the origin body (H6).
4. A non-Tau-Ceti fixture with zero Tau Ceti output (H12).
5. A browser smoke test. The scripts for this review needed only Node built-ins and the installed Edge through the DevTools protocol, so this fits the "no installs" rule. It can be local-only if CI is a problem.

### CI

`.github/workflows/pages.yml` deploys `main` **without running any tests**, and `review` has no workflow at all. Add a job that runs `node --test "test/**/*.js"` and `tests\hooks.tests.ps1` on pushes to `review`, and make deploy depend on it. Neither needs an install step.

### Repository

- `tasks/` and `system_view_mockups/` track about **228 MB**, and `.git` is 107 MB, for a 20 MB site. Move them out, or to Git LFS or a release asset, for future commits. A history rewrite is your call, and `AGENTS.md` rightly stops bots from doing one.
- `__pycache__` and `.pyc` files are tracked, and `.gitignore` has only three OS entries. Add `__pycache__/`, `*.pyc`, and `node_modules/`.
- Both `test/` and `tests/` exist, which invites mistakes. `tests/viewer3d/*.ps1` are pinned to a finished job folder and can't run elsewhere.
- `tools/moon_lore_v241b` looks superseded by `v241c`. The Python tools have no README saying what produced what.
- Workflow actions use version tags, not commit hashes. That is low risk here, but hashes are safer.

## 9. Suggested order of work

Each step follows the repo rule: failing test first, small commits on `review`.

**Step 1: Stop the damage (small).** C4 and H8 escaping, C2's version 2 writer and non-destructive save, C5 backup prompts and safe opening, H3 panel collapse, H9 draft safety, H13 to H19 data guards, M25 epoch safety, M29 link safety, M34 moon distance, M35 failed link safety, CSV `#` and BOM handling, M14 server crash, M15 path removal. Add CI at the same time.

**Step 2: Make playback right (medium).** H1 and H2 by moving positions instead of rebuilding, H5 day and date display, H4 vendored three.js, H6, M2, M22, and M23 transfer fixes. Extract the shared orbit module here, because these fixes touch the duplicated code anyway.

**Step 3: Connect the app (medium).** H7 and M31 validation, M26 local paths, then C1 file loading and "View this system", H12 removing Tau Ceti assumptions, H10 builder fields, and M20, M21, M24, M30, M32, and M33. After this step, any user can build a system and see it.

**Step 4: Deliver the promise (large).** The C3 transfer planner: constant thrust first, then bodies at any level, then windows and the arrival burn. Update the README to match what ships.

**Step 5: Serve GMs (large).** NASA planet import, setting packs and calendars, rules profiles and exports, then the player view, and the layered generator.

## 10. Checked and found fine

These were suspected during the review and turned out not to be problems:

- **Kepler solver and Hohmann math:** correct, and the 481-day card matches.
- **Server path traversal:** the `normalize` and root check holds.
- **`safeSystemFile` and `cleanModelPath`:** they reject traversal.
- **3D inward arcs:** correct, unlike the SVG version.
- **SVG string building:** about 0.9 ms, so it is not the bottleneck. `buildScene` takes about 0.4 ms.
- **GPU texture leak on rebuild:** ruled out for the models checked, which use base color textures only, and `disposeMaterial` handles those.
- **`git -C` and `--git-dir` guard bypass:** both denied. The real gaps are in M17.
- **Page-wide horizontal overflow at phone width:** none on the viewer or builder.
- **`manual.js` script order:** the deep-link path waits for `DOMContentLoaded`, so the module is ready.
- **Elevation limits:** the 15-75° mapping to polar angles is correct.
- **Kepler solver at high eccentricity:** accurate to 2e-15 up to e = 0.9999, with no `NaN`.
- **Position angles:** a stored angle returns exactly at the epoch, at any eccentricity tested.
- **Fusion delta-v budget:** never exceeded in 224 trips. M22 is about trip time only.
- **Mean anomaly:** suspected of being misread as a position angle. `pos` treats it correctly.
- **Local references:** every `href`, `src`, CSS `url()`, module import, model, and sky path resolves, with exact case, so the Windows and Linux hosts agree.
- **Tau Ceti's numbers:** periods match Kepler's law to 0.2%, both moons imply a parent of 1.05 Earth masses against 1.045 in the file, Haven's 54,076 km orbit gives 34.01 hours against a 34-hour day, and Kakakiko's surface gravity matches its mass and radius. Every `canon` and `lore.copied` path exists.
- **Parent loops:** a body that is its own parent, or two that orbit each other, does not hang either viewer. They are just not drawn, which H7 covers.

## 11. Failing tests for these findings

Added 2026-11-05 and extended 2026-11-06. Two test files describe the correct behavior, so they fail until each bug is fixed. **Fixing a bug should turn its tests green.** No site code was changed.

| File | Runs in | Tests | Fails today |
| --- | --- | --- | --- |
| `test/review-findings.test.js` | Node only | 147 | 146 |
| `test/review-browser.test.js` | Real pages in headless Edge, using Node built-ins. Skips if Edge is not installed | 54 | 54 |

Each test name starts with its finding id. Each failure was read to confirm it fails because of the bug, not because of a mistake in the test.

The one passing test is `C2 guard`, and it passes on purpose. C2's fix merges into the stored `orbit`, and done carelessly, that would let the stored value overwrite an edit. The guard must stay green through that fix.

**`node --test "test/**/*.js"` now exits 1 on purpose:** 333 tests, 133 pass, 200 fail. All 132 older tests still pass, and `tests\hooks.tests.ps1` still exits 0. This means the Definition of Done in `AGENTS.md` cannot be met until these tests pass or are moved.

```powershell
# Only the review tests
node --test test/review-findings.test.js test/review-browser.test.js

# One finding
node --test --test-name-pattern "^C2:" test/review-findings.test.js test/review-browser.test.js
```

### Finding to test map

| Finding | Node tests | Browser tests | What the failure shows today |
| --- | --- | --- | --- |
| C1 | 2 | 2 | No file input in either viewer, no "View this system", and the error blames the static server |
| C2 | 6, plus the guard | 1 | Saved file differs from the source, version 1 is written, `orbit` is replaced on migration |
| C3 | 4 | 0 | No trip control, arc ends 482 px from the destination, moon cannot start a trip, fixed thrust |
| C4 | 2 | 1 | Script from a file ran in the builder, and `esc()` skips `>` and `'` |
| C5 | 0 | 3 | No backup prompt, no replace prompt, 16 bodies became 0 |
| H1 | 0 | 1 | 10 model requests from one click |
| H2 | 0 | 1 | 0 of 4 clicks registered during play |
| H3 | 0 | 3 | Panel closes on a keystroke, and moon fields lose focus |
| H4 | 2 | 1 | `unpkg.com` in the page, an unused CDN constant, and a blocked script reported as no WebGL |
| H5 | 3 | 1 | No day shown, the legend says "not a date", the 3D legend never changes, no date or reset control |
| H6 | 1 | 0 | Inward arc starts 131 px from the origin |
| H7 | 3 | 1 | `e: 1.5` draws `NaN`, no `validateSystem`, `-30` is fatal, real error is hidden |
| H8 | 1 | 0 | A crafted value adds an `onmouseover` attribute |
| H9 | 2 | 3 | Draft replaced, old faction kept, Remove does not ask, no New system, no undo |
| H10 | 5 | 1 | Haven opens as `planet`, moons blank, Gravity blank, no eccentricity, belt, mass, or radius fields |
| H11 | 3 | 1 | `#` lines and a BOM give 0 rows, planet columns unread, an empty result gets no warning |
| H12 | 18 | 0 | Each table row except the default system id, including `hostname` ignored and the 55 Cnc fixture getting the Tau Ceti model |
| H13 | 2 | 0 | `0.7x` saves with no error, in star and body fields |
| H14 | 0 | 1 | Locked 8.13° changed without asking |
| H15 | 0 | 1 | Kakakiko is gone, Shudder stays |
| H16 | 0 | 3 | Planet and moon deleted, angle and typed star data replaced with no prompt |
| H17 | 0 | 1 | Other Star saved with 16 Tau Ceti bodies |
| H18 | 0 | 1 | The file input keeps its value |
| H19 | 0 | 2 | No field for the star's name, radius, or position |
| M1 to M9 | 11 | 1 | Includes the 255,957-day impossible burn, 6.3° gate drift per century, and 0.015 shown for 0.01539 AU |
| M10 | 1 | 1 | Cue Ball and Croquet Ball labels overlap, and the picture runs 187 px below the window |
| M11 | 0 | 1 | Hash change loads nothing |
| M12 | 2 | 0 | The format in `BRIEF.md` is not read, and `tag`, `imp`, and `exp` are dropped |
| M13 to M18 | 10 | 0 | Includes the dev server exiting on a bad URL, `/viewer` giving 404, and guard gaps |
| M19 | 1 | 0 | Nothing says what MIT does not cover |
| M20 to M28 | 14 | 0 | Includes vanished bodies, L5 at 160°, 520.5 days against 140.25, a label 341 px off, and 2,410.65 days for a 6.6-day moon |
| M29, M30 | 0 | 3 | Link values replace an edit and the draft, period stays 247.4 |
| M31, M32 | 7 | 0 | `NaN` from bad values, versions 0, -3, and 1.5 accepted, belt dropped, planet doubled |
| M33 | 1 | 1 | Three list rows for one star, and `sy_name` rows dropped |
| M34, M35 | 0 | 2 | Shudder gets 3.272 AU, and the draft is replaced after a failed link |
| L1 to L18 | 16 | 2 | Includes blank oxygen read as lethal, stars 7.9 times denser at the poles, and a legend 1,176 px tall |
| L19 to L49 | 20 | 14 | Includes 2,880 idle draw calls a second, 15.8 MB of models at start, and a leader 262 px off the arc |
| CI and repository (R1 to R6) | 6 | 0 | No workflow runs tests, deploy has no `needs:`, 10 Python cache files tracked, actions not pinned |
| Docs (D1 to D3) | 3 | 0 | Phases 3 and 4 "not started", README promises Accurate, `BRIEF.md` says pages open from disk |

### Notes for fixing

- **One adapter to update.** `builderOpen` and `builderSave` at the top of `review-findings.test.js` mirror how `manual.js` opens and saves today. If the writer is replaced or renamed, change those two helpers and leave the assertions alone.
- **Text-search tests.** These check source text, the weakness section 8 describes, because no behavior can be run yet or the check is about a file: C1 (2), C3 trip control, C4 (Node), H4, H10 (2), H11 planet columns, H12 (2), M8, M9, M12, M13, M15, M16, M18, M19, L12, L13, L16, L22, L24, L30, L31, L32, L39, R1 to R3, R5, R6, D1 to D3, and the third-pass tests for C3, C4, H5, H9, H10, and six H12 rows. Replace them with behavior tests when the features exist. They may need adjusting if a fix uses different wording or ids.
- **Tests that assume a design.** `validateSystem` is the name suggested in H7. The C3 control test expects a `select` with `trip`, `transfer`, or `route` in its id. The H5 browser test looks for text such as "Day 10", "T+10", or "10 days since". The C3 arc test treats the arc as departing on the current day, so a planner that draws a future window will need that test updated. H19 expects `data-header` values of `hostname`, `rad`, `x`, `y`, and `z`. L16 looks for "distance-mode" or "True AU" in the page. L18 looks for the word "saved" in the status line. The M27 ring test reads the `inclination` value from `planetRingsFromScene`. The M24 and M31 tests state a default that you may decide differently. L20 assumes the three view fields stay in the format. L42 assumes the file's goldilocks values win. L25 allows 8 MB at start and L29 allows a 48 px gap, and both limits are my choice. L35 assumes the card keeps its content, so a fix that closes the card needs that test changed. L36 assumes moonlets get a period. M12's format test passes if `BRIEF.md` is changed instead of the code.
- **Prompts.** Browser tests accept either a native `confirm` or an open `<dialog>`, so either design passes.
- **The browser suite** takes about three minutes, and uses ports 8144 and 9344. M14 uses 8143 and 8145. CI without Edge will skip the browser tests.
- **The H9 star test** now uses a local CSV. It used to depend on the remote star list and could skip.

### Not covered by a test

These were checked against the code and are still outstanding, but have no test, because they need a person's judgment or are not behavior bugs:

- **Part of a finding:** H2's lost hover readouts (same cause as its click test), the M10 phone-width text, and the H12 default system id, which is reasonable while a page has no `?system=`.
- **L50,** the shared origin note, and the Der Eindringling density question.
- **Code health:** duplication, large files, and module styles. The dead code was rechecked: `detectLowResource`, `storedViewerMode`, and the `orbit-match-viewer-mode` key appear only in `low-resource.js`, `window.OrbitKepler` only in `kepler.js`, and nothing under `site/` reads `sky-ab-temp.js` or `tau-ceti.stability.json`.
- **Docs rows** not in D1 to D3. Most are covered by the matching behavior tests (H4, C2, M13). The `.glb` and palette decision rows need you to record a decision.
- **Repository size,** the `test/` and `tests/` split, and `moon_lore_v241b`. These are your call.

Section 7 is feature ideas, not defects, so it has no tests beyond the C3 and H11 items. L1 and L2 are in section 6. R1 and R2 are the CI and `.gitignore` items in section 8, and R3 to R6 and D1 to D3 come from the same section. The Python research tools in `tools/` and `tasks/` were still not checked.
