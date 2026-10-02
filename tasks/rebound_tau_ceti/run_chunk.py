"""Integrate one Tau Ceti chunk and checkpoint it.

Usage (from anywhere):
  python run_chunk.py <run_id> <years>

The process stops at the year target, on an ejection or Hill-sphere crossing,
or after WALL_LIMIT seconds, whichever comes first. A second invocation of the
same run_id resumes from the SimulationArchive restart file.
"""

from __future__ import annotations

import csv
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
import rebound

import tau_ceti_model as model

ROOT = Path(__file__).resolve().parent
ARCH = ROOT / "archives"
LOGS = ROOT / "logs"
WALL_LIMIT = 500.0  # seconds, leaves margin under the 10-minute shell cap

# check_interval: years between bound checks and CSV rows.
# archive_interval: years between SimulationArchive snapshots (resume + audit).
# nsub: Keplerian samples used to estimate the minimum separation inside one check.
RUNS = {
    "A": dict(builder="outer", variant="baseline", integrator="whfast", target=1.0e8, check=1000.0, archive=20000.0, nsub=4000),
    "A_megno": dict(builder="outer", variant="baseline", integrator="whfast", megno=True, target=1.0e6, check=2000.0, archive=50000.0, nsub=500),
    "A_e05": dict(builder="outer", variant="e05", integrator="whfast", target=2.0e7, check=1000.0, archive=20000.0, nsub=4000),
    "A_cue15": dict(builder="outer", variant="cue15", integrator="whfast", target=2.0e7, check=1000.0, archive=20000.0, nsub=4000),
    "B": dict(builder="full", sable_e=0.0, integrator="whfast", target=5.0e6, check=500.0, archive=10000.0, nsub=2000),
    "B_sable01": dict(builder="full", sable_e=0.1, integrator="whfast", target=2.0e6, check=500.0, archive=10000.0, nsub=2000),
    "B_sable005": dict(builder="full", sable_e=0.05, integrator="whfast", target=2.0e6, check=500.0, archive=10000.0, nsub=2000),
    "C": dict(builder="moons", phase="resonant", inc_deg=0.0, tune=False, integrator="ias15", target=1.0e4, check=0.1, archive=100.0, nsub=40),
    "C_random": dict(builder="moons", phase="random", inc_deg=0.0, tune=False, integrator="ias15", target=2.0e3, check=0.1, archive=50.0, nsub=40),
    "C_nudged": dict(builder="moons", phase="resonant", inc_deg=0.0, tune=True, integrator="ias15", target=1.0e4, check=0.1, archive=100.0, nsub=40),
    "C_tilt": dict(builder="moons", phase="resonant", inc_deg=12.0, tune=False, integrator="ias15", target=1.0e4, check=0.1, archive=100.0, nsub=40),
    "C_isolated": dict(builder="moons", phase="resonant", inc_deg=0.0, tune=False, isolated=True, integrator="ias15", target=5.0e4, check=0.25, archive=200.0, nsub=20),
    "C_star": dict(builder="moons", phase="resonant", inc_deg=0.0, tune=False, companions=False, integrator="ias15", target=2.0e3, check=0.1, archive=50.0, nsub=40),
    "C_apo": dict(builder="moons", phase="apocenter", inc_deg=0.0, tune=False, integrator="ias15", target=1.0e3, check=0.1, archive=50.0, nsub=40),
    "D_croquet": dict(builder="trojan_croquet", integrator="whfast", target=2.0e7, check=20.0, archive=5000.0, nsub=80),
    "D_der": dict(builder="trojan_der", integrator="ias15", target=1.0e4, check=0.25, archive=100.0, nsub=8),
}


def _paths(run_id: str):
    ARCH.mkdir(parents=True, exist_ok=True)
    LOGS.mkdir(parents=True, exist_ok=True)
    return {
        "archive": ARCH / f"{run_id}.bin",
        "restart": ARCH / f"{run_id}_restart.bin",
        "csv": LOGS / f"{run_id}.csv",
        "status": LOGS / f"{run_id}.json",
        "frames": LOGS / f"{run_id}_frames.json",
    }


