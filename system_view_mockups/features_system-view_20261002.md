# System viewer: features from the mockups, and gaps from similar tools

Date: 2026-10-02. Tau Ceti, Turquenish setting. This note reads the mockups in `system_view_mockups/` and says what the viewer is for. It does not add lore. Numbers below are the ones already drawn on the v5a and v6m pictures, or already fixed in spec v6.

The page is a viewer for a GM or a player. It shows one star system, and it lets someone inspect a body. It is not a game. It does not command fleets, fight, or build ships.

## What the latest pictures are

The pictures Doug called closest are:

| Set | Whole system | Close-up | Interface |
| --- | --- | --- | --- |
| v5a | `concept_tauceti-turquenish-system_20260930_v5a.png` | `concept_kakakiko-closeup_20260930_v5a.png` | Empire-style, medium slate `#5a6270`, soft star |
| v6m | `concept_tauceti-turquenish-system_20260930_v6m.png` | `concept_kakakiko-closeup_20260930_v6m.png` | Mardat-style, deep indigo `#17143e`, fiery star |

Both use the same camera: elevation 20° above the plane (ellipse ratio sin 20° = 0.34), large holo bodies, legend top-left, three callout cards, projector cone. The system view uses schematic distances. The close-up is planet-centred on Kakakiko, with linear kilometres.

v7 (this pass) keeps that scene and draws the controls the earlier pictures only imply. See the end of this note.

## Two interface schemes

The scheme is the display hardware, not a flag and not a faction colour. Spec v4 §7a and v6 §0000.

**Empire-style** (v5a). Pale panels `#EEF1F5`, light blue `#7FD3FF` and green `#6EE7A8` for lines, outlines, and status lamps. Round callout target. Soft star: pale yellow `#ffe0a0`, a real G8V tint, slightly warmer than the Sun, not red. Ground is medium slate, so lines use a dark keyline instead of a glow. Scan-lines are dark.

**Mardat-style** (v6m). Medium-gray panels `#6B6F76`, near-black wells `#0A0C10`, red outlines `#C0142B`, title bars `#173f96` with a light top edge so the navy still reads on indigo. Square callout target. Red leader `#ff2e48`. Fiery star: granulated photosphere, limb darkening, corona, one prominence. The hue stays golden amber. It is warmer than the true G8V colour on purpose, and the star card says so. Ground is deep indigo, so orbit lines get a pale glow again.

A view has one chrome theme. A single object may override the card only. The spec's example is Der's mines, which run Mardat hardware inside an Empire view. v6m is the whole view in Mardat chrome, not that one-card override.

## What the pictures already show

**Frame.** A bezel, corner brackets, a status strip, and a title: "TAU CETI · SYSTEM NAV HOLO" or "KAKAKIKO · LOCAL NAV HOLO". The status names the interface, the default view (4C), the elevation, and the background token.

**Camera.** Orthographic. The orbital plane is an ellipse. Far-side bodies draw behind the star, near-side bodies in front. Body size gets a small depth cue. Discs stay circles. The close-up states the scale ("1 px ≈ 741 km" on v5a/v6m).

**Schematic system.** Orbits are spread so the outer belts and the inner planets are both visible. The legend says sizes are enlarged, and that a true-AU toggle exists. A green band is the habitable zone, 0.68–1.22 AU. Two belts: The Sombrero (B1) and the Outer Wall (B2). A hover tag on Kakakiko's orbit reads "0.71 AU".

**Bodies in the system view.** Tau Ceti G8V. Gane (tC 1), Hornstooth (tC 2), Husk (tC 3), Sable (tC 4), Kakakiko (tC 5, with two moon dots), Croquet Ball (tC 6, name proposed, striped), Cue Ball (tC 7, pale, ringed, one dark storm), tC 8 (name TBD, dark and dusty). Each has a name and a designation.

**Transfers in the system view.** A mint dashed Hohmann from Kakakiko to tC 6, with ghost rings at depart and arrive. The card gives 481 d and Δv 8.2 + 5.7 km/s, next window T+181 d. A violet Turquenish Empire fusion path at 0.01 g: 82 d, burn-coast-burn, 8.9 d burns, Δv 133 of a 150 km/s budget, arrival matched to Croquet Ball. Coast is dotted. These are Turquenish drives only. Reactionless is not on the picture.

**Kakakiko close-up.** The planet is centred. Shudder (Moon I, 2.8 g/cm³, e 0.20, perigee 201,080 km, apogee 301,620 km) and Der Eindringling (Moon II, 7.2 g/cm³). Distance rings every 100,000 km. Der's orbit carries L3 Watch (diamond), L4 Yard + Goliath Funnel, and L5 Haven (cylinder cluster). A dashed triangle ties Der, L4, and L5 to the planet. A mass-driver stream of slugs runs Der → L4 (backward shots, ~70 m/s beyond escape, 23.5 d phasing ellipse, 40 slugs). A crew shuttle on a fusion spiral climbs from low orbit toward L5: coasting in the snapshot, 113.4 h elapsed, 44.1 h to go, Δv 5.4 of 9.0 km/s, reaction mass ~28%. Ship numbers are marked placeholder.

