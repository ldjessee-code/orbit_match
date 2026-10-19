"""v2.41b numbers: trench, transfers, Der railgun, catcher, radiation belts.

Imports the tide study's constants. Does not modify that package.
Cargo after it leaves a moon is a test particle on GM_planet. A moon's own
speed uses GM of planet plus moon. That is the patched conic.
"""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path

_CONST_PATH = Path(__file__).resolve().parents[1] / "tides_lagrange" / "constants.py"
_spec = importlib.util.spec_from_file_location("tides_lagrange_constants", _CONST_PATH)
tc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(tc)

G = tc.G
M_P = tc.M_P
R_P = tc.R_P
DAY_S = tc.DAY_S
M_DER = tc.M_DER
A_DER = tc.A_DER
E_DER = tc.E_DER
R_DER = tc.R_DER
M_SHUDDER = tc.M_SHUDDER
A_SHUDDER = tc.A_SHUDDER
E_SHUDDER = tc.E_SHUDDER
MU_P = tc.MU_P
M_EARTH = tc.M_EARTH

MU_DER = G * M_DER
MU_DER_ORBIT = G * (M_P + M_DER)
MU_SH_ORBIT = G * (M_P + M_SHUDDER)
C_LIGHT = 299_792_458.0
G0 = 9.80665
AU_M = tc.AU_M
M_SUN = tc.M_SUN
YEAR_S = 365.25 * 86400.0
MYR_S = 1.0e6 * YEAR_S

# Earth anchors for the dipole scaling. Equatorial field 31 uT at 6,371 km.
R_EARTH = 6_371_000.0
B0_EARTH = 31.0e-6
P_SW_EARTH = 2.0e-9
R_MP_EARTH_RP = 10.0

JOB_DIR = Path(r"F:\Dropbox\TheCourt\research\_jobs\tauceti-moon-lore-v241b-20261009")
R_DOWN = 6_700_000.0
FUNNEL_M = 7_500.0


def circ_speed(mu: float, a: float) -> float:
    return math.sqrt(mu / a)


def vis_viva(mu: float, r: float, a: float) -> float:
    return math.sqrt(mu * (2.0 / r - 1.0 / a))


def kepler_period(a: float, mu: float) -> float:
    return 2.0 * math.pi * math.sqrt(a**3 / mu)


def sync_orbit() -> dict:
    a = (MU_P * DAY_S**2 / (4.0 * math.pi**2)) ** (1.0 / 3.0)
    return {
        "a_m": a,
        "a_km": a / 1000.0,
        "lore_km": 54_070.0,
        "delta_vs_lore_km": a / 1000.0 - 54_070.0,
        "rp": a / R_P,
        "circular_speed_m_s": circ_speed(MU_P, a),
        "period_h": 34.0,
        "light_s_from_center": a / C_LIGHT,
    }


def hohmann(r1: float, r2: float, mu: float = MU_P) -> dict:
    """Two-burn transfer between circular orbits. r1 is the outer or inner radius."""
    if r1 == r2:
        return {
            "dv1_m_s": 0.0,
            "dv2_m_s": 0.0,
            "total_m_s": 0.0,
            "tof_s": 0.0,
            "tof_days": 0.0,
            "v1_m_s": circ_speed(mu, r1),
            "v2_m_s": circ_speed(mu, r2),
            "at_m": r1,
        }
    at = 0.5 * (r1 + r2)
    v1 = circ_speed(mu, r1)
    v2 = circ_speed(mu, r2)
    v_leave = math.sqrt(mu * (2.0 / r1 - 1.0 / at))
    v_arrive = math.sqrt(mu * (2.0 / r2 - 1.0 / at))
    dv1 = abs(v1 - v_leave)
    dv2 = abs(v_arrive - v2)
    tof = kepler_period(at, mu) / 2.0
    return {
        "dv1_m_s": dv1,
        "dv2_m_s": dv2,
        "total_m_s": dv1 + dv2,
        "tof_s": tof,
        "tof_days": tof / 86400.0,
        "v1_m_s": v1,
        "v2_m_s": v2,
        "v_leave_m_s": v_leave,
        "v_arrive_m_s": v_arrive,
        "at_m": at,
        "r1_m": r1,
        "r2_m": r2,
    }


def patched_drop(r_moon: float, v_moon: float, r_target: float) -> dict:
    """Retrograde drop from a moon's instantaneous r and speed onto a transfer
    whose apoapsis is r_moon and whose periapsis is r_target. Planet mu only
    on the transfer. Returns the moon-relative excess and the arrival burn.
    """
    at = 0.5 * (r_moon + r_target)
    v_leave = math.sqrt(MU_P * (2.0 / r_moon - 1.0 / at))
    v_arrive = math.sqrt(MU_P * (2.0 / r_target - 1.0 / at))
    v_circ_t = circ_speed(MU_P, r_target)
    dv1 = v_moon - v_leave
    dv2 = v_arrive - v_circ_t
    tof = kepler_period(at, MU_P) / 2.0
    return {
        "r_moon_km": r_moon / 1000.0,
        "v_moon_m_s": v_moon,
        "vinf_m_s": dv1,
        "arrival_m_s": dv2,
        "total_m_s": dv1 + dv2,
        "tof_days": tof / 86400.0,
        "v_leave_m_s": v_leave,
        "v_arrive_m_s": v_arrive,
    }


