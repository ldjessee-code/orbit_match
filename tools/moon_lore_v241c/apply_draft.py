"""Build Tau_Cet_system_v2.41c_DRAFT.md from the read-only v2.41b draft.

Change-log rows that start with "| C" are copied unchanged. Body lines are
edited to Doug's 2026-10-09 canon and to the calculations already in results\\.
"""

from __future__ import annotations

import re
from pathlib import Path

import calc

SRC = Path(
    r"F:\Dropbox\TheCourt\research\_jobs\tauceti-moon-lore-v241b-20261009"
) / "Tau_Cet_system_v2.41b_DRAFT.md"
DEST = calc.JOB_DIR / "Tau_Cet_system_v2.41c_DRAFT.md"

# Same checks as the job's read-only verify_draft.py.
CHECKS = {
    "100 million years": re.compile(r"(?i)100\s*million\s*years"),
    "~100 Myr": re.compile(r"(?i)~\s*100\s*Myr|\b100\s*Myr"),
    "Continent B": re.compile(r"\bContinent\s+B\b"),
    "backslash": re.compile(r"(?i)back[\s-]?slash"),
    "moderate quake": re.compile(r"(?i)moderate[^.|]{0,60}quake|quake[^.|]{0,60}moderate"),
}
TRENCH = re.compile(r"(?i)\btrench")
TNEG = re.compile(
    r"(?i)\bno\b|\bnot\b|\bnot yet\b|too young|would|could|future|someday|eventually|"
    r"crack|instead|rather than|without|never|may one day|in time|millions of years|"
    r"Myr from now|has yet|won.t|isn.t|no longer|former|replac|old "
)
PLACE = re.compile(r"(?i)\b(yard|haven)\b")
LPT = re.compile(r"\bL[45]\b")
NEG = re.compile(r"(?i)unstable|unusable|not usable|abandon|former|no longer|rejected|lost|moved|instead|old ")


def verify_lines(lines: list[str]) -> tuple[list[tuple[str, int]], bool, bool]:
    hits: list[tuple[str, int]] = []
    for i, line in enumerate(lines, 1):
        if line.strip().startswith("| C"):
            continue
        for key, rx in CHECKS.items():
            if rx.search(line):
                hits.append((key, i))
        if TRENCH.search(line) and not TNEG.search(line):
            hits.append(("trench as existing", i))
        if PLACE.search(line) and LPT.search(line) and not NEG.search(line):
            hits.append(("Yard/Haven at L4/L5", i))
    hdr = bool(re.search(r"v2\.41c", "\n".join(lines[:60])))
    row = any(line.strip().startswith("| C") and "v2.41c" in line for line in lines)
    return hits, hdr, row


def _sub(line: str, pattern: str, repl: str, tag: str, misses: list[str]) -> str:
    new, n = re.subn(pattern, repl, line, count=1)
    if n != 1 and pattern in line:
        misses.append(tag)
    elif n != 1 and tag:
        # Counted only when the caller knows this line should match.
        pass
    return new