**Cards.** At most three, plus the legend. A leader line runs from the card to a marker on the object. Cards sit in the corners the legend does not use. Kakakiko's card ends with "[ Open in Orbital Object Details ]". The star card records the display stylisation. The legend is the key to orbits, transfers, and slugs, and it states epoch "T+0 (circa 1600 yrs hence) + 6 d" on the close-up.

**Epoch and honesty.** Placeholder is written on the picture when a figure is not fixed. Name status is written on the body ("name proposed", "name TBD").

## What the pictures imply and do not draw

These are already decided in spec v3–v6, or they are the next click the layout is built for. v7 draws the first four. The interactive prototype makes a few of them work.

1. **Zoom is a continuous slicer**, not a list of named stops. The same gesture is the mouse wheel, a slider, and a pinch on a phone or tablet. Zoom changes what slice you are in: system, planet, moon, structure. Detail fades in as the framed extent gets small (structures and moon orbits appear; they are absent on the system picture). Auto-fit frames whatever you picked.
2. **Elevation is a control**, 15–75°, default 20°. The header already prints the number. The pictures do not show the slider.
3. **Distance mode.** Schematic is the default because true AU hides the inner planets inside the star disc. The legend says "toggle: TRUE AU" and "hover a ring for true distance". Neither control is drawn.
4. **A card opens on click.** Phase 1 was a static graphic, so the cards are already open. The link line is the lore path. The user also wants a pencil. The pencil edits the card's details and must warn that the edit can contradict the lore document. The viewer does not write that document by itself.
5. **At most three cards**, corners chosen by the user, legend corner separate. v5/v6 use legend top-left.
6. **Time is a parameter.** Positions are computed at an epoch. The pictures are one frame (T+0 for the system, T+6 d for the close-up). A scrubber is implied by "epoch" and by the shuttle's elapsed and ETA.
7. **Per-object theme override** for hardware, distinct from the view theme.
8. **Source on every fact.** The data model carries a source string pointing at a section of `Tau_Cet_system_v2.md`. The pictures do not print the section number on the card.

## What similar tools do that these pictures lack

Looked at as viewers and planners, not as games. Fleet orders, weapons, formations, and build queues are out of scope even when those games mix them into the same screen.

