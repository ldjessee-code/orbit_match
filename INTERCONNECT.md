# Interconnect — star card opens Orbit Match

For Jumpgate Starroute. Orbit Match already has the page this link should open.

Checked 2026-09-25.

## What to add

On the card for a star, add a launch control. Label it **Orbits**. It opens Orbit Match in a new window, for that star only.

```text
target = _blank
rel = noopener
```

The address is the builder, then a hash, then the thin card as parameters:

```text
https://ldjessee-code.github.io/orbit_match/manual/#h=1&host=tau+Cet&spec=G8.5V&planets=4&holder=Turquenish+Empire&from=Sol
```

A local copy uses whatever address is stored for Orbit Match, with `manual/` on the end. The hash is the same.

One star. The hash stays in the browser. Do not put the solar system, the route graph, or the faction matrix in the link.

## Parameters

`h=1` marks the handoff. Repeat a name for a list. Leave a field off when it is empty.

| Parameter | Card field |
| --- | --- |
| `host` | Catalog name |
| `name` | Setting name |
| `spec` | Spectral type |
| `mass` | Solar masses |
| `lum` | log10 of solar luminosity, the NASA column |
| `teff` | Temperature in kelvin |
| `x`, `y`, `z` | Light-years |
| `planets` | NASA planet count. Not a world, and not a gravity |
| `concept` | High concept |
| `port` | Port class |
| `holder` | Faction that holds the star |
| `tag` | Tag, repeated |
| `svc` | Service, repeated |
| `imp` | Import, repeated |
| `exp` | Export, repeated |
| `from` | Other end of a route that arrives here, repeated |
| `fuel`, `fuel_unit` | Only if this star already has its own fuel figure |

Orbit Match reads that hash on `manual/` and fills the star header. It then makes one section per known planet. The person edits bodies there.

## What stays on the map

The card remains the map's card. Orbit Match does not become the editor for routes, stance, or the tariff. The launch link is the new part.

When Orbit Match later hands back a system file, the map stores the path on `star.system_file`. That file is not this link.

## Star list

A person can also start from Orbit Match and pick a star. The builder loads the public sample list:

```text
https://ldjessee-code.github.io/jumpgate_starroute/sample-systems.csv
```

It also accepts a CSV the map saved out. These columns are the ones it reads: `hostname`, `sy_name`, `sy_pnum`, `st_spectype`, `st_teff`, `st_rad`, `st_mass`, `st_lum`, `calculated_x`, `calculated_y`, `calculated_z`. `st_lum` stays log10 of solar luminosity.
