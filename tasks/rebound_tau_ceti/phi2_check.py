"""How phi2 moves in the isolated moon run. Read-only."""

import math
from pathlib import Path

import numpy as np

from digest import load

data = load("C_isolated")
p1 = data["phi1"]
p2 = data["phi2"]
ok = np.isfinite(p1) & np.isfinite(p2)
p1, p2 = p1[ok], p2[ok]
# phi1 - phi2 = varpi_Der - varpi_Shudder, which is secular and well sampled.
dvarpi = (p1 - p2 + np.pi) % (2 * np.pi) - np.pi
unw = np.unwrap(dvarpi)
print(f"apsidal diff deg min {math.degrees(dvarpi.min()):.2f} max {math.degrees(dvarpi.max()):.2f}")
print(f"unwrap net deg {math.degrees(float(unw[-1]-unw[0])):.1f} span {math.degrees(float(unw.max()-unw.min())):.1f}")
print(f"frac |dvarpi|>90 {float(np.mean(np.abs(dvarpi)>math.radians(90))):.4f}")
steps = np.diff(unw)
print(f"median step deg {math.degrees(float(np.median(steps))):.4f} max {math.degrees(float(np.max(np.abs(steps)))):.2f}")
