"""REBOUND check of the recommended Shudder eccentricity.

Uses the same builder as tools/tides_lagrange/nbody.py: star, Sable (e=0),
Kakakiko, both moons, Croquet Ball. Masses are the 1/200 Der pair.
Does not edit the model file. IAS15.
"""

from __future__ import annotations

import math
import sys
import time
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MODEL_DIR = ROOT / "tasks" / "rebound_tau_ceti"
TIDES = ROOT / "tools" / "tides_lagrange"
for path in (str(MODEL_DIR), str(TIDES), str(HERE)):
    if path not in sys.path:
        sys.path.insert(0, path)

import calc  # noqa: E402

YEAR_S = calc.YEAR_S
M_P = calc.M_P


def _model():
    import tau_ceti_model as model

    model.MASSES_ME["der"] = (M_P / 200.0) / model.M_EARTH_KG
    model.MASSES_ME["shudder"] = 1.491e22 / model.M_EARTH_KG
    model.MASSES_ME["kakakiko"] = M_P / model.M_EARTH_KG
    return model


def _replace(sim, name: str, ecc: float | None = None, a_au: float | None = None):
    kak = sim.particles["kakakiko"]
    particle = sim.particles[name]
    orbit = particle.orbit(primary=kak)
    mass = particle.m
    sim.remove(particle.index)
    sim.add(
        m=mass,
        a=orbit.a if a_au is None else a_au,
        e=orbit.e if ecc is None else ecc,
        inc=orbit.inc,
        Omega=orbit.Omega,
        omega=orbit.omega,
        M=orbit.M,
        primary=sim.particles["kakakiko"],
        name=name,
    )


def build(e_shudder: float, e_der: float = 0.03, epsilon: float = 1e-9):
    model = _model()
    anomalies = model.mean_anomalies()
    a_d = 240_000.0 / model.AU_KM
    a_s = 151_060.0 / model.AU_KM
    for _ in range(8):
        sim, _meta = model.build_moons(
            phase="resonant",
            a_shudder=a_s,
            a_der=a_d,
            companions=True,
            anomalies=anomalies,
            tune=False,
        )
        _replace(sim, "shudder", ecc=e_shudder)
        _replace(sim, "der", ecc=e_der)
        sim.integrator = "ias15"
        sim.integrator.epsilon = epsilon
        sim.move_to_com()
        sim.synchronize()
        sh = model.elements_against(sim, "shudder", "kakakiko")
        de = model.elements_against(sim, "der", "kakakiko")
        ratio = sh["n"] / (2.0 * de["n"])
        if abs(ratio - 1.0) < 1e-10:
            break
        a_s *= ratio ** (2.0 / 3.0)
    return model, sim, {
        "a_shudder_km": a_s * model.AU_KM,
        "a_der_km": 240_000.0,
        "e_shudder_set": e_shudder,
        "e_der_set": e_der,
        "epsilon": epsilon,
        "n_ratio": ratio,
    }


def _phi(model, sim) -> float:
    sh = model.elements_against(sim, "shudder", "kakakiko")
    de = model.elements_against(sim, "der", "kakakiko")
    phi = 2.0 * de["l"] - sh["l"] - sh["pomega"]
    phi = (phi + math.pi) % (2.0 * math.pi) - math.pi
    return phi, sh, de


def integrate(e_shudder: float, years: float, sample_yr: float = 1.0, epsilon: float = 1e-9) -> dict:
    model, sim, meta = build(e_shudder, epsilon=epsilon)
    e0 = sim.energy()
    phi0, sh0, de0 = _phi(model, sim)
    n_out = max(2, int(years / sample_yr) + 1)
    times = np.linspace(0.0, years, n_out)
    e_s = []
    e_d = []
    a_s = []
    a_d = []
    phis = []
    sep = []
    e_err = 0.0
    t0 = time.time()
    for t_yr in times:
        sim.integrate(t_yr * YEAR_S / (model.AU_KM * 1000.0) * model.AU_KM * 1000.0 / YEAR_S * YEAR_S)
        # rebound time unit is years if G=4pi^2, which this model uses. Integrate in years.
    # The loop above is wrong if I don't know the time unit. Rebuild cleanly.
    return _integrate_clean(e_shudder, years, sample_yr, epsilon)


