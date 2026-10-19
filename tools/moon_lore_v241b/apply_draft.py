"""Apply Doug's v2.41b decisions to the staged draft. Called from run_all.py."""

from __future__ import annotations

import calc


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"FAIL {label}: count {count}")
    return text.replace(old, new, 1)


def span(text: str, start: str, end: str, new: str, label: str) -> str:
    start_at = text.find(start)
    end_at = text.find(end, start_at + 1 if start_at >= 0 else 0)
    if start_at < 0 or end_at < 0 or end_at <= start_at:
        raise SystemExit(f"FAIL {label}: markers {start_at} {end_at}")
    if text.find(start, start_at + 1) != -1:
        raise SystemExit(f"FAIL {label}: start not unique")
    return text[:start_at] + new + text[end_at:]


NEW_HABIT = """##### Habitability note

Equatorial open water runs about 1–2 m from high to low on a normal day, and a typical equatorial day is about **1.7 m**, so **equatorial island chains and archipelagos stay settleable**. Ordinary shelves are about **4–7 m**. A funnel or king tide in a shallow bay is about **8 m** from high to low, with a physical ceiling near **11 m**. The hazards are storms, the shallow delta where the tide meets a river, and storm surge. Big surf still comes from storm swell, not tides, so some coasts get large waves just as on Earth. *(est.; Doug, 2026-10-09)*

##### Surfing and the kayak challenge *(narrative, physically supported)*

Surfing on Kakakiko is a real sport, not a death wish. The big waves come from storm swell rolling out of the cyclone belts onto exposed mid-latitude and tropical coasts, much like Earth's famous big-wave breaks. There is no great tidal bore to ride.

Four wild coasts stay untamed. They are preserves of ~20,000 km² in all, shores plus watersheds *(est.)*. They are no longer bore preserves:

1. **Equatorial delta:** on the equator, on Continent B, where the arc crosses the equator *(est.)*. The old resonant bay is now a wide, flattened, shallow delta. At king tide the incoming tide meets the river. Where that happens in a rocky narrows, or over a ledge in the main channel, the water runs like rapids and sometimes stands as a wave. The real analog is the Reversing Falls at Saint John, New Brunswick. Structures sit set back from the channel, on stilts, or both: the settled pattern is a mix of the two. The against-the-flow kayak challenge is paddled here as well as at 55° S.
2. **North shelf coast:** ~20–25° N, possibly on Continent B's northern tropical coast *(est.)*; otherwise on a chain. Ordinary shelf tides of about 4–7 m, plus storm surge. No bore.
3. **South shelf coast:** ~20–25° S, on an island chain or the partial third landmass *(B does not reach that far south, and A starts at ~33° S)*. Same 4–7 m shelf class, plus storm surge. No bore.
4. **Southern cold-water coast:** ~55° S, on Continent A's southern coast *(est.; the south was chosen because the south-polar ocean has no land to block the westerlies, like Earth's Southern Ocean, so storm swell there has the longest run)*. This is the cold-water destination. Locals paddle **sea kayaks**. The challenge is to paddle against the flow: upstream against the incoming tide, then against the river as it forces its way back out. Storm swell is the other half of the sport, on the open coast. The water is ~43–50 °F (6–10 °C) *(est.)*, so paddlers wear drysuits or wetsuits or rely on biomods (details `TBD`). The boats and the kayak culture are *(narrative, physically supported)*. Real-world inspiration: the Aleut/Unangan baidarka (iqyax), a skin-on-frame sea kayak famous for handling rough North Pacific seas, and modern cold-water paddling in Alaska and the Aleutians.

The other wild coasts near cities and colonies were reshaped over roughly 1,600 years (blasting, fill, breakwaters) so they would not funnel the tide. The four survivors and their watersheds stay preserves *(est.)*.

**Channel grazers** *(narrative)*: long-lived aquatic grazers, about the size of a sea turtle, live in these rivers and on the muddy flats. They look like an armadillo with a shrimp, lobster, or crawdad tail. They migrate up and down the rivers. They eat aquatic plants and the animals that live in the mud. They are at home on muddy flats. Their passage keeps the central channel of the delta from clogging. No species name is fixed.

"""

NEW_TIDES = """Doug's 2026-10-09 tide canon uses the equilibrium table plus the 200-day ocean series *(est., derived)*:

- **Open water, normal day:** about **1–2 m** from high to low.
- **Typical equatorial day:** about **1.7 m** from high to low. That is the crust-relative median of the 200-day series (1.66 m).
- **Conjunction peak:** about **5.7 m** from high to low, recurring every **13.2 days**. That is the rigid spring maximum already in the table. The crust-relative height of that same peak is about 3.9 m.
- **Deepest neap:** about **0.3 m** from high to low. The equilibrium neap bulge stays **0.27 m** (the table's ≈ 0.4 m is 1.5× that bulge).
- **Ordinary shelves:** about **4–7 m**.
- **Funnel or king tide:** about **8 m** from high to low in a shallow bay, with a physical ceiling near **11 m**. Those are coastal numbers, not open-ocean numbers. The 8 m case is a realistic bay (350 km; depths 17.5 m and 50 m; widths 8 km and 40 km). The 11 m ceiling is a longer rectangle that still passes the area filter.
- **Mid-latitudes:** gentle. At about 35° the open-water tide is about two-thirds of the equatorial bulge, so a typical mid-latitude spring is about **1.1 m** high and about **1.7 m** from high to low. The "about 1–2 m" line is for mid-latitude shelves and farming.

The old resonant-bay scaling was dropped. A real ocean responds at roughly 0.7× in open water *(est.)*. The coast is where the range grows, on shelves and in the shallow delta, not as a breaking bore. The **19.0 h** half-day of Der's **38.1 h** tidal day is still the rhythm of the equatorial shelves. Earth's Bay of Fundy reaches ~16 m from a smaller forcing, which is why a funnel tide near 8 m, and a ceiling near 11 m, is the physical range kept here *(est.)*. A one-dimensional channel at 55° S does not turn that coast into an 8 m tide: the equilibrium tide there is about a third of the equatorial bulge. No bore forms. In the inner bay the flood is about 0.50 m/s, against a critical speed of about 4.4 m/s in 2 m of water *(est., derived)*.

"""