def build_run(cfg: dict):
    kind = cfg["builder"]
    if kind == "outer":
        return model.build_outer(cfg["variant"])
    if kind == "full":
        return model.build_full(cfg["sable_e"])
    if kind == "moons":
        return model.build_moons(
            phase=cfg["phase"],
            inc_deg=cfg["inc_deg"],
            tune=cfg["tune"],
            isolated=cfg.get("isolated", False),
            companions=cfg.get("companions", True),
        )
    if kind == "trojan_croquet":
        return model.build_croquet_trojans()
    if kind == "trojan_der":
        return model.build_der_trojans()
    raise ValueError(kind)


def _apply_integrator(sim, cfg, meta):
    kind = cfg["integrator"]
    if kind == "whfast":
        pmin = model.shortest_period(sim, meta["bodies"])
        dt = 0.99 * pmin / 20.0
        model.configure_whfast(sim, dt)
        safe = 0
        if cfg.get("megno"):
            # Variational equations in this REBOUND build require safe_mode.
            sim.integrator.safe_mode = 1
            sim.integrator.keep_unsynchronized = 0
            safe = 1
        return {"integrator": "whfast", "dt": dt, "Pmin": pmin, "corrector": 17, "safe_mode": safe}
    if kind == "ias15":
        sim.integrator = "ias15"
        sim.integrator.epsilon = 1e-9
        return {"integrator": "ias15", "dt": None, "Pmin": None, "epsilon": 1e-9}
    if kind == "trace":
        pmin = model.shortest_period(sim, [n for n in meta["bodies"] if n not in ("shudder", "der")])
        dt = 0.99 * pmin / 20.0
        sim.integrator = "trace"
        sim.dt = dt
        return {"integrator": "trace", "dt": dt, "Pmin": pmin}
    raise ValueError(kind)


def _csv_header(meta, cfg) -> list[str]:
    cols = ["t", "E", "relE"]
    for name in meta["bodies"]:
        cols += [f"a_{name}", f"e_{name}", f"i_{name}"]
    if meta["kind"] == "moons" or cfg["builder"] == "moons":
        cols += ["phi1", "phi2", "sep_sh_der", "r_sh", "r_der", "hill_kak"]
    if cfg.get("megno"):
        cols += ["megno", "lyapunov"]
    for p1, p2 in meta.get("pairs", []):
        cols.append(f"minsep_{p1}_{p2}")
    if "test_particles" in meta:
        cols += ["tp_tadpole", "tp_horseshoe", "tp_lost", "tp_amp_med_deg", "min_perturber"]
    return cols


def _load_status(path: Path) -> dict | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _save_status(path: Path, status: dict) -> None:
    path.write_text(json.dumps(status, indent=2), encoding="utf-8")


def _body_distance(sim, name: str, primary_name: str) -> float:
    p = sim.particles[name]
    c = sim.particles[primary_name]
    return math.sqrt((p.x - c.x) ** 2 + (p.y - c.y) ** 2 + (p.z - c.z) ** 2)


def _snapshot_elements(sim, meta) -> dict:
    out = {}
    for name in meta["bodies"]:
        out[name] = model.elements_against(sim, name, meta["primary"][name])
    if "test_particles" in meta:
        host = meta["host"]
        primary = meta["primary"].get(host, meta.get("host_primary", "star"))
        if meta["kind"] == "trojan_der":
            primary = "kakakiko"
        out["_host"] = model.elements_against(sim, host, primary)
        out["_tp"] = []
        for tp in meta["test_particles"]:
            try:
                el = model.elements_against(sim, tp["name"], primary)
            except Exception:
                el = None
            out["_tp"].append(el)
    return out


def _pair_minsep(prev, curr, meta, dt, nsub) -> dict:
    mins = {}
    for p1, p2 in meta.get("pairs", []):
        if prev is None or p1 not in prev or p2 not in prev:
            mins[f"minsep_{p1}_{p2}"] = float("nan")
            continue
        # Instantaneous separation at the sample, and a Keplerian fill of the gap.
        inst = _sep_from_elements_unused()
        gap = model.min_kepler_separation(prev[p1], prev[p2], dt, nsub)
        # Also the separation of the current Keplerian state at the endpoint (dt).
        mins[f"minsep_{p1}_{p2}"] = gap
        _ = inst
        _ = curr
    return mins