def edit_body(line: str, misses: list[str]) -> str:
    """Edit one non-changelog line. Patterns use '.' for the file's dash character."""

    if "Draft v2.41b" in line and line.startswith("> **Status:**"):
        line = line.replace("Draft v2.41b", "Draft v2.41c", 1)
        old = "park the watch station in synchronous orbit. Everything else follows"
        new = (
            "park the watch station in synchronous orbit. "
            "v2.41c (Doug, 2026-10-09, 9:29–9:32 PM) sets the capture at about 1 million years ago, "
            "names the equatorial continent Bee-Slash, gives the opposite ridge a crack rather than a trench, "
            "sets the Yard lead at 110°, and makes the Goliath Funnel a 10 km frame with a 7–8 km brake. "
            "Everything else follows"
        )
        if old not in line:
            misses.append("status-tail")
        else:
            line = line.replace(old, new, 1)

    if "arrival ~100 Myr ago" in line:
        line = line.replace("arrival ~100 Myr ago", "arrival about 1 million years ago", 1)

    line = re.sub(
        r"100.120° ahead of the trade cylinders",
        "110° ahead of the trade cylinders",
        line,
        count=1,
    )

    if "A constant 81 ms/century is the wrong history" in line:
        old_start = "A constant 81 ms/century is the wrong history"
        idx = line.find(old_start)
        end = line.find("| (est., derived), see §13 |")
        if idx < 0 or end < 0:
            misses.append("day-cell")
        else:
            repl = (
                "At the present rate the day gains **0.81 s per millennium** and **0.23 h per million years**. "
                "If both moons had already been near these orbits for that whole million years, the day about "
                "1 million years ago would have been about **33.8 h**. Der's torque is new with the capture, so "
                "before the capture the rate was Shudder plus the star only, about **68 ms/century**, about "
                "**0.19 h** over that million years. The old resonance-locked backward track assumed both moons "
                "were already near the present orbits for many millions of years. A capture about 1 million years "
                "ago does not support that track. **81 ms per century** is a clock figure. The day is still "
                "lengthening, and a sundial does not show it. "
            )
            line = line[:idx] + repl + line[end:]

    if "**Deepest trenches:**" in line:
        line = (
            "  - **Deepest ocean floors:** typically ~10–12 km (Earth's Challenger Deep ~10.9 km). "
            "Beside the old volcanic ridge there is a crack, an early rupture, rather than a trench. "
            "A future trench is not there yet. In about 1 million years, 2–8 cm/yr of convergence is only "
            "20–80 km of lithosphere *(est.)* (see the watch station)."
        )

    if "about **2–30×** the planet's normal heat flow for 1–10 Myr" in line:
        line = line.replace(
            "about **2–30×** the planet's normal heat flow for 1–10 Myr (29× at the fast end, 1.7× at the slow end; see \"Capture consequences\").",
            "an upper bound. Dumped over about 1 million years it is about **17–29×** the planet's normal 30–50 TW heat flow (see \"Capture consequences\").",
        )

    if "erupted at ~3–30 km³/yr." in line:
        line = line.replace(
            "erupted at ~3–30 km³/yr.",
            "erupted at about **30 km³/yr** if that land was built in the million years since capture *(est.)*.",
        )

    if "The lava volume and the 3–30 km³/yr rate" in line:
        line = line.replace("the 3–30 km³/yr rate", "the about 30 km³/yr rate")

    if line.startswith("- **Compared with the planet's own heat budget.**"):
        line = (
            "- **Compared with the planet's own heat budget.** Kakakiko's normal internal heat flow is estimated at "
            "~30–50 TW (Earth: ~47 TW). The **2.7×10²⁸ J** figure is the binding energy of today's orbit, an upper "
            "bound if the capture ended there from a loosely bound path. Dumped over about 1 million years it is "
            "8.6×10¹⁴ W, about **17–29×** the normal 30–50 TW flow (29× at 30 TW, 17× at 50 TW). One million years "
            "of 40 TW is 1.26×10²⁷ J, so the upper bound is about **21×** that. A 40 TW flow removes the pulse in "
            "about **21 Myr** *(est.)*, so the mantle can still be warm. Spread evenly through the planet it is about "
            "**4 K** (about **3.6 K** at 1,200 J/kg/K *(est.)*)."
        )

    if line.startswith("- **Energy.** Settling Der Eindringling"):
        line = (
            line
            + "\n"
            + "- **Circularization inside about 1 million years** *(est., derived; §13)*. Rock dissipation does not "
            "take a high-eccentricity capture down to e ≈ 0.03 in that time. Cold rock and a warm Q = 30 interior "
            "still pump eccentricity at the final orbit, but so slowly that e = 0.03 barely moves in 1 million years. "
            "A warm Q = 10 tail from e = 0.20 to 0.03 takes hundreds of Myr. A global magma ocean with k₂/Q ≈ 3 "
            "*(est.)* reaches about e ≈ 0.04 from e = 0.85 in 1 million years. Two readings fit the published "
            "**e = 0.03**. Use the first. (1) A three-body capture already within a few hundredths of circular, so "
            "the 2.7×10²⁸ J upper bound was not fully deposited, and the warm lock (**0.14–0.43 Myr**) finishes. "
            "(2) Der stayed molten, k₂/Q ≈ 3, for that whole million years and landed near e ≈ 0.04, with 0.03 inside "
            "the uncertainty. The cold lock, **3.2 Myr**, does not finish. Der is locked, so the warm-interior track "
            "is required."
        )

    if "Faster mantle overturn carries cold slabs down to the core-mantle boundary over tens of Myr" in line:
        line = line.replace(
            "Faster mantle overturn carries cold slabs down to the core-mantle boundary over tens of Myr, which raises the core's heat flux.",
            "Slab delivery to the core-mantle boundary is a longer schedule than the million years since capture. "
            "The mantle can still be warm: young lava land can persist, volcanism can still be declining, and the weak "
            "magnetic field can persist. The surface is a habitable ocean world, not a magma ocean. Ongoing tidal heat "
            "in the planet is about **43 TW** (about 32 from Shudder, 7.7 from Der, 2.8 from the star).",
        )

    if "*(B does not reach that far south" in line:
        line = line.replace("*(B does not reach that far south", "*(Bee-Slash does not reach that far south", 1)

    if line.startswith("**Channel grazers**"):
        line = (
            "**Curlfish** *(narrative)*: a sea-turtle-sized, long-lived animal of these rivers and the muddy flats. "
            "The body is armadillo-like and armored, with a shrimp, lobster, or crawdad tail. It is an omnivore: "
            "aquatic plants, mud dwellers, and shellfish. The jaws are double-hinged book valves, a book hinge and a "
            "bivalve hinge together. With nothing in the mouth, one hinge seals the mouth in an overbite. For a large "
            "item, both hinges close around the prey and help digestion. It curls up to lock its armor plates together, "
            "protecting itself, its food, or its young. It migrates up and down the rivers. That passage keeps the "
            "delta's central channel from clogging."
        )

    if "No run went past 20,000 years." in line:
        line = line.replace(
            "No run went past 20,000 years.",
            "No run in that set went past 20,000 years. A separate IAS15 integration of the same bodies, Shudder "
            "started at e = 0.20, ran **1,200 years** (sample 2 years, epsilon 1×10⁻⁹): φ₁ stayed inside "
            "**−22.6° to +22.0°**, Shudder's eccentricity inside **0.190–0.235**, closest sampled separation "
            "**111,952 km** (2-year sampling, so the true minimum can be slightly closer; the 20,000-year run's "
            "closest was 111,300 km), relative energy error **1.2×10⁻¹⁵**. Conjunction at perigee and the 2:1 still hold.",
        )

    if "Nobody in the setting measures that." in line:
        line = line.replace(
            "Nobody in the setting measures that.",
            "Nobody in the setting measures that. Over 1 million years at this locked drift the axes move about "
            "**680 km** (Shudder) and **1,080 km** (Der), and the day changes by about **0.23 h**. That is a small "
            "shift beside 151,060 km and 240,000 km. The pair was caught near the present distance while Der "
            "circularized. It did not ride this drift in from the old outer orbits.",
        )

    if "Tidally locked (1:1) before Der arrived" in line:
        line = line.replace(
            "Tidally locked (1:1) before Der arrived; the move from 1:1 into 3:2 stays in the 1–10 Myr after capture "
            "and finishes on the present orbit. Cold despin time at the new distance is **0.33 Myr**. A few hundred "
            "thousand years, still inside the 1–10 Myr settle window",
            "The planet is old, so Shudder was already at 1:1 before the capture. An eccentricity spike above about "
            "0.3 broke that lock. The spin slowed through 3:2 and stayed there, then e settled near **0.20**, where "
            "3:2 remains stable. Cold time to reach 3:2 on today's orbit is **0.33 Myr** (the a⁶ scale of the old "
            "cold clock). A softer k₂ gives about **0.08 Myr**. Both finish inside the million years since capture. "
            "Pseudo-synchronous spin at e = 0.20 is about 1.24 times the mean motion, not 1.5",
        )

    if "Both sit inside the 1–10 Myr settle window, so Der locked early even without closer passes." in line:
        line = line.replace(
            "Both sit inside the 1–10 Myr settle window, so Der locked early even without closer passes.",
            "The cold **3.2 Myr** does not finish inside the million years since capture. The warm **0.43–0.14 Myr** does. "
            "Der is locked, so the warm-interior track is the one that fits.",
        )

    if "| Arrival | **~100 million years ago** |" in line:
        line = line.replace(
            "| Arrival | **~100 million years ago** |",
            "| Arrival | **about 1 million years ago** |",
        )

    if "about 0.05 G in the 7.5 km funnel" in line:
        line = line.replace(
            "about 0.05 G in the 7.5 km funnel, is not the cargo case anymore.",
            "about 0.05 G on the old 7.5 km comparison length, is not the cargo case anymore. "
            "The operating catcher is the 10 km frame.",
        )

    fixed_lead, n_lead = re.subn(
        r"sits \*\*100.120° ahead\*\* of Haven in the same orbit\. The recommended lead is \*\*110°\*\* \*\(est\.\)\*\.",
        "sits **110° ahead** of Haven in the same orbit (Doug, 2026-10-09).",
        line,
        count=1,
    )
    if "recommended lead is" in line and n_lead != 1:
        misses.append("yard-lead")
    else:
        line = fixed_lead
    if "A watch station in the long gap sees both as well." in line:
        line = line.replace(
            "A watch station in the long gap sees both as well.",
            "A watch station in the long gap sees both once it sits off the crack. On the crack itself the planet hides Haven.",
        )
    line = re.sub(
        r"The Yard, 100° / 110° / 120° ahead of Haven, has its window \*\*10\.6 / 11\.6 / 12\.7 hours before\*\*",
        "The Yard, **110°** ahead of Haven, has its window **11.6 hours before**",
        line,
        count=1,
    )

    if line.startswith("**The Goliath Funnel stays at the Yard.**"):
        line = (
            "**The Goliath Funnel stays at the Yard.** It is a momentum catcher with regenerative braking. "
            "What arrives is the **0.77 km/s** arrival burn of the Hohmann, not the full 1.29 km/s. The catcher is a "
            "**10 km** cylindrical skeleton frame. About **7–8 km** of that length is the brake. The last **1–2 km** "
            "is storage and logistics: warehousing and routing. Over 7 km the brake is **4.3 G** for **18 s**. Over "
            "8 km it is **3.8 G** for **21 s** *(est., derived)*. The old 7.5 km comparison is **4.0 G** for **19.5 s** "
            "(4.04 G in the formula) and is not the operating length. Braking over the whole 10 km frame would be "
            "**3.0 G** for 26 s, and that is not the operating load, because the last 1–2 km is not brake. A 30 km "
            "brake would be **1.0 G** for 78 s. One G needs 30.3 km, 3 G needs 10.1 km, and 5 G needs 6.1 km. A 1,000 t "
            "slug carries **297 GJ** (82.5 MWh). Energy divided by brake time is about **16 GW** at 7 km, **15 GW** at "
            "7.5 km, and **14 GW** at 8 km. Storage on the scale of the gate's 125 TJ makes the energy small. Peak "
            "power is the engineering load. The old hard-shot rating still covers a shorter, harder stop: braking "
            "1 km/s over 7.5 km is ~6.8 G, and 3 km/s is ~61 G. The 88 m/s arrival belonged to the abandoned phasing shot."
        )

    if line.startswith("**Recommendation** *(est.)*: keep a regenerative electromagnetic Goliath Funnel"):
        line = (
            "**The operating catcher** *(est., derived)*: a regenerative electromagnetic Goliath Funnel at the Yard, "
            "cargo only, a 10 km frame with the brake on the first 7–8 km at about **3.8–4.3 G**. Crew and finished "
            "ships brake on their own drives."
        )

    if "within 7.5 km down the length" in line:
        line = line.replace(
            "within 7.5 km down the length the slug is slowed and the energy is captured.",
            "the frame is **10 km** long. The slug is slowed over the first **7–8 km**, and the last **1–2 km** "
            "holds the slowed cargo for warehousing and routing.",
        )

    if "The 1.0 G cylinders keep a 24-hour day." in line:
        line = line.replace(
            "The 1.0 G cylinders keep a 24-hour day.",
            "The 1.0 G cylinders keep a 24-hour day. The cylinders stay classic open O'Neill habitats, with shielded "
            "windows and mirrors. Cosmic-ray shielding plus a storm shelter is enough, because the stations sit "
            "outside the belts.",
        )

    if line.startswith("- **Location:** synchronous orbit, in a gap"):
        line = (
            "- **Location:** synchronous orbit, in the long gap between Haven and the Yard. Haven sits over Bee-Slash. "
            "The ridge is opposite Bee-Slash, across the equator, **180°** from Haven. Given a capture about 1 million "
            "years ago, that ridge has only a crack, an early rupture, rather than a trench. A future trench is not "
            "there yet. The Yard's 110° lead puts the Yard about **70°** from the ridge and the crack, inside the "
            "60–80° band. A station sitting on the crack, 180° from Haven, cannot see Haven: the planet blocks the "
            "line of sight within about 14° of the antipode. The recommended offset is about **25°** from the crack "
            "into the long gap, about **155°** from Haven and about **95°** from the Yard, so the station sees both. "
            "Exact longitude is still open *(est.)*."
        )

    if line.startswith("- **Why that trench is plausible**"):
        line = (
            "- **Why the ridge has a crack and not a trench** *(est.)*: capture energy **2.7×10²⁸ J** is the binding "
            "energy of today's orbit, an upper bound on the heat deposited. If that whole amount arrived in about "
            "1 million years it is **17–29×** normal heat flow. Present-day tidal stress from the 3.78 m conjunction "
            "bulge is only about 17 kPa, which does not crack a plate by itself. One quake cannot open a trench: a "
            "20 m slip is about 1/400 of an 8 km depth, and a future trench is not there yet. Convergence of 2–8 cm/yr "
            "over about 1 million years is **20–80 km** of lithosphere, a crack, maybe about 1 km of graben relief "
            "*(est.)*. Earth analogs for a mature trench (Mariana, Tonga) took far longer than this. Puysegur is an "
            "incipient case beside a ridge, and it is older than this capture. Izu–Bonin began about 52 million years "
            "ago along a weak zone. After only about 1 million years the ridge and a future trench are not neighbors yet."
        )

    line = re.sub(
        r"A 100.120° separation is inside the 166° limit\. ",
        "With the station offset from the crack, both neighbors stay outside the blocked band. ",
        line,
        count=1,
    )

    if "The watch station sits in a gap between them, over the trench." in line:
        line = re.sub(
            r"The Yard sits 100.120° ahead of Haven\. The watch station sits in a gap between them, over the trench\.",
            "The Yard sits **110°** ahead of Haven. The watch station sits in the long gap, offset from the crack "
            "so the planet does not hide Haven. The ridge opposite Bee-Slash has a crack, an early rupture, and a "
            "future trench is not there yet.",
            line,
            count=1,
        )

    if line.startswith("- Der Eindringling captured:"):
        line = (
            "- Der Eindringling captured: **about 1 million years ago** *(narrative)*. Der's warm tidal lock "
            "(**0.14–0.43 Myr**) and Shudder's move into 3:2 (**0.33 Myr** cold) finish inside that span. A cold Der "
            "lock (**3.2 Myr**) does not. Keeping today's e ≈ 0.03 needs either a capture that was already nearly "
            "circular, or a molten Der (k₂/Q about 3 *(est.)*) for that whole million years. The 2:1 was caught while "
            "Der circularized, on a timescale of libration periods, not a long migration. They are not running during "
            "human history. The strengthening of Kakakiko's weak magnetic field stays with that warm settle *(est.)*. "
            "Colonial history (~1,600 years) sits inside a span the integration already found quiet. The moons do not "
            "need a migration chapter to cover it."
        )

    if line.startswith("- Der's despin and Shudder's 3:2 settling stay inside the 1–10 Myr"):
        line = (
            "- Der locked on the warm track inside the million years since capture (**0.14–0.43 Myr**). "
            "The cold clock is **3.2 Myr** and does not finish in that span. Shudder's 3:2 settling is **0.33 Myr** cold."
        )

    if "The capture itself stays the least physical part of the canon." in line:
        line = line.replace(
            "The capture itself stays the least physical part of the canon.",
            "The capture itself stays the least physical part of the canon. Published e ≈ 0.03 is kept. "
            "The preferred reading is a capture already nearly circular. The alternate is a molten Der for that "
            "million years (k₂/Q ≈ 3 *(est.)*), ending near e ≈ 0.04.",
        )

    if "That is not a 100 Myr proof and not a claim that the moons die at 20,000 years." in line:
        line = line.replace(
            "That is not a 100 Myr proof and not a claim that the moons die at 20,000 years.",
            "A fresh 1,200-year IAS15 run held φ₁ inside −22.6° to +22.0°, Shudder's e inside 0.190–0.235, "
            "closest sampled separation 111,952 km, relative energy error 1.2×10⁻¹⁵. "
            "Those lengths are the runs, not a geologic lifetime, and not a claim that the moons die when the integration stops.",
        )

    if "The Io-like formula's 23 TW is above what the orbit receives, so it is not a sustainable state." in line and "without the resonance" in line:
        line = line.replace(
            "The Io-like formula's 23 TW is above what the orbit receives, so it is not a sustainable state.",
            "The Io-like formula's 23 TW is above what the orbit receives, so it is not a sustainable state. "
            "An 80-year eccentricity scan librated most quietly at e = 0.20. Starts at 0.02, 0.05, and 0.25 did not "
            "stay in libration. Cold and warm rock move e = 0.20 by only a few thousandths in 1 million years. "
            "Dependent tides, sky sizes, and quake figures were checked and left as published. Keep **e = 0.20**.",
        )

    if "The day was about 33.8 h one Myr ago and about 31.6 h ten Myr ago on this dissipation. The track does not extend to the capture." in line:
        line = line.replace(
            "The day was about 33.8 h one Myr ago and about 31.6 h ten Myr ago on this dissipation. The track does not extend to the capture.",
            "At the present rate that is **0.81 s per millennium**. If the rate had already applied for the whole "
            "million years since capture, the day would have been about **33.8 h** then. Der's share is new with the "
            "capture, so the earlier rate was about **68 ms/century**. A backward track that moves the moons for "
            "many millions of years does not apply.",
        )

    if line.startswith("- 100 Myr of 40 TW"):
        line = (
            "- One million years of 40 TW is 1.26×10²⁷ J, so this capture energy is about **21×** one million years "
            "of heat flow at 40 TW. A 40 TW flow removes the pulse in about **21 Myr** *(est.)*. Against 30–50 TW, "
            "dumping the whole upper bound in 1 million years is **17–29×** normal heat flow."
        )

    if line.startswith("- **Trench (v2.41b, est.).**"):
        line = (
            "- **Crack, not a trench (v2.41c, est.).** The same 2.7×10²⁸ J, if dumped over 1 million years against "
            "30–50 TW, is 17–29× normal heat flow. Present rigid bulge 3.78 m is a strain of about 6×10⁻⁷ and a stress "
            "of about 17 kPa at a 30 GPa rigidity, too small to crack a plate alone. Convergence of 2, 5, and 8 cm/yr "
            "over 1 million years consumes 20, 50, and 80 km of lithosphere. That is a crack, an early rupture, maybe "
            "about 1 km of graben relief. A future trench is not there yet. A single quake does not open one."
        )

    if "Both sit inside the settle window, so Der locked early even without closer passes." in line:
        line = line.replace(
            "Both sit inside the settle window, so Der locked early even without closer passes.",
            "The warm times finish inside 1 million years. The cold 3.2 Myr does not, so a locked Der requires the warm interior.",
        )

    if "23 hours per 100 Myr" in line:
        new, n = re.subn(
            r"A constant-rate 81 ms/century is about 23 hours per 100 Myr and is the wrong history\..*$",
            "A constant-rate 81 ms/century is **0.81 s per millennium** and **0.23 h per million years** at the present "
            "orbits. If that rate had already applied for the whole million years since capture, the day then would "
            "have been about **33.8 h**. Der's torque is new with the capture, so the earlier rate was Shudder plus "
            "the star, about **68 ms/century**, and the day would have changed by about **0.19 h** over that million "
            "years. The old backward track, which put the moons closer and the day near 31.6 h and which became "
            "unusable near 34 million years, assumed both moons were already near today's orbits for that whole span. "
            "It does not date the capture. Do not publish a day length from that track.",
            line,
            count=1,
        )
        if n != 1:
            misses.append("spin-down-tail")
        else:
            line = new

    if "over 1–10 Myr that is 3–30 km³/yr" in line:
        line = line.replace(
            "over 1–10 Myr that is 3–30 km³/yr",
            "over about 1 million years that is about 30 km³/yr",
        )

    if "This v2.41b run did not repeat that integration." in line:
        line = line.replace(
            "This v2.41b run did not repeat that integration.",
            "This v2.41c run did not repeat that 1,000-year particle. It did run the moons for 1,200 years (§13).",
        )

    if "This v2.41b run did not integrate." in line:
        line = line.replace(
            "This v2.41b run did not integrate.",
            "This v2.41c run did not re-integrate the equilateral particles.",
        )

    if line.startswith("## 13. Sources"):
        line = (
            "- **Der's e = 0.03 and a capture about 1 million years ago** *(est.)*: published e stays **0.03**. "
            "Rock tides do not finish a high-e capture in that time. Preferred reading: the capture was already nearly "
            "circular. Alternate reading: a molten interior with k₂/Q ≈ 3 for the whole million years, ending near e ≈ 0.04.\n"
            "- **Watch station and the crack:** the ridge and its crack are 180° from Haven, and the Yard is about 70° "
            "from them. A station exactly on the crack cannot see Haven. Recommended offset about 25° into the long gap "
            "(about 155° from Haven, about 95° from the Yard). Exact longitude is open.\n"
            "- **Shudder's e = 0.20:** kept. The quiet resonant band in an 80-year scan was about 0.10–0.22, and the "
            "smallest libration amplitude on that grid was at 0.20. Dependent tide, sky, and quake numbers were checked "
            "and left unchanged.\n"
            + line
        )

    # Rename the continent on body lines only. Changelog rows never reach here.
    line = line.replace("Continent B", "Bee-Slash")
    line = line.replace("of B (its spine)", "of Bee-Slash (its spine)")
    line = line.replace("Because B is only", "Because Bee-Slash is only")
    line = line.replace("A 7.7 + B 7.7", "A 7.7 + Bee-Slash 7.7")
    return line