NEW_LAUNCH = """##### Launch field: backward shots only

**Der's railguns fire backward only** (against Der's orbital motion): onto the transfer to synchronous orbit, or **down to Kakakiko**. There are no forward launches. **(Locked, Doug's decision.)** Forward shots are not used. The old objection from residents at a trailing point belonged to a placement that was abandoned. Those points are unstable.

**Geometry: long flat rails on the equator** *(est., derived)*. Der has no air. A horizontal rail shot just above Der's **2.03 km/s** escape speed does not keep its launch direction: Der's gravity bends it around.

- **Synchronous-orbit shot (the operating cargo shot).** The Hohmann departure needs **0.52 km/s** left over after escaping Der (519 m/s). Surface launch speed **2.09 km/s**. The leftover speed is **6%** of the launch kinetic energy. The departure swings **62°**. The flat-rail site is **62°** from the sub-Kakakiko point toward the leading apex, which is **28°** off the leading apex. Kakakiko stands **62°** from the zenith there. A backward equatorial shot at that speed leaves on the Hohmann. Because Der is tidally locked, a fixed equatorial site always throws the cargo retrograde. Timing, not steering, chooses which station on the synchronous ring the cargo meets. The Yard is not fixed in Der's sky.
- **Down shot**, perigee at 6,700 km (the atmosphere, unchanged target). Leftover speed **1.01 km/s** (planet-only circular case 1,011 m/s; with Der's own mass the mean is 1,014 m/s). Surface launch speed **2.27 km/s**. The departure swings **42°**. The site is **42°** from the sub-Kakakiko point toward the leading apex, which is **48°** from the apex. Kakakiko stands **42°** from the zenith there. Coast time about **2.4 days**. The speed at 6,700 km on that ellipse is about 3.1 km/s. That is the transfer speed there, not a circularization.
- **The abandoned phasing shot** (88 m/s left over, swing 85°, site 5° off the leading apex) was the old way to drift ahead of Der. That placement was abandoned because it is unstable. It is not an operating shot. Its arrival, about 0.05 G in the 7.5 km funnel, is not the cargo case anymore.
- **So the sub- and anti-Kakakiko points are still the wrong sites.** A flat rail there, fired backward, sends the cargo off toward or away from Kakakiko instead of backward.
- **The rails run along the equator and fire toward the sub-Kakakiko side.** Cargo launched horizontally at the sites above swings around Der and departs heading backward.
- **Energy.** Escaping Der still dominates the synchronous-orbit rail energy: the 0.52 km/s is **6%** of the launch kinetic energy. The down shot's 1.01 km/s is **20%** of the launch kinetic energy, so that shot is the harder rail job. A 10 m/s error in leftover speed moves the synchronous-shot swing by about **0.5°**. Rail speed on that shot still has to be tight (see below).

**The corporate lemon.** The prime ground for the synchronous shot is the equatorial strip about 28° off the leading apex, toward the sub-Kakakiko point. The down-shot ground is farther toward that point, about 42° from it. As mining expanded, competing corporations claimed land and bid, sued and maneuvered for the prime sites *(narrative)*. Later launchers took less optimal ground spreading outward, so the **launch field is a lemon or pointed-egg shape: stretched along the equator and narrowing in latitude**. Moving along the equator costs efficiency; moving off it costs more.

**Mining hardware** *(narrative)*: some mining operations on Der run **Mardat hardware and software**, either because it is best in class for automated mining or because it was picked up cheap during the war. It is a visible cross-border tell in a Turquenish system (see `review/visual_style_sheet_DRAFT.md`: Mardat interface scheme).

**Misalignment penalty** *(est., derived)*. A site θ off the ideal spot sends cargo off roughly θ from the ideal direction. The useful speed left over after escaping Der (v∞) drops by a factor of cos θ, and the sideways part (v∞ tan θ) must be cancelled later. Off the equator, that sideways part is out of Kakakiko's orbital plane and needs a plane-change burn. Along the equator it stays in the plane and can be partly absorbed by retiming and aiming (roughly ⅓–½ of the listed cost). The old tilt column belonged to the abandoned phasing shot and was dropped.

| Offset from ideal site / equator | Cosine loss of v∞ | Extra launch speed: sync (v∞ 0.52 km/s) / down (v∞ 1.01 km/s) | Extra launch energy: sync / down | Correction or plane-change Δv: sync / down |
|---|---|---|---|---|
| 5° | 0.4% | 0.5 / 2 m/s | 0.05% / 0.2% | 45 / 88 m/s |
| 10° | 1.5% | 2 / 7 m/s | 0.2% / 0.6% | 91 / 178 m/s |
| 20° | 6.0% | 8.5 / 30 m/s | 0.8% / 2.6% | 189 / 368 m/s |
| 30° | 13.4% | 21 / 74 m/s | 2.0% / 6.6% | 299 / 583 m/s |

**The real cost is the correction burn**, which cargo or catchers must pay with propellant. At 20–30° off the equator the correction is **189–299 m/s** on top of the synchronous shot's 0.52 km/s, and **368–583 m/s** on top of the down shot's 1.01 km/s. That is why the field stays narrow in latitude and why the prime sites are fought over. Along the equator, retiming can absorb roughly ⅓–½ of the listed correction *(est.)*.

**Rail tolerance** *(est., derived)*. Near the Hohmann transverse speed, 1 m/s of error moves periapsis by about **166 km**. Two metres slow: periapsis 53,745 km, and the arrival burn rises to about 800 m/s. The nominal shot meets 54,076 km at 771 m/s. Two metres fast: periapsis 54,408 km, and the ellipse never reaches synchronous orbit. Holding periapsis within ±20 km needs a speed tolerance of about **0.12 m/s**. The swing error at that tolerance is negligible. A dumb rail slug does not have a wide launch window. A propelled ship that can trim departure speed and flight-path angle does: a radial component of ±8 m/s, at the exact Hohmann transverse speed, shifts the launch epoch by about −4.3 h to +3.8 h (about **8 hours**) for an extra **0–7 m/s**. Changing the transverse speed by ±8 m/s costs more than 100 m/s. The passive catcher still has only seconds (below).

##### The Orbital Boost *(est.)*

The cargo railguns are on **Der Eindringling**, not on Kakakiko.

- **Why Der is ideal:** it is airless and low-gravity: surface gravity **2.04 m/s² (0.208 G)**, escape velocity **2.03 km/s** (Kakakiko: 11.2 km/s through 1.5 atm of air). A railgun on Der needs no heat shield and fights no drag.
- **No spin boost:** Der is tidally locked, so its day equals its **13.213 d** orbit and its surface turns at only **5.6 m/s**, about 0.3% of escape velocity. The old "rotational boost" was replaced by the physics below.
- **The real boost is Der's orbital velocity:** Der circles Kakakiko at **1.32 km/s**, and everything it launches starts with that speed. The railgun supplies escape from Der plus the change to that orbital motion.
  - **Backward shots only** (against Der's motion; see "Launch field" above for the site): these drop the cargo onto a lower, faster orbit. The operating shot is the synchronous-orbit transfer: **0.52 km/s** beyond escape, surface speed **2.09 km/s**, coast **3.18 days**, caught at **0.77 km/s**. A stronger backward shot, **1.01 km/s** beyond escape (surface speed **2.27 km/s**), drops cargo **down toward Kakakiko** (perigee at the atmosphere, 6,700 km).
  - Forward shots are not used (Locked). The old reason was an objection from a trailing habitat. That placement was abandoned because it is unstable.

##### The Perfect Trajectory

Launching from the equator keeps the cargo in Kakakiko's orbital plane. The synchronous-orbit transfer then meets the Yard's Goliath Funnel.

#### Synchronous orbit: Haven, the Yard, and the watch station

**Synchronous (stationary) orbit** is **54,076 km** from Kakakiko's center *(est., derived)*, **8.16** planetary radii. Circular speed **2,776 m/s**. Light time from the planet's center **0.180 s**. The earlier **54,070 km** figure is 6 km lower and is the same orbit.

A test particle there stayed quiet for **1,000 years** in the 2026-10-09 IAS15 run: eccentricity at most 0.018, semi-major axis 53,972–54,118 km, closest sampled approach to Shudder 60,900 km, logged station-keeping 0. This v2.41b run did not repeat that integration. Radial wander if the eccentricity reaches 0.018 is about ±970 km. Circularizing that would be about 50 m/s per millennium, about **0.05 m/s per year**. That is trim, not a survival burn. The quiet dynamical band in that run is about 12,000–56,000 km. The band 20,000–35,000 km is even quieter, but it sits inside the radiation belts, so crewed stations do not park there.

Neither moon's L4 or L5 is usable. In that same integration every equilateral test particle, and both L3 controls, was lost inside 50 years. With the other moon removed, the points librate for at least 300 years. The second moon is what wrecks them.

The old Yard and Haven placement at L4 and L5 was abandoned because those points are unstable.

**Haven** (trade, diplomacy, and the O'Neill cylinders) hangs over the equatorial continent, at Continent B's equatorial crossing. That is the lowest-energy place to reach orbit from the inhabited equatorial land. **The Yard** sits **100–120° ahead** of Haven in the same orbit. The recommended lead is **110°** *(est.)*. At 110° the chord is **88,600 km**, **0.30** light-seconds. The planet's angular half-width from this orbit is **7.0°**, so the line of sight between two stations stays clear unless they are within about 14° of opposite each other (inside **166°** of 180°). Haven and the Yard see each other. A watch station in the long gap sees both as well. The Yard at that lead falls off Continent B into ocean. It does not need to hang over land.

##### Transfers from the moons *(est., derived)*

From a circular orbit at Der's **240,000 km**, on the planet's gravity alone:

- Departure brake **519 m/s**, arrival burn **771 m/s**, total **1,289 m/s** (**1.29 km/s**). This is the figure that was to be checked. It checks.
- Coast **3.18 days**.
- Speeds: circular at Der **1,318 m/s**, speed on the transfer as it leaves **799 m/s**, speed as it arrives **3,546 m/s**, circular at synchronous orbit **2,776 m/s**.

Including Der's own mass, the total is **1,292 m/s** at the mean distance, **1,300 m/s** at perigee (232,800 km, coast 3.06 d), and **1,284 m/s** at apogee (247,200 km, coast 3.29 d). Publish **1.29 km/s**, and the range **1.28–1.30 km/s** with the eccentricity. A bi-elliptic transfer does not beat this Hohmann. The radius ratio is about 4.4, and the bi-elliptic advantage starts near 12.

Shudder to synchronous orbit is cheaper: about **1.05 km/s** if circular at 151,060 km (coast **1.85 d**), **1.06 km/s** from perigee (1.46 d), and **1.00 km/s** from apogee (2.27 d). Shudder is not a shipping moon. Quakes, and no industry. Do not route cargo that way. Shudder's synodic period against the planet's spin is **43.3 h**.

**Launch windows.** Der's tidal day, the synodic period of the planet's spin against Der, is **38.1 h** (38.083 h). One Hohmann window per station per synodic period. At the moment of launch the target station is **93° ahead of Der**. The Yard, 100° / 110° / 120° ahead of Haven, has its window **10.6 / 11.6 / 12.7 hours before** Haven's window. Along-track motion at synchronous orbit is **2,478 m/s**. A passive funnel therefore has a short mouth: **4.0 s** to cross 10 km, **12 s** for 30 km, **40 s** for 100 km. The rail slug has to hit that. A ship that can trim its burn has the ~8 hour window above.

##### The Yard and the Goliath Funnel

The Yard is the industrial powerhouse of the system. It is not a single station. It is a sprawling complex of unpressurized, kilometers-wide scaffolding frames. Suited workers and automated fabrication swarms forge zero-gravity foam-metal alloys, crystalline titanium-carbon composites, and the hulls of small ships, sleds, interstellar freighters, defense vessels, and, during the war, capital ships.

The workspace is a harsh, utilitarian landscape lit by the blinding glare of plasma welding and the dull orange glow of newly cast hull plates cooling in the vacuum. Human presence is mostly in designated zones. Outside them are engineering supervisors, drone-fleet operators, and corporate security, where mostly automated systems work. Small spin habs sit near the Yard. Paradise, the off-cycle cylinder for yard workers and miners, is one of Haven's cylinders.

**The Goliath Funnel stays at the Yard.** It is a momentum catcher with regenerative braking. What arrives is the **0.77 km/s** arrival burn of the Hohmann, not the full 1.29 km/s. Over the existing **7.5 km** length that is **4.0 G** for **19.5 s** *(est., derived; 4.04 G in the formula)*. A 10 km funnel is **3.0 G** for 26 s. A 30 km funnel is **1.0 G** for 78 s. One G needs 30.3 km, 3 G needs 10.1 km, and 5 G needs 6.1 km. A 1,000 t slug carries **297 GJ** (82.5 MWh). Peak power at 7.5 km is **15 GW**. Storage on the scale of the gate's 125 TJ makes the energy small. Peak power is the engineering load. The old hard-shot rating still covers this: braking 1 km/s over 7.5 km is ~6.8 G, and 3 km/s is ~61 G. The 88 m/s arrival belonged to the abandoned phasing shot.

**Recommendation** *(est.)*: keep a regenerative electromagnetic Goliath Funnel at the Yard, cargo only, at about **4 G** over the existing 7.5 km. Lengthening it to about 10 km (3 G) or about 30 km (1 G) is the gentler build if the coils allow. Crew and finished ships brake on their own drives.

Alternatives that were checked and not chosen:

- **Aerobraking** is impossible at 8.2 planetary radii. There is no air.
- **A catcher net** at 0.77 km/s destroys the slug and the net.
- **A tug** at 0.005 g takes 4.4 h over 6,100 km; at 0.01 g, 2.2 h over 3,000 km. A fusion drive (exhaust 98 km/s) spends a mass ratio of **1.008** either way. A chemical kick at about 280 s specific impulse spends a mass ratio of **1.32**, about **24%** propellant. A dumb slug cannot carry a fusion motor, so the tug is for ships and for slugs that missed, not for the ordinary shot.

###### The Structure

It looks like a colossal, hollow, skeletal O'Neill cylinder-long cylinder frame but entirely open to the vacuum of space. Payload enters at one end, where the largest coil is, the full 2 km wide, and within 7.5 km down the length the slug is slowed and the energy is captured.

###### The Physics

The interior is lined with a series of ever-narrowing superconducting electromagnetic rings. As a cargo block flies into the wide mouth of the funnel, it passes through these coils. The magnetic fields act as a non-contact, progressive regenerative brake.

The casing, iron, has the same outer dimensions. The more expensive metals are squeezed to the center of the cylinder. This keeps the center of gravity and still has the same interaction with the funnel's coils.

###### The Energy Loop

The funnel does not just slow the cargo without a physical collision. It captures the kinetic energy of the incoming block and turns the braking force back into electricity. Once slowed to a standstill, the cylinder is dismantled, sorted, and packaged for the next leg. That can be a short hop to the yard frames, a transfer along the synchronous ring to Haven, or a shuttle down to a mid-latitude city on Kakakiko.

On the surface of Der, the railguns fire dense cylinders of refined iron, with nickel, cobalt, and heavy radioactive elements inside, backward against the moon's orbital motion. The cargo coasts about **3.18 days** and runs into the funnel.

##### Haven: O'Neill colonies and the spaceport

Haven is the commercial hub, in the same synchronous orbit, over the equatorial continent. Safely removed from the industrial glare of the Yard, this is where the wealth of Kakakiko is on display for those who travel between systems. Ships from the gate finish their crossing here.

Interstellar passenger terminals handle colonists, passengers, corporate executives, and wealthy tourists. While the Yard builds the ships, Haven handles traffic in and out of the system. Automated container docks move planetary goods (luxury deep-sea food, biological products, and rare volcanic minerals from Kakakiko's mid-latitude island chains) into long-range vessels.

Using the structural metals and nuclear fuel mined from Der Eindringling, the colonists have built a cluster of O'Neill cylinders. These rotating worlds house traders, diplomats, short-term visitors, and the off-cycle home for yard workers and miners (**total residency is 2.2 million, but usually at a time it is closer to 1.3 million**).

Built with carbon-nanotube matrices and hyper-tensile alloys forged in zero-g, the cylinders are kilometers long and self-sustaining. Their structural integrity holds against the occasional micrometeoroid. Some spin to **1.0 G** for Turquenish travelers (1 rpm needs an 894 m radius *(est., derived)*; other radii `TBD`). Others spin at **0.967 G** to match Kakakiko. Interiors have lakes, forests, towers, and agricultural rings. The 0.967 G cylinders keep Kakakiko's 34-hour day. The 1.0 G cylinders keep a 24-hour day.

##### The watch station (monitoring and weather)

**Locked (Doug's decision) except where noted.** The former L3 watch station was moved. It fills the gaps between the major installations. It is not parked at L3.

- **Location:** synchronous orbit, in a gap between Haven and the Yard, over a deep ocean trench beside an underwater ridge. An ancient volcanic chain built the ridge. During Der Eindringling's capture era, extra heat and tidal stress weakened that line. A great quake marked the first rupture. It did not dig the trench. Over the following tens of millions of years the broken plate began to sink, and the trench beside the ridge is the result. Recommended size **8–11 km** deep and **800–2,000 km** long *(est.)*, inside the planet's usual 10–12 km trench depths. The recommended place is the long ocean arc roughly opposite the Haven–Yard pair, so the station is not sitting on Continent B. Exact longitude is open.
- **Why that trench is plausible** *(est.)*: capture energy **2.7×10²⁸ J**, about **2–30×** normal heat flow for 1–10 Myr, is enough to weaken an old volcanic line and to feed the canon volcanism burst. Present-day tidal stress from the 3.78 m conjunction bulge is only about 17 kPa, which does not crack a plate by itself. One quake cannot open a trench: a 20 m slip is about 1/400 of an 8 km depth. Convergence of 2–8 cm/yr over ~90 Myr consumes 1,800–7,200 km of lithosphere, which is enough for a mature trench after a 1–10 Myr start. Earth analogs: Mariana (~10.9 km deep, ~2,550 km long) and Tonga (~10.8 km, ~2,500 km) are mature; Puysegur, beside the Macquarie Ridge, is the incipient case (a trench a few hundred kilometres long and about 6 km deep, next to a volcanic ridge); Izu–Bonin began about 52 million years ago along a weak zone, with arc lavas within a few million years, not from one quake. After ~90 Myr the ridge and the trench can still be neighbors.
- **View:** weather and monitoring for the ocean under it, and a line of sight to both Haven and the Yard. A 100–120° separation is inside the 166° limit. The planet blocks a neighbor only when that neighbor is within about 14° of the antipode. It does not permanently block the relay.
- **Station-keeping** *(est.)*: trim, from about **0** up to about **0.05 m/s per year** if the orbit is pumped to eccentricity 0.018. The 1,000-year integration logged none. This replaces active station-keeping as a requirement for living at a Lagrange point of either moon. Those points were abandoned because they are unstable. The old 18.4-day e-folding belonged to the abandoned opposite-Der point.
- **Crew (Locked, narrative):** **at most under 50; usually ~20; 40+ during crew changeover**, so the station feels empty, then crowded for several days.
- **Who serves there (Locked, narrative):** **mostly Islanders, because it counts as a planetary post. Most Orbitals see it as isolated, with no career or political benefit.**
- **Duty cycle:** **two weeks on / two weeks off** (Doug decision). Crew shuttles, straight-line flip-and-burn, distance from the surface to synchronous orbit **47,450 km** *(est., derived)*:
  - **0.005 g: 17.3 h, Δv 3.05 km/s**, mass ratio 1.032, propellant **3.1%**
  - **0.01 g: 12.2 h, Δv 4.31 km/s**, mass ratio 1.045, propellant **4.3%**
  - From a 300 km orbit the distance is 47,150 km: **17.2 h / 3.04 km/s** and **12.2 h / 4.30 km/s**, propellant **3.1%** and **4.3%**.
  - Round trip about **1.4 d** or **1.0 d**, still inside a 14-day off period.
  - Not used: 0.05 g and 0.1 g stay Expanse-level and are not used.
  - Supplies and bulk cargo come up by slow ion/plasma freighters. Cargo Hohmann from a 300 km orbit to synchronous orbit: **7.2 h**, departure **Δv 2.57 km/s**, arrival **Δv 1.45 km/s**, total **4.02 km/s**.

##### Radiation belts *(est.)*

The data block gives a weak intrinsic dipole, **5–10% of Earth's moment**, and no tighter number. That range is the assumption here. Earth's surface field is taken as 31 μT at 6,371 km, and Earth's dayside standoff as 10 planetary radii at 2 nPa. Scaled to Kakakiko's radius, 5% of Earth's moment is a surface field of **1.4 μT** (moment 4.0×10²¹ A·m²) and 10% is **2.8 μT** (8.0×10²¹ A·m²).

Tau Ceti's wind is an estimate: solar dynamic pressure, times 1/0.71², times a mass-loss factor **0.2–1.0**, gives **0.79–3.97 nPa**. That matches the earlier ~1–4 nPa band.

Chapman–Ferraro standoff, with the constant set so that Earth lands on 10 radii, is **3.2–5.2 planetary radii** on the dayside (**20,900–34,500 km**). A terminator flare of about 1.4×, itself an estimate, reaches **4.4–7.3 radii**. Synchronous orbit at **8.16 radii** sits **outside** the dayside magnetosphere and **outside** that terminator estimate. It is not inside a trapped belt. The nightside tail may clip the orbit. That is not a trapped belt.

- **Inner belt**, the L = 1.2–2.5 analog: **8,000–16,600 km** from the center. It sits inside the magnetosphere in every case above. (This "L" is the magnetic-shell index, not a Lagrange point.)
- **Outer belt:** from L = 3 (**19,900 km**) out to the dayside standoff, so about **20,900–34,500 km** depending on moment and wind. At the weak-field, windy end the outer belt is only about 1,000 km thick. It cannot extend past the magnetopause.

The Der-to-synchronous Hohmann stays between about 8.2 and 36 planetary radii and does not cross the belts. The down shot to 6,700 km, and surface shuttles, do.

**Safe crewed parking:** outside the dayside magnetopause and inside the quiet dynamical band. That overlap is about **35,000–56,000 km**. Synchronous orbit is in it. Do not park crewed stations near 1.5–5 planetary radii. A clearance sphere of 8,000 km radius is not enough: the inner belt starts near 8,000 km. Shielding at synchronous orbit is for galactic cosmic rays and the quiet stellar wind, plus a storm shelter for rare events. Belt protons are not the driver there.

"""