def _sep_from_elements_unused():
    return None


def _physical_sep(sim, n1, n2) -> float:
    a = sim.particles[n1]
    b = sim.particles[n2]
    return math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)


def _update_running_sep(status, key, value):
    if value is None or not math.isfinite(value):
        return
    cur = status["running_minsep"].get(key)
    if cur is None or value < cur:
        status["running_minsep"][key] = value


def _check_bounds(sim, meta, status) -> tuple[str, str] | None:
    mstar = meta["mstar"]
    for name in meta["bodies"]:
        primary = meta["primary"][name]
        # Radial bound is about that body's own primary: the star, or Kakakiko for a moon.
        r = _body_distance(sim, name, primary)
        a0 = meta["a0"][name]
        if r < 0.5 * a0 or r > 2.0 * a0:
            return "radial", f"{name} distance from {primary} is {r:.6e} AU, outside [0.5, 2] x a0={a0:.6e}"
        el = model.elements_against(sim, name, primary)
        if not math.isfinite(el["a"]) or el["a"] < 0:
            return "radial", f"{name} unbound osculating a={el['a']}"
    # Planet-planet (or moon-moon) Hill encounters. Not applied to a moon vs its planet.
    for p1, p2 in meta.get("pairs", []):
        if meta["primary"][p1] != meta["primary"][p2]:
            # Hierarchical pair: moon vs planet is not an encounter.
            # Still record moon-moon, which share a primary.
            continue
        sep = _physical_sep(sim, p1, p2)
        el1 = model.elements_against(sim, p1, meta["primary"][p1])
        el2 = model.elements_against(sim, p2, meta["primary"][p2])
        rhm = model.mutual_hill(el1["a"], el2["a"], meta["m"][p1], meta["m"][p2], meta["m"][meta["primary"][p1]] if meta["primary"][p1] != "star" else mstar)
        # Moons: stop only inside 0.8 mutual Hill (the resonant minimum is ~1.65).
        thresh = 0.8 if meta["kind"] == "moons" else 1.0
        _update_running_sep(status, f"inst_{p1}_{p2}", sep)
        if sep < thresh * rhm:
            return "encounter", f"{p1}-{p2} separation {sep:.6e} AU < {thresh} mutual Hill {rhm:.6e} AU"
    if meta["kind"] in ("moons", "trojan_der") and "kakakiko" in meta["bodies"]:
        r_der = _body_distance(sim, "der", "kakakiko")
        el_k = model.elements_against(sim, "kakakiko", "star")
        rh = model.hill_radius(el_k["a"], meta["m"]["kakakiko"], mstar)
        status["running_minsep"]["der_over_hill_max"] = max(status["running_minsep"].get("der_over_hill_max", 0.0), r_der / rh)
        if r_der > rh:
            return "radial", f"Der distance {r_der:.6e} AU exceeds Kakakiko Hill radius {rh:.6e} AU"
    return None


def _init_tp_stats(meta, sim) -> dict:
    stats = {}
    if "test_particles" not in meta:
        return stats
    primary = "kakakiko" if meta["kind"] == "trojan_der" else "star"
    host_el = model.elements_against(sim, meta["host"], primary)
    for tp in meta["test_particles"]:
        el = model.elements_against(sim, tp["name"], primary)
        phi = float(model.wrap_pi(el["l"] - host_el["l"] - math.radians(tp["center_deg"])))
        stats[tp["name"]] = {
            "group": tp["group"],
            "center_deg": tp["center_deg"],
            "phi_min": phi,
            "phi_max": phi,
            "a_min": el["a"],
            "a_max": el["a"],
            "alive": True,
            "fate": "tadpole",
        }
    return stats