**Homeworld sensors manager** (Homeworld, and Homeworld 3's Sensors Manager). The useful part is the camera. Select is separate from focus: you can select a unit and only then press focus, and while focused a right-drag orbits that unit. Wheel zooms. Edge-pan and arrow keys pan. Alt-click focuses without the same command as a normal click. The sensors view is a farther slice of the same world, which is the same idea as the slicer. Tactical colours for friend and foe, and move orders, do not belong here.

**Kerbal Space Program map view.** Apoapsis and periapsis markers, with the numbers available on the marker. A maneuver node on the orbit that previews the resulting path and the burn length. "Warp here" along an orbit. Sphere-of-influence boundaries, and patched conics when a path crosses into another body's frame. The transfer card on the system picture is the static version of a maneuver. The pictures have no Ap/Pe on the system view (Sable is eccentric in the generator and is drawn as a plain ring). The close-up does mark Shudder's perigee and apogee. There is no sphere-of-influence ring around Kakakiko, and no way to scrub to the T+181 d window.

**Elite Dangerous system map and orrery.** Two scales of the same system: a schematic map you can read at a glance, and a true-scale orrery. The orrery is accurate and, in practice, easy to get lost in, because a real system is almost empty. That is the reason the Turquenish default is schematic, with true AU as a toggle rather than the home view. Elite also has bookmarks, a filter list, and a detail pane for whatever is under the cursor. The old Frontier games could run time so you could see where bodies would be. The mockups have no name search, no pin list, and no time play.

**Children of a Dead Earth orbital view.** Camera focus and maneuver target are different buttons. The orbit marks periapsis, apoapsis, and the two nodes where the path crosses the target plane. A reference plane, Lagrange points, and a time handle for phasing. Lagrange points are already on the Kakakiko picture. Nodes and a reference plane matter once a body has inclination. The current generator orbits are coplanar, so the pictures correctly omit nodes. The time handle is the missing piece for "when is the Hohmann window".

**Celestia.** Click selects and shows a short fact block. A go-to key frames the selection. Right-drag orbits the selection. The wheel changes distance. Time rate is a separate control from the camera, including pause. Typing a name selects. That split (selection, framing, orbit, time) is the right split for this viewer.

**Universe Sandbox.** Search focuses the camera. Labels, trails, and projected paths are layers. Trails can be drawn relative to a chosen body, which is how you look at a moon without the planet's motion smearing the view. The properties panel can open without destroying the view. A description field on an object is the nearest thing these tools have to a lore blurb. It is also a reminder that a description someone types is not the same object as the sourced lore.

## Practical features still missing

In the order they would help a GM or a player read Tau Ceti. Not a build list for tonight. The prototype only does the camera and a few cards.

1. **Selection, focus, and framing are three states.** Click opens the card and arms orbit-around. A second action (double-click or a Frame control) moves the camera and the slicer. Pan releases the follow. Homeworld and Children of a Dead Earth both got this wrong when the actions were glued together, and the mockups cannot show it because nothing is clickable yet.
2. **The slicer, the wheel, and pinch are one zoom.** Keyboard `+` / `−` too. Zoom toward the cursor when the user is not following a body, and toward the body when they are.
3. **Right-drag, or a two-finger twist, orbits elevation and azimuth around the focused body.** Left-drag pans. One finger pans. The elevation range stays 15–75° so the plane never becomes a line and never becomes a top-down circle by accident.
4. **A time scrubber, paused by default, independent of zoom.** Play, pause, and jump to the next transfer window. While following a moon, the camera stays on that moon. Trails, if shown, are relative to the framed parent (planet, or the star).
5. **Ap and Pe markers on eccentric orbits**, and a Hill-sphere or sphere-of-influence ring when the frame is a planet. Shudder already has the two range labels. The system view should grow the same marks when an orbit is visibly eccentric. No new radii in this note: use the Hill radii already in the system document when that ring is drawn.
6. **Layers, each able to hide.** Orbits, labels, belts, habitable zone, transfers, ships, structures, grid. The v7 pictures show the chips. The prototype leaves them visible and inert.
7. **A name list or search** that frames a body. The labels on the picture are the only index. A list matters once a system has yards, moons, and ships.
8. **Measure.** Pick two objects and read separation and relative speed at the current epoch. Hover on an orbit ring reads the true AU or the true kilometres, which the legend already promises.
9. **Transfer preview stays a preview.** Ghost at depart and arrive, burn thicker than coast, Δv against the budget, and the existing "ballpark" flag when the star's gravity is not negligible next to the thrust. A draggable maneuver node can wait. Nothing in a preview writes lore.
10. **Card actions.** "Open lore" goes to the object's section, or to Orbital Object Details, as the Kakakiko card already says. The pencil opens the same facts for edit and warns, in the dialog, that a change can contradict `Tau_Cet_system_v2.md`. The prototype warns and does not save. A later version can keep a table note that is explicitly not the lore document. The pencil is a GM action. A player view can hide it. The pictures have no login, so this note only records the split.
11. **Breadcrumb of the frame.** Tau Ceti, then Kakakiko, then the moon or structure. v7 draws it. It is how you climb back out without hunting for the zoom slider.
12. **Placeholder and name-status stay on the card** when the figure or the name is not fixed. Croquet Ball stays "name proposed". tC 8 stays "name TBD". Shuttle budget figures stay placeholder.
13. **Empty click clears the card and does not jump the camera.**

## Leave out

- Fleet orders, formations, stances, attack moves, and a friend-or-foe tactical overlay.
- A navball, throttle, or piloting instruments. The shuttle card is a status readout for a planned burn, not a flight control.
- Weapon ranges, build queues, and resource transfer between ships.
- A true-scale view as the default. Elite's orrery is the cautionary case. Keep it as the distance-mode toggle the legend already names.
- Invented facts to fill a card. If the mockups and the system document do not say it, the card says the prototype does not have it.

## v7 pictures

`concept_generator_v7_20261002.mjs` redraws the v6 scene twice:

- Empire-style on medium slate, soft star: `concept_tauceti-turquenish-system_20261002_v7e.svg` and `concept_kakakiko-closeup_20261002_v7e.svg`
- Mardat-style on deep indigo, fiery star: `concept_tauceti-turquenish-system_20261002_v7m.svg` and `concept_kakakiko-closeup_20261002_v7m.svg`

A PNG copy sits beside each of those four SVGs.

Same elevation, same bodies, same transfers. Added on every picture: a zoom slicer with slice labels, an elevation readout, layer chips, a frame breadcrumb, and an "Open lore" plus pencil row on each card. The Kakakiko sentence "[ Open in Orbital Object Details ]" is now that row, so the card does not say it twice.

## Interactive prototype

`interactive_mardat_tau_ceti_20261002.html` is the Mardat pair, one step past a still picture. Open it from the file. Wheel, the slicer, or a pinch zooms. Left-drag pans. A click opens a card and arms orbit around that body, without moving the camera. Right-drag, or a two-finger twist, orbits it. Double-click frames it, and that lock is what pan releases. "Open lore" explains that the lore page is not wired. The pencil warns about contradicting the lore document and does not save. Other bodies can be selected and orbited. Their cards say the prototype has no further facts. The page does not write `site/` and does not write the lore file.
