"""Ranges for runs that are not being written right now."""

import json
import math
from pathlib import Path

import numpy as np

from digest import fft_period, load

LOGS = Path(__file__).resolve().parent / "logs"

for run_id, keys in (
    ("A", ("a_kakakiko", "e_kakakiko", "a_croquet", "e_croquet", "a_cue", "e_cue", "a_eight", "e_eight", "minsep_croquet_cue", "minsep_kakakiko_croquet", "relE")),
    ("B_sable005", ("e_kakakiko", "e_sable", "e_gane", "e_hornstooth", "e_husk", "a_kakakiko", "a_sable", "minsep_sable_kakakiko", "relE")),
    ("D_croquet", ("tp_tadpole", "tp_horseshoe", "tp_lost", "tp_amp_med_deg", "e_croquet", "e_cue", "minsep_croquet_cue", "relE")),
):
    data = load(run_id)
    print(f"\n== {run_id} t={data['t'][-1]:.8g} n={len(data['t'])}")
    for key in keys:
        x = data[key]
        x = x[np.isfinite(x)]
        print(f"  {key}: {np.min(x):.6g} .. {np.max(x):.6g} last {x[-1]:.6g}")
    if "a_cue" in data and "a_croquet" in data:
        ratio = (data["a_cue"] / data["a_croquet"]) ** 1.5
        print(f"  Pratio {np.nanmin(ratio):.6f} .. {np.nanmax(ratio):.6f}")

data = load("B_sable005")
period, mean, lo, hi, dt, n = fft_period(data["t"], data["e_kakakiko"])
print(f"B_sable005 fft {period:.1f} mean {mean:.5f}")

st = json.loads((LOGS / "D_croquet.json").read_text(encoding="utf-8"))
groups = {}
for name, tp in st["tp_stats"].items():
    g = tp["group"]
    groups.setdefault(g, []).append(tp)
for g, items in groups.items():
    amps = [0.5 * (tp["phi_max"] - tp["phi_min"]) for tp in items]
    fates = {}
    for tp in items:
        fates[tp["fate"]] = fates.get(tp["fate"], 0) + 1
    print(
        g,
        "n",
        len(items),
        "fates",
        fates,
        "amp_deg med",
        round(math.degrees(float(np.median(amps))), 3),
        "max",
        round(math.degrees(float(np.max(amps))), 3),
    )
print("min_perturber", st.get("running_minsep", {}).get("min_perturber"))
