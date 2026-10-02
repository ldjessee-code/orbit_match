"""Suggestion scan: scale both moons inward, keeping the 2:1, and see
whether the star still breaks the resonance. Not a setting-doc value.
"""

import math
import time

import rebound

import tau_ceti_model as model

# Fraction of the published semi-major axes. 1.0 is the doc.
FACTORS = (0.65, 0.62, 0.60, 0.58, 0.55)
YEARS = 2000.0


def run_one(factor: float, companions: bool) -> str:
    a_s = model.A_AU["shudder"] * factor
    a_d = model.A_AU["der"] * factor
    sim, meta = model.build_moons(
        phase="resonant",
        a_shudder=a_s,
        a_der=a_d,
        companions=companions,
    )
    sim.integrator = "ias15"
    t0 = time.perf_counter()
    limit = a_s
    reason = "survived"
    max_e_s = 0.0
    max_e_d = 0.0
    min_sep = 1e9
    phi_max = 0.0
    while sim.t < YEARS:
        try:
            sim.integrate(min(sim.t + 0.5, YEARS), exact_finish_time=0)
        except (rebound.Escape, rebound.Collision):
            reason = "integrator stop"
            break
        sim.synchronize()
        r_s = math.dist(
            (sim.particles["shudder"].x, sim.particles["shudder"].y, sim.particles["shudder"].z),
            (sim.particles["kakakiko"].x, sim.particles["kakakiko"].y, sim.particles["kakakiko"].z),
        )
        if r_s < 0.5 * limit or r_s > 2.0 * limit:
            reason = f"shudder radial r/a0={r_s/limit:.2f}"
            break
        sh = model.elements_against(sim, "shudder", "kakakiko")
        de = model.elements_against(sim, "der", "kakakiko")
        max_e_s = max(max_e_s, sh["e"])
        max_e_d = max(max_e_d, de["e"])
        phi1, _phi2 = model.resonant_angles(sim)
        phi_max = max(phi_max, abs(phi1))
        sep = math.dist(
            (sim.particles["shudder"].x, sim.particles["shudder"].y, sim.particles["shudder"].z),
            (sim.particles["der"].x, sim.particles["der"].y, sim.particles["der"].z),
        )
        min_sep = min(min_sep, sep)
    wall = time.perf_counter() - t0
    return (
        f"f={factor:.2f} comp={int(companions)} t={sim.t:.1f} {reason} "
        f"max_eS={max_e_s:.3f} max_eD={max_e_d:.3f} "
        f"phi1_max_deg={math.degrees(phi_max):.1f} minsep_km={min_sep*model.AU_KM:.0f} wall={wall:.1f}s"
    )


def main():
    print("star+Kakakiko+moons, scaled a, resonant phase, up to", YEARS, "yr")
    t0 = time.perf_counter()
    for f in FACTORS:
        print(run_one(f, companions=False), flush=True)
        if time.perf_counter() - t0 > 480:
            print("WALL CAP before companion cases")
            return
    print("--- full companions at the most distant survivor ---")
    for f in (0.60, 0.55):
        if time.perf_counter() - t0 > 480:
            print("WALL CAP")
            return
        print(run_one(f, companions=True), flush=True)


if __name__ == "__main__":
    main()
