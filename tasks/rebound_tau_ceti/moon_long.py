"""Suggestion only: both moons at 0.60 of the published semi-major axes.

Keeps the 2:1 period ratio and the resonant phase (conjunction at Shudder
perigee). Integrates star + Sable + Kakakiko + moons + Croquet with IAS15.
This is not a setting-doc value.
"""

import math
import time

import rebound

import tau_ceti_model as model

FACTOR = 0.60
YEARS = 20000.0
STEP = 1.0


def main():
    a_s = model.A_AU["shudder"] * FACTOR
    a_d = model.A_AU["der"] * FACTOR
    sim, _meta = model.build_moons(
        phase="resonant",
        a_shudder=a_s,
        a_der=a_d,
        companions=True,
    )
    sim.integrator = "ias15"
    sim.integrator.epsilon = 1e-9
    print(
        f"SUGGEST f={FACTOR} a_shudder_km={a_s * model.AU_KM:.1f} "
        f"a_der_km={a_d * model.AU_KM:.1f} target={YEARS}",
        flush=True,
    )
    t0 = time.perf_counter()
    reason = "survived"
    max_e_s = 0.0
    max_e_d = 0.0
    min_sep = 1e9
    phi_max = 0.0
    phi_min = 0.0
    last_print = t0
    while sim.t < YEARS:
        if time.perf_counter() - t0 > 480.0:
            reason = "wall"
            break
        try:
            sim.integrate(min(sim.t + STEP, YEARS), exact_finish_time=0)
        except (rebound.Escape, rebound.Collision):
            reason = "integrator stop"
            break
        sim.synchronize()
        r_s = math.dist(
            (sim.particles["shudder"].x, sim.particles["shudder"].y, sim.particles["shudder"].z),
            (sim.particles["kakakiko"].x, sim.particles["kakakiko"].y, sim.particles["kakakiko"].z),
        )
        if r_s < 0.5 * a_s or r_s > 2.0 * a_s:
            reason = f"shudder radial r/a0={r_s / a_s:.3f}"
            break
        r_d = math.dist(
            (sim.particles["der"].x, sim.particles["der"].y, sim.particles["der"].z),
            (sim.particles["kakakiko"].x, sim.particles["kakakiko"].y, sim.particles["kakakiko"].z),
        )
        if r_d < 0.5 * a_d or r_d > 2.0 * a_d:
            reason = f"der radial r/a0={r_d / a_d:.3f}"
            break
        sh = model.elements_against(sim, "shudder", "kakakiko")
        de = model.elements_against(sim, "der", "kakakiko")
        max_e_s = max(max_e_s, sh["e"])
        max_e_d = max(max_e_d, de["e"])
        phi1, phi2 = model.resonant_angles(sim)
        phi_max = max(phi_max, phi1)
        phi_min = min(phi_min, phi1)
        sep = math.dist(
            (sim.particles["shudder"].x, sim.particles["shudder"].y, sim.particles["shudder"].z),
            (sim.particles["der"].x, sim.particles["der"].y, sim.particles["der"].z),
        )
        min_sep = min(min_sep, sep)
        now = time.perf_counter()
        if now - last_print > 45.0:
            print(
                f"  t={sim.t:.1f} eS={sh['e']:.4f} eD={de['e']:.4f} "
                f"phi1_deg={math.degrees(phi1):.2f} wall={now - t0:.0f}s",
                flush=True,
            )
            last_print = now
    wall = time.perf_counter() - t0
    print(
        f"DONE f={FACTOR} t={sim.t:.1f} {reason} max_eS={max_e_s:.4f} max_eD={max_e_d:.4f} "
        f"phi1_deg=[{math.degrees(phi_min):.2f}, {math.degrees(phi_max):.2f}] "
        f"minsep_km={min_sep * model.AU_KM:.0f} wall={wall:.1f}s",
        flush=True,
    )


if __name__ == "__main__":
    main()