def moon_speed(a: float, e: float, mu_orbit: float, at_peri: bool) -> tuple[float, float]:
    r = a * (1.0 - e) if at_peri else a * (1.0 + e)
    # Speed at peri or apo: sqrt( mu (2/r - 1/a) ).
    return r, vis_viva(mu_orbit, r, a)


def hyperbola(vinf: float) -> dict:
    """Horizontal equatorial launch from Der. Escape asymptote angle from the
    launch radial is nu_inf = acos(-1/e). Site angle from the sub-Kakakiko
    point, toward the leading apex, equals nu_inf - 90 deg when the rail fires
    backward and the excess velocity is pure retrograde.
    """
    e = 1.0 + R_DER * vinf * vinf / MU_DER
    nu = math.acos(max(-1.0, min(1.0, -1.0 / e)))
    swing = math.degrees(nu) - 90.0
    v_surf = math.sqrt(tc.G * M_DER * 2.0 / R_DER + vinf * vinf)
    v_esc = math.sqrt(2.0 * MU_DER / R_DER)
    return {
        "vinf_m_s": vinf,
        "e": e,
        "asymptote_deg": math.degrees(nu),
        "swing_deg": swing,
        "site_from_sub_deg": swing,
        "site_from_leading_deg": 90.0 - swing,
        "kakakiko_zenith_deg": swing,
        "v_surface_m_s": v_surf,
        "v_esc_m_s": v_esc,
        "vinf_fraction_of_ke": (vinf * vinf) / (v_surf * v_surf),
    }


def penalty_row(vinf: float, theta_deg: float) -> dict:
    th = math.radians(theta_deg)
    v_esc = math.sqrt(2.0 * MU_DER / R_DER)
    v0 = math.sqrt(v_esc * v_esc + vinf * vinf)
    vinf2 = vinf / math.cos(th)
    v1 = math.sqrt(v_esc * v_esc + vinf2 * vinf2)
    return {
        "offset_deg": theta_deg,
        "cosine_loss": 1.0 - math.cos(th),
        "extra_launch_m_s": v1 - v0,
        "extra_energy_fraction": (v1 * v1 - v0 * v0) / (v0 * v0),
        "correction_m_s": vinf * math.tan(th),
    }


def nu_to_E(nu: float, e: float) -> float:
    nu = (nu + 2.0 * math.pi) % (2.0 * math.pi)
    cos_e = (e + math.cos(nu)) / (1.0 + e * math.cos(nu))
    sin_e = math.sqrt(max(0.0, 1.0 - e * e)) * math.sin(nu) / (1.0 + e * math.cos(nu))
    e_an = math.atan2(sin_e, cos_e)
    if e_an < 0.0:
        e_an += 2.0 * math.pi
    return e_an


def tof_nu(a: float, e: float, nu0: float, nu1: float, mu: float) -> float:
    """Time of flight with true anomaly increasing from nu0 to nu1."""
    span = (nu1 - nu0) % (2.0 * math.pi)
    if span < 1e-12:
        span = 2.0 * math.pi
    e0 = nu_to_E(nu0, e)
    e1 = nu_to_E(nu0 + span, e)
    # nu_to_E folds into 0..2pi. Rebuild E1 from the span if it wrapped.
    e1_raw = nu_to_E((nu0 + span) % (2.0 * math.pi), e)
    if e1_raw + 1e-9 < e0:
        e1 = e1_raw + 2.0 * math.pi
    else:
        e1 = e1_raw
    # Mean anomaly uses the unwrapped eccentric anomaly.
    m0 = e0 - e * math.sin(e0)
    m1 = e1 - e * math.sin(e1)
    return (m1 - m0) / math.sqrt(mu / a**3)


