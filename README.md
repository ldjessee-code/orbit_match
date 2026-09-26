# Orbit Match

Orbit Match works one star system at a time. You record the bodies and their orbits, then ask for the trip from one to another. The result includes the arrival burn, so the ship is on the destination vector when it gets there.

A body can be a planet, a moon, a belt, a station, or the place a jump arrives. On it you can keep the facts a referee writes down: size, gravity, atmosphere, water, temperature, length of day, population, government, tech level, and a high concept. You fill those in by hand. The stored record is the plain facts.

A trip can be run at three fidelities.

| Fidelity | What you get |
| --- | --- |
| Ballpark | Days or weeks, and a rough fuel cost. Only the star's gravity. Enough for a session. |
| Close | The transfer's shape, and the window when the destination is in place. Includes the gravity of the world you leave and the world you arrive at. |
| Accurate | A trajectory that also includes the large bodies. A swing past one of them can stand in for fuel on the way. Arrival is still a match burn. |

The page is [https://ldjessee-code.github.io/orbit_match/](https://ldjessee-code.github.io/orbit_match/). [Build a system](https://ldjessee-code.github.io/orbit_match/manual/) from the star list, or from a CSV the star map saved.

## Jumpgate Starroute

Orbit Match can take a star from [Jumpgate Starroute](https://github.com/ldjessee-code/jumpgate_starroute) and hand back the system it built. The star map keeps the routes between stars. This program keeps the worlds and the burns inside one of them. The public addresses, and the default Turquenish neighborhood, are in [site/config.json](site/config.json).

Design notes: [BRIEF.md](BRIEF.md). How different games describe a world: [GAME_SYSTEMS.md](GAME_SYSTEMS.md).

MIT License. Lloyd Douglass Jessee, 2026. The game-system notes link out. They do not copy rulebooks.

Orbit Match is not part of the worldstack + gamer eye project.
