# Orbit Match — design brief

**Name:** Orbit Match (`orbit_match`)

**One line:** Navigation inside a single star system. From one orbital vector to another, arriving matched so the ship does not overshoot.

**Sibling:** Jumpgate Starroute, the map of routes *between* stars. That program's work list is `../jumpgate_starroute/TODO-between-stars.md`. Game-system reading notes are [GAME_SYSTEMS.md](GAME_SYSTEMS.md).

Checked and agreed 2026-09-24.

## What it is

A tool for one solar system at a time.

- The star is the header: catalog name, setting name if the map has one, spectral type, mass, luminosity, temperature, and coordinates. NASA's count of known planets is a hint, not an order to invent that many worlds.
- **Bodies:** planets, moons, belts, stations, and jump-arrival points. Each body has an orbit.
- **Surface and society facts on a body,** filled by hand at first: size, gravity, atmosphere, water, temperature, day length, population, government, tech level, and a high concept. Those are the facts stat-heavy games ask for (a Traveller mainworld, a *GURPS Space* record, a Stars Without Number world, a Starfinder gazetteer line, a Coriolis planet). Orbit Match stores the facts. It does not emit one game's code as the source of truth.
- **A transfer** from a departure body or orbit to a destination body or orbit. The result includes the arrival burn, so the ship is on the destination vector.
- **Three fidelities,** chosen per trip:
  - **Ballpark.** Days or weeks, and a rough fuel cost. Enough to run a session.
  - **Close.** A real transfer shape and a window. Careful enough that a referee would not be embarrassed by the numbers.
  - **Accurate.** A calculated trajectory with the arrival condition included.
- **Later: step-by-step generation.** Roll or fill one layer, lock it, then roll the next. "This stays a water world" or "this stays an asteroid belt" is not rerolled because a later table came out dull. Generation is not the first version. Hand entry is.

## What it is not

- Not a map of routes between stars. No jump graph, no gate network, no drive range, no tolls, no faction stance matrix. A setting can travel by short ship-drive, by long gates, or by both. That choice belongs to Jumpgate Starroute.
- Not a ship designer. It can report a fuel cost for a transfer. It does not track hulls, drives, or campaigns.
- Not a second copy of faction politics. It may name which faction holds a body, using the same faction id the star map uses. The stance from one faction to another stays on the star map.
- Not a universal rules translator. A later export may print a Traveller profile or a Stars Without Number block from the same body. The stored record is the plain facts.
- Not orbital scenery for its own sake. The job is the connection: where you can go in-system, and how you arrive without overshooting.
- Not Worldstack, Ptah, `star_network`, or Gamer Eye.

In-system clocks and interstellar hop times stay separate. How long a ring transit takes is a property of the route on the star map. How long it takes to climb from that arrival point to a port depends on where both are in their orbits, which is this program.

## Boundary with the star map

Jumpgate Starroute keeps, per star: catalog identity, coordinates, routes, a high concept, tags, port class, services (fuel, repair, trade, shipyard), imports, exports, the holding faction, and other presences. Orbit Match may read those as labels. It does not become the editor for them.

Orbit Match owns the bodies and the transfers. The star map may store a pointer to a system file and show the thin card without opening it.

A jump arrives at a **star** on the map. Where that arrival sits in the system (a ring at the edge, a gate in orbit, a jump point) is a body in Orbit Match. The handoff lists arrivals so this program knows which routes need a place to put them.

### Handoff file

The star map can write this. Orbit Match can write the `system_file` path back onto the star later. Field names can grow. The split should not.

```json
{
  "handoff": 1,
  "star": {
    "hostname": "tau Cet",
    "setting_name": "",
    "spectype": "G8.5V",
    "mass_solar": null,
    "lum_solar": null,
    "teff_k": null,
    "x_ly": 10.16,
    "y_ly": 4.96,
    "z_ly": -3.23
  },
  "known_planet_count": 3,
  "card": {
    "high_concept": "",
    "tags": [],
    "port": null,
    "services": [],
    "imports": [],
    "exports": [],
    "holder": ""
  },
  "arrivals": [
    { "from_hostname": "Sol", "route_id": "" }
  ],
  "system_file": null
}
```

