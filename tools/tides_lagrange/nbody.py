"""REBOUND parking-orbit and Lagrange-point integrations.

Star + Sable (e = 0, the model baseline inside the doc's e ≤ 0.1 ceiling)
+ Kakakiko + Shudder + Der + Croquet Ball. Test particles are massless.
Der's mass is 1/200 of Kakakiko. Axes are the 2026-10-09 pair, with
Shudder nudged so the initial osculating mean motions are an exact 2:1.
That nudge is sub-kilometre on the published 151,060 km.

IAS15, same integrator family as the 20,000-year moon run. Lost test
particles are removed so a close encounter cannot stall the rest of the run.
"""

from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path

import numpy as np

from constants import (
    A_DER,
    A_SHUDDER,
    DAY_S,
    M_P,
    MODEL_DIR,
    MU_P,
    R_DER,
    R_P,
    R_SHUDDER,
    kepler_period,
)

YEAR_S = 365.25 * 86400.0
IMPACT_PLANET_KM = 7_000.0
CLEAR_MOON_KM = 25_000.0
ESCAPE_KM = 700_000.0
DEADBAND_M = 500_000.0


def _model():
    if MODEL_DIR not in sys.path:
        sys.path.insert(0, MODEL_DIR)
    import tau_ceti_model as model

    model.MASSES_ME["der"] = (M_P / 200.0) / model.M_EARTH_KG
    model.MASSES_ME["shudder"] = 1.491e22 / model.M_EARTH_KG
    model.MASSES_ME["kakakiko"] = M_P / model.M_EARTH_KG
    return model


def ms_to_au_yr(model, speed_m_s: float) -> float:
    return speed_m_s * YEAR_S / (model.AU_KM * 1000.0)


def tune_shudder(model, a_s: float, a_d: float, anomalies: dict) -> float:
    for _ in range(8):
        sim, _meta = model.build_moons(
            phase="resonant",
            a_shudder=a_s,
            a_der=a_d,
            companions=True,
            anomalies=anomalies,
            tune=False,
        )
        sim.synchronize()
        sh = model.elements_against(sim, "shudder", "kakakiko")
        de = model.elements_against(sim, "der", "kakakiko")
        ratio = sh["n"] / (2.0 * de["n"])
        if abs(ratio - 1.0) < 1e-12:
            break
        a_s *= ratio ** (2.0 / 3.0)
    return a_s


def build_massive(model, drop_names: tuple[str, ...] = ()):
    anomalies = model.mean_anomalies()
    a_d = 240_000.0 / model.AU_KM
    a_s0 = 151_060.0 / model.AU_KM
    a_s = tune_shudder(model, a_s0, a_d, anomalies)
    sim, _meta = model.build_moons(
        phase="resonant",
        a_shudder=a_s,
        a_der=a_d,
        companions=True,
        anomalies=anomalies,
        tune=False,
    )
    for name in drop_names:
        for i in range(sim.N - 1, -1, -1):
            if sim.particles[i].name == name:
                sim.remove(i)
                break
    sim.integrator = "ias15"
    sim.integrator.epsilon = 1e-9
    sim.synchronize()
    return sim, {
        "a_shudder_km_tuned": a_s * model.AU_KM,
        "a_shudder_km_design": 151_060.0,
        "a_der_km": 240_000.0,
        "tune_delta_km": a_s * model.AU_KM - 151_060.0,
        "anomaly_seed": 20260930,
        "dropped": list(drop_names),
        "integrator": "ias15",
        "epsilon": 1e-9,
        "sable_e": 0.0,
        "croquet_e": 0.0,
        "croquet_m_earth": 95.0,
    }