def _update_tp(sim, meta, status) -> dict:
    """Update Trojan running stats. Returns summary numbers for the CSV."""
    if "test_particles" not in meta:
        return {}
    primary = "kakakiko" if meta["kind"] == "trojan_der" else "star"
    host_el = model.elements_against(sim, meta["host"], primary)
    a_host = host_el["a"]
    pert = meta.get("perturber")
    min_pert = status["running_minsep"].get("min_perturber", float("inf"))
    n_tad, n_horse, n_lost = 0, 0, 0
    amps = []
    a_limit = 0.15 * a_host if meta["kind"] == "trojan_der" else 0.25
    for tp in meta["test_particles"]:
        st = status["tp_stats"][tp["name"]]
        try:
            el = model.elements_against(sim, tp["name"], primary)
        except Exception:
            st["alive"] = False
            st["fate"] = "lost"
            n_lost += 1
            continue
        phi = float(model.wrap_pi(el["l"] - host_el["l"] - math.radians(tp["center_deg"])))
        st["phi_min"] = min(st["phi_min"], phi)
        st["phi_max"] = max(st["phi_max"], phi)
        if math.isfinite(el["a"]) and el["a"] > 0:
            st["a_min"] = min(st["a_min"], el["a"])
            st["a_max"] = max(st["a_max"], el["a"])
        r = _body_distance(sim, tp["name"], primary)
        a0 = a_host
        left = (not math.isfinite(el["a"])) or el["a"] < 0 or abs(el["a"] - a_host) > a_limit or r > 2.5 * a0 or r < 0.4 * a0
        amp = 0.5 * (st["phi_max"] - st["phi_min"])
        # Crossing more than 90 deg from the Lagrange point means the tadpole opened.
        if left:
            st["alive"] = False
            st["fate"] = "lost"
            n_lost += 1
        elif abs(phi) > math.radians(90.0) or abs(st["phi_min"]) > math.radians(100.0) or abs(st["phi_max"]) > math.radians(100.0):
            st["fate"] = "horseshoe"
            n_horse += 1
            amps.append(math.degrees(amp))
        else:
            st["fate"] = "tadpole"
            st["alive"] = True
            n_tad += 1
            amps.append(math.degrees(amp))
        if pert:
            dpert = _physical_sep(sim, tp["name"], pert)
            min_pert = min(min_pert, dpert)
    if min_pert < float("inf"):
        status["running_minsep"]["min_perturber"] = min_pert
    med = float(np.median(amps)) if amps else float("nan")
    return {
        "tp_tadpole": n_tad,
        "tp_horseshoe": n_horse,
        "tp_lost": n_lost,
        "tp_amp_med_deg": med,
        "min_perturber": min_pert if min_pert < float("inf") else float("nan"),
    }


def _row(sim, meta, cfg, status, E0, prev_el, dt) -> tuple[list, dict]:
    sim.synchronize()
    el = _snapshot_elements(sim, meta)
    E = float(sim.energy())
    rel = abs(E - E0) / abs(E0)
    status["relE_last"] = rel
    status["relE_max"] = max(status.get("relE_max", 0.0), rel)
    status["energy_last"] = E
    vals = {"t": sim.t, "E": E, "relE": rel}
    for name in meta["bodies"]:
        vals[f"a_{name}"] = el[name]["a"]
        vals[f"e_{name}"] = el[name]["e"]
        vals[f"i_{name}"] = el[name]["inc"]
    if meta["kind"] == "moons":
        phi1, phi2 = model.resonant_angles(sim)
        vals["phi1"] = phi1
        vals["phi2"] = phi2
        vals["sep_sh_der"] = _physical_sep(sim, "shudder", "der")
        vals["r_sh"] = _body_distance(sim, "shudder", "kakakiko")
        vals["r_der"] = _body_distance(sim, "der", "kakakiko")
        if "kakakiko" in el:
            el_k = el["kakakiko"]
            vals["hill_kak"] = model.hill_radius(el_k["a"], meta["m"]["kakakiko"], meta["mstar"])
            status["running_minsep"]["der_over_hill_max"] = max(
                status["running_minsep"].get("der_over_hill_max", 0.0),
                vals["r_der"] / vals["hill_kak"],
            )
        else:
            vals["hill_kak"] = float("nan")
        _update_running_sep(status, "sep_sh_der", vals["sep_sh_der"])
    if cfg.get("megno"):
        try:
            vals["megno"] = float(sim.megno())
            vals["lyapunov"] = float(sim.lyapunov())
        except Exception:
            vals["megno"] = float("nan")
            vals["lyapunov"] = float("nan")
    for p1, p2 in meta.get("pairs", []):
        key = f"minsep_{p1}_{p2}"
        if prev_el is not None and p1 in prev_el and p2 in prev_el and dt > 0:
            gap = model.min_kepler_separation(prev_el[p1], prev_el[p2], dt, cfg["nsub"])
        else:
            gap = _physical_sep(sim, p1, p2)
        # The Kepler fill can miss a real geometry if elements change quickly.
        # Keep the smaller of the fill and the sample-endpoint separation.
        endsep = _physical_sep(sim, p1, p2)
        gap = min(gap, endsep)
        vals[key] = gap
        _update_running_sep(status, key, gap)
    if "test_particles" in meta:
        vals.update(_update_tp(sim, meta, status))
    return vals, el


