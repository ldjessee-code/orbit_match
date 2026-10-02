"""Plot and summarize Tau Ceti REBOUND logs. Reads logs/, writes plots/."""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parent
LOGS = ROOT / "logs"
PLOTS = ROOT / "plots"
PLOTS.mkdir(parents=True, exist_ok=True)


def load(run_id: str):
    path = LOGS / f"{run_id}.csv"
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    if len(rows) < 2:
        return None
    cols = rows[0].keys()
    data = {c: np.array([float(r[c]) if r[c] != "" else np.nan for r in rows]) for c in cols}
    return data


def status(run_id: str) -> dict:
    path = LOGS / f"{run_id}.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def thin(x, n=4000):
    if len(x) <= n:
        return np.arange(len(x))
    return np.linspace(0, len(x) - 1, n).astype(int)


def secular_period(t, e):
    """First positive autocorrelation peak of e(t), in years. None if flat."""
    if len(t) < 50:
        return None
    y = e - np.mean(e)
    if np.max(np.abs(y)) < 1e-6:
        return None
    # Uniform-ish samples: use index lag times mean dt.
    y = y - np.mean(y)
    corr = np.correlate(y, y, mode="full")
    corr = corr[len(y) - 1 :]
    corr = corr / corr[0]
    # Ignore the first 1% of the series (the zero-lag peak).
    start = max(5, len(corr) // 200)
    if start >= len(corr) - 5:
        return None
    # Find the first peak after corr has fallen below 0.5.
    below = np.where(corr[start:] < 0.5)[0]
    if len(below) == 0:
        return None
    i0 = start + int(below[0])
    seg = corr[i0:]
    if len(seg) < 5:
        return None
    k = int(np.argmax(seg))
    if seg[k] < 0.2:
        return None
    lag = i0 + k
    dt = float(np.median(np.diff(t)))
    return lag * dt


def angle_stats(phi):
    phi = phi[np.isfinite(phi)]
    if len(phi) < 5:
        return None
    z = np.mean(np.exp(1j * phi))
    center = float(np.angle(z))
    d = (phi - center + np.pi) % (2 * np.pi) - np.pi
    return {
        "conc": float(np.abs(z)),
        "center_deg": math.degrees(center),
        "amp_rms_deg": math.degrees(float(np.sqrt(np.mean(d**2)))),
        "amp_peak_deg": math.degrees(float(np.max(np.abs(d)))),
        "min_deg": math.degrees(float(np.min(phi))),
        "max_deg": math.degrees(float(np.max(phi))),
    }


def save(fig, name):
    path = PLOTS / name
    fig.tight_layout()
    fig.savefig(path, dpi=120)
    plt.close(fig)
    print("wrote", path.name)


def plot_ae(data, names, title, fname, ylabel_a="a - a(0) (AU)"):
    idx = thin(data["t"])
    t = data["t"][idx]
    fig, axes = plt.subplots(2, 1, figsize=(9, 6), sharex=True)
    for name in names:
        key = f"a_{name}"
        if key in data:
            series = data[key]
            finite = series[np.isfinite(series)]
            a0 = float(finite[0]) if len(finite) else 0.0
            axes[0].plot(t, series[idx] - a0, label=name, lw=0.8)
    axes[0].set_ylabel(ylabel_a)
    axes[0].legend(loc="best", fontsize=8)
    axes[0].set_title(title)
    for name in names:
        key = f"e_{name}"
        if key in data:
            axes[1].plot(t, data[key][idx], label=name, lw=0.8)
    axes[1].set_ylabel("eccentricity")
    axes[1].set_xlabel("time (yr)")
    axes[1].legend(loc="best", fontsize=8)
    save(fig, fname)


def plot_energy(run_ids, fname):
    fig, ax = plt.subplots(figsize=(9, 4))
    any_line = False
    for run_id in run_ids:
        data = load(run_id)
        if data is None or "relE" not in data:
            continue
        idx = thin(data["t"])
        y = np.maximum(data["relE"][idx], 1e-18)
        ax.plot(data["t"][idx], y, lw=0.8, label=run_id)
        any_line = True
    if not any_line:
        plt.close(fig)
        return
    ax.set_yscale("log")
    ax.set_xlabel("time (yr)")
    ax.set_ylabel("|E-E0| / |E0|")
    ax.set_title("Relative energy error")
    ax.legend(fontsize=8)
    save(fig, fname)


def plot_ratio(data, fname):
    idx = thin(data["t"])
    t = data["t"][idx]
    ratio = (data["a_cue"] / data["a_croquet"]) ** 1.5
    fig, axes = plt.subplots(2, 1, figsize=(9, 6), sharex=True)
    axes[0].plot(t, ratio[idx], lw=0.8)
    axes[0].axhline(2.75, color="k", lw=0.6, ls="--", label="11/4 = 2.75")
    axes[0].set_ylabel("P_Cue / P_Croquet")
    axes[0].legend()
    axes[0].set_title("Croquet Ball – Cue Ball")
    if "minsep_croquet_cue" in data:
        axes[1].plot(t, data["minsep_croquet_cue"][idx], lw=0.8)
    axes[1].set_ylabel("min separation in sample window (AU)")
    axes[1].set_xlabel("time (yr)")
    save(fig, fname)


def plot_angles(data, fname, title):
    idx = thin(data["t"])
    t = data["t"][idx]
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(t, np.degrees(data["phi1"][idx]), lw=0.6, label="phi1")
    ax.plot(t, np.degrees(data["phi2"][idx]), lw=0.6, label="phi2", alpha=0.8)
    ax.set_xlabel("time (yr)")
    ax.set_ylabel("resonant angle (deg)")
    ax.set_title(title)
    ax.legend()
    save(fig, fname)


def plot_trojans(run_id, fname):
    path = LOGS / f"{run_id}_frames.json"
    if not path.exists():
        return
    frames = json.loads(path.read_text(encoding="utf-8"))
    if len(frames) < 1:
        return
    fig, axes = plt.subplots(1, len(frames), figsize=(5 * len(frames), 5), squeeze=False)
    for ax, frame in zip(axes[0], frames):
        for group, color in (("host", "k"), ("L4", "C0"), ("L5", "C1")):
            xs, ys = [], []
            for p in frame["particles"]:
                if p["group"] == group:
                    xs.append(p["x"])
                    ys.append(p["y"])
            ax.scatter(xs, ys, s=12 if group != "host" else 40, c=color, label=group)
        ax.set_aspect("equal")
        ax.set_title(f"{run_id} t={frame['t']:.4g} yr")
        ax.set_xlabel("co-rotating x (AU)")
        ax.set_ylabel("co-rotating y (AU)")
        ax.legend(fontsize=8)
    save(fig, fname)


def summarize(run_id):
    data = load(run_id)
    st = status(run_id)
    if data is None:
        print(run_id, "no data")
        return
    print(f"\n== {run_id} t={data['t'][-1]:.6g} stop={st.get('stop_reason')} wall={st.get('wall_s')} relEmax={st.get('relE_max')}")
    integ = st.get("integrator") or {}
    print("  integrator", integ.get("integrator"), "dt", integ.get("dt"), "detail", st.get("stop_detail"))
    for key in data:
        if key.startswith("e_") or key.startswith("a_") or key.startswith("minsep") or key in ("phi1", "phi2", "megno", "lyapunov", "r_der", "sep_sh_der"):
            x = data[key]
            x = x[np.isfinite(x)]
            if len(x) == 0:
                continue
            print(f"  {key}: min {np.min(x):.6g} max {np.max(x):.6g} last {x[-1]:.6g}")
    if "e_kakakiko" in data and run_id.startswith("B"):
        per = secular_period(data["t"], data["e_kakakiko"])
        print("  kakakiko e secular period yr", per)
    if "phi1" in data:
        print("  phi1", angle_stats(data["phi1"]))
        print("  phi2", angle_stats(data["phi2"]))
    if "a_cue" in data and "a_croquet" in data:
        ratio = (data["a_cue"] / data["a_croquet"]) ** 1.5
        print(f"  Pratio min {np.min(ratio):.6f} max {np.max(ratio):.6f}")
    if "tp_tadpole" in data:
        print(
            "  trojans last tadpole/horse/lost",
            data["tp_tadpole"][-1],
            data["tp_horseshoe"][-1],
            data["tp_lost"][-1],
            "amp_med",
            data["tp_amp_med_deg"][-1],
        )


def main():
    for run_id in ("A", "A_e05", "A_cue15", "A_megno", "B", "B_sable01", "B_sable005", "C", "C_nudged", "C_random", "C_tilt", "C_isolated", "C_star", "C_apo", "D_croquet", "D_der"):
        if (LOGS / f"{run_id}.csv").exists():
            summarize(run_id)

    A = load("A")
    if A is not None:
        plot_ae(A, ["kakakiko", "croquet", "cue", "eight"], "Outer system semi-major axis and eccentricity", "A_giant_ae.png")
        plot_ratio(A, "A_croquet_cue.png")
    plot_energy(["A", "A_e05", "A_cue15", "A_megno"], "A_energy.png")

    Ae = load("A_e05")
    if Ae is not None:
        plot_ae(Ae, ["croquet", "cue", "eight"], "Giants with e = 0.05", "A_e05_ae.png")
    Ac = load("A_cue15")
    if Ac is not None:
        plot_ae(Ac, ["croquet", "cue", "eight"], "Cue Ball at 1.5x mass", "A_cue15_ae.png")

    Am = load("A_megno")
    if Am is not None and "megno" in Am:
        idx = thin(Am["t"])
        fig, ax = plt.subplots(figsize=(9, 4))
        ax.plot(Am["t"][idx], Am["megno"][idx], lw=0.8)
        ax.axhline(2.0, color="k", lw=0.6, ls="--")
        ax.set_xlabel("time (yr)")
        ax.set_ylabel("MEGNO")
        ax.set_title("Outer-system MEGNO")
        save(fig, "A_megno.png")

    B = load("B")
    if B is not None:
        idx = thin(B["t"])
        fig, ax = plt.subplots(figsize=(9, 4))
        ax.plot(B["t"][idx], B["e_kakakiko"][idx], lw=0.8)
        ax.axhline(0.0396, color="k", lw=0.6, ls="--", label="Locked 0.0396")
        ax.set_xlabel("time (yr)")
        ax.set_ylabel("Kakakiko eccentricity")
        ax.set_title("Full system, Sable e = 0")
        ax.legend()
        save(fig, "B_kakakiko_e.png")
        plot_ae(B, ["gane", "hornstooth", "husk", "sable", "kakakiko"], "Inner planets", "B_inner_ae.png")
        plot_energy(["B", "B_sable01", "B_sable005"], "B_energy.png")

    fig, ax = plt.subplots(figsize=(9, 4))
    drew = False
    for run_id, label in (("B", "Sable e=0"), ("B_sable005", "Sable e=0.05"), ("B_sable01", "Sable e=0.1")):
        data = load(run_id)
        if data is None or "minsep_sable_kakakiko" not in data:
            continue
        idx = thin(data["t"])
        ax.plot(data["t"][idx], data["minsep_sable_kakakiko"][idx], lw=0.8, label=label)
        drew = True
    if drew:
        ax.set_xlabel("time (yr)")
        ax.set_ylabel("Sable–Kakakiko min separation (AU)")
        ax.legend()
        ax.set_title("Closest approach, Sable eccentricity variants")
        save(fig, "B_sable_approach.png")
    else:
        plt.close(fig)

    for run_id, title in (
        ("C", "Doc moons with the star, Sable and Croquet"),
        ("C_isolated", "Kakakiko + moons only (no star)"),
        ("C_star", "Star + Kakakiko + moons"),
        ("C_nudged", "Nudged Shudder a, with the star"),
        ("C_tilt", "Moons tilted 12 deg, with the star"),
    ):
        data = load(run_id)
        if data is None or "a_shudder" not in data:
            continue
        plot_ae(data, ["shudder", "der"], title, f"{run_id}_moons_ae.png", ylabel_a="planetocentric a (AU)")
        if "phi1" in data:
            plot_angles(data, f"{run_id}_angles.png", title)
    plot_energy(["C", "C_isolated", "C_star", "C_nudged", "C_tilt", "C_random", "C_apo"], "C_energy.png")

    plot_trojans("D_croquet", "D_croquet_corot.png")
    plot_trojans("D_der", "D_der_corot.png")
    plot_energy(["D_croquet", "D_der"], "D_energy.png")
    print("ANALYZE DONE")


if __name__ == "__main__":
    main()