def state_to_transfer(r: float, vr: float, vt: float, r_target: float) -> dict | None:
    """Propagate a departure state until it next crosses r_target inward."""
    mu = MU_P
    v2 = vr * vr + vt * vt
    energy = 0.5 * v2 - mu / r
    if energy >= 0.0:
        return None
    h = r * vt
    a = -mu / (2.0 * energy)
    e2 = 1.0 + 2.0 * energy * h * h / (mu * mu)
    if e2 < 0.0:
        return None
    e = math.sqrt(e2)
    if e < 1e-8:
        return None
    # True anomaly at departure.
    cos_nu = (h * h / (mu * r) - 1.0) / e
    cos_nu = max(-1.0, min(1.0, cos_nu))
    nu = math.acos(cos_nu)
    if vr < 0.0:
        nu = 2.0 * math.pi - nu
    rp = a * (1.0 - e)
    ra = a * (1.0 + e)
    if r_target < rp - 1.0 or r_target > ra + 1.0:
        return None
    cos_t = (a * (1.0 - e * e) / r_target - 1.0) / e
    cos_t = max(-1.0, min(1.0, cos_t))
    nu_abs = math.acos(cos_t)
    # Two crossings. Pick the soonest forward one.
    candidates = (nu_abs, 2.0 * math.pi - nu_abs)
    best = None
    for nu_t in candidates:
        span = (nu_t - nu) % (2.0 * math.pi)
        if span < 1e-4:
            continue
        tof = tof_nu(a, e, nu, nu + span, mu)
        if tof <= 0.0:
            continue
        if best is None or tof < best["tof_s"]:
            # Velocity at the crossing.
            # Flight-path: vr = (mu/h) e sin nu
            vr_t = (mu / h) * e * math.sin(nu_t)
            vt_t = h / r_target
            best = {
                "a_m": a,
                "e": e,
                "nu0": nu,
                "nu1": nu_t,
                "dnu_rad": span,
                "tof_s": tof,
                "vr_arrive": vr_t,
                "vt_arrive": vt_t,
                "rp_m": rp,
            }
    return best


def arrival_dv(tr: dict, r_target: float) -> float:
    v_c = circ_speed(MU_P, r_target)
    return math.sqrt(tr["vr_arrive"] ** 2 + (tr["vt_arrive"] - v_c) ** 2)


def departure_dv(vr: float, vt: float, r: float) -> float:
    v_c = circ_speed(MU_P, r)
    return math.sqrt(vr * vr + (vt - v_c) ** 2)


def scan_windows(r_from: float, r_to: float) -> dict:
    """How long a free-burn launch can be early or late and still stay near
    the Hohmann cost. The rail itself is tangential; the free-burn scan is
    the tug/ship case.
    """
    nominal = hohmann(r_from, r_to)
    v_c = circ_speed(MU_P, r_from)
    # Grid: transverse speed and a small radial component.
    best_by_budget = {20.0: 0.0, 50.0: 0.0, 100.0: 0.0}
    samples = []
    v_leave = nominal["v_leave_m_s"]
    for iv in range(-16, 17):
        vt = v_leave + iv * 8.0
        for ig in range(-8, 9):
            vr = ig * 8.0
            tr = state_to_transfer(r_from, vr, vt, r_to)
            if tr is None:
                continue
            dv1 = departure_dv(vr, vt, r_from)
            dv2 = arrival_dv(tr, r_to)
            extra = dv1 + dv2 - nominal["total_m_s"]
            # Phase: transfer angle and flight time set the launch epoch
            # relative to the Hohmann (angle pi, time tof_h).
            # Required: (n_target - n_dep) * dt + omega terms are handled
            # by the caller via the synodic rate. Here dt is the epoch
            # shift that puts the target on this arrival angle.
            dnu = tr["dnu_rad"]
            # Station angular rate is the planet spin. Departure body rate
            # is not applied here; the caller converts angle error to time.
            samples.append(
                {
                    "dv1": dv1,
                    "dv2": dv2,
                    "extra": extra,
                    "dnu_deg": math.degrees(dnu),
                    "tof_days": tr["tof_s"] / 86400.0,
                    "vr": vr,
                    "vt": vt,
                }
            )
            if extra < 0.0:
                extra = 0.0
            # Epoch offset relative to a pure 180 deg Hohmann of the same
            # departure longitude: the arrival longitude differs by dnu - pi,
            # and the flight time differs. Converted to a launch-time window
            # by the synodic rate outside this function.
            for budget, span in best_by_budget.items():
                if extra <= budget:
                    # placeholder, filled below
                    best_by_budget[budget] = budget
    # Launch-time offset for each sample, using planet spin vs Der mean motion.
    sync = sync_orbit()
    omega = 2.0 * math.pi / DAY_S
    n_der = 2.0 * math.pi / kepler_period(A_DER, MU_DER_ORBIT)
    # At the nominal Hohmann, dnu = pi and tof = tof_h.
    # A sample with dnu and tof meets the target if launched at dt where
    # the extra station motion matches the extra transfer angle:
    # (omega - n_der) * dt = (dnu - pi) - omega * (tof - tof_h)
    # rearranged from:
    # theta_site + omega*(t+tof) = theta_der + n*t + dnu
    # nominal: theta_site + omega*(t0+tof_h) = theta_der + n*t0 + pi
    tof_h = nominal["tof_s"]
    windows = {20.0: 0.0, 50.0: 0.0, 100.0: 0.0}
    dts = {20.0: [], 50.0: [], 100.0: []}
    for s in samples:
        dnu = math.radians(s["dnu_deg"])
        tof = s["tof_days"] * 86400.0
        numer = (dnu - math.pi) - omega * (tof - tof_h)
        dt = numer / (omega - n_der)
        s["dt_s"] = dt
        for budget in dts:
            if s["extra"] <= budget:
                dts[budget].append(dt)
    out_windows = {}
    cheap = []
    for s in samples:
        if s["extra"] <= 100.0:
            cheap.append(
                {
                    "extra_m_s": s["extra"],
                    "dt_s": s["dt_s"],
                    "dnu_deg": s["dnu_deg"],
                    "tof_days": s["tof_days"],
                    "dv1": s["dv1"],
                    "dv2": s["dv2"],
                }
            )
    for budget, values in dts.items():
        if not values:
            out_windows[str(int(budget))] = {"half_width_s": 0.0, "full_width_s": 0.0, "n_samples": 0}
            continue
        out_windows[str(int(budget))] = {
            "min_dt_s": min(values),
            "max_dt_s": max(values),
            "full_width_s": max(values) - min(values),
            "n_samples": len(values),
        }
    # Rail-only: vr = 0, vt varied. Radial miss is the periapsis error.
    rail = []
    for iv in range(-30, 31):
        vt = v_leave + iv * 2.0
        tr = state_to_transfer(r_from, 0.0, vt, r_to)
        if tr is None:
            # Still record periapsis if the ellipse never reaches r_to.
            v2 = vt * vt
            energy = 0.5 * v2 - MU_P / r_from
            if energy >= 0.0:
                continue
            h = r_from * vt
            a = -MU_P / (2.0 * energy)
            e = math.sqrt(max(0.0, 1.0 + 2.0 * energy * h * h / (MU_P * MU_P)))
            rp = a * (1.0 - e)
            rail.append(
                {
                    "vt": vt,
                    "dv_from_nominal_m_s": vt - v_leave,
                    "reaches_sync": False,
                    "rp_km": rp / 1000.0,
                }
            )
            continue
        rail.append(
            {
                "vt": vt,
                "dv_from_nominal_m_s": vt - v_leave,
                "reaches_sync": True,
                "rp_km": tr["rp_m"] / 1000.0,
                "dnu_deg": math.degrees(tr["dnu_rad"]),
                "tof_days": tr["tof_s"] / 86400.0,
                "arrival_m_s": arrival_dv(tr, r_to),
                "dv1_m_s": departure_dv(0.0, vt, r_from),
            }
        )
    return {
        "nominal_total_m_s": nominal["total_m_s"],
        "free_burn_windows": out_windows,
        "cheap_samples": cheap,
        "rail_tangential_samples": rail,
        "v_circular_m_s": v_c,
        "note": (
            "Free-burn windows are launch-epoch spans where a coplanar burn "
            "still hits the sync radius within the extra delta-v budget. "
            "The rail is tangential only; its speed sets periapsis."
        ),
    }