V241C_NOTE = """**Capture, lock, day, eccentricity, and the catcher (v2.41c)** *(est., derived)*. Same constants as the v2.41 notes. New checks are in the orbit_match tree under `tools/moon_lore_v241c`. REBOUND 5.2.1, IAS15, units year / AU / solar mass. Der's mass in the integrator is 1/200 of Kakakiko. No tides, no J2, and no spin inside the N-body runs.

- **Day.** Recomputed spin-down is Shudder 63.7 + Der 13.4 + star 4.4 = **81.5 ms/century**. Published stays **+81 ms/century**, shares **78% / 16% / 5%** (the v2.41 split was 63.7 + 13.3 + 4.4). That is **0.81 s per millennium** and **0.23 h per million years**. A clock sees it. A sundial does not. Before Der the rate is **68 ms/century**, **0.19 h per million years**.
- **Der lock.** Gladman despin, ω₀ = 2π/(10 h), α = 0.35. Cold Q = 100, k₂ = 0.045: **3.18 Myr**, which does not fit in 1 million years. Warm k₂ = 0.1, Q = 30: **0.43 Myr**. Q = 10: **0.14 Myr**. Der is locked, so the warm track is required.
- **Shudder 3:2.** The published cold clock is the a⁶ scale of the old cold time: **0.33 Myr**. Direct Gladman with k₂ = 0.045 gives **0.08 Myr**, because that k₂ is softer than the old clock. Publish **0.33 Myr**. The planet is billions of years old, so Shudder was already at 1:1 before this capture. Makarov 2012: 1:1 is allowed for e < 0.29, and 3:2 is captured while the spin slows through 3:2. Pseudo-synchronous equilibrium at e = 0.20 is about 1.24 n, not 1.5 n. The path that fits is an eccentricity spike above about 0.3, capture into 3:2, then damping of e toward 0.20.
- **Circularization.** High-e tracks hold orbital angular momentum so the end state can be e = 0.03 at 240,000 km. Hut's f₁ multiplies the satellite tide. None of the rock tracks reached e = 0.03 inside the time that was integrated (cold and warm Q = 30 are essentially frozen; warm Q = 10 falls from 0.85 only to about 0.65 in 1.2 Myr). Magma k₂/Q = 1 reaches about 0.07 in 2 Myr. Magma k₂/Q = 3 reaches about **0.038** from e = 0.85 in 1.0 Myr. At the final orbit the small-e tail is slower still: warm Q = 10 needs about 830 Myr to go from 0.20 to 0.03. Keep published **e = 0.03**, with the two readings in §6.5.
- **2:1 capture.** μ_Der = 0.005, α = 0.630, and an eccentricity-width scale μ^(1/3) ≈ 0.17. While Der circularizes, a(1−e²) stays nearly fixed, so a falls and the period ratio falls through 2. That sweep is convergent. Capture is expected if the sweep is slower than a libration period and Shudder's free eccentricity is inside the width. A free e already near 0.20 makes capture probabilistic. Once the ratio is sweeping through 2, the timescale is libration periods (years to 10⁴–10⁵ yr), not a million-year migration. Present locked drift is **0.68 m/yr** (Shudder) and **1.08 m/yr** (Der). Shudder's fractional drift is the larger one, so the period ratio is still decreasing. About 1 m/yr moves about 1 km in a thousand years, so the pair was caught near today's distance.
- **Shudder's eccentricity, kept at 0.20.** An 80-year IAS15 scan (sample 2 yr, epsilon 1×10⁻⁸) : e₀ = 0.02 and 0.05 were kicked up and did not librate; 0.10, 0.15, and 0.20 librated; 0.25 did not stay quiet. The smallest amplitude on that grid was at **0.20** (about 0.020). The 1,200-year run (epsilon 1×10⁻⁹, wall clock 24 s) held φ₁ inside **−22.6° to +22.0°**, e inside **0.190–0.235**, sampled separation minimum **111,952 km**, relative energy error **1.2×10⁻¹⁵**. Resonant-power equilibrium eccentricities are *(est.)* and are not used as a replacement: cold rock barely moves e = 0.20 in 1 million years (to about 0.202); warm rock to about 0.206; an Io-like k₂/Q would pull it toward about 0.17. Perigee **120,848 km**, apogee **181,272 km**, conjunction about **112,000 km**, and the published tides, sky angles, quakes, and heating stay as in v2.41b because e did not change.
- **Heat still in the planet.** Upper-bound capture energy 2.71×10²⁸ J is about **21×** one million years of 40 TW, and about **4 K** if spread through the planet (**3.6 K** at 1,200 J/kg/K). A 40 TW flow removes that pulse in about **21 Myr**, so a warm mantle today is allowed. The surface is not a magma ocean. Present tidal heat in the planet remains about **43 TW**.
- **Catcher.** a = v²/(2s) with v = 771 m/s. Brake 7 km: **4.33 G**, 18.2 s. Brake 8 km: **3.79 G**, 20.8 s. Published operating range **3.8–4.3 G** on a **10 km** frame. The 7.5 km / 4.0 G and 10 km / 3.0 G figures are comparisons, not the operating load.
- **Synchronous radius** (μ P² / 4π²)^(1/3), P = 122,400 s: **54,076 km**. Unchanged.

"""

