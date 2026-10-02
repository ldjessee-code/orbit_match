"""One-shot numbers for the report. Reads closed logs only."""

from __future__ import annotations

import csv
import math
from pathlib import Path

import numpy as np

import tau_ceti_model as model

LOGS = Path(__file__).resolve().parent / "logs"


def load(run_id):
    path = LOGS / f"{run_id}.csv"
    with path.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    data = {}
    for key in rows[0]:
        vals = []
        for row in rows:
            raw = row[key]
            vals.append(float(raw) if raw not in ("", None) else np.nan)
        data[key] = np.asarray(vals, dtype=float)
    return data


def fft_period(t, y):
    finite = np.isfinite(y) & np.isfinite(t)
    t = t[finite]
    y = y[finite]
    dt = float(np.median(np.diff(t)))
    y0 = y - np.mean(y)
    # Detrend a slow linear drift so the carrier stands out.
    slope = np.polyfit(t - t[0], y0, 1)
    y1 = y0 - np.polyval(slope, t - t[0])
    spec = np.abs(np.fft.rfft(y1)) ** 2
    freq = np.fft.rfftfreq(len(y1), d=dt)
    spec[0] = 0.0
    # Ignore periods shorter than 2 kyr (sampling noise / inner orbits).
    mask = (freq > 0) & (1.0 / freq < 2.0e3)
    spec = spec.copy()
    spec[mask] = 0.0
    k = int(np.argmax(spec))
    period = 1.0 / freq[k] if freq[k] > 0 else float("nan")
    return period, float(np.mean(y)), float(np.min(y)), float(np.max(y)), dt, len(y)


def angle_report(phi):
    phi = phi[np.isfinite(phi)]
    c = np.mean(np.cos(phi))
    s = np.mean(np.sin(phi))
    conc = math.hypot(c, s)
    center = math.atan2(s, c)
    # Circulation if the running unwrapped angle covers more than a full turn
    # beyond a bounded libration. Use the range of the wrapped samples.
    return {
        "n": len(phi),
        "min_deg": math.degrees(float(np.min(phi))),
        "max_deg": math.degrees(float(np.max(phi))),
        "center_deg": math.degrees(center),
        "concentration": conc,
        "rms_deg": math.degrees(math.sqrt(float(np.mean(np.square(phi - center))))),
    }


