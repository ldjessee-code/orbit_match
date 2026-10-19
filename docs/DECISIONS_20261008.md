# Decisions 2026-10-08

## Q1: Viewer chrome

Choice: C. Draw both the quiet orrery and the spec v6 holo chrome as static pictures before any viewer page code.

Assumed: A quiet orrery.

If they differ: Phase 2 does not open as a quiet-only SVG page. Both looks are drawn first, and the quiet-only page (including the "no holo filters" check) waits until Doug picks after seeing them.

## Q2: When three.js arrives

Choice: A. SVG viewer first. three.js stays an optional later page. Doug's condition: the SVG camera must tilt and orbit around the focused body, always facing it, clockwise or counterclockwise.

Assumed: A SVG first, three.js optional later.

If they differ: The letter matches. The orbit is already in the features note (right-drag changes elevation and azimuth around the focused body; elevation stays 15–75°). Phase 3 of the SVG page includes that camera. A left-right pan is not a substitute. Phase 4 three.js remains optional.

## Q3: Script loading

Choice: B. ES modules on every page. The page is opened through a tiny static server written with Python or Node already on the machine. No new install. A Rust desktop app is a later job, outside this refactor.

Assumed: A UMD for the SVG page, so `file://` works.

If they differ: Phase 2 does not embed the fixture for a double-clicked file. The page fetches it. `type=module` is used on the SVG page as well as the later 3D page. Q8 still chooses the port; this answer already requires some local static server. GitHub Pages remains the public host.

## Q4: True distance on the picture

Choice: A. A true-AU column in the legend, and a hover on the ring.

Assumed: A legend column and hover.

If they differ: They match. The schematic stays the default picture. The legend column and the ring hover both show true distance.

## Lore source after Q5

The plan's moon numbers are Draft v2.40. On 2026-10-09 the setting file is v2.41c: `F:\Dropbox\Projects\Turquenish\systems\tauCet\Tau_Cet_system_v2.md`. Phase 1 copies that file, not the plan's mismatch table.

## Q5: How to draw Sable's eccentricity

Choice: A. A circular orbit at e = 0. The card says e ≤ 0.1.

Assumed: A circular with an e-max note.

If they differ: They match. The drawn orbit is a circle. The card stores the ceiling. No ellipse is drawn at 0.1.

## Q6: Moon distances on the picture

Choice: Draw the v2.41c published system. Shudder at 151,060 km, Der Eindringling at 240,000 km, Der at 1/200 of Kakakiko. The Yard, Haven, and the watch station sit on the 54,076 km synchronous ring. Moon L4 and L5 are not stations. The moon cards can say the 20,000-year run with the star, Sable, and Croquet Ball kept the 2:1.

Assumed: A. Draw the v2.40 distances, 251,350 km and 400,000 km, and put the old instability verdict on the card.

If they differ: The fixture uses the v2.41c axes, the 1/200 mass, and the synchronous ring. The old 4.5-year breakup is history for the abandoned distances. It is not the verdict on the drawn moons.

## Q7: Job-folder path in AGENTS.md

Choice: B. Keep `F:\Dropbox\TheCourt\research\_jobs\orbit_match\<job>\`, as the setup report wrote it. Future orbit jobs go there.

Assumed: A hyphenated court path, `orbit-match-<slug>\<run>\`.

If they differ: `AGENTS.md` stays on the underscore path. The next launcher sets `ORBIT_JOB_DIR` to that path so the stop gate watches the folder it names. Existing hyphenated folders, including this plan, stay where they are.

## Q8: A local server and the port pair

Choice: B. Add a tiny static server on 8131 now.

Assumed: A. No server in this refactor. The peer URL comes from the query, then localStorage, then `config.json`. 8130/8131 stay a suggestion in `TODO_PORTS.md`.

If they differ: This refactor serves the site on 8131 with the Python or Node static server from Q3. 8130 stays Jumpgate's port in `TODO_PORTS.md`. The page does not hardcode it. The peer URL still comes from the query, then localStorage, then `config.json`. GitHub Pages stays the public host.

## Q9: When the Mardat plate shows up

Choice: A. The first coded page is Empire on the quiet sky only. The Mardat accent and the fiery star arrive in the interaction phase.

Assumed: A Empire in phase 2, Mardat in phase 3.

If they differ: They match. The static chrome pictures from Q1 still come before that page. The first coded viewer is Empire. Mardat waits for the interaction phase.

## Q10: When the public site updates

Choice: A. Work stays on `review` until Doug merges. Pages does not see the viewer until that merge. The first sensible merge is after phase 2.

Assumed: A merge when Doug wants, first useful one after phase 2.

If they differ: They match. Commits stay on `review`. `pages.yml` keeps deploying `main` only. Doug merges with `Merge-Review.ps1`.

## Setting flexibility

Turquenish is the default setting, and Tau Ceti v2.41c is the first fixture. Orbit Match loads setting and system documents of the same shape. The schema, the loader, and the viewer do not hardcode Turquenish ids, names, or one star. A second setting is another file, not a code change.

Phase 1 does not parse a setting's markdown. The interchange file is the JSON shape. Copying Tau Ceti into that file is the first example. A markdown importer would be its own later phase.

Chrome, color, and look are data too. A setting can supply its own theme: colors, type, chrome, and star treatment. Empire, Mardat, quiet, and holo are themes that ship with the Tau Ceti example. They are not the only looks the viewer can draw. The renderer reads the theme. It does not bake one palette into the page.

## Phase 0

Approved 2026-10-10. Doug is good with phase 0 as summarized. The job-folder sentence stays `F:\Dropbox\TheCourt\research\_jobs\orbit_match\<job>\`. `TODO_PORTS.md` records 8131 as the local Orbit Match server. The server script waits until a page needs it. No viewer and no fixture in this phase.

## Phase 1

Approved 2026-10-10. Schema and the Tau Ceti v2.41c fixture, as summarized. `schema.js` is an ES module. The view file stores `azimuth_deg` and accepts `quiet` and `holo`, and `empire` and `mardat`. The loader does not require Tau Ceti ids. The fixture's view starts at quiet Empire.

## Phase 2

Approved 2026-10-10. Two static pictures first, quiet and holo, from theme files. Then the coded SVG page loads the quiet Empire theme for Tau Ceti. Shudder's periapsis test is 120,848 km. The page fetches the fixture through the server on 8131. No embedded `file://` copy. Mardat waits for phase 3.

## Phase 3

Approved 2026-10-10. Interaction on the phase 2 picture, including azimuth and elevation orbit around the focused body. Theme files load quiet Empire by default, Mardat in this phase, and the phase 2 holo file the same way. Stations on the picture are the synchronous ring.

## Phase 4

Approved 2026-10-10. Optional three.js page of the same system and epoch. It shares the SVG camera aim and the theme file. Both pages open on port 8131. If the vendor copy needs npm, the phase stops and the SVG page is the product. No `.glb`, no Babylon.js, no Blender.

## Phase 5

Approved 2026-10-10. Doug signed off the order 0 through 5. The builder writes version 2 and still loads version 1. The peer URL stays query, then localStorage, then `config.json`. It does not bind a port. The static server on 8131 is the phase 2 script, not a second listener. Shared numbers are the v2.41c fixture. Nothing is deleted. The REBOUND author-check is a later job.

## Phase order

Approved 2026-10-10: phase 0, phase 1, phase 2, phase 3, phase 4, phase 5. Phases 0, 1, and 2 are done on `review`. Phase 3 is next.