def synodic_windows(sync_a: float) -> dict:
    omega = 2.0 * math.pi / DAY_S
    n_der = 2.0 * math.pi / kepler_period(A_DER, MU_DER_ORBIT)
    n_sh = 2.0 * math.pi / kepler_period(A_SHUDDER, MU_SH_ORBIT)
    rel = abs(omega - n_der)
    p_syn = 2.0 * math.pi / rel
    # Hohmann TOF sets the inertial phase at launch.
    h = hohmann(A_DER, sync_a)
    # psi = theta_der - theta_site = omega*TOF - pi
    psi = omega * h["tof_s"] - math.pi
    psi_deg = math.degrees((psi + math.pi) % (2.0 * math.pi) - math.pi)
    # Station ahead of Der by -psi.
    ahead = -psi
    ahead_deg = math.degrees((ahead + math.pi) % (2.0 * math.pi) - math.pi)

    def lead_hours(deg: float) -> float:
        # Yard is prograde of the cylinders, so its window is earlier.
        return math.radians(deg) / rel / 3600.0

    along_track_m_s = sync_a * rel
    return {
        "omega_rad_s": omega,
        "n_der_rad_s": n_der,
        "n_shudder_rad_s": n_sh,
        "synodic_der_s": p_syn,
        "synodic_der_h": p_syn / 3600.0,
        "synodic_shudder_h": (2.0 * math.pi / abs(omega - n_sh)) / 3600.0,
        "phase_psi_deg": psi_deg,
        "station_ahead_of_der_deg": ahead_deg,
        "yard_leads_cylinders_h": {
            "100": lead_hours(100.0),
            "110": lead_hours(110.0),
            "120": lead_hours(120.0),
        },
        "along_track_m_s": along_track_m_s,
        "passive_window_s": {
            "10_km": 10_000.0 / along_track_m_s,
            "30_km": 30_000.0 / along_track_m_s,
            "100_km": 100_000.0 / along_track_m_s,
        },
        "chord_110_km": 2.0 * sync_a * math.sin(math.radians(55.0)) / 1000.0,
        "chord_110_light_s": 2.0 * sync_a * math.sin(math.radians(55.0)) / C_LIGHT,
        "planet_half_angle_deg": math.degrees(math.asin(R_P / sync_a)),
        "los_limit_deg": 2.0 * math.degrees(math.acos(R_P / sync_a)),
    }