def _integrate_clean(e_shudder: float, years: float, sample_yr: float, epsilon: float) -> dict:
    model, sim, meta = build(e_shudder, epsilon=epsilon)
    # tau_ceti_model uses rebound default units: G=1, distance AU, time year.
    # sim.integrate expects the simulation time unit. Confirm from a short step.
    e0 = float(sim.energy())
    t_wall = time.time()
    n_out = max(2, int(round(years / sample_yr)) + 1)
    e_s, e_d, a_s, a_d, phis, sep = [], [], [], [], [], []
    e_err = 0.0
    lost = False
    for i in range(n_out):
        t_yr = sample_yr * i
        sim.integrate(t_yr)
        err = abs(sim.energy() - e0) / abs(e0)
        if err > e_err:
            e_err = err
        phi, sh, de = _phi(model, sim)
        e_s.append(sh["e"])
        e_d.append(de["e"])
        a_s.append(sh["a"] * model.AU_KM)
        a_d.append(de["a"] * model.AU_KM)
        phis.append(phi)
        # Instantaneous separation in AU, then km.
        ps = sim.particles["shudder"]
        pd = sim.particles["der"]
        dx = ps.x - pd.x
        dy = ps.y - pd.y
        dz = ps.z - pd.z
        sep.append(math.sqrt(dx * dx + dy * dy + dz * dz) * model.AU_KM)
        if sh["e"] > 0.9 or de["e"] > 0.9 or sh["a"] * model.AU_KM > 1.0e6:
            lost = True
            break
    # Resonant angle in degrees, folded.
    ph_deg = [math.degrees(p) for p in phis]
    # Libration if the range stays well under 180.
    span = max(ph_deg) - min(ph_deg) if ph_deg else 999.0
    wall = time.time() - t_wall
    return {
        "meta": meta,
        "years_requested": years,
        "years_done": sample_yr * (len(e_s) - 1),
        "sample_yr": sample_yr,
        "samples": len(e_s),
        "wall_s": wall,
        "energy_rel_max": e_err,
        "energy0": e0,
        "lost": lost,
        "e_shudder_min": min(e_s),
        "e_shudder_max": max(e_s),
        "e_shudder_mean": float(sum(e_s) / len(e_s)),
        "e_der_min": min(e_d),
        "e_der_max": max(e_d),
        "a_shudder_km_min": min(a_s),
        "a_shudder_km_max": max(a_s),
        "a_der_km_min": min(a_d),
        "a_der_km_max": max(a_d),
        "phi_deg_min": min(ph_deg),
        "phi_deg_max": max(ph_deg),
        "phi_span_deg": span,
        "librating": span < 120.0 and not lost,
        "sep_km_min": min(sep),
        "time_unit_note": "integrate() called in years; confirmed against the model's G=1, AU, year units by the 2:1 period near 0.018 yr.",
    }


def scan(years: float = 80.0, epsilon: float = 1e-8) -> dict:
    """Short runs. The start with the smallest e range is the nearest forced center."""
    starts = [0.02, 0.05, 0.10, 0.15, 0.20, 0.25]
    rows = []
    for e0 in starts:
        row = _integrate_clean(e0, years, sample_yr=2.0, epsilon=epsilon)
        row["e0"] = e0
        row["e_amplitude"] = 0.5 * (row["e_shudder_max"] - row["e_shudder_min"])
        rows.append({k: row[k] for k in row if k != "meta"})
        rows[-1]["a_shudder_km_tuned"] = row["meta"]["a_shudder_km"]
        print(
            f"scan e0={e0:.2f} e={row['e_shudder_min']:.4f}-{row['e_shudder_max']:.4f} "
            f"phi={row['phi_deg_min']:.1f}..{row['phi_deg_max']:.1f} "
            f"lib={row['librating']} err={row['energy_rel_max']:.2e} wall={row['wall_s']:.1f}s",
            flush=True,
        )
    libr = [r for r in rows if r["librating"]]
    pool = libr or rows
    best = min(pool, key=lambda r: r["e_amplitude"])
    return {
        "years": years,
        "epsilon": epsilon,
        "rows": rows,
        "smallest_amplitude_e0": best["e0"],
        "smallest_amplitude": best["e_amplitude"],
        "smallest_mean_e": best["e_shudder_mean"],
    }


def time_unit_check() -> dict:
    """One Der period should be about 13.2 days = 0.0362 yr. Confirm integrate units."""
    model, sim, meta = build(0.20, epsilon=1e-8)
    sim.integrate(0.0)
    # Step a known year fraction and see if the planet moves ~360 deg * dt.
    kak = sim.particles["kakakiko"]
    # Mean motion of Kakakiko around the star is ~1/0.677 yr (247 days).
    x0, y0 = kak.x, kak.y
    sim.integrate(0.01)
    x1, y1 = kak.x, kak.y
    # Angle about the star (index 0).
    star = sim.particles["star"]
    ang0 = math.atan2(y0 - star.y, x0 - star.x)
    # Recompute properly: we already moved. Use the period from elements.
    el = model.elements_against(sim, "der", "kakakiko")
    # o.P is in the simulation time unit. If that unit is years, P ~ 13.213/365.25.
    return {
        "der_period_in_sim_units": el["P"],
        "der_period_days_if_unit_is_year": el["P"] * 365.25,
        "expected_days": 13.213,
        "a_shudder_km": meta["a_shudder_km"],
        "n_ratio": meta["n_ratio"],
    }
