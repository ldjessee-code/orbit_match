"""Print compact ranges from the logs that already exist. Read-only."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
LOGS = ROOT / "logs"

KEYS = (
    "a_kakakiko",
    "e_kakakiko",
    "a_croquet",
    "e_croquet",
    "a_cue",
    "e_cue",
    "a_eight",
    "e_eight",
    "a_sable",
    "e_sable",
    "a_gane",
    "e_gane",
    "a_hornstooth",
    "e_hornstooth",
    "a_husk",
    "e_husk",
    "a_shudder",
    "e_shudder",
    "i_shudder",
    "a_der",
    "e_der",
    "i_der",
    "phi1",
    "phi2",
    "sep_sh_der",
    "r_sh",
    "r_der",
    "hill_kak",
    "megno",
    "lyapunov",
    "minsep_croquet_cue",
    "minsep_sable_kakakiko",
    "minsep_kakakiko_croquet",
    "tp_tadpole",
    "tp_horseshoe",
    "tp_lost",
    "tp_amp_med_deg",
    "relE",
)


def load(run_id: str):
    path = LOGS / f"{run_id}.csv"
    if not path.exists():
        return None
    with path.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    if not rows:
        return None
    data = {}
    for key in rows[0]:
        vals = []
        for row in rows:
            raw = row.get(key, "")
            if raw == "" or raw is None:
                vals.append(np.nan)
            else:
                try:
                    vals.append(float(raw))
                except ValueError:
                    vals.append(np.nan)
        data[key] = np.asarray(vals, dtype=float)
    return data


def main():
    for path in sorted(LOGS.glob("*.json")):
        if path.name.endswith("_frames.json"):
            continue
        st = json.loads(path.read_text(encoding="utf-8"))
        data = load(path.stem)
        if data is None:
            print(f"\n== {path.stem} no csv rows stop={st.get('stop_reason')}")
            continue
        t = data["t"]
        print(
            f"\n== {path.stem} n={len(t)} t={t[-1]:.6g} stop={st.get('stop_reason')} "
            f"wall={st.get('wall_s')} relE_max={st.get('relE_max')} integ={st.get('integrator')}"
        )
        for key in KEYS:
            if key not in data:
                continue
            x = data[key]
            x = x[np.isfinite(x)]
            if len(x) == 0:
                continue
            print(f"  {key}: min {np.min(x):.6g} max {np.max(x):.6g} last {x[-1]:.6g}")
        if "a_cue" in data and "a_croquet" in data:
            ratio = (data["a_cue"] / data["a_croquet"]) ** 1.5
            ratio = ratio[np.isfinite(ratio)]
            print(f"  Pratio: min {np.min(ratio):.6f} max {np.max(ratio):.6f}")
        if "e_kakakiko" in data and path.stem.startswith("B"):
            e = data["e_kakakiko"]
            finite = np.isfinite(e)
            e = e[finite]
            tt = t[finite]
            if len(e) > 10:
                # Autocorr peaks: first time corr drops below 0.2, and the lag of the minimum.
                e0 = e - np.mean(e)
                var = np.dot(e0, e0)
                if var > 0:
                    step = max(1, len(e) // 4000)
                    e0s = e0[::step]
                    tts = tt[::step]
                    n = len(e0s)
                    best = None
                    crossed = None
                    for lag in range(1, n // 2):
                        c = np.dot(e0s[:-lag], e0s[lag:]) / var * step
                        if best is None or c < best[1]:
                            best = (float(tts[lag] - tts[0]), float(c))
                        if crossed is None and c < 0.2:
                            crossed = (float(tts[lag] - tts[0]), float(c))
                    print(f"  e_kak autocorr min {best} first_below_0.2 {crossed} mean {np.mean(e):.6g}")


if __name__ == "__main__":
    main()