def flip_burn(distance_m: float) -> dict:
    out = {"distance_km": distance_m / 1000.0}
    for g in (0.005, 0.01):
        a = g * G0
        t = 2.0 * math.sqrt(distance_m / a)
        dv = a * t
        mr = math.exp(dv / (98.1e3))
        out[f"g_{g}"] = {
            "hours": t / 3600.0,
            "dv_m_s": dv,
            "mass_ratio": mr,
            "propellant_fraction": 1.0 - 1.0 / mr,
        }
    return out


def transfers() -> dict:
    sync = sync_orbit()
    a_s = sync["a_m"]
    plain = hohmann(A_DER, a_s)
    # Patched at mean, peri, apo. Moon speed from the two-body orbit.
    r_mean = A_DER
    v_mean = circ_speed(MU_DER_ORBIT, A_DER)
    r_peri, v_peri = moon_speed(A_DER, E_DER, MU_DER_ORBIT, True)
    r_apo, v_apo = moon_speed(A_DER, E_DER, MU_DER_ORBIT, False)
    der_cases = {
        "circular_planet_mu": plain,
        "patched_mean": patched_drop(r_mean, v_mean, a_s),
        "patched_peri": patched_drop(r_peri, v_peri, a_s),
        "patched_apo": patched_drop(r_apo, v_apo, a_s),
    }
    # Shudder. Mean circular on planet mu, plus patched peri and apo.
    r_sp, v_sp = moon_speed(A_SHUDDER, E_SHUDDER, MU_SH_ORBIT, True)
    r_sa, v_sa = moon_speed(A_SHUDDER, E_SHUDDER, MU_SH_ORBIT, False)
    sh = {
        "circular_at_a": hohmann(A_SHUDDER, a_s),
        "patched_peri": patched_drop(r_sp, v_sp, a_s),
        "patched_apo": patched_drop(r_sa, v_sa, a_s),
    }
    # Down shot, published target 6,700 km, planet-mu circular at Der's a,
    # plus patched peri and apo.
    down_plain = {}
    # Recompute with the doc's vis-viva form for the check.
    v_der_circ = circ_speed(MU_P, A_DER)
    at = 0.5 * (A_DER + R_DOWN)
    v_a = math.sqrt(MU_P * (2.0 / A_DER - 1.0 / at))
    down_plain = {
        "v_circular_m_s": v_der_circ,
        "v_apo_transfer_m_s": v_a,
        "vinf_m_s": v_der_circ - v_a,
        "tof_days": kepler_period(at, MU_P) / 2.0 / 86400.0,
    }
    down = {
        "planet_mu_circular": down_plain,
        "patched_mean": patched_drop(r_mean, v_mean, R_DOWN),
        "patched_peri": patched_drop(r_peri, v_peri, R_DOWN),
        "patched_apo": patched_drop(r_apo, v_apo, R_DOWN),
    }
    # Surface to sync and 300 km to sync.
    r_300 = R_P + 300_000.0
    surface_gap = a_s - R_P
    low_gap = a_s - r_300
    return {
        "sync": sync,
        "der_to_sync": der_cases,
        "shudder_to_sync": sh,
        "down_shot": down,
        "from_300km_hohmann": hohmann(r_300, a_s),
        "crew_from_surface": flip_burn(surface_gap),
        "crew_from_300km": flip_burn(low_gap),
        "synodic": synodic_windows(a_s),
        "one_point_two_nine_km_s": plain["total_m_s"] / 1000.0,
    }


def railgun() -> dict:
    sync = sync_orbit()
    plain = hohmann(A_DER, sync["a_m"])
    vinf = plain["dv1_m_s"]
    hyp = hyperbola(vinf)
    # Sensitivity: 10 m/s on vinf.
    hyp_hi = hyperbola(vinf + 10.0)
    hyp_lo = hyperbola(vinf - 10.0)
    down_vinf = transfers()["down_shot"]["planet_mu_circular"]["vinf_m_s"]
    down_h = hyperbola(down_vinf)
    # Historical L4 phasing, the check case.
    old_l4 = hyperbola(88.0)
    old_down = hyperbola(1013.0)
    rows = [penalty_row(vinf, th) for th in (5.0, 10.0, 20.0, 30.0)]
    down_rows = [penalty_row(down_vinf, th) for th in (5.0, 10.0, 20.0, 30.0)]
    # Abandoned one-orbit L4 numbers, kept so the self-test can see them.
    return {
        "sync_shot": hyp,
        "swing_change_per_10_m_s": abs(hyp_hi["swing_deg"] - hyp_lo["swing_deg"]) / 2.0,
        "down_shot": down_h,
        "historical_l4_88": old_l4,
        "historical_down_1013": old_down,
        "penalty_sync": rows,
        "penalty_down": down_rows,
        "can_rail_hit_sync": True,
        "reason": (
            "A backward equatorial shot with v-infinity equal to the Hohmann "
            "departure burn leaves on the transfer. Der has no air, so the "
            "surface speed is the hyperbola speed."
        ),
    }