def main() -> int:
    path = calc.JOB_DIR / "Tau_Cet_system_v2.41b_DRAFT.md"
    text = path.read_text(encoding="utf-8")

    text = once(
        text,
        "> **Status:** Draft v2.41 (2026-10-09, revised after Doug's reviews of v2 through v2.40). Doug's decisions of 2026-09-28 and 2026-09-30 stay **Locked** except Der Eindringling's mass ratio, which the 2026-10-09 decision replaces. Everything else follows the tags below.",
        "> **Status:** Draft v2.41b (2026-10-09, revised after Doug's reviews of v2 through v2.40, then after the tides and Lagrange check). Doug's decisions of 2026-09-28 and 2026-09-30 stay **Locked** except Der Eindringling's mass ratio, which the 2026-10-09 decision replaces. Doug's 2026-10-09 v2.41b decisions replace the resonant-bay tide picture, move the yards and habitats off the moons' Lagrange points, and park the watch station in synchronous orbit. Everything else follows the tags below.",
        "status",
    )
    text = once(
        text,
        "standoff ~3–5 planetary radii *(est.)*)",
        "standoff ~3.2–5.2 planetary radii *(est.)*)",
        "canon-standoff",
    )
    text = once(
        text,
        "its quakes are physics-supported and moderate *(est.)*. It does not tumble.",
        "its quakes are physics-supported *(est.)*. It does not tumble.",
        "moderate-quake",
    )
    text = once(
        text,
        "- **Tides follow real physics** (Doug decision): mid-latitude open water stays about 1–2 m. The equatorial open ocean runs about 2–4 m from high to low, up to about 4 m at king tide, and the resonant bays are much higher. Big surf still comes from storm swell, not tides (§6.5).",
        "- **Tides follow real physics** (Doug decision, 2026-10-09): open water is about 1–2 m on a normal day. A typical equatorial day is about 1.7 m from high to low. The recurring 13.2-day conjunction peak is about 5.7 m from high to low. The deepest neap is about 0.3 m. Ordinary shelves run about 4–7 m. A funnel or king tide in a shallow bay is about 8 m from high to low, with a physical ceiling near 11 m. Mid-latitude tides are gentle. Big surf still comes from storm swell, not tides (§6.5).",
        "tides-canon",
    )
    text = once(
        text,
        "it is a hazard near stations and the L4/L5 habitats, so it is banned in civilian traffic lanes.",
        "it is a hazard near stations and the synchronous-orbit habitats, so it is banned in civilian traffic lanes.",
        "habitats",
    )
    text = once(
        text,
        "For orbital industrial operations, equatorial mass-drivers launch refined minerals (from Der Eindringling) to the L4 Goliath Funnel & shipyards for regenerative braking. Alloy foundries and hull fabrication are the primary industries in L4, while the L5 lagrange point serves as the commercial hub featuring 1.0 G and 0.967 G O'Neill habitats, cargo port, and other trade and diplomatic services.",
        "For orbital industrial operations, equatorial mass-drivers on Der Eindringling launch refined minerals backward onto a transfer to synchronous orbit, about 54,076 km *(est., derived)*, where the Yard's Goliath Funnel catches them with regenerative braking. Alloy foundries and hull fabrication sit at the Yard, 100–120° ahead of the trade cylinders in that same orbit. The trade and habitation O'Neill cylinders (Haven) hang over the equatorial continent and hold 1.0 G and 0.967 G habitats, the cargo port, and the other trade and diplomatic services. The old placement of the Yard and Haven at the moons' L4 and L5 was abandoned: those points are unstable.",
        "glance",
    )
    text = once(
        text,
        "dayside magnetopause standoff ~3–5 R_p (Earth ~10, Mercury ~1.5).",
        "dayside magnetopause standoff ~3.2–5.2 R_p (Earth ~10, Mercury ~1.5) *(est.)*.",
        "data-standoff",
    )
    text = once(
        text,
        "Because **mid-latitude** tides are calm (about 1–2 m in open water), subaquatic farming and mining stay practical on the continental shelves and shallow seas.",
        "Because **mid-latitude** tides are gentle (about 1–2 m in open water), subaquatic farming and mining stay practical on the continental shelves and shallow seas.",
        "gentle-mid",
    )
    text = once(
        text,
        "Driven mechanically by the ongoing gravitational churning by its recent (100 million years) arrived moon, the small core's weak magnetic field was strengthened, helping shield the newly made dense atmosphere from Tau Ceti's stellar wind. *(fiction, physically supported; see Capture consequences below)* The field stays weak: a compact magnetosphere (dayside standoff ~3–5 planetary radii) backed by a Venus-like induced magnetosphere in the upper atmosphere and ionosphere *(est.)*.",
        "With the arrival of Der Eindringling and the energy it brought, both moons stir the core, and the small core's weak magnetic field was strengthened, helping shield the newly made dense atmosphere from Tau Ceti's stellar wind. *(fiction, physically supported; see Capture consequences below)* The field stays weak: a compact magnetosphere (dayside standoff ~3.2–5.2 planetary radii *(est.)*) backed by a Venus-like induced magnetosphere in the upper atmosphere and ionosphere *(est.)*.",
        "field-prose",
    )
    text = once(
        text,
        "Its southern coast at ~55° S holds the cold-water kayak bay.",
        "Its southern coast at ~55° S holds the cold-water kayak challenge: paddle against the incoming tide, then against the river as it forces its way back out.",
        "kayak-coast",
    )
    text = once(
        text,
        "The calm tides help keep coastlines and reefs stable, but tides are not the main erosion driver: storm waves, rain and rivers are.",
        "Gentle mid-latitude tides help keep those reefs stable. Equatorial shelves on the same chains are the ordinary 4–7 m class. Tides are not the main erosion driver: storm waves, rain and rivers are.",
        "reefs",
    )
    text = once(
        text,
        "| − Resonant-bay preserves (4 bays and their watersheds) |",
        "| − Wild-coast preserves (4 coasts and their watersheds) |",
        "land-budget",
    )
    text = once(
        text,
        "**Deepest trenches:** typically ~10–12 km (Earth's Challenger Deep ~10.9 km).",
        "**Deepest trenches:** typically ~10–12 km (Earth's Challenger Deep ~10.9 km). The capture-era trench beside the old volcanic ridge is **8–11 km** deep and **800–2,000 km** long *(est.)*, inside that range (see the watch station).",
        "trench-line",
    )
    text = once(
        text,
        "Tides from a close, massive moon also stir the liquid core mechanically (tidal and precession-driven core flows were proposed for the early Moon's dynamo: Dwyer+2011, Le Bars+2011).",
        "With the arrival of Der Eindringling and the energy it brought, both moons stir the core (tidal and precession-driven core flows were proposed for the early Moon's dynamo: Dwyer+2011, Le Bars+2011).",
        "core",
    )
    text = once(
        text,
        "Both moons are outside the synchronous line (**54,070 km**, unchanged), so the planet's tides push them **outward**.",
        "Both moons are outside the synchronous line (**54,076 km** *(est., derived)*; the earlier 54,070 km figure is 6 km lower and is the same orbit), so the planet's tides push them **outward**.",
        "sync-300",
    )
    text = once(
        text,
        "Both moons orbit outside the planet's synchronous line (54,070 km for a 34-hour day), so the planet's tides push them outward.",
        "Both moons orbit outside the planet's synchronous line (54,076 km *(est., derived)* for a 34-hour day; 54,070 km is 6 km lower and the same orbit), so the planet's tides push them outward.",
        "sync-353",
    )
    text = span(text, "##### Habitability note\n", "#### The Great Disturbance (equatorial tides)\n", NEW_HABIT, "habit")
    text = span(text, "Open-ocean response (0.7×):", "#### Old and New Moon\n", NEW_TIDES, "tides")
    text = span(text, "##### Launch field: backward shots only\n", "### 6.6 tC 6: Croquet Ball (The Gas Giant)\n", NEW_LAUNCH, "launch")

    text = once(
        text,
        "**Haven (the L5 point of Der, the Gateway Spaceport) remains Kakakiko's arrival port**: ships jump in at Croquet Ball's Trojan point, then cross the inner system to Haven. Ring geometry and signalling are in `lore/JUMPGATE_SPECS.md`.",
        "Ships jump in at Croquet Ball's Trojan point, then cross the inner system to the arrival port.\n  - **Haven, the Gateway Spaceport, remains Kakakiko's arrival port.** It sits in synchronous orbit over the equatorial continent. The old placement at a Lagrange point of Der was abandoned because those points are unstable. Ring geometry and signalling are in `lore/JUMPGATE_SPECS.md`.",
        "gate-haven",
    )
    text = once(
        text,
        "The last hop between Haven and Kakakiko adds ~1.5–2 d.",
        "The last hop between Haven and Kakakiko adds ~12–17 h.",
        "last-hop",
    )
    text = once(
        text,
        "The **main target is Haven (Der's L5)**.",
        "The **main target is Haven**, in synchronous orbit over Kakakiko.",
        "aim-target",
    )
    text = once(
        text,
        "dropped off in Kakakiko space (Haven L5, L4, Der or the planet)",
        "dropped off in Kakakiko space (Haven, the Yard, Der, or the planet)",
        "pod-drop",
    )
    text = once(
        text,
        "a magnetic funnel like the Goliath Funnel at Der's L4",
        "a magnetic funnel like the Goliath Funnel at the Yard",
        "feeder-funnel",
    )
    text = once(
        text,
        "- Lagrange points: L4 (Yard, leading), L5 (Haven, trailing), and L3 (Watch Station) each **240,000 km** from Kakakiko. L4 and L5 are also **240,000 km** from Der *(est., derived)*.\n- Kakakiko ↔ 240,000 km (L3/L4/L5) transit: fusion crew shuttles, constant-acceleration flip-and-burn at the hard-sci-fi baseline: **~38 h at 0.005 g, ~27 h at 0.01 g** *(est.)*. Ion/plasma cargo: Hohmann **~2.4 d**, up to weeks on low-thrust spirals *(est.; see Calculation notes)*. (0.1 g is 8.6 h and is Expanse-level and is not used.)\n- In-system transit times: gate ↔ Kakakiko as above *(est.)*: **~6.5–12 weeks with rail assist and pre-thrown fuel (v2.34)**, and still long unless Doug chooses a closer-gate option (open). Kakakiko ↔ L3/L4/L5 ~27–38 h (crew). Other routes (for example to Der's mines, the Sombrero, and the outer giants) are `TBD`, but can be scaled with t = 2√(d/a). Propellant at v_e = 98.1 km/s for the crew Δv of 6.8–9.6 km/s: mass ratio **1.07–1.10** (propellant **7–9%** of departure mass). Propellant is still not the limit. Thrust-to-mass still is.",
        "- Orbital facilities sit in synchronous orbit at **54,076 km** *(est., derived)*. Haven (trade and the O'Neill cylinders) hangs over the equatorial continent. The Yard sits 100–120° ahead of Haven. The watch station sits in a gap between them, over the trench. The old placement at either moon's L4 or L5 was abandoned because those points are unstable. Der's distance remains **240,000 km**.\n- Kakakiko ↔ synchronous orbit: fusion crew shuttles, constant-acceleration flip-and-burn at the hard-sci-fi baseline: **~17 h at 0.005 g, ~12 h at 0.01 g** *(est., derived)*. Ion/plasma cargo: Hohmann **~7.2 h** from a 300 km orbit, up to weeks on low-thrust spirals *(est.; see Calculation notes)*. (0.1 g is Expanse-level and is not used.)\n- In-system transit times: gate ↔ Kakakiko as above *(est.)*: **~6.5–12 weeks with rail assist and pre-thrown fuel (v2.34)**, and still long unless Doug chooses a closer-gate option (open). Kakakiko ↔ synchronous orbit ~12–17 h (crew). Other routes (for example to Der's mines, the Sombrero, and the outer giants) are `TBD`, but can be scaled with t = 2√(d/a). Propellant at v_e = 98.1 km/s for the crew Δv of 3.05–4.31 km/s: mass ratio **1.03–1.05** (propellant **3–4%** of departure mass). Propellant is still not the limit. Thrust-to-mass still is.",
        "section-8",
    )
    text = once(
        text,
        "The Orbitals are the L5 Cosmopolitans.",
        "The Orbitals are the Haven cosmopolitans, in the synchronous-orbit cylinders.",
        "orbitals",
    )
    text = once(
        text,
        '- War era: L4 built "massive capital ships, be it carriers or dreadnaughts"',
        '- War era: the Yard built "massive capital ships, be it carriers or dreadnaughts"',
        "war",
    )
    text = once(
        text,
        ", main target Haven)*",
        ", main target the Gateway Spaceport)*",
        "open-q",
    )
    text = once(
        text,
        "- **Resonant-bay preserves: resolved (v2.8).** There are exactly 4 wild resonant bays (equator; ~20–25° N; ~20–25° S; ~55° S), and their preserves (bays plus watersheds) are ~20,000 km² (8,000–40,000) *(est.)*, about 0.1% of the land, down from the old 1–2%.",
        "- **Wild-coast preserves: updated (v2.41b).** There are exactly 4 wild coasts (equatorial delta; ~20–25° N; ~20–25° S; ~55° S). Their preserves (shores plus watersheds) stay ~20,000 km² (8,000–40,000) *(est.)*, about 0.1% of the land. They are no longer bore coasts. The v2.8 count of four is what was kept.",
        "preserves",
    )
    text = once(
        text,
        "- **Resonant bays at ~20–25° vs. the cyclone belt (5–20°):** the north and south bays sit at the poleward edge of the cyclone belt, so storm surge can stack on the bores. That is dramatic, but those bays are also the most dangerous *(est.)*.",
        "- **Shelf coasts at ~20–25° vs. the cyclone belt (5–20°):** the north and south coasts sit at the poleward edge of the cyclone belt, so storm surge can stack on the 4–7 m shelf tide. That is dramatic, and those coasts stay the most dangerous *(est.)*.",
        "cyclone",
    )
    text = once(
        text,
        'so they no longer oversell ~1–2 m open-ocean tides. Resolved; listed for Doug\'s sign-off.',
        "The oversell was the old open-ocean wall. Normal open water is about 1–2 m. Resolved as a heading change; listed for Doug's sign-off.",
        "headings",
    )
    text = once(
        text,
        "L4/L5 at 240,000 km were not re-integrated.",
        "Neither moon's L4 or L5 is usable. The 2026-10-09 integration lost every equilateral particle and both L3 controls inside 50 years. This run did not re-integrate them. The old Yard and Haven placement there was abandoned.",
        "resonance-note",
    )
    text = once(
        text,
        "- **L3 duty cycle**: resolved text uses **38.3 h / 6.8 km/s** at 0.005 g and **27.1 h / 9.6 km/s** at 0.01 g, distance **233,000 km**. Round trip about 2.3–3.2 days. Hohmann **2.44 d**. 0.05 g and 0.1 g stay unused (12.1 h / 21 km/s and 8.6 h / 30 km/s). Duty cycle stays two weeks on / two weeks off.",
        "- **Watch-station duty cycle**: resolved text uses **17.3 h / 3.05 km/s** at 0.005 g and **12.2 h / 4.31 km/s** at 0.01 g, distance **47,450 km** up to synchronous orbit. Round trip about 1.0–1.4 days. Hohmann from a 300 km orbit **7.2 h** (Δv 4.02 km/s). 0.05 g and 0.1 g stay unused. Duty cycle stays two weeks on / two weeks off. The old opposite-Der transfer was abandoned with that station.",
        "duty",
    )
    text = once(
        text,
        "- **Rotational boost**: resolved text uses Der's **1.32 km/s** orbital speed, L4 at **88 m/s** beyond escape, down at **1.01 km/s** beyond escape. Backward shots only.",
        "- **Rotational boost**: resolved text uses Der's **1.32 km/s** orbital speed. The synchronous-orbit shot is **0.52 km/s** beyond escape. The down shot is **1.01 km/s** beyond escape. Backward shots only. The old phasing shot was abandoned.",
        "boost",
    )
    text = once(
        text,
        "**Der launch physics (v2.41).** v_esc = 2.030 km/s. Spin 5.57 m/s. Orbital speed 1.321 km/s. Planet-escape at Der's distance = √2 × 1.321 = 1.868 km/s, so outbound v∞ = 0.547 km/s and the surface speed is 2.10 km/s. Leaving Kakakiko entirely from Der's orbit, which is not a used cargo shot, would need **0.55 km/s** beyond escape (surface speed 2.10 km/s). Down to 6,700 km: apoapsis speed = 1.321 × √(2 × 6,700 / 246,700) = 0.308 km/s, so Δv = **1.013 km/s**, surface speed **2.27 km/s**. L4, one orbit, P′/P = 5/6: v∞ = **88 m/s**, surface speed **2.031 km/s**. Hyperbola e = 1 + R v∞²/(Gm) with Gm = 2.083×10¹² and R = 1.0115×10⁶ m. L4: e = 1.0038, asymptote 175.0°, swing 85.0°, site 5.0° off the leading apex. Down: e = 1.498, asymptote 131.9°, swing 41.9°, site 41.9° from the sub-Kakakiko point. Der's own Hill radius = a (m/3M_p)^(1/3) = **28,500 km**. Two-body periods at these axes are 6.6067 d and 13.2133 d, ratio 2.000.",
        "**Der launch physics (v2.41b, est., derived).** v_esc = 2.030 km/s. Spin 5.57 m/s. Orbital speed at 240,000 km on the planet's gravity is 1.318 km/s (1.321 km/s including Der's mass). Synchronous orbit a = (μ P² / 4π²)^(1/3) = **54,076 km**, circular speed **2,776 m/s**. Hohmann on the planet's gravity: departure brake **519 m/s**, arrival **771 m/s**, total **1,289 m/s = 1.29 km/s**, coast **3.176 d**. Hyperbola for that departure (v∞ = 519 m/s): e = 1.131, asymptote 152.2°, swing **62.2°**, site **27.8°** off the leading apex, surface speed **2.095 km/s**. Down to 6,700 km: planet-only v∞ = **1,011 m/s**, patched mean **1,014 m/s** (the published **1.01 km/s**), surface speed **2.27 km/s**, swing **42°**, site 42° from the sub-Kakakiko point. The old 88 m/s phasing hyperbola (e = 1.0038, swing 85°, site 5° off the leading apex) was checked and then abandoned with that placement. Der's own Hill radius stays **28,500 km**. Two-body periods at these axes are 6.6067 d and 13.2133 d, ratio 2.000. This run did not integrate.",
        "launch-calc",
    )
    text = once(
        text,
        """**L3 station (v2.41).** μ = GM_p = 4.167×10¹⁴ m³/s². From a 300 km low orbit (r = 6,928 km) to 240,000 km:
- **Hohmann:** semi-major axis **123,500 km** (123,464 km in the formula), t = **2.44 d**, Δv₁ = 10.81 − 7.76 = **3.06 km/s**, Δv₂ = 1.32 − 0.31 = **1.01 km/s**.
- **Faster ellipses**, time of flight to 240,000 km:

| Apoapsis | Time | Departure above the Hohmann Δv | Arrival Δv |
|---|---|---|---|
| 270,000 km | 1.71 d | +17 m/s | 1.17 km/s |
| 300,000 km | 1.54 d | +30 m/s | 1.29 km/s |
| 360,000 km | 1.39 d | +51 m/s | 1.45 km/s |
| 480,000 km | 1.26 d | +77 m/s | 1.63 km/s |

- **Geometry:** chord = 240,000 × √3 = **415,700 km** = 1.39 light-seconds. The published relay figure is **416,000 km**.
- **Stability:** λ ≈ √(21μ′/8) n with μ′ = 0.005 gives an e-folding time **18.4 d**. M_p/M_Der = 200 > 24.96. Not an N-body result at the new distance.
""",
        """**Synchronous station (v2.41b, est., derived).** μ = GM_p = 4.167×10¹⁴ m³/s². a = (μ P² / 4π²)^(1/3) with P = 122,400 s gives **54,076 km** (8.16 R_p). Circular speed **2,776 m/s**. Light time from the center **0.180 s**.
- **Hohmann, 300 km orbit (r = 6,928 km) to synchronous orbit:** departure **2,571 m/s**, arrival **1,453 m/s**, total **4,024 m/s**, time **7.2 h**.
- **Der to synchronous orbit:** **519 + 771 = 1,289 m/s**, coast **3.176 d**. See the launch-physics note. Patched range **1,284–1,300 m/s**.
- **Haven–Yard chord at 110°:** 2 × 54,076 × sin(55°) = **88,592 km** = **0.296** light-seconds. Planet half-angle **7.04°**. Line of sight stays clear inside **165.9°** of 180°.
- **Stability:** the 2026-10-09 IAS15 particle at 54,076 km stayed quiet for 1,000 years (e ≤ 0.018; a within 53,972–54,118 km). Trim if pumped is about **0.05 m/s per year**. The old opposite-Der e-folding of 18.4 days, and the 416,000 km relay chord, belonged to a station that was abandoned. This run did not integrate.
""",
        "sync-calc",
    )
    text = once(
        text,
        """**L3 crew transfer, flip-and-burn (v2.41, est.).** Straight-line approximation that ignores gravity and orbital velocity. d = 233,072 km (published **233,100 km**; the Known-tensions line uses **233,000 km**); g = 9.807 m/s². t = 2√(d/a); Δv = a·t.
- **0.005 g:** **38.3 h** and **6.76 km/s** (published **6.8 km/s**).
- **0.01 g:** **27.1 h** and **9.56 km/s** (published **9.6 km/s**).
- Not used: 0.05 g is 12.1 h (Δv 21 km/s); 0.1 g is 8.6 h (Δv 30 km/s).
- Mass ratio exp(Δv / 98.1 km/s) = **1.071–1.102** (published **1.07–1.10**, propellant **7–9%** of departure mass). Propellant is still not the limit. Thrust-to-mass still is.
""",
        """**Synchronous-orbit crew transfer, flip-and-burn (v2.41b, est., derived).** Straight-line approximation that ignores gravity and orbital velocity. Distance from the surface is 54,076 − 6,628 = **47,448 km**. From a 300 km orbit it is **47,148 km**. g = 9.80665 m/s². t = 2√(d/a); Δv = a·t. Exhaust 98.1 km/s.
- **0.005 g, from the surface:** **17.28 h**, **3,051 m/s**, mass ratio 1.032, propellant **3.1%**.
- **0.01 g, from the surface:** **12.22 h**, **4,314 m/s**, mass ratio 1.045, propellant **4.3%**.
- From 300 km: **17.23 h / 3,041 m/s** and **12.18 h / 4,301 m/s**. The old 38.3 h / 6.8 km/s and 27.1 h / 9.6 km/s figures belonged to a station that was abandoned.
- Mass ratio for 3.05–4.31 km/s is **1.03–1.05** (propellant **3–4%** of departure mass). Propellant is still not the limit. Thrust-to-mass still is.
""",
        "crew-calc",
    )
    text = once(
        text,
        "for the L3 crew-shuttle Δv of 6.8–9.6 km/s, a mass ratio of **1.07–1.10** (formula **1.071–1.102**; propellant **7–9%** of departure mass).",
        "for the synchronous-orbit crew Δv of 3.05–4.31 km/s, a mass ratio of **1.03–1.05** (propellant **3–4%** of departure mass). The old 6.8–9.6 km/s check belonged to a station that was abandoned.",
        "propellant",
    )
    text = once(
        text,
        "gives **R_mp ≈ 3.2–5.0 R_p**. Mercury ~1.5 R, Earth ~10 R. The induced magnetosphere (ionospheric currents, as at Venus) adds a barrier near ~1.1–1.5 R_p on the dayside.",
        "gives **R_mp ≈ 3.2–5.2 R_p** in the v2.41b scaling (wind **0.79–3.97 nPa** *(est.)*, moment 5–10% of Earth's, Chapman–Ferraro constant set so Earth is 10 R_p). Dayside standoff **20,900–34,500 km**. Inner belt **8,000–16,600 km**. Outer belt from **19,900 km** out to the standoff. Synchronous orbit at 8.16 R_p is outside the dayside magnetosphere and outside a 1.4× terminator estimate (4.4–7.3 R_p). Mercury ~1.5 R, Earth ~10 R. The induced magnetosphere (ionospheric currents, as at Venus) adds a barrier near ~1.1–1.5 R_p on the dayside. Safe crewed parking is about **35,000–56,000 km**.",
        "magnetopause",
    )
    text = once(
        text,
        "Synchronous orbit stays 54,070 km: a = (GM_p P² / 4π²)^(1/3) with P = 122,400 s.",
        "Synchronous orbit is **54,076 km** *(est., derived)*: a = (GM_p P² / 4π²)^(1/3) with P = 122,400 s. The earlier 54,070 km figure is 6 km lower and is the same orbit.",
        "periods-sync",
    )
    text = once(
        text,
        "- **L4/L5.** M_p/M_Der = 200 > 24.96. Not an N-body result at the new distance. Not re-integrated. Do not claim they are stable.",
        "- **L4/L5.** M_p/M_Der = 200 > 24.96, so the linear criterion is comfortable, and it is not enough. The 2026-10-09 IAS15 run lost all 72 equilateral particles and both L3 controls inside 50 years. With the other moon removed they librate for at least 300 years. The second moon is the wrecker. Neither moon's L4 or L5 is usable. The old Yard and Haven placement there was abandoned. This v2.41b run did not integrate.",
        "l45-calc",
    )
    text = once(
        text,
        "- Open-ocean response about 0.7×. Coastal scale factor 3.78 / 1.30 = 2.9: equatorial shelves **6–9 m**, four resonant bays **60–90 m**, bores **9–30 m**. Mid-latitude open water at about 35° is about two-thirds of the equatorial bulge: about **1.1 m** high and about **1.7 m** from high to low.",
        "- Open-ocean response about 0.7×. The v2.41b canon does not scale the old resonant bays. Normal open water is about **1–2 m**. A typical equatorial day is about **1.7 m** high-to-low (200-day crust-relative median 1.66 m). The conjunction peak is the rigid spring, about **5.7 m** high-to-low. The deepest neap is about **0.3 m**. Shelves are about **4–7 m**. A funnel or king tide is about **8 m**, with a ceiling near **11 m**. Mid-latitude open water at about 35° is about two-thirds of the equatorial bulge: about **1.1 m** high and about **1.7 m** from high to low. No bore: inner flood about 0.50 m/s against about 4.4 m/s critical in 2 m of water. The old resonant-bay scaling was dropped.",
        "tides-calc",
    )
    text = once(
        text,
        "- Spread evenly through the planet: about **4 K**. The magma figure 1.4×10²⁶ J is still **0.5%** of 2.7×10²⁸ J.",
        "- Spread evenly through the planet: about **4 K**. The magma figure 1.4×10²⁶ J is still **0.5%** of 2.7×10²⁸ J.\n- **Trench (v2.41b, est.).** The same 2.7×10²⁸ J, dumped over 1 Myr against 30–50 TW, is 17–29× normal heat flow, and over 10 Myr it is 1.7–2.9×. That matches the doc's 2–30× for 1–10 Myr. Present rigid bulge 3.78 m is a strain of about 6×10⁻⁷ and a stress of about 17 kPa at a 30 GPa rigidity, too small to crack a plate alone. Convergence of 2, 5, and 8 cm/yr over 90 Myr consumes 1,800, 4,500, and 7,200 km of lithosphere. Recommended trench **8–11 km** deep and **800–2,000 km** long. A single quake does not open it.",
        "trench-calc",
    )
    text = once(
        text,
        "Not changed on purpose: Doug's other spelling and grammar",
        "| C104 | **v2.41b (Doug, 2026-10-09):** Tides follow the checked ocean. Open water is about 1–2 m on a normal day, a typical equatorial day is about 1.7 m, the 13.2-day conjunction peak is about 5.7 m, the deepest neap is about 0.3 m, shelves are about 4–7 m, and a funnel or king tide is about 8 m with a ceiling near 11 m. The resonant-bay picture and its bores were dropped. Continent B's equatorial bay is a wide shallow delta, with reversing falls and structures set back and on stilts. Mid-latitude tides are called gentle. Shudder's quakes are no longer called moderate. With the arrival of Der Eindringling, both moons stir the core. Neither moon's L4 or L5 is usable; that placement was abandoned. Haven, the Yard, and the watch station move to synchronous orbit at 54,076 km. The Yard is 100–120° ahead of Haven. The watch station parks over a capture-era trench beside an old volcanic ridge. The Der railgun's operating shot is the 0.52 km/s synchronous transfer (surface 2.09 km/s), caught at the Yard by the Goliath Funnel at about 0.77 km/s and about 4 G. Crew hops to synchronous orbit are about 12–17 h. | Doug decision |\n\nNot changed on purpose: Doug's other spelling and grammar",
        "c104",
    )

    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"applied {path} bytes {path.stat().st_size}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