C105 = (
    "| C105 | **v2.41c (Doug, 2026-10-09, 9:29–9:32 PM):** Capture set to about 1 million years ago. "
    "The equatorial continent is named Bee-Slash. The ridge opposite Bee-Slash has a crack, an early rupture, "
    "and a future trench is not there yet. Haven stays over Bee-Slash, 180° from that ridge. The Yard lead is 110°, "
    "about 70° from the ridge. The watch station is offset from the crack so it can see Haven. The Curlfish is named. "
    "The Goliath Funnel is a 10 km frame with a 7–8 km brake at about 4.3–3.8 G and 1–2 km of logistics. "
    "Cylinders stay classic open O'Neill habitats with shielded windows, mirrors, cosmic-ray shielding, and a storm shelter. "
    "Shudder's e = 0.20 is kept after a 1,200-year IAS15 check (relative energy error 1.2×10⁻¹⁵). "
    "Der's e = 0.03 is kept. Der's lock uses the warm track. | Doug decision |"
)


def build_text() -> tuple[str, list[str]]:
    raw = SRC.read_text(encoding="utf-8")
    newline = "\r\n" if "\r\n" in raw else "\n"
    misses: list[str] = []
    out_lines: list[str] = []
    for line in raw.splitlines():
        if line.strip().startswith("| C"):
            out_lines.append(line)
        else:
            out_lines.append(edit_body(line, misses))
    text = newline.join(out_lines)
    if not text.endswith(newline):
        text += newline
    marker = "### Change log (every change from"
    if marker not in text:
        misses.append("change-log-marker")
    else:
        text = text.replace(marker, V241C_NOTE + marker, 1)
    end = "Not changed on purpose:"
    if end not in text:
        misses.append("end-marker")
    else:
        text = text.replace(end, C105 + newline + newline + end, 1)
    return text, misses


