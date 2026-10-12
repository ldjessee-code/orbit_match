# Orbit Match formats

Version 2 is the system file. Version 1 is what the builder still saves. Readers accept 1 and 2. A higher version is an error. Unknown keys are kept. Numbers may be numbers or numeric strings. The loader does not require Tau Ceti ids. Turquenish is the default setting, and another setting is another file of this shape.

`site/js/schema.js` is an ES module. `site/js/package.json` exists so Node loads that folder as modules. It is not an install. The builder does not import the module yet.

## System file

`orbit_match` is 2. `kind` is `system`.

Units:

- Heliocentric distance is `orbit.a_au`. A stored period is `orbit.period_days`.
- A moon or a station distance is `orbit.a_km` from `parent`. One field is not both AU and kilometres.
- A belt uses `orbit.a_inner_au` and `orbit.a_outer_au`.
- Mass is at most one of `mass_earth`, `mass_kg`, or `mass_solar`.
- Angles are degrees. Time is days from `epoch.t0_days`.

Star luminosity may be `lum_solar` (linear) or `lum_log` (log10). The loader records which key it saw. Habitable-zone edges are `hz_inner_au` and `hz_outer_au` when the setting gives them. Tau Ceti uses 0.68 and 1.22. A star without those fields still loads. The viewer may fall back to `0.95 √L` through `1.67 √L` and tag that band `est`.

`canon` maps a field path to `locked`, `est`, `derived`, `real`, `fiction`, `narrative`, `tbd`, or `placeholder`. `source` names the setting section. The site does not read the setting's markdown.

A body may set `display.color` and `display.shape`. `torus` draws a ring. The renderer uses that color for the disk, the legend swatch, and that body's callout. A missing `display` falls back to the theme. `display.stripes` draws thin bands across the disk in `display.stripe`.

`lore.version` and `lore.source` name the file the fixture was copied from. `lore.copied` lists the field paths that copy must match. A node test fails when the fixture and that list disagree. A later lore edit that changes one of those fields is stale until the fixture and the test change together.

If `period_days` is missing and `a_au` is present, the loader derives the period with a 365.25-day year and the same cube root as `site/manual/orbit.js`. A body with no `a_au`, `period_days`, `a_km`, or belt edges is listed in `skipped`. It is not deleted.

## Version 1 migration

`migrateV1toV2` turns nested `moons` into bodies with `parent`. `au` becomes `orbit.a_au`. `distanceKm` becomes `orbit.a_km`. `period` plus `unit` becomes `period_days` (`days` stay days, `years` multiply by 365.25). Existing ids stay, including a builder id such as `b` plus random characters. The Tau Ceti fixture uses lore ids from the start.

## View file

`orbit_match_view` is 1. Fields: `elevation_deg` (default 20, clamped to 15–75), `azimuth_deg` (default 0, the angle around the focused body), `distance_mode` (`schematic` or `true`), `legend_corner`, `style`, `theme`, `callouts` (at most 3), `layers`, and `epoch_days`.

`callouts` entries are `body:<id>`, `transfer:hohmann`, `transfer:fusion`, or `star`. `orbit:<id>` selects the same card as `body:<id>`. An empty list draws no cards. The page fills the list when a disk, a ring, or a transfer is clicked. A ring click toggles that body's card.

`style` and `theme` are strings a setting supplies. Quiet and holo are the chrome files in `site/themes/`. Empire is the palette file that ships with the Tau Ceti example. Mardat is a later file. Another setting may use its own names. The renderer reads those files. The Tau Ceti view starts at quiet Empire.

`star.name` is the label drawn beside the disc. `hostname` stays the setting's short name. A view may name one transfer with `transfer.from` and `transfer.to`. The picture asks `kepler.js` for the days and the burns. Ring angles are display spacing when the file has no mean anomaly.

## Stability file

`tau-ceti.stability.json` is a short note for cards. It is not an ephemeris. The page does not parse rebound logs or `.bin` archives.

## This fixture

Copied from Draft v2.41c on 2026-10-11. Shudder is 151,060 km at e = 0.20. Der Eindringling is 240,000 km at e = 0.03 and 1/200 of Kakakiko. Haven, the Yard, and the watch station sit on the 54,076 km synchronous ring. Moon L4 and L5 are not stations. The jumpgate is at Croquet Ball's L4 or L5, and which of those two is still open. Sable is drawn at e = 0, and `e_max` is 0.1.