def catcher() -> dict:
    plain = hohmann(A_DER, sync_orbit()["a_m"])
    v = plain["dv2_m_s"]
    lengths = {}
    for name, length in (("existing_7_5_km", FUNNEL_M), ("10_km", 10_000.0), ("30_km", 30_000.0)):
        acc = v * v / (2.0 * length)
        lengths[name] = {
            "length_m": length,
            "accel_m_s2": acc,
            "g": acc / G0,
            "time_s": v / acc,
        }
    for g_target, label in ((1.0, "at_1_g"), (3.0, "at_3_g"), (5.0, "at_5_g")):
        acc = g_target * G0
        length = v * v / (2.0 * acc)
        lengths[label] = {
            "length_m": length,
            "accel_m_s2": acc,
            "g": g_target,
            "time_s": v / acc,
        }
    # 1,000 t slug.
    mass = 1.0e6
    ke = 0.5 * mass * v * v
    t_brake = lengths["existing_7_5_km"]["time_s"]
    # Tug at crew accelerations. Distance = v^2 / 2a if it starts at v and stops.
    tugs = {}
    for g in (0.005, 0.01):
        acc = g * G0
        tugs[f"g_{g}"] = {
            "time_s": v / acc,
            "distance_km": (v * v / (2.0 * acc)) / 1000.0,
            "propellant_mass_ratio": math.exp(v / 98.1e3),
        }
    chemical_mr = math.exp(v / 2750.0)  # Isp ~280 s, ve ~2.75 km/s
    return {
        "arrival_m_s": v,
        "total_hohmann_m_s": plain["total_m_s"],
        "lengths": lengths,
        "slug_1000t": {
            "ke_j": ke,
            "ke_gj": ke / 1.0e9,
            "peak_gw_at_7_5_km": (ke / t_brake) / 1.0e9,
            "mwh": ke / 3.6e9,
        },
        "tug": tugs,
        "chemical_kick_mass_ratio": chemical_mr,
        "chemical_propellant_fraction": 1.0 - 1.0 / chemical_mr,
        "fusion_mass_ratio_98kms": math.exp(v / 98.1e3),
        "aerobrake": "impossible at synchronous altitude; no air",
        "recommendation": "resized_regenerative_funnel",
    }


def belts() -> dict:
    """Dipole scaled from Earth. Moment fraction is the doc's 5-10% (est.).
    Wind pressure is solar 2 nPa times 1/0.71^2 times a Tau Ceti mass-loss
    factor 0.2 to 1.0 (est.).
    """
    # Calibrate K so Earth is 10 Rp at 31 uT and 2 nPa.
    # R/Rp = K * (B0^2 / P)^(1/6)
    base = (B0_EARTH**2 / P_SW_EARTH) ** (1.0 / 6.0)
    k_cf = R_MP_EARTH_RP / base
    moment_earth = B0_EARTH * R_EARTH**3 / 1.0e-7  # mu0/4pi = 1e-7
    r_factor = (R_EARTH / R_P) ** 3
    wind_geom = 1.0 / (0.71**2)
    rows = []
    for frac in (0.05, 0.10):
        b0 = B0_EARTH * frac * r_factor
        moment = frac * moment_earth
        for mdot in (0.2, 1.0):
            p_sw = P_SW_EARTH * wind_geom * mdot
            ratio = (b0**2 / p_sw) ** (1.0 / 6.0)
            r_mp = k_cf * ratio
            rows.append(
                {
                    "moment_fraction": frac,
                    "b0_uT": b0 * 1.0e6,
                    "moment_A_m2": moment,
                    "mdot_over_solar": mdot,
                    "p_sw_nPa": p_sw * 1.0e9,
                    "standoff_rp": r_mp,
                    "standoff_km": r_mp * R_P / 1000.0,
                }
            )
    sync = sync_orbit()
    standoffs = [row["standoff_rp"] for row in rows]
    r_mp_min = min(standoffs)
    r_mp_max = max(standoffs)
    # Inner belt is the Earth L-shell analog, cut off at the magnetopause.
    # Outer belt lives only inside the dayside standoff.
    def belt_span(l_inner, l_outer, l_cut):
        lo = l_inner
        hi = min(l_outer, l_cut)
        if hi <= lo:
            return None
        return {
            "l_min": lo,
            "l_max": hi,
            "km_min": lo * R_P / 1000.0,
            "km_max": hi * R_P / 1000.0,
        }

    cases = []
    for row in rows:
        cut = row["standoff_rp"]
        cases.append(
            {
                **row,
                "inner_belt": belt_span(1.2, 2.5, cut),
                "outer_belt": belt_span(3.0, 7.0, cut),
                "sync_vs_dayside": "outside" if sync["rp"] > cut else "inside",
            }
        )
    # Terminator flare ~1.4 times subsolar, a usual quiet-magnetosphere factor (est.).
    flare = 1.4
    return {
        "assumption": (
            "Dipole moment 5-10% of Earth's, est., from the v2.41 draft. "
            "Earth B0 = 31 uT, R = 6371 km, standoff 10 Rp at 2 nPa. "
            "Tau Ceti wind est.: solar dynamic pressure times 1/0.71^2 "
            "times a mass-loss factor 0.2 to 1.0."
        ),
        "moment_earth_A_m2": moment_earth,
        "chapman_ferraro_k": k_cf,
        "sync_rp": sync["rp"],
        "sync_km": sync["a_km"],
        "dayside_standoff_rp": [r_mp_min, r_mp_max],
        "sync_dayside": "outside" if sync["rp"] > r_mp_max else "borderline_or_inside",
        "terminator_rp_est": [flare * r_mp_min, flare * r_mp_max],
        "sync_vs_terminator": (
            "outside"
            if sync["rp"] > flare * r_mp_max
            else "may_graze_high_moment_low_wind"
        ),
        "cases": cases,
        "safe_band_km": {
            "above_dayside_magnetopause_and_inside_dynamical_quiet": [
                r_mp_max * R_P / 1000.0,
                56_000.0,
            ],
            "note": (
                "56,000 km is the upper end of the quiet band in the "
                "2026-10-09 tides-lagrange integration. This run did not "
                "repeat that integration."
            ),
        },
    }