def _add_particle(sim, model, name: str, a_au: float, ecc: float, mean_anom: float, omega: float, dv_rad: float, dv_tang: float):
    kak = sim.particles["kakakiko"]
    sim.add(
        m=0.0,
        a=a_au,
        e=ecc,
        inc=0.0,
        Omega=0.0,
        omega=omega,
        M=mean_anom,
        primary=kak,
        name=name,
    )
    if dv_rad == 0.0 and dv_tang == 0.0:
        return
    p = sim.particles[name]
    rx = p.x - kak.x
    ry = p.y - kak.y
    rz = p.z - kak.z
    r = math.sqrt(rx * rx + ry * ry + rz * rz)
    urx, ury, urz = rx / r, ry / r, rz / r
    # Prograde tangential unit, equatorial: z-hat cross r-hat.
    utx, uty, utz = -ury, urx, 0.0
    scale = ms_to_au_yr(model, 1.0)
    p.vx += scale * (urx * dv_rad + utx * dv_tang)
    p.vy += scale * (ury * dv_rad + uty * dv_tang)
    p.vz += scale * (urz * dv_rad + utz * dv_tang)


def particle_specs(sim, model) -> list[dict]:
    sim.synchronize()
    hosts = {}
    for name in ("shudder", "der"):
        if name in [p.name for p in sim.particles]:
            hosts[name] = model.elements_against(sim, name, "kakakiko")
    specs = []

    def add(spec: dict):
        specs.append(spec)

    for host, el in hosts.items():
        for point, delta_deg in (("L4", 60.0), ("L5", -60.0)):
            dM = math.radians(delta_deg)
            base = f"{host}_{point}"
            add(
                {
                    "name": f"{base}_ell",
                    "group": "lagrange",
                    "family": base,
                    "kind": "elliptic",
                    "a_au": el["a"],
                    "e": el["e"],
                    "M": el["M"] + dM,
                    "omega": el["omega"],
                    "host": host,
                    "target_deg": delta_deg,
                    "dv_rad": 0.0,
                    "dv_tang": 0.0,
                }
            )
            add(
                {
                    "name": f"{base}_circ",
                    "group": "lagrange",
                    "family": base,
                    "kind": "circular",
                    "a_au": el["a"],
                    "e": 0.0,
                    "M": dM,
                    "omega": 0.0,
                    "host": host,
                    "target_deg": delta_deg,
                    "dv_rad": 0.0,
                    "dv_tang": 0.0,
                }
            )
            for dang in (-15.0, -8.0, -3.0, 3.0, 8.0, 15.0):
                add(
                    {
                        "name": f"{base}_ang{dang:+.0f}",
                        "group": "lagrange",
                        "family": base,
                        "kind": "elliptic_angle",
                        "a_au": el["a"],
                        "e": el["e"],
                        "M": el["M"] + dM + math.radians(dang),
                        "omega": el["omega"],
                        "host": host,
                        "target_deg": delta_deg,
                        "dv_rad": 0.0,
                        "dv_tang": 0.0,
                        "dang_deg": dang,
                    }
                )
            for frac in (-0.02, -0.01, 0.01, 0.02):
                tag = f"{frac:+.0%}".replace("%", "pct")
                add(
                    {
                        "name": f"{base}_da{tag}",
                        "group": "lagrange",
                        "family": base,
                        "kind": "elliptic_da",
                        "a_au": el["a"] * (1.0 + frac),
                        "e": el["e"],
                        "M": el["M"] + dM,
                        "omega": el["omega"],
                        "host": host,
                        "target_deg": delta_deg,
                        "dv_rad": 0.0,
                        "dv_tang": 0.0,
                        "da_frac": frac,
                    }
                )
            for dv_rad, dv_tang, tag in (
                (0.0, 10.0, "vt+10"),
                (0.0, -10.0, "vt-10"),
                (0.0, 30.0, "vt+30"),
                (0.0, -30.0, "vt-30"),
                (10.0, 0.0, "vr+10"),
                (-10.0, 0.0, "vr-10"),
            ):
                add(
                    {
                        "name": f"{base}_{tag}",
                        "group": "lagrange",
                        "family": base,
                        "kind": "elliptic_dv",
                        "a_au": el["a"],
                        "e": el["e"],
                        "M": el["M"] + dM,
                        "omega": el["omega"],
                        "host": host,
                        "target_deg": delta_deg,
                        "dv_rad": dv_rad,
                        "dv_tang": dv_tang,
                    }
                )
        # L3 control, elliptic, opposite the host.
        add(
            {
                "name": f"{host}_L3_ell",
                "group": "lagrange",
                "family": f"{host}_L3",
                "kind": "elliptic",
                "a_au": el["a"],
                "e": el["e"],
                "M": el["M"] + math.pi,
                "omega": el["omega"],
                "host": host,
                "target_deg": 180.0,
                "dv_rad": 0.0,
                "dv_tang": 0.0,
            }
        )

    sync_km = (MU_P * DAY_S**2 / (4.0 * math.pi**2)) ** (1.0 / 3.0) / 1000.0
    radii = [
        (7_200, "fallback"),
        (12_000, "fallback"),
        (20_000, "fallback"),
        (35_000, "fallback"),
        (50_000, "fallback"),
        (round(sync_km - 2_000), "sync"),
        (round(sync_km), "sync"),
        (round(sync_km + 2_000), "sync"),
        (75_000, "fallback"),
        (90_000, "fallback"),
        (105_000, "fallback"),
        (115_000, "fallback"),
        (170_000, "fallback"),
        (190_000, "fallback"),
        (200_000, "fallback"),
        (210_000, "fallback"),
        (220_000, "fallback"),
    ]
    for km, group in radii:
        add(
            {
                "name": f"{group}_{km}",
                "group": group,
                "family": group,
                "kind": "circular_parking",
                "a_au": km / model.AU_KM,
                "e": 0.0,
                "M": 0.2,
                "omega": 0.0,
                "host": None,
                "target_deg": None,
                "dv_rad": 0.0,
                "dv_tang": 0.0,
                "a_km_design": km,
            }
        )
    return specs