`known_planet_count` is what the NASA tables published. It is not a mainworld, and it is not a gravity or an atmosphere.

`port` uses the star map's words: blank, `none`, `minor`, `standard`, or `major`.

### Where the other page lives

Each program stores the addresses in a JSON file. Orbit Match's copy is [site/config.json](site/config.json). The shipped file points at the public GitHub Pages addresses. A local copy edits that file. The handoff fields are the same either way.

`other_page` is the star map page this program calls. `pages` lists the public homes, the map, and the lore. `setting` is the default neighborhood: `crowded`, the Turquenish pages, and that pack's map file. Jumpgate Starroute's own setting points back at Orbit Match.

```text
other_page = https://ldjessee-code.github.io/jumpgate_starroute/app.html
other_page = http://127.0.0.1:8080/app.html
```

The call is that address, a hash, then the thin card as parameters (`h=1`, `host`, `from`, and the rest). The hash stays in the browser. A blank address means the page does not open the other one. The handoff file still saves and opens by hand.

The builder is `site/manual/`. A star card on the map should open that page in a new window. The note for that work is [INTERCONNECT.md](INTERCONNECT.md). Until the map has the link, the builder loads the public star list, or a CSV the map saved.

A hosted page can call any http or https address. It cannot open a folder on the visitor's computer. Two copies on one machine call each other by the local address each is served at. `system_file` stays a path to the system JSON. That path is a different setting from the page address.

## Build order

1. Open one star from a handoff file. Edit bodies and orbits by hand. Save a system file the map can point at.
2. Ballpark transfer between two bodies: duration and a rough fuel cost, with an arrival that is matched rather than a flyby.
3. Close fidelity: a transfer window and a real shape.
4. Accurate fidelity: numerical trajectory and arrival burn.
5. Generation by layers, with locks, so a locked water world or a locked belt survives the next roll.

## How it runs

Decided 2026-09-25. A referee opens a page. Nothing is installed.

**Page.** HTML, CSS, and JavaScript. One folder is the program on Mac, Windows, and Linux, hosted or copied onto a disk.

**Files.** The page opens a handoff JSON file and saves a system JSON file. On one computer, Jumpgate Starroute stores that path in `system_file`. Either page can also open the other, locally or hosted, at the address stored in its settings. The call carries the thin card in the hash. A blank address leaves the file as the handoff. The two pages share no account and no database.

**Transfers.** JavaScript does the arithmetic. Ballpark and close use Kepler: period, a transfer ellipse, a window, and the arrival burn. Accurate follows the bodies with a numerical trajectory. One star system is a small calculation.

**WebAssembly.** Reserved for the accurate solver, and only if JavaScript is too slow or too rough for that trajectory. The rest of the page stays HTML, CSS, and JavaScript. The project starts as scripts, so the person changing the page edits a file and refreshes the browser.

**Python.** Jumpgate Starroute can rerun its map engine with Pyodide because that engine was already Python. Orbit Match has no inherited engine, so it does not download one. If a later job cannot live in the page, the server is Node, then Python, and it has to run the same way on a laptop and on a host.

**Picture.** An SVG diagram: orbits, bodies, and the transfer. The job is the connection. A 3D view can be added later. The first picture stays readable with WebGL turned off.

**Setup.** No build step and no package install. The first page uses the browser's own HTML, SVG, and JavaScript. Ordinary script tags, so the folder opens from disk as well as from a host. A focused library may be added later for the accurate solver if it drops in as a script tag and leaves that double-click working. The public copy is GitHub Pages, the same kind of static site as the star map, or any host that serves the folder.

A server waits until the page cannot do the job. The first job that would need one is several people editing one system at the same time, or a private library of systems kept online. That work sits outside build steps 1 through 4.

**First page.** Build step 1, and the ballpark half of step 2. Close, accurate, and layered generation are later work in the same page, in the order above.

**Where the page lives.** `site/index.html` is the program. Styles and scripts sit under `site/`. `site/config.json` holds the sibling addresses and the default setting. These notes stay at the repository root.

## License

The program in this repository is under the MIT License, copyright Lloyd Douglass Jessee, 2026. These planning notes are the author's. Game rules stay with their publishers. See [GAME_SYSTEMS.md](GAME_SYSTEMS.md).