def trench() -> dict:
    """Capture heat versus the time needed to start a trench."""
    e_cap = G * M_P * M_DER / (2.0 * A_DER)
    area = 4.0 * math.pi * R_P**2
    # Doc range 30-50 TW. Use 40 TW as the midpoint, and the ends.
    flows = {}
    for tw in (30.0, 40.0, 50.0):
        watts = tw * 1.0e12
        flows[str(int(tw))] = {
            "watts": watts,
            "flux_w_m2": watts / area,
            "years_of_normal_heat_in_capture": e_cap / watts / YEAR_S,
            "multiplier_if_dumped_in_1_myr": (e_cap / MYR_S) / watts,
            "multiplier_if_dumped_in_10_myr": (e_cap / (10.0 * MYR_S)) / watts,
        }
    # Present-day body tide is not what cracks a plate.
    # Strain ~ ocean bulge / R. Use the conjunction rigid bulge 3.78 m.
    bulge = 3.78
    strain = bulge / R_P
    mu = 3.0e10  # Pa, the quake note's shear modulus
    stress_pa = mu * strain
    # One great quake: 20 m of slip does not dig an 8 km trench.
    slip_m = 20.0
    trench_depth_m = 8_000.0
    slip_equivalent = trench_depth_m / slip_m
    # Convergence after the 1-10 Myr settle, over the remaining ~90 Myr.
    conv = {}
    for cm_yr in (2.0, 5.0, 8.0):
        m_per_yr = cm_yr / 100.0
        conv[str(cm_yr)] = {
            "cm_per_yr": cm_yr,
            "km_in_90_myr": m_per_yr * 90.0e6 / 1000.0,
            "km_in_50_myr": m_per_yr * 50.0e6 / 1000.0,
        }
    return {
        "capture_energy_j": e_cap,
        "heat_flows": flows,
        "present_bulge_m": bulge,
        "present_tidal_strain": strain,
        "present_tidal_stress_kpa": stress_pa / 1000.0,
        "one_quake_slip_m": slip_m,
        "slips_to_match_8_km": slip_equivalent,
        "convergence": conv,
        "analogs": {
            "mariana": {"depth_km": 10.9, "length_km": 2550, "status": "mature"},
            "tonga": {"depth_km": 10.8, "length_km": 2500, "status": "mature"},
            "puysegur": {
                "depth_km": 6.0,
                "length_km": 400,
                "status": "incipient, beside the Macquarie Ridge",
            },
            "izu_bonin": {
                "started_ma": 52,
                "note": "initiation along a weak zone, arc lavas within a few Myr, not one quake",
            },
        },
        "recommended_trench_depth_km": [8.0, 11.0],
        "recommended_trench_length_km": [800.0, 2000.0],
        "plausible": True,
        "single_quake_opens_trench": False,
        "wording": (
            "An ancient volcanic chain built the ridge. During Der Eindringling's "
            "capture era, extra heat and tidal stress weakened that line. A great "
            "quake marked the first rupture. It did not dig the trench. Over the "
            "following tens of millions of years the broken plate began to sink, "
            "and the trench beside the ridge is the result."
        ),
    }