def write_and_verify() -> int:
    text, misses = build_text()
    lines = text.splitlines()
    hits, hdr, row = verify_lines(lines)
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(text, encoding="utf-8", newline="\n")
    keys = list(CHECKS) + ["trench as existing", "Yard/Haven at L4/L5"]
    counts = {k: sum(1 for h in hits if h[0] == k) for k in keys}
    ok = not hits and hdr and row and not misses
    line = "VERIFY: %s - banned hits %d (%s); header v2.41c %s; change-log row %s; edit misses %d" % (
        "PASS" if ok else "FAIL",
        len(hits),
        ", ".join("%s=%d" % kv for kv in counts.items()),
        "yes" if hdr else "no",
        "yes" if row else "no",
        len(misses),
    )
    out_p = calc.JOB_DIR / "results" / "verify.txt"
    out_p.parent.mkdir(parents=True, exist_ok=True)
    detail = line + "\n\nHits (check -> line):\n" + ("\n".join("  %s -> line %d" % h for h in hits) or "  none")
    if misses:
        detail += "\n\nEdit misses:\n" + "\n".join("  " + m for m in misses)
    detail += "\n"
    out_p.write_text(detail, encoding="utf-8")
    print(line, flush=True)
    for hit in hits[:40]:
        print("  %s -> line %d" % hit, flush=True)
    for miss in misses:
        print("  MISS " + miss, flush=True)
    print("wrote " + str(DEST), flush=True)
    return 0 if ok else 1