def _write_row(fh, writer, header, vals):
    writer.writerow([vals.get(h, "") for h in header])
    fh.flush()


def _save_restart(sim, path: Path):
    tmp = path.with_suffix(".tmp.bin")
    if tmp.exists():
        tmp.unlink()
    sim.save_to_file(str(tmp))
    if path.exists():
        path.unlink()
    tmp.rename(path)


def _save_frame(sim, meta, path: Path, t: float):
    if "test_particles" not in meta:
        return
    if meta["kind"] == "trojan_der":
        origin = "kakakiko"
        host = "der"
    else:
        origin = "star"
        host = "croquet"
    o = sim.particles[origin]
    h = sim.particles[host]
    ang = math.atan2(h.y - o.y, h.x - o.x)
    co, so = math.cos(-ang), math.sin(-ang)
    frame = {"t": t, "origin": origin, "host": host, "particles": []}
    names = [host] + [tp["name"] for tp in meta["test_particles"]]
    groups = {host: "host"}
    for tp in meta["test_particles"]:
        groups[tp["name"]] = tp["group"]
    for name in names:
        p = sim.particles[name]
        dx, dy = p.x - o.x, p.y - o.y
        frame["particles"].append({
            "name": name,
            "group": groups[name],
            "x": co * dx - so * dy,
            "y": so * dx + co * dy,
        })
    # Keep the initial frame and overwrite the latest frame in a small JSON list.
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
    else:
        data = []
    if not data:
        data.append(frame)
    elif abs(data[0]["t"] - t) < 1e-12:
        data[0] = frame
    else:
        if len(data) == 1:
            data.append(frame)
        else:
            data[-1] = frame
    path.write_text(json.dumps(data), encoding="utf-8")


