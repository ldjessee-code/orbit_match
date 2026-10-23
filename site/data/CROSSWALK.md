# Field-name and unit crosswalk

Orbit Match system files, jumpgate handoff records, and the merged star-catalog columns do not share one set of names. The loader in `site/js/system-source.js` translates. It does not rename catalog columns or lore keys.

Handoff `x`, `y`, and `z` are parsecs. Light-years on the system star are `x_ly`, `y_ly`, and `z_ly`. The factor is 3.26156 (`PC_TO_LY`). Catalog `calculated_x`, `calculated_y`, and `calculated_z` are already light-years. When a catalog row has no parsec `x`, the loader divides `calculated_x` by 3.26156 and then applies the same factor, so the stored light-years match `calculated_x`.

A lore file (`orbit_match` 1 or 2) wins for bodies, orbits, rings, tags, lore version, and checksums. Handoff values fill only star fields the lore star left empty. `exoplanet_count` and `sy_pnum` are labels. They never become planets. Explicit `planets` or non-belt `bodies` records are drawn. Explicit `belts` become belt bodies. Handoff `rings` are notes. When the lore file loaded, those notes are ignored and `ring_system` on each body stays.

`model` is the orbit_match mesh path, relative to `site/viewer3d/`. The handoff review proposed the name `mesh`. This file uses `model`. A missing path keeps the sphere.

`sky.equirect` is a path relative to `site/viewer3d/`. `sky.rotation_deg` is degrees (`null` means no tilt). A number tilts about X. An `{x,y,z}` object is an Euler in degrees. `sky.background_rotation` is an optional three.js Euler in radians, used only when `rotation_deg` is absent. The default rotation is the identity.

| Handoff field | orbit_match field | Catalog column | Match |
| --- | --- | --- | --- |
| star_key | star.star_key | star_key | Loader copies it. Tau Ceti lore now stores the Gaia key. |
| gaia_source_id | star.gaia_source_id | gaia_source_id | Same. |
| hyg_id | star.hyg_id | hyg_id | Same. |
| hip | star.hip | hip | Same. |
| hd | star.hd | hd | Same. |
| hostname | star.hostname | exo_hostname, or proper via the catalog hostname helper | Copied as written. The 55 Cnc example stays `55 Cnc`. A catalog row with no hostname uses exo_hostname, then proper. |
| name | star.name | proper, else a display name | Copied as written. A catalog row uses name, then proper. That can be Copernicus while hostname stays 55 Cnc. |
| ra_deg, dec_deg | star.ra_deg, star.dec_deg | ra_deg, dec_deg | Copied onto the fallback star. |
| dist_pc | star.dist_pc | dist_pc | Parsecs. |
| x, y, z | star.x_ly, star.y_ly, star.z_ly | x, y, z in parsecs. Map calculated_x, y, z are light-years | Multiply parsecs by 3.26156. |
| mag | star.render_mag | render_mag (G if present, else V) | Name only. Tau Ceti 3.3003998 matches the handoff. |
| bp_rp | star.bp_rp | bp_rp | Copied onto the fallback star. |
| ci | star.ci | ci | Copied onto the fallback star. |
| spect | star.spectype | spect, enriched st_spectype | Name. Tau Ceti G8V matches. |
| has_known_exoplanets | has_known_exoplanets | has_known_exoplanets | Label on the fallback system. |
| exoplanet_count | exoplanet_count | exoplanet_count (pscomppars rows for that host, not sy_pnum) | Label. Tau Ceti catalog 3 versus 8 lore planets. Lore bodies win. 55 Cnc stays 5. |
| sy_pnum | sy_pnum | sy_pnum | Optional label. 7 on 55 Cnc is the binary total, not a body list. |
| st_mass | star.mass_solar | st_mass filled from the sample, not a merged column | Copied only when mass_known is not false. Lore 0.78 wins over a handoff mass. |
| mass_known | star.mass_known | (not a catalog column) | false means the mass cell was empty. No spectral-type mass is invented. |
| tier | tier | not a catalog column | Copied when present. A missing tier stays null. It is not defaulted to gate_candidate. |
| turquenish_system | star.setting_name | turquenish_system | Name. Tau Ceti value Turquenish matches. Unmapped stars stay null. |
| system_file | file name under site/data | system_file from the overlay | Loaded when it is a safe `*.system.json` name. |
| belts[].id, name | bodies[].id, name, kind belt | none | Used only when no lore file is loaded. |
| belts[].a_inner_au, a_outer_au | bodies[].orbit.a_inner_au, a_outer_au | none | Nesting. Tau Ceti 1.1–1.6 and 10–52 match. |
| belts[].parent | bodies[].parent | none | Ring follow code uses parentId on the scene belt. |
| (not on the handoff belt) | belt_structure.gaps_au and resonant clumps | none | Lore only. |
| (not on the handoff) | display.density, display.dustiness | none | Slider defaults. Sliders only fine-tune. |
| rings[].name, parent, note | body.ring_system.bands | none | Ignored when a lore file loads. Tau Ceti handoff rings is empty. |
| (none) | lore.version, canon, real / est / est. / fiction | none | Stay on the lore file. Both spellings are accepted. |
| (none) | sky.equirect, sky.rotation_deg | none | Per system. No path keeps the procedural sky. |
| (none) | star.model and bodies[].model | none | GLB path. Sphere if missing or the load fails. |

Belt `display.density` default index is 2. `display.dustiness` default is 40. Those match the previous dock sliders.