def selftest_numbers() -> list[tuple[str, bool, str]]:
    checks = []

    def add(name: str, ok: bool, detail: str):
        checks.append((name, ok, detail))

    sync = sync_orbit()
    add("sync-km", 54_070.0 < sync["a_km"] < 54_080.0, f"{sync['a_km']:.2f}")
    plain = hohmann(A_DER, sync["a_m"])
    add(
        "hohmann-1.29",
        1_250.0 < plain["total_m_s"] < 1_330.0,
        f"{plain['total_m_s']:.1f}",
    )
    add(
        "split-sums",
        abs(plain["dv1_m_s"] + plain["dv2_m_s"] - plain["total_m_s"]) < 1e-6,
        f"{plain['dv1_m_s']:.1f}+{plain['dv2_m_s']:.1f}",
    )
    old = hyperbola(88.0)
    add(
        "l4-swing",
        abs(old["swing_deg"] - 85.0) < 0.2 and abs(old["site_from_leading_deg"] - 5.0) < 0.2,
        f"swing={old['swing_deg']:.2f} site={old['site_from_leading_deg']:.2f}",
    )
    old_d = hyperbola(1013.0)
    add(
        "down-swing",
        abs(old_d["swing_deg"] - 41.9) < 0.3,
        f"swing={old_d['swing_deg']:.2f} e={old_d['e']:.3f}",
    )
    shot = hyperbola(plain["dv1_m_s"])
    add(
        "rail-speed",
        shot["v_esc_m_s"] < shot["v_surface_m_s"] < 2_300.0,
        f"v={shot['v_surface_m_s']:.1f} swing={shot['swing_deg']:.2f}",
    )
    # Direction check: escape direction is pure retrograde at the solved site.
    nu = math.radians(shot["asymptote_deg"])
    lam = math.radians(shot["site_from_sub_deg"])
    r_hat = (-math.cos(lam), math.sin(lam))
    t_hat = (-math.sin(lam), -math.cos(lam))
    v_dir = (
        math.cos(nu) * r_hat[0] + math.sin(nu) * t_hat[0],
        math.cos(nu) * r_hat[1] + math.sin(nu) * t_hat[1],
    )
    add(
        "retrograde-aim",
        abs(v_dir[0]) < 1e-6 and abs(v_dir[1] + 1.0) < 1e-6,
        f"v=({v_dir[0]:.4f},{v_dir[1]:.4f})",
    )
    pen = penalty_row(1013.0, 5.0)
    add(
        "penalty-5",
        abs(pen["correction_m_s"] - 88.6) < 1.5 and abs(pen["extra_launch_m_s"] - 2.0) < 1.5,
        f"corr={pen['correction_m_s']:.1f} extra={pen['extra_launch_m_s']:.2f}",
    )
    cap = catcher()
    g75 = cap["lengths"]["existing_7_5_km"]["g"]
    add("funnel-g", 3.0 < g75 < 5.5, f"{g75:.2f} G")
    belt = belts()
    add(
        "sync-outside-dayside",
        belt["sync_dayside"] == "outside" and belt["dayside_standoff_rp"][1] < sync["rp"],
        f"standoff={belt['dayside_standoff_rp'][0]:.2f}-{belt['dayside_standoff_rp'][1]:.2f} sync={sync['rp']:.2f}",
    )
    tr = trench()
    add(
        "capture-energy",
        2.6e28 < tr["capture_energy_j"] < 2.8e28,
        f"{tr['capture_energy_j']:.3e}",
    )
    syn = synodic_windows(sync["a_m"])
    add("synodic", 37.5 < syn["synodic_der_h"] < 39.0, f"{syn['synodic_der_h']:.3f} h")
    down = transfers()["down_shot"]["planet_mu_circular"]["vinf_m_s"]
    add("down-vinf", 980.0 < down < 1_050.0, f"{down:.1f}")
    # Hohmann TOF propagator matches the closed form.
    r1 = A_DER
    r2 = sync["a_m"]
    v_leave = plain["v_leave_m_s"]
    prop = state_to_transfer(r1, 0.0, v_leave, r2)
    ok_prop = (
        prop is not None
        and abs(prop["tof_s"] - plain["tof_s"]) / plain["tof_s"] < 0.01
        and abs(prop["dnu_rad"] - math.pi) < 0.02
    )
    add(
        "propagator",
        ok_prop,
        "none" if prop is None else f"tof={prop['tof_s']/86400:.4f} d dnu={math.degrees(prop['dnu_rad']):.2f}",
    )
    windows = scan_windows(r1, r2)
    w50 = windows["free_burn_windows"]["50"]
    add(
        "window-50",
        w50["n_samples"] > 5 and w50["full_width_s"] > 60.0,
        f"width={w50['full_width_s']:.0f} s n={w50['n_samples']}",
    )
    return checks