def _blank_stat(spec: dict, model) -> dict:
    a_km = spec["a_au"] * model.AU_KM
    return {
        "name": spec["name"],
        "group": spec["group"],
        "family": spec["family"],
        "kind": spec["kind"],
        "host": spec.get("host"),
        "target_deg": spec.get("target_deg"),
        "a0_km": a_km,
        "e0": spec["e"],
        "dv_rad_m_s": spec["dv_rad"],
        "dv_tang_m_s": spec["dv_tang"],
        "status": "alive",
        "t_loss_yr": None,
        "loss_reason": None,
        "max_abs_dtheta_deg": 0.0,
        "sum_dtheta2": 0.0,
        "n_ang": 0,
        "a_min_km": a_km,
        "a_max_km": a_km,
        "e_max": spec["e"],
        "min_shudder_km": 1e12,
        "min_der_km": 1e12,
        "min_planet_km": 1e12,
        "t_angle_15_yr": None,
        "t_angle_30_yr": None,
        "t_da_2pct_yr": None,
        "t_da_5pct_yr": None,
        "bins_dtheta": {},
        "bins_da": {},
    }


def _bin_key(t_yr: float) -> str:
    return str(int(t_yr // 10.0) * 10)


def _update_stat(stat: dict, t_yr: float, a_km: float, ecc: float, dtheta_deg: float | None, d_sh: float, d_de: float, d_pl: float):
    stat["a_min_km"] = min(stat["a_min_km"], a_km)
    stat["a_max_km"] = max(stat["a_max_km"], a_km)
    stat["e_max"] = max(stat["e_max"], ecc)
    stat["min_shudder_km"] = min(stat["min_shudder_km"], d_sh)
    stat["min_der_km"] = min(stat["min_der_km"], d_de)
    stat["min_planet_km"] = min(stat["min_planet_km"], d_pl)
    da = abs(a_km - stat["a0_km"]) / stat["a0_km"]
    key = _bin_key(t_yr)
    stat["bins_da"][key] = max(stat["bins_da"].get(key, 0.0), da)
    if stat["t_da_2pct_yr"] is None and da > 0.02:
        stat["t_da_2pct_yr"] = t_yr
    if stat["t_da_5pct_yr"] is None and da > 0.05:
        stat["t_da_5pct_yr"] = t_yr
    if dtheta_deg is not None:
        ad = abs(dtheta_deg)
        stat["max_abs_dtheta_deg"] = max(stat["max_abs_dtheta_deg"], ad)
        stat["sum_dtheta2"] += dtheta_deg * dtheta_deg
        stat["n_ang"] += 1
        stat["bins_dtheta"][key] = max(stat["bins_dtheta"].get(key, 0.0), ad)
        if stat["t_angle_15_yr"] is None and ad > 15.0:
            stat["t_angle_15_yr"] = t_yr
        if stat["t_angle_30_yr"] is None and ad > 30.0:
            stat["t_angle_30_yr"] = t_yr


def _loss_reason(a_km: float, ecc: float, d_sh: float, d_de: float, d_pl: float, a0: float) -> str | None:
    if d_pl < IMPACT_PLANET_KM:
        return "planet_impact"
    if d_sh < 1.5 * R_SHUDDER / 1000.0:
        return "shudder_impact"
    if d_de < 1.5 * R_DER / 1000.0:
        return "der_impact"
    if d_pl > ESCAPE_KM or a_km > ESCAPE_KM or ecc > 0.95:
        return "escaped"
    if a_km < 0.4 * a0 or a_km > 2.5 * a0:
        return "scattered"
    return None


def _angle_deg(model, sim, name: str, host: str, target_deg: float) -> float | None:
    try:
        el = model.elements_against(sim, name, "kakakiko")
        ho = model.elements_against(sim, host, "kakakiko")
    except Exception:
        return None
    delta = math.degrees(float(model.wrap_pi(el["l"] - ho["l"])))
    return float(model.wrap_pi(math.radians(delta - target_deg)) * 180.0 / math.pi)


def classify(stat: dict, years: float) -> dict:
    survived = stat["status"] == "alive" and stat["t_loss_yr"] is None
    a0 = stat["a0_km"]
    da = max(abs(stat["a_max_km"] - a0), abs(stat["a_min_km"] - a0)) / a0
    rms = math.sqrt(stat["sum_dtheta2"] / stat["n_ang"]) if stat["n_ang"] else None
    bins = sorted((int(k), v) for k, v in stat["bins_dtheta"].items())
    growing = False
    if len(bins) >= 4:
        mid = len(bins) // 2
        first = max(v for _k, v in bins[:mid])
        second = max(v for _k, v in bins[mid:])
        if first > 1.0 and second > 1.5 * first and second > 8.0:
            growing = True
    lagrange = stat["group"] == "lagrange" and stat["family"].endswith(("L4", "L5"))
    if not survived:
        outcome = stat["loss_reason"] or "lost"
    elif lagrange and stat["max_abs_dtheta_deg"] < 40.0 and da < 0.08 and not growing:
        outcome = "tadpole"
    elif lagrange and da < 0.15 and stat["max_abs_dtheta_deg"] >= 40.0:
        outcome = "horseshoe_or_circulating"
    elif (not lagrange) and da < 0.03 and stat["e_max"] < 0.03:
        outcome = "quiet"
    elif da < 0.08 and stat["e_max"] < 0.1:
        outcome = "bound_mild"
    else:
        outcome = "bound_pumped"
    clear = (
        stat["min_shudder_km"] > CLEAR_MOON_KM
        and stat["min_der_km"] > CLEAR_MOON_KM
        and stat["min_planet_km"] > 8_000.0
    )
    usable = survived and outcome in ("tadpole", "quiet") and clear and not growing
    # Station-keeping. A quiet survivor needs none from this N-body.
    # An unstable particle is charged the deadband burn once per e-folding,
    # with the e-folding taken as the time to leave a 15° or 2% box. est.
    if usable:
        dv_year = 0.0
        tau = None
    else:
        tau = stat["t_angle_15_yr"] if lagrange else stat["t_da_2pct_yr"]
        if tau is None:
            tau = stat["t_loss_yr"] or years
        tau = max(tau, 1e-3)
        tau_s = tau * YEAR_S
        dv_each = DEADBAND_M / tau_s
        dv_year = dv_each * (YEAR_S / tau_s)
    along_km = a0 * math.radians(stat["max_abs_dtheta_deg"]) if stat["n_ang"] else None
    return {
        "outcome": outcome,
        "survived": survived,
        "usable": usable,
        "growing_libration": growing,
        "da_frac": da,
        "rms_dtheta_deg": rms,
        "along_track_km": along_km,
        "tau_yr_est": None if usable else tau,
        "station_dv_m_s_per_yr_est": dv_year,
        "clear_of_moons": clear,
    }


def _dist_km(model, a, b) -> float:
    return math.dist((a.x, a.y, a.z), (b.x, b.y, b.z)) * model.AU_KM


def integrate(
    out_dir: Path,
    years: float,
    groups: set[str],
    step_yr: float = 0.05,
    wall_s: float = 50 * 60,
    tag: str = "main",
    drop_names: tuple[str, ...] = (),
    specs_override: list[dict] | None = None,
) -> dict:
    import rebound

    model = _model()
    out_dir.mkdir(parents=True, exist_ok=True)
    bin_path = out_dir / f"nbody_{tag}.bin"
    meta_path = out_dir / f"nbody_{tag}.json"
    if bin_path.exists() and meta_path.exists():
        sim = rebound.Simulation(str(bin_path))
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        # A previous chunk may have stopped on the wall clock. That flag
        # belongs to the finished chunk, not to this one.
        meta.pop("stopped", None)
        print(f"resume {tag} at t={sim.t:.4f} yr", flush=True)
    else:
        sim, setup = build_massive(model, drop_names=drop_names)
        n_active = sim.N
        specs = specs_override if specs_override is not None else particle_specs(sim, model)
        specs = [s for s in specs if s["group"] in groups]
        names = [s["name"] for s in specs]
        if len(names) != len(set(names)):
            dup = sorted({n for n in names if names.count(n) > 1})
            raise SystemExit("duplicate particle names: " + ", ".join(dup))
        for spec in specs:
            _add_particle(sim, model, spec["name"], spec["a_au"], spec["e"], spec["M"], spec["omega"], spec["dv_rad"], spec["dv_tang"])
        sim.N_active = n_active
        sim.testparticle_type = 0
        sim.synchronize()
        e0 = float(sim.energy())
        meta = {
            "tag": tag,
            "setup": setup,
            "groups": sorted(groups),
            "years_goal": years,
            "e0": e0,
            "energy_err_max": 0.0,
            "t_yr": 0.0,
            "wall_s": 0.0,
            "specs": specs,
            "stats": {s["name"]: _blank_stat(s, model) for s in specs},
            "moon_samples": [],
            "done": False,
        }
        print(f"start {tag} particles={len(specs)} massive={n_active}", flush=True)

    t_wall0 = time.perf_counter()
    wall_already = float(meta.get("wall_s") or 0.0)
    goal = max(years, float(meta.get("years_goal") or years))
    meta["years_goal"] = goal
    names = set(meta["stats"])
    while sim.t < goal - 1e-9:
        if time.perf_counter() - t_wall0 > wall_s:
            meta["stopped"] = "wall"
            break
        t_next = min(goal, sim.t + step_yr)
        try:
            sim.integrate(t_next, exact_finish_time=1)
        except (rebound.Collision, rebound.Escape) as exc:
            meta["stopped"] = f"integrator {type(exc).__name__}"
            break
        sim.synchronize()
        t_yr = float(sim.t)
        by_name = {p.name: p for p in sim.particles}
        kak = by_name.get("kakakiko")
        sh = by_name.get("shudder")
        de = by_name.get("der")
        lost = []
        for name, stat in meta["stats"].items():
            if stat["status"] != "alive":
                continue
            p = by_name.get(name)
            if p is None or kak is None:
                continue
            try:
                el = model.elements_against(sim, name, "kakakiko")
            except Exception:
                stat["status"] = "lost"
                stat["loss_reason"] = "elements_failed"
                stat["t_loss_yr"] = t_yr
                lost.append(name)
                continue
            a_km = el["a"] * model.AU_KM
            d_pl = _dist_km(model, p, kak)
            d_sh = _dist_km(model, p, sh) if sh is not None else 1e12
            d_de = _dist_km(model, p, de) if de is not None else 1e12
            dtheta = None
            if stat["host"] and stat["target_deg"] is not None and stat["host"] in by_name:
                dtheta = _angle_deg(model, sim, name, stat["host"], stat["target_deg"])
            _update_stat(stat, t_yr, a_km, el["e"], dtheta, d_sh, d_de, d_pl)
            reason = _loss_reason(a_km, el["e"], d_sh, d_de, d_pl, stat["a0_km"])
            if reason:
                stat["status"] = "lost"
                stat["loss_reason"] = reason
                stat["t_loss_yr"] = t_yr
                lost.append(name)
        for name in sorted(lost, key=lambda n: by_name[n].index if n in by_name else 0, reverse=True):
            p = by_name.get(name)
            if p is not None:
                sim.remove(p.index)
        e = float(sim.energy())
        rel = abs(e - meta["e0"]) / abs(meta["e0"])
        meta["energy_err_max"] = max(meta["energy_err_max"], rel)
        meta["energy_err_now"] = rel
        meta["t_yr"] = t_yr
        if sh is not None and de is not None:
            try:
                phi1, phi2 = model.resonant_angles(sim)
                sh_el = model.elements_against(sim, "shudder", "kakakiko")
                de_el = model.elements_against(sim, "der", "kakakiko")
                if int(t_yr * 20) % 20 == 0:
                    meta["moon_samples"].append(
                        {
                            "t": round(t_yr, 4),
                            "phi1_deg": math.degrees(phi1),
                            "eS": sh_el["e"],
                            "eD": de_el["e"],
                            "aS_km": sh_el["a"] * model.AU_KM,
                            "aD_km": de_el["a"] * model.AU_KM,
                        }
                    )
            except Exception:
                pass
        if int(t_yr) % 10 == 0 and abs(t_yr - round(t_yr)) < step_yr * 0.6:
            alive = sum(1 for s in meta["stats"].values() if s["status"] == "alive")
            print(
                f"{tag} t={t_yr:.2f} yr alive={alive} dE={rel:.3e} wall={time.perf_counter() - t_wall0:.1f}s",
                flush=True,
            )
        # Keep the moon sample list from growing without bound.
        if len(meta["moon_samples"]) > 4000:
            meta["moon_samples"] = meta["moon_samples"][::2]

    meta["wall_s"] = wall_already + (time.perf_counter() - t_wall0)
    meta["t_yr"] = float(sim.t)
    meta["done"] = bool(sim.t >= goal - 1e-6 and meta.get("stopped") is None)
    # Classify a copy for the summary. Keep raw stats for resume.
    summary_rows = []
    for stat in meta["stats"].values():
        row = {k: v for k, v in stat.items() if k not in ("sum_dtheta2", "bins_dtheta", "bins_da")}
        row.update(classify(stat, meta["t_yr"]))
        # Compact bin maxima so the report can see growth without the raw dict noise.
        if stat["bins_dtheta"]:
            vals = [stat["bins_dtheta"][k] for k in sorted(stat["bins_dtheta"], key=lambda s: int(s))]
            row["dtheta_bin_max_deg"] = vals
        summary_rows.append(row)
    meta["summary"] = summary_rows
    meta["n_alive"] = sum(1 for s in meta["stats"].values() if s["status"] == "alive")
    # Drop the bulky spec duplication from the on-disk summary view by
    # writing everything; specs are needed if we ever rebuild, but resume
    # uses the binary. Keep them.
    sim.save_to_file(str(bin_path))
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(
        f"saved {tag} t={meta['t_yr']:.3f} done={meta['done']} dE={meta['energy_err_max']:.3e} wall={meta['wall_s']:.1f}s",
        flush=True,
    )
    return meta


def control_specs(sim, model, host: str) -> list[dict]:
    el = model.elements_against(sim, host, "kakakiko")
    specs = []
    for point, delta_deg in (("L4", 60.0), ("L5", -60.0)):
        dM = math.radians(delta_deg)
        for kind, ecc, M, omega, tag in (
            ("elliptic", el["e"], el["M"] + dM, el["omega"], "ell"),
            ("circular", 0.0, dM, 0.0, "circ"),
        ):
            specs.append(
                {
                    "name": f"{host}_{point}_{tag}",
                    "group": "lagrange",
                    "family": f"{host}_{point}",
                    "kind": kind,
                    "a_au": el["a"],
                    "e": ecc,
                    "M": M,
                    "omega": omega,
                    "host": host,
                    "target_deg": delta_deg,
                    "dv_rad": 0.0,
                    "dv_tang": 0.0,
                }
            )
        for dang in (-5.0, 5.0):
            specs.append(
                {
                    "name": f"{host}_{point}_ang{dang:+.0f}",
                    "group": "lagrange",
                    "family": f"{host}_{point}",
                    "kind": "elliptic_angle",
                    "a_au": el["a"],
                    "e": el["e"],
                    "M": el["M"] + dM + math.radians(dang),
                    "omega": el["omega"],
                    "host": host,
                    "target_deg": delta_deg,
                    "dv_rad": 0.0,
                    "dv_tang": 0.0,
                }
            )
    return specs


def selftest_nbody() -> dict:
    model = _model()
    sim, setup = build_massive(model)
    sim.synchronize()
    sh = model.elements_against(sim, "shudder", "kakakiko")
    de = model.elements_against(sim, "der", "kakakiko")
    p_sh = kepler_period(A_SHUDDER, 6.67430e-11 * (M_P + 1.491e22)) / 86400.0
    p_de = kepler_period(A_DER, 6.67430e-11 * (M_P + M_P / 200.0)) / 86400.0
    sh_days = sh["P"] * 365.25
    de_days = de["P"] * 365.25
    e0 = float(sim.energy())
    sim.integrate(0.25, exact_finish_time=1)
    sim.synchronize()
    rel = abs(float(sim.energy()) - e0) / abs(e0)
    phi1, _phi2 = model.resonant_angles(sim)
    ok = (
        abs(sh_days - p_sh) / p_sh < 0.02
        and abs(de_days - p_de) / p_de < 0.02
        and rel < 1e-8
        and abs(phi1) < 1.0
        and abs(setup["tune_delta_km"]) < 50.0
    )
    return {
        "pass": ok,
        "shudder_days": sh_days,
        "der_days": de_days,
        "si_shudder_days": p_sh,
        "si_der_days": p_de,
        "energy_rel": rel,
        "phi1_rad": phi1,
        "tune_delta_km": setup["tune_delta_km"],
        "t_yr": float(sim.t),
    }


def transfers() -> dict:
    """Hohmann Δv from Der's orbit and from a 300 km parking altitude."""

    def circ(a):
        return math.sqrt(MU_P / a)

    def hohmann(a1, a2):
        at = 0.5 * (a1 + a2)
        v1 = circ(a1)
        v2 = circ(a2)
        dv1 = abs(math.sqrt(MU_P * (2.0 / a1 - 1.0 / at)) - v1)
        dv2 = abs(v2 - math.sqrt(MU_P * (2.0 / a2 - 1.0 / at)))
        return {"dv1_m_s": dv1, "dv2_m_s": dv2, "total_m_s": dv1 + dv2, "tof_days": kepler_period(at, MU_P) / 2.0 / 86400.0}

    sync = (MU_P * DAY_S**2 / (4.0 * math.pi**2)) ** (1.0 / 3.0)
    targets = {
        "sync": sync,
        "r_300km": R_P + 300e3,
        "a_75Mm": 75_000e3,
        "a_90Mm": 90_000e3,
        "a_105Mm": 105_000e3,
        "a_200Mm": 200_000e3,
        "shudder": A_SHUDDER,
        "der": A_DER,
    }
    out = {"sync_km": sync / 1000.0, "from_der": {}, "from_300km": {}}
    for name, a in targets.items():
        out["from_der"][name] = hohmann(A_DER, a)
        out["from_300km"][name] = hohmann(R_P + 300e3, a)
        out["from_der"][name]["circular_speed_m_s"] = circ(a)
    return out