def _fresh(cfg, paths, run_id):
    sim, meta = build_run(cfg)
    sim.synchronize()
    info = _apply_integrator(sim, cfg, meta)
    if cfg.get("megno"):
        sim.init_megno(seed=model.SEED)
    # Exit backstop: well outside the outermost tracked body.
    outers = [meta["a0"][n] for n in meta["bodies"] if meta["primary"].get(n) == "star"]
    # Trojan runs must not abort when one massless particle is scattered.
    sim.exit_max_distance = 1000.0 if (not outers or "test_particles" in meta) else 3.0 * max(outers)
    E0 = float(sim.energy())
    header = _csv_header(meta, cfg)
    status = {
        "run_id": run_id,
        "builder": cfg["builder"],
        "integrator": info,
        "target_yr": cfg["target"],
        "check_interval_yr": cfg["check"],
        "archive_interval_yr": cfg["archive"],
        "t_yr": 0.0,
        "wall_s": 0.0,
        "energy0": E0,
        "energy_last": E0,
        "relE_last": 0.0,
        "relE_max": 0.0,
        "stop_reason": "running",
        "stop_detail": "",
        "seed": model.SEED,
        "megno": bool(cfg.get("megno")),
        "meta_brief": {
            "kind": meta["kind"],
            "bodies": meta["bodies"],
            "primary": meta["primary"],
            "a0": meta["a0"],
            "m": meta["m"],
            "mstar": meta["mstar"],
            "pairs": meta.get("pairs", []),
            "phase": meta.get("phase"),
            "inc_deg": meta.get("inc_deg"),
            "a_shudder_input": meta.get("a_shudder_input"),
            "tuned": meta.get("tuned"),
            "variant": meta.get("variant"),
            "sable_e": meta.get("sable_e"),
            "n_test_particles": len(meta.get("test_particles", [])),
            "host": meta.get("host"),
        },
        "anomalies": model.mean_anomalies(),
        "running_minsep": {},
        "tp_stats": _init_tp_stats(meta, sim),
        "chunks": [],
        "header": header,
    }
    # Initial osculating elements for the report.
    status["t0_elements"] = {
        name: model.elements_against(sim, name, meta["primary"][name]) for name in meta["bodies"]
    }
    if meta["kind"] == "moons":
        phi1, phi2 = model.resonant_angles(sim)
        status["t0_phi"] = {"phi1": phi1, "phi2": phi2}
    fh = paths["csv"].open("w", newline="", encoding="utf-8")
    writer = csv.writer(fh)
    writer.writerow(header)
    vals, el = _row(sim, meta, cfg, status, E0, None, 0.0)
    _write_row(fh, writer, header, vals)
    _save_frame(sim, meta, paths["frames"], sim.t)
    sim.save_to_file(str(paths["archive"]), interval=cfg["archive"], delete_file=True)
    _save_restart(sim, paths["restart"])
    _save_status(paths["status"], status)
    return sim, meta, status, fh, writer, el


def _resume(cfg, paths):
    status = _load_status(paths["status"])
    if status is None:
        raise RuntimeError("missing status")
    sa = rebound.Simulationarchive(str(paths["archive"]))
    sim = sa[-1]
    # The archive snapshot can lag the CSV if a chunk ended between snapshots.
    # Prefer the restart file when it is at least as far as the archive.
    if paths["restart"].exists():
        sim_r = rebound.Simulation(str(paths["restart"]))
        if sim_r.t + 1e-9 >= sim.t:
            sim = sim_r
    sim.synchronize()
    # Rebuild meta from the same builder. Particle positions come from the file,
    # so the rebuilt meta is only the label structure. Do not replace `sim`.
    _sim2, meta = build_run(cfg)
    # Sanity: names of massive bodies must exist.
    for name in meta["bodies"]:
        _ = sim.particles[name]
    # Drop CSV rows that are ahead of the restored time (partial chunk).
    _truncate_csv(paths["csv"], sim.t)
    fh = paths["csv"].open("a", newline="", encoding="utf-8")
    writer = csv.writer(fh)
    el = _snapshot_elements(sim, meta)
    # Re-arm the archive append only when we resumed from the interval archive
    # itself. A one-snapshot restart file is not that archive. If sim.t is ahead
    # of the archive, append by pointing the interval writer at the archive.
    if abs(sim.t - sa[-1].t) > 1e-8:
        sim.save_to_file(str(paths["archive"]), interval=cfg["archive"], delete_file=False)
    return sim, meta, status, fh, writer, el


def _truncate_csv(path: Path, t_max: float):
    lines = path.read_text(encoding="utf-8").splitlines()
    if len(lines) <= 1:
        return
    header = lines[0]
    kept = [header]
    for line in lines[1:]:
        if not line.strip():
            continue
        t = float(line.split(",")[0])
        if t <= t_max + 1e-8:
            kept.append(line)
    path.write_text("\n".join(kept) + "\n", encoding="utf-8")


