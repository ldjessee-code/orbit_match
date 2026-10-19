"""Physical constants for the Kakakiko tide and parking-orbit study.

Masses and orbits are the 2026-10-09 moon decision plus the live
Tau_Cet_system_v2.md figures. Der's kilogram mass in the lore brief
(3.122e22) is M_p/200 rounded; this file uses the doc planet mass and
the exact 1/200 ratio.
"""

from __future__ import annotations

import math

G = 6.67430e-11
M_SUN = 1.98847e30
AU_M = 1.496e11
M_EARTH = 5.972e24

M_STAR = 0.78 * M_SUN
M_P = 6.243e24
R_P = 6.628e6
DAY_S = 34.0 * 3600.0
E_PLANET = 0.0396
A_PLANET = 0.71 * AU_M

M_SHUDDER = 1.491e22
A_SHUDDER = 151_060e3
E_SHUDDER = 0.20
R_SHUDDER = 2_167e3 / 2.0

M_DER = M_P / 200.0
A_DER = 240_000e3
E_DER = 0.03
R_DER = 2_023e3 / 2.0

# Saturn-like Croquet Ball, from the system doc §6.6. Sable is 2 M⊕.
M_CROQUET = 95.0 * M_EARTH
A_CROQUET = 2.8 * AU_M
M_SABLE = 2.0 * M_EARTH
A_SABLE = 0.538 * AU_M

# Earth-like ocean relative to the crust: 1 + k2 - h2 ≈ 0.69.
GAMMA2 = 0.69

# Quadratic bottom drag. 0.0025 is a usual sandy-shelf value.
CD_BED = 0.0025

# Comparison anchors named in the brief. Not remeasured here.
FUNDY_RANGE_M = 16.0
UNGAVA_RANGE_M = 16.0
QIANTANG_BORE_M = 9.0
SEVERN_BORE_TYPICAL_M = 2.0

# Same draw as tasks/rebound_tau_ceti/tau_ceti_model.py.
PLANET_ORDER = (
    "gane",
    "hornstooth",
    "husk",
    "sable",
    "kakakiko",
    "croquet",
    "cue",
    "eight",
)
ANOMALY_SEED = 20260930

JOB_DIR = r"F:\Dropbox\TheCourt\research\_jobs\tauceti-tides-lagrange-20261009"
MODEL_DIR = r"C:\Users\DougJ\Documents\GitHub\orbit_match\tasks\rebound_tau_ceti"

G_SURF = G * M_P / R_P**2
MU_P = G * M_P


def bulge(mass_kg: float, distance_m: float, primary_kg: float = M_P) -> float:
    """Sub-point equilibrium height, metres. h = (m/M) R^4 / r^3."""
    return (mass_kg / primary_kg) * (R_P**4) / (distance_m**3)


def kepler_period(a_m: float, mu: float) -> float:
    return 2.0 * math.pi * math.sqrt(a_m**3 / mu)


def true_anomaly(mean_anom: float, ecc: float) -> tuple[float, float]:
    """Return (true anomaly, eccentric anomaly) in radians."""
    ecc = min(max(ecc, 0.0), 0.999)
    mean_anom = (mean_anom + math.pi) % (2.0 * math.pi) - math.pi
    E = mean_anom if ecc < 0.8 else math.copysign(math.pi, mean_anom)
    if abs(ecc) < 1e-14:
        return mean_anom, mean_anom
    for _ in range(20):
        f = E - ecc * math.sin(E) - mean_anom
        fp = 1.0 - ecc * math.cos(E)
        E -= f / fp
    half = 0.5 * E
    nu = 2.0 * math.atan2(
        math.sqrt(1.0 + ecc) * math.sin(half),
        math.sqrt(1.0 - ecc) * math.cos(half),
    )
    return nu, E


def radius_at(a_m: float, ecc: float, E: float) -> float:
    return a_m * (1.0 - ecc * math.cos(E))
