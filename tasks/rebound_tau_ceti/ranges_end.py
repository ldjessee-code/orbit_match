"""Final ranges for the closed 100 Myr and 5 Myr runs."""

import numpy as np

from digest import fft_period, load

for run_id in ("A", "B"):
    data = load(run_id)
    print(f"\n== {run_id} t={data['t'][-1]:.8g}")
    for key in data:
        if key.startswith(("a_", "e_", "minsep", "relE")) or key in ("megno", "lyapunov"):
            x = data[key]
            x = x[np.isfinite(x)]
            if len(x) == 0:
                continue
            print(f"  {key}: {np.min(x):.6g} .. {np.max(x):.6g}")
    if run_id == "B":
        period, mean, lo, hi, dt, n = fft_period(data["t"], data["e_kakakiko"])
        print(f"  e_kak fft_yr {period:.1f} mean {mean:.5f}")
    if "a_cue" in data:
        ratio = (data["a_cue"] / data["a_croquet"]) ** 1.5
        print(f"  Pratio {np.nanmin(ratio):.6f} .. {np.nanmax(ratio):.6f}")