def run(run_id: str, years: float) -> None:
    if run_id not in RUNS:
        raise SystemExit(f"unknown run_id {run_id}. known: {', '.join(RUNS)}")
    cfg = RUNS[run_id]
    paths = _paths(run_id)
    t_wall0 = time.perf_counter()
    resuming = paths["status"].exists() and paths["restart"].exists()
    if resuming:
        sim, meta, status, fh, writer, prev_el = _resume(cfg, paths)
        print(f"RESUME {run_id} t={sim.t:.6g} yr target_chunk={years:g}", flush=True)
    else:
        sim, meta, status, fh, writer, prev_el = _fresh(cfg, paths, run_id)
        print(f"START {run_id} integrator={status['integrator']} target_chunk={years:g}", flush=True)
    hard_stop = status.get("stop_reason") in ("radial", "encounter", "escape", "collision")
    if hard_stop or sim.t >= cfg["target"] - 1e-8:
        print(f"ALREADY STOPPED {run_id} reason={status['stop_reason']} {status.get('stop_detail','')}", flush=True)
        fh.close()
        return
    status["stop_reason"] = "running"
    t_goal = sim.t + years
    t_goal = min(t_goal, cfg["target"])
    header = status["header"]
    E0 = status["energy0"]
    stop = None
    last_print = t_wall0
    last_ckpt = t_wall0
    t_chunk0 = sim.t
    try:
        while sim.t < t_goal - 1e-12:
            t_next = min(sim.t + cfg["check"], t_goal)
            try:
                sim.integrate(t_next, exact_finish_time=0)
            except rebound.Escape:
                sim.synchronize()
                stop = ("escape", f"exit_max_distance reached at t={sim.t:.6g}")
                break
            except rebound.Collision:
                sim.synchronize()
                stop = ("encounter", f"integrator collision at t={sim.t:.6g}")
                break
            dt = sim.t - prev_el[meta["bodies"][0]]["t_sample"] if prev_el and "t_sample" in prev_el.get(meta["bodies"][0], {}) else (sim.t - t_chunk0 if prev_el else 0.0)
            # dt for the Kepler fill is the time since the previous sample.
            dt = cfg["check"]
            vals, el = _row(sim, meta, cfg, status, E0, prev_el, dt)
            _write_row(fh, writer, header, vals)
            prev_el = el
            reason = _check_bounds(sim, meta, status)
            if reason:
                stop = reason
                break
            now = time.perf_counter()
            if now - last_print > 45.0:
                print(
                    f"  {run_id} t={sim.t:.6g} yr relE={status['relE_last']:.3e} wall={now-t_wall0:.0f}s",
                    flush=True,
                )
                last_print = now
            if now - last_ckpt > 90.0:
                _save_restart(sim, paths["restart"])
                _save_status(paths["status"], status)
                last_ckpt = now
            if now - t_wall0 > WALL_LIMIT:
                stop = ("wall_limit", f"wall clock {now-t_wall0:.0f}s")
                break
    finally:
        fh.close()
    sim.synchronize()
    wall = time.perf_counter() - t_wall0
    status["wall_s"] = float(status.get("wall_s", 0.0) + wall)
    status["t_yr"] = float(sim.t)
    if stop is None:
        if sim.t + 1e-6 >= cfg["target"]:
            stop = ("complete_target", f"reached {sim.t:.6g} yr")
        else:
            stop = ("chunk_done", f"advanced to {sim.t:.6g} yr")
    status["stop_reason"] = stop[0]
    status["stop_detail"] = stop[1]
    status["chunks"].append({
        "t0": t_chunk0,
        "t1": float(sim.t),
        "wall_s": wall,
        "reason": stop[0],
    })
    _save_frame(sim, meta, paths["frames"], sim.t)
    _save_restart(sim, paths["restart"])
    # Make sure the interval archive has a snapshot at the chunk end.
    try:
        sim.save_to_file(str(paths["archive"]), interval=cfg["archive"], delete_file=False)
    except Exception as exc:
        status["archive_note"] = str(exc)
    _save_status(paths["status"], status)
    print(
        f"DONE {run_id} t={sim.t:.6g} reason={stop[0]} relE={status['relE_last']:.3e} "
        f"maxRelE={status['relE_max']:.3e} wall={wall:.1f}s total_wall={status['wall_s']:.1f}s",
        flush=True,
    )
    if stop[1]:
        print(f"  detail: {stop[1]}", flush=True)


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: python run_chunk.py <run_id> <years>")
    run(sys.argv[1], float(sys.argv[2]))


if __name__ == "__main__":
    main()