def main():
    print("M_EARTH/Msun", model.M_EARTH)
    print("kakakiko Mearth", model.MASSES_ME["kakakiko"])
    print("der/kak", model.MASSES_ME["der"] / model.MASSES_ME["kakakiko"])
    print("shudder Mearth", model.MASSES_ME["shudder"])
    mstar = model.M_STAR
    for n1, n2 in (
        ("gane", "hornstooth"),
        ("hornstooth", "husk"),
        ("husk", "sable"),
        ("sable", "kakakiko"),
        ("kakakiko", "croquet"),
        ("croquet", "cue"),
        ("cue", "eight"),
    ):
        a1, a2 = model.A_AU[n1], model.A_AU[n2]
        m1, m2 = model.mass_msun(n1), model.mass_msun(n2)
        rh = model.mutual_hill(a1, a2, m1, m2, mstar)
        print(f"dHill {n1}-{n2} {(a2-a1)/rh:.3f} RHm_AU {rh:.6g}")
    rh_k = model.hill_radius(model.A_AU["kakakiko"], model.mass_msun("kakakiko"), mstar)
    print("kak hill AU", rh_k, "km", rh_k * model.AU_KM)
    rh_m = model.mutual_hill(
        model.A_AU["shudder"], model.A_AU["der"],
        model.mass_msun("shudder"), model.mass_msun("der"), model.mass_msun("kakakiko"),
    )
    print("moon mutual hill km", rh_m * model.AU_KM, "spacing", (model.A_AU["der"]-model.A_AU["shudder"]) / rh_m)
    print("folded Msun", sum(model.mass_msun(n) for n in model.INNER_FOLDED))

    for run_id in ("B_sable01", "B_sable005"):
        data = load(run_id)
        period, mean, lo, hi, dt, n = fft_period(data["t"], data["e_kakakiko"])
        print(f"{run_id} t {data['t'][-1]:.6g} e_kak fft_period_yr {period:.1f} mean {mean:.5f} range {lo:.5f} {hi:.5f} n {n}")
        for key in ("e_sable", "e_gane", "e_hornstooth", "e_husk", "e_croquet", "e_cue", "e_eight", "a_kakakiko", "a_sable"):
            x = data[key]
            x = x[np.isfinite(x)]
            print(f"  {key} {np.min(x):.6g} {np.max(x):.6g}")
        sep = data["minsep_sable_kakakiko"]
        sep = sep[np.isfinite(sep)]
        print(f"  sable-kak minsep AU {np.min(sep):.6f}")

    data = load("C_isolated")
    print("C_isolated t", data["t"][0], data["t"][-1], "n", len(data["t"]))
    print(" phi1", angle_report(data["phi1"]))
    print(" phi2", angle_report(data["phi2"]))
    # Amplitude in 10 kyr blocks.
    t = data["t"]
    phi = data["phi1"]
    for t0 in (0.0, 10000.0, 20000.0, 30000.0, 40000.0):
        m = (t >= t0) & (t < t0 + 10000.0) & np.isfinite(phi)
        if np.any(m):
            print(f"  phi1 block {t0:.0f} deg {np.degrees(np.min(phi[m])):.2f} {np.degrees(np.max(phi[m])):.2f}")
    for key in ("a_shudder", "e_shudder", "a_der", "e_der", "sep_sh_der"):
        x = data[key]
        x = x[np.isfinite(x)]
        print(f"  {key} {np.min(x):.6g} {np.max(x):.6g}")

    der = load("D_der")
    tad = der["tp_tadpole"]
    # First time tadpole count falls below 50, and below 25, and to 0.
    for thresh in (50, 40, 25, 1):
        idx = np.where(tad < thresh)[0]
        if len(idx):
            print(f"D_der tadpole<{thresh} first t={der['t'][idx[0]]:.4f} count={tad[idx[0]]}")
    print("D_der last", der["t"][-1], "tad", tad[-1], "horse", der["tp_horseshoe"][-1], "lost", der["tp_lost"][-1])

    # A_e05 Kakakiko e: is the swing one long period?
    ae = load("A_e05")
    period, mean, lo, hi, dt, n = fft_period(ae["t"], ae["e_kakakiko"])
    print(f"A_e05 e_kak fft {period:.1f} mean {mean:.5f} {lo:.5f} {hi:.5f}")
    period, mean, lo, hi, dt, n = fft_period(ae["t"], ae["e_eight"])
    print(f"A_e05 e_eight fft {period:.1f} {lo:.5f} {hi:.5f}")

    am = load("A_megno")
    print(
        f"A_megno t {am['t'][-1]:.6g} megno last {am['megno'][-1]:.6g} "
        f"min {np.nanmin(am['megno']):.6g} max {np.nanmax(am['megno']):.6g} "
        f"lyap last {am['lyapunov'][-1]:.6g} min {np.nanmin(am['lyapunov']):.6g} max {np.nanmax(am['lyapunov']):.6g}"
    )
    bb = load("B")
    period, mean, lo, hi, dt, n = fft_period(bb["t"], bb["e_kakakiko"])
    print(f"B t {bb['t'][-1]:.6g} e_kak fft {period:.1f} mean {mean:.5f} {lo:.5f} {hi:.5f}")
    sep = bb["minsep_sable_kakakiko"]
    print(f"  minsep {np.nanmin(sep):.6f} e_sable {np.nanmin(bb['e_sable']):.5f} {np.nanmax(bb['e_sable']):.5f}")
    for key in ("e_gane", "e_hornstooth", "e_husk", "e_croquet", "e_cue", "e_eight"):
        x = bb[key]
        print(f"  {key} {np.nanmin(x):.6g} {np.nanmax(x):.6g}")

    try:
        dc = load("D_croquet")
        print(
            f"D_croquet t {dc['t'][-1]:.6g} tad {dc['tp_tadpole'][-1]} horse {dc['tp_horseshoe'][-1]} "
            f"lost {dc['tp_lost'][-1]} amp_med last {dc['tp_amp_med_deg'][-1]:.3f} "
            f"amp max {np.nanmax(dc['tp_amp_med_deg']):.3f}"
        )
    except Exception as exc:
        print("D_croquet skip", type(exc).__name__)


if __name__ == "__main__":
    main()
