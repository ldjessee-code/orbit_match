"""v2.41c capture, lock, eccentricity, day-length, and catcher numbers.

Imports tides_lagrange.constants and does not modify that package.
Constant-Q formulas match the v2.41b calculation notes (Gladman despin,
the 21/2 eccentricity tide, k2/Q = 0.0257 on the planet). High-e
circularization uses Hut's eccentricity functions, normalized so the
small-e rate matches that 21/2 law. Tag those high-e tracks est.
"""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path

_CONST_PATH = Path(__file__).resolve().parents[1] / "tides_lagrange" / "constants.py"
_spec = importlib.util.spec_from_file_location("tides_lagrange_constants_v241c", _CONST_PATH)
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
R_SHUDDER = tc.R_SHUDDER
M_SUN = tc.M_SUN
M_STAR = tc.M_STAR
AU_M = tc.AU_M
A_PLANET = tc.A_PLANET

YEAR_S = 365.25 * 86400.0
MYR_S = 1.0e6 * YEAR_S
G0 = 9.80665
K2_Q_PLANET = 0.0257
# Shudder's published torque at e = 0.20 is 1.30 times the circular torque.
# 1 + 7.5 e^2 = 1.30 at e = 0.20. Same factor the v2.41 note used.
E2_TORQUE = 7.5

JOB_DIR = Path(r"F:\Dropbox\TheCourt\research\_jobs\tauceti-moon-lore-v241c-20261009")

# Cold / warm interiors used in the v2.41 despin note.
K2_COLD = 0.045
Q_COLD = 100.0
K2_WARM = 0.1
Q_WARM_HI = 30.0
Q_WARM_LO = 10.0
ALPHA_SPIN = 0.35
# Primordial spin the Gladman clock starts from. v2.41: 10 h.
SPIN0_H = 10.0
# Shudder heating cases in the v2.41 note.
K2Q_ROCK_COLD = 1.0e-4
K2Q_ROCK_WARM = 1.0e-3
K2Q_IO = 0.015


def n_mean(a_m: float, mu: float | None = None) -> float:
    mu = G * M_P if mu is None else mu
    return math.sqrt(mu / a_m**3)


def gladman_despin_s(a_m: float, mass: float, radius: float, k2: float, q: float, spin_h: float = SPIN0_H, alpha: float = ALPHA_SPIN) -> float:
    """Time to remove a spin_h rotator. Gladman et al. 1996 form used in v2.41.

    tau = omega0 * a^6 * alpha * m * Q / (3 * G * M_p^2 * k2 * R^3)
    """
    omega0 = 2.0 * math.pi / (spin_h * 3600.0)
    return omega0 * a_m**6 * alpha * mass * q / (3.0 * G * M_P**2 * k2 * radius**3)


def sync_radius_m() -> float:
    return (G * M_P * DAY_S**2 / (4.0 * math.pi**2)) ** (1.0 / 3.0)


def capture_energy_j(a_m: float = A_DER, mass: float = M_DER) -> float:
    """Orbital binding energy GM m / (2a). The v2.41 published heat floor."""
    return G * M_P * mass / (2.0 * a_m)


def torque_planet(a_m: float, mass: float, k2_over_q: float = K2_Q_PLANET, e: float = 0.0) -> float:
    """Torque on the planet from a moon. N = (3/2) (k2/Q) G m^2 R^5 / a^6, times 1+7.5 e^2."""
    circ = 1.5 * k2_over_q * G * mass**2 * R_P**5 / a_m**6
    return circ * (1.0 + E2_TORQUE * e * e)


def satellite_dedt_over_e(a_m: float, mass: float, radius: float, k2_over_q: float) -> float:
    """(1/e) de/dt for tides raised on a synchronous satellite. Negative.

    (1/e) de/dt = -(21/2) n (k2/Q) (M_p/m) (R/a)^5
    """
    n = n_mean(a_m)
    return -10.5 * n * k2_over_q * (M_P / mass) * (radius / a_m) ** 5


def planet_dedt_over_e(a_m: float, mass: float, k2_over_q: float = K2_Q_PLANET) -> float:
    """(1/e) de/dt from tides raised on a fast-spinning planet. Positive: pumping.

    (1/e) de/dt = +(57/8) n (k2/Q) (m/M) (R_p/a)^5
    est. coefficient; the sign is the fast-rotator case.
    """
    n = n_mean(a_m)
    return 7.125 * n * k2_over_q * (mass / M_P) * (R_P / a_m) ** 5


def hut_functions(e: float) -> tuple[float, float, float, float, float]:
    """Hut 1981 eccentricity functions. f1(0) = f2(0) = ... = 1."""
    e2 = e * e
    e4 = e2 * e2
    e6 = e4 * e2
    e8 = e4 * e4
    den = max(1.0 - e2, 1.0e-8)
    f1 = (1.0 + 15.5 * e2 + 31.875 * e4 + 11.5625 * e6 + 0.390625 * e8) / den**7.5
    f2 = (1.0 + 7.5 * e2 + 5.625 * e4 + 0.3125 * e6) / den**6.0
    f3 = (1.0 + 3.75 * e2 + 1.875 * e4 + 0.078125 * e6) / den**6.5
    f4 = (1.0 + 1.5 * e2 + 0.125 * e4) / den**5.0
    f5 = (1.0 + 3.0 * e2 + 0.375 * e4) / den**4.5
    return f1, f2, f3, f4, f5


def _sat_rate_factor(e: float) -> float:
    """How many times faster than the small-e law, at the same a.

    At equilibrium spin the Hut de/dt scales as f1-like. Normalized to 1 at e=0.
    Uses f1, which is the dominant high-e factor for a body near pseudo-sync.
    est.
    """
    f1, _, _, _, _ = hut_functions(e)
    return f1


def angular_momentum_factor(a_m: float, e: float) -> float:
    return math.sqrt(a_m * (1.0 - e * e))


def circularize_track(k2: float, q: float, e_start: float, a_start: float | None, t_cap_myr: float = 5.0) -> dict:
    """Integrate satellite-tide de/dt and da/dt at constant orbital angular momentum.

    a (1-e^2) is held at the value that ends on today's Der orbit when e = 0.03,
    unless a_start is set. The rate is the small-e 21/2 law times Hut's f1(e).
    Planet-tide pumping at the instantaneous a is applied as well (est.).
    """
    k2q = k2 / q
    target_l = angular_momentum_factor(A_DER, E_DER)
    if a_start is None:
        # Same angular momentum as today's Der, so the end state can be e=0.03 at 240,000 km.
        a = target_l**2 / (1.0 - e_start * e_start)
    else:
        a = a_start
    e = e_start
    dt = 1000.0 * YEAR_S
    t = 0.0
    t_end = t_cap_myr * MYR_S
    hit = None
    samples = []
    n_step = 0
    while t < t_end and e > 0.025 and a > R_P * 3.0:
        factor = _sat_rate_factor(e)
        dedt = e * satellite_dedt_over_e(a, M_DER, R_DER, k2q) * factor
        dedt += e * planet_dedt_over_e(a, M_DER)
        # Hold angular momentum of the satellite-tide part: da/a = 2 e de / (1-e^2), de<0 so a falls.
        if e < 0.999:
            dadt = a * (2.0 * e / (1.0 - e * e)) * dedt
        else:
            dadt = 0.0
        # Clamp the step so e and a move by at most a few percent.
        scale = max(abs(dedt) / max(e, 1e-4), abs(dadt) / a, 1e-30)
        step = min(dt, 0.02 / scale, t_end - t)
        e_new = e + dedt * step
        a_new = a + dadt * step
        if e_new < 0.02:
            # Interpolate to e = 0.03.
            if dedt != 0.0 and e > 0.03:
                frac = (0.03 - e) / dedt
                hit = t + max(0.0, frac)
            e_new = 0.02
        e = max(0.02, e_new)
        a = max(R_P * 3.0, a_new)
        t += step
        n_step += 1
        if n_step % 400 == 0:
            samples.append({"t_myr": t / MYR_S, "e": e, "a_km": a / 1000.0})
        if hit is not None:
            break
        if n_step > 2_000_000:
            break
    return {
        "k2": k2,
        "Q": q,
        "k2_over_Q": k2q,
        "e_start": e_start,
        "a_start_km": (target_l**2 / (1.0 - e_start * e_start) if a_start is None else a_start) / 1000.0,
        "t_to_e_0_03_myr": None if hit is None else hit / MYR_S,
        "reached": hit is not None,
        "t_end_myr": t / MYR_S,
        "e_end": e,
        "a_end_km": a / 1000.0,
        "samples": samples[:12],
        "note": "est. Satellite 21/2 law times Hut f1, plus fast-rotator planet pumping. Angular momentum held.",
    }


def lock_times() -> dict:
    der_cold = gladman_despin_s(A_DER, M_DER, R_DER, K2_COLD, Q_COLD) / MYR_S
    der_warm_30 = gladman_despin_s(A_DER, M_DER, R_DER, K2_WARM, Q_WARM_HI) / MYR_S
    der_warm_10 = gladman_despin_s(A_DER, M_DER, R_DER, K2_WARM, Q_WARM_LO) / MYR_S
    # Published Shudder scale: (151060/251350)^6 times the old ~7 Myr.
    a_old = 251_350e3
    scale = (A_SHUDDER / a_old) ** 6
    shudder_scaled = 7.0 * scale
    # Direct Gladman at Shudder's mass and radius, same 10 h, Q=100, k2=0.045.
    # k2=0.045 was Der's cold rock. Shudder's old 7 Myr used Q=100 without a published k2
    # separate from that scale, so the direct number is reported beside the scale.
    shudder_direct = gladman_despin_s(A_SHUDDER, M_SHUDDER, R_SHUDDER, K2_COLD, Q_COLD) / MYR_S
    n_sh = n_mean(A_SHUDDER, G * (M_P + M_SHUDDER))
    omega0 = 2.0 * math.pi / (SPIN0_H * 3600.0)
    omega_32 = 1.5 * n_sh
    # Fraction of the 10 h angular momentum still left when the spin reaches 3:2.
    # Time to fall from omega0 to omega_32 is (omega0 - omega_32)/omega0 of the full clock,
    # because Gladman's torque is constant-Q (not proportional to the spin excess).
    frac_to_32 = (omega0 - omega_32) / omega0
    return {
        "der_cold_myr": der_cold,
        "der_warm_Q30_myr": der_warm_30,
        "der_warm_Q10_myr": der_warm_10,
        "shudder_scaled_from_7myr": shudder_scaled,
        "shudder_a_ratio_sixth": scale,
        "shudder_direct_gladman_myr": shudder_direct,
        "shudder_fraction_of_clock_to_reach_3_2": frac_to_32,
        "shudder_time_to_3_2_scaled_myr": shudder_scaled * frac_to_32,
        "omega0_over_n": omega0 / n_sh,
        "formula": "tau = omega0 a^6 alpha m Q / (3 G M_p^2 k2 R^3), alpha=0.35, omega0=2pi/(10 h)",
    }


def final_orbit_timescales() -> dict:
    rows = []
    for label, k2, q in (
        ("der_cold", K2_COLD, Q_COLD),
        ("der_warm_Q30", K2_WARM, Q_WARM_HI),
        ("der_warm_Q10", K2_WARM, Q_WARM_LO),
        ("der_io_like", 1.0, 1.0 / K2Q_IO),
    ):
        dedt = satellite_dedt_over_e(A_DER, M_DER, R_DER, k2 / q)
        pump = planet_dedt_over_e(A_DER, M_DER)
        net = dedt + pump
        rows.append(
            {
                "label": label,
                "k2_over_Q": k2 / q,
                "tau_e_satellite_myr": (1.0 / abs(dedt)) / MYR_S,
                "tau_e_planet_pump_myr": (1.0 / abs(pump)) / MYR_S,
                "tau_e_net_myr": None if net == 0.0 else (1.0 / abs(net)) / MYR_S,
                "net_damps": net < 0.0,
            }
        )
    return {"at_a_km": A_DER / 1000.0, "e_law": "small-e, no Hut factor", "rows": rows}


def heating_w(a_m: float, mass: float, radius: float, e: float, k2_over_q: float) -> float:
    """Eccentricity-tide power in the satellite. Ė = (21/2) (k2/Q) G M^2 R^5 n e^2 / a^6."""
    n = n_mean(a_m)
    return 10.5 * k2_over_q * G * M_P**2 * radius**5 * n * e * e / a_m**6


def orbit_angular_momentum(a_m: float, mass: float, e: float) -> float:
    return mass * math.sqrt(G * M_P * a_m * (1.0 - e * e))


def equilibrium_e() -> dict:
    """e of Shudder where resonant hold-back balances satellite-tide damping.

    Locked fractional drift sigma = 2 (T1+T2) / (L1+L2).
    Resonance removes T1 - L1*sigma/2 from Shudder and gives it to Der.
    Power available to maintain e is (n1 - n2) times that transferred torque
    when the transfer is outward-of-Shudder (Shudder held back). est.
    """
    n1 = n_mean(A_SHUDDER)
    n2 = n_mean(A_DER)
    # Iterate e because the torque factor and L depend on it weakly, and Ė on e^2.
    e = 0.2
    rows = []
    for k2q, label in ((K2Q_ROCK_COLD, "cold"), (K2Q_ROCK_WARM, "warm"), (K2Q_IO, "io_like")):
        e = 0.2
        for _ in range(12):
            t1 = torque_planet(A_SHUDDER, M_SHUDDER, e=e)
            t2 = torque_planet(A_DER, M_DER, e=E_DER)
            l1 = orbit_angular_momentum(A_SHUDDER, M_SHUDDER, e)
            l2 = orbit_angular_momentum(A_DER, M_DER, E_DER)
            sigma = 2.0 * (t1 + t2) / (l1 + l2)
            t_res = t1 - l1 * sigma / 2.0
            # t_res > 0: Shudder has excess planet torque, resonance removes it, e is pumped.
            power = (n1 - n2) * t_res
            coeff = heating_w(A_SHUDDER, M_SHUDDER, R_SHUDDER, 1.0, k2q)  # Ė / e^2
            if power <= 0.0 or coeff <= 0.0:
                e = 0.0
                break
            e = math.sqrt(max(0.0, power / coeff))
            if e > 0.6:
                e = 0.6
        rows.append(
            {
                "rock": label,
                "k2_over_Q": k2q,
                "e_eq": e,
                "power_W": None if e == 0.0 else heating_w(A_SHUDDER, M_SHUDDER, R_SHUDDER, e, k2q),
                "heating_at_0_20_W": heating_w(A_SHUDDER, M_SHUDDER, R_SHUDDER, 0.20, k2q),
                "tau_e_at_0_20_myr": (1.0 / abs(satellite_dedt_over_e(A_SHUDDER, M_SHUDDER, R_SHUDDER, k2q))) / MYR_S,
            }
        )
    # Damping of a free eccentricity toward e_eq over 1 Myr. de/dt = -(e - e_eq)/tau is not
    # exact (the law is de/dt ∝ -e, with a pump ∝ 1/e or constant power). For Ė_tide ∝ e^2
    # and pump power fixed, de^2/dt = -e^2/tau + P/c, so e^2(t) = e_eq^2 + (e0^2 - e_eq^2) exp(-t/tau).
    evolved = []
    for row in rows:
        tau = row["tau_e_at_0_20_myr"]
        e_eq = row["e_eq"]
        e0 = 0.20
        e2 = e_eq**2 + (e0**2 - e_eq**2) * math.exp(-1.0 / tau)
        evolved.append({"rock": row["rock"], "e_after_1_myr_from_0_20": math.sqrt(max(0.0, e2)), "tau_myr": tau, "e_eq": e_eq})
    t1 = torque_planet(A_SHUDDER, M_SHUDDER, e=0.20)
    t2 = torque_planet(A_DER, M_DER, e=E_DER)
    return {
        "rows": rows,
        "evolved_from_0_20": evolved,
        "torque_shudder_N": t1,
        "torque_der_N": t2,
        "power_orbit_shudder_TW": t1 * n1 / 1e12,
        "power_orbit_der_TW": t2 * n2 / 1e12,
        "assumption": "est. Pump power (n_Shudder - n_Der) * T_resonance, T from the v2.41 (3/2) torque with the 1.30 e^2 factor.",
    }


def day_length() -> dict:
    """Present torques and the change over 1 Myr at today's orbits."""
    n_s = n_mean(A_SHUDDER)
    n_d = n_mean(A_DER)
    n_star = n_mean(A_PLANET, G * (M_STAR + M_P))
    omega = 2.0 * math.pi / DAY_S
    c_spin = 0.345 * M_P * R_P**2
    t_s = torque_planet(A_SHUDDER, M_SHUDDER, e=0.20)
    t_d = torque_planet(A_DER, M_DER, e=0.03)
    # Stellar torque: same (3/2) law, planet is the satellite of the star.
    # N = (3/2) (k2/Q) G M_star^2 R_p^5 / a^6, with the planet's k2/Q.
    t_star = 1.5 * K2_Q_PLANET * G * M_STAR**2 * R_P**5 / A_PLANET**6
    torque = t_s + t_d + t_star
    d_omega = -torque / c_spin
    # P = 2pi/omega, dP/dt = -2pi/omega^2 * d(omega)/dt = P^2 / 2pi * torque/C
    dP = (DAY_S**2 / (2.0 * math.pi)) * (torque / c_spin)
    ms_per_century = dP * (100.0 * YEAR_S) * 1000.0
    shares = {
        "shudder": t_s / torque,
        "der": t_d / torque,
        "star": t_star / torque,
    }
    # Before Der, only Shudder and the star. Shudder's e may have been lower; report both.
    t_before = t_s + t_star
    dP_before = (DAY_S**2 / (2.0 * math.pi)) * (t_before / c_spin)
    ms_before = dP_before * (100.0 * YEAR_S) * 1000.0
    delta_p_1myr = dP * MYR_S
    delta_p_before = dP_before * MYR_S
    # Locked outward drift. sigma = 2 (T1+T2)/(L1+L2), da/dt = sigma * a.
    l1 = orbit_angular_momentum(A_SHUDDER, M_SHUDDER, 0.20)
    l2 = orbit_angular_momentum(A_DER, M_DER, 0.03)
    sigma = 2.0 * (t_s + t_d) / (l1 + l2)
    da_s = sigma * A_SHUDDER
    da_d = sigma * A_DER
    return {
        "ms_per_century": ms_per_century,
        "ms_per_century_shudder": ms_per_century * shares["shudder"],
        "ms_per_century_der": ms_per_century * shares["der"],
        "ms_per_century_star": ms_per_century * shares["star"],
        "shares": shares,
        "seconds_per_millennium": dP * (1000.0 * YEAR_S),
        "hours_gained_per_myr_at_present_rate": delta_p_1myr / 3600.0,
        "day_h_1myr_ago_if_rate_constant": 34.0 - delta_p_1myr / 3600.0,
        "ms_per_century_before_der": ms_before,
        "hours_gained_per_myr_before_der": delta_p_before / 3600.0,
        "da_dt_shudder_m_per_yr": da_s * YEAR_S,
        "da_dt_der_m_per_yr": da_d * YEAR_S,
        "heat_planet_TW": {
            "shudder": t_s * (omega - n_s) / 1e12,
            "der": t_d * (omega - n_d) / 1e12,
            "star": t_star * (omega - n_star) / 1e12,
        },
        "C_spin": c_spin,
        "omega": omega,
    }


def catcher(v_m_s: float = 771.0) -> dict:
    """Constant braking. a = v^2 / (2s). The 771 m/s figure is the v2.41b arrival."""
    rows = []
    for s_km in (7.0, 7.5, 8.0, 10.0):
        s = s_km * 1000.0
        accel = v_m_s**2 / (2.0 * s)
        rows.append(
            {
                "brake_km": s_km,
                "g": accel / G0,
                "seconds": v_m_s / accel,
                "accel_m_s2": accel,
            }
        )
    return {
        "arrival_m_s": v_m_s,
        "frame_km": 10.0,
        "brake_km_canon": [7.0, 8.0],
        "logistics_km_canon": [1.0, 2.0],
        "rows": rows,
        "g_at_7_km": rows[0]["g"],
        "g_at_8_km": rows[2]["g"],
        "seconds_at_7_km": rows[0]["seconds"],
        "seconds_at_8_km": rows[2]["seconds"],
    }


def dependents(e: float) -> dict:
    """Numbers that move when Shudder's eccentricity moves. a and Der's e stay put."""
    a_s = A_SHUDDER
    a_d = A_DER
    rp = a_s * (1.0 - e)
    ra = a_s * (1.0 + e)
    rp_d = a_d * (1.0 - E_DER)
    ra_d = a_d * (1.0 + E_DER)
    conjunction = rp_d - rp
    gap = rp_d - ra
    # Equilibrium bulges. High-to-low in the draft is about 1.5 times the bulge.
    def bulge(mass: float, dist: float) -> float:
        return (mass / M_P) * (R_P**4) / dist**3

    b_der_mean = bulge(M_DER, a_d)
    b_der_peri = bulge(M_DER, rp_d)
    b_der_apo = bulge(M_DER, ra_d)
    b_sh_mean = bulge(M_SHUDDER, a_s)
    b_sh_peri = bulge(M_SHUDDER, rp)
    b_sh_apo = bulge(M_SHUDDER, ra)
    b_star = bulge(M_STAR, A_PLANET)
    spring = b_der_peri + b_sh_peri + b_star
    # Sky angles, full diameter, degrees.
    def ang(radius: float, dist: float) -> float:
        return math.degrees(2.0 * math.atan(radius / dist))

    # Orbit-to-orbit flex scales with the bulge difference, hence with e.
    # Published at e=0.20: 1.0 m cold, 20 m warm. Scale by (e/0.20).
    flex_scale = e / 0.20
    heat_cold = heating_w(a_s, M_SHUDDER, R_SHUDDER, e, K2Q_ROCK_COLD)
    heat_warm = heating_w(a_s, M_SHUDDER, R_SHUDDER, e, K2Q_ROCK_WARM)
    heat_io = heating_w(a_s, M_SHUDDER, R_SHUDDER, e, K2Q_IO)
    # Mutual Hill at the mean of the two semi-major axes.
    rh = ((M_SHUDDER + M_DER) / (3.0 * M_P)) ** (1.0 / 3.0) * 0.5 * (a_s + a_d)
    return {
        "e": e,
        "perigee_km": rp / 1000.0,
        "apogee_km": ra / 1000.0,
        "der_perigee_km": rp_d / 1000.0,
        "der_apogee_km": ra_d / 1000.0,
        "conjunction_km": conjunction / 1000.0,
        "apogee_to_perigee_gap_km": gap / 1000.0,
        "gap_mutual_hill": gap / rh,
        "spacing_mutual_hill": (a_d - a_s) / rh,
        "mutual_hill_km": rh / 1000.0,
        "bulge_m": {
            "der_mean": b_der_mean,
            "der_peri": b_der_peri,
            "der_apo": b_der_apo,
            "shudder_mean": b_sh_mean,
            "shudder_peri": b_sh_peri,
            "shudder_apo": b_sh_apo,
            "star": b_star,
            "spring_rigid": spring,
            "spring_high_to_low": 1.5 * spring,
        },
        "sky_deg": {
            "der_mean": ang(R_DER, a_d),
            "der_peri": ang(R_DER, rp_d),
            "der_apo": ang(R_DER, ra_d),
            "shudder_mean": ang(R_SHUDDER, a_s),
            "shudder_peri": ang(R_SHUDDER, rp),
            "shudder_apo": ang(R_SHUDDER, ra),
        },
        "flex_cold_m": 1.0 * flex_scale,
        "flex_warm_m": 20.0 * flex_scale,
        "stress_cold_MPa": 0.03 * flex_scale,
        "stress_warm_MPa": 0.56 * flex_scale,
        "heat_TW": {"cold": heat_cold / 1e12, "warm": heat_warm / 1e12, "io": heat_io / 1e12},
        "static_tide_m": (M_P / M_SHUDDER) * (R_SHUDDER**4) / a_s**3,
    }


def heat_budget() -> dict:
    energy = capture_energy_j()
    flows = {}
    for tw in (30.0, 40.0, 50.0):
        watt = tw * 1e12
        flows[str(int(tw))] = {
            "ratio_if_dumped_in_1_myr": energy / (watt * MYR_S),
            "joules_in_1_myr": watt * MYR_S,
        }
    # Mantle convection at 40 TW removes the pulse in this many Myr.
    cool_myr = energy / (40e12 * MYR_S)
    # Convergence at a few cm/yr over 1 Myr.
    conv = {str(cm): cm * 1e-2 * 1.0e6 / 1000.0 for cm in (2, 5, 8, 20)}
    return {
        "capture_energy_J": energy,
        "versus_40_TW": flows,
        "years_for_40_TW_to_remove_the_pulse_myr": cool_myr,
        "planet_wide_delta_T_K": energy / (1200.0 * M_P),  # est. 1200 J/kg/K
        "convergence_km_in_1_myr": conv,
        "note": "Specific heat 1200 J/kg/K is est. Convergence is km of lithosphere, not trench depth.",
    }


def resonance_analytic() -> dict:
    """Order-of-magnitude resonant eccentricity and capture notes. est."""
    mu = M_DER / M_P
    e_scale = mu ** (1.0 / 3.0)
    # Laplace coefficient b_1/2^(2)(alpha) for a rough resonant strength.
    alpha = 2.0 ** (-2.0 / 3.0)
    # Numerical integral of the Laplace coefficient.
    steps = 2000
    acc = 0.0
    for i in range(steps):
        psi = 2.0 * math.pi * (i + 0.5) / steps
        acc += math.cos(2.0 * psi) / math.sqrt(1.0 - 2.0 * alpha * math.cos(psi) + alpha * alpha)
    b = acc / steps
    # Direct-term coefficient scale f ~ O(1). Forced-e width ~ (mu * |b|)^{1/3} is the same order.
    return {
        "mu_der": mu,
        "mu_shudder": M_SHUDDER / M_P,
        "alpha_2_1": alpha,
        "laplace_b_half_2": b,
        "e_width_scale_(mu)^(1/3)": e_scale,
        "capture": (
            "Period ratio falls through 2 while Der circularizes, because a(1-e^2) is nearly fixed "
            "and a falls as e falls. That sweep is convergent. Capture into the 2:1 is the expected "
            "channel when the sweep is slower than a libration period and Shudder's free e is below "
            "the resonance width. A free e already near 0.2 makes capture probabilistic. est."
        ),
    }


def tail_times() -> list[dict]:
    """Small-e time to fall from e1 to 0.03 at today's a. Satellite damping minus planet pumping.

    This is the slow tail. High-e tracks are faster only while e is large. est. on the 57/8 pump.
    """
    pump = planet_dedt_over_e(A_DER, M_DER)  # positive (1/e) de/dt
    rows = []
    cases = (
        ("cold_rock", K2_COLD / Q_COLD),
        ("warm_Q30_k2_0.1", K2_WARM / Q_WARM_HI),
        ("warm_Q10_k2_0.1", K2_WARM / Q_WARM_LO),
        ("io_like_0.015", K2Q_IO),
        ("magma_k2Q_1", 1.0),
        ("magma_k2Q_3", 3.0),
    )
    for name, k2q in cases:
        damp = satellite_dedt_over_e(A_DER, M_DER, R_DER, k2q)  # negative
        net = damp + pump
        for e1 in (0.10, 0.20, 0.50):
            if net >= 0.0:
                myr = None
            else:
                myr = math.log(e1 / 0.03) / (-net) / MYR_S
            rows.append(
                {
                    "name": name,
                    "k2_over_Q": k2q,
                    "e_start": e1,
                    "net_damps": net < 0.0,
                    "myr_to_0_03_at_final_a": myr,
                    "fits_in_1_myr": bool(myr is not None and myr <= 1.0),
                }
            )
    return rows


def run_capture() -> dict:
    tracks = []
    for e0 in (0.5, 0.7, 0.85):
        for k2, q, name in (
            (K2_COLD, Q_COLD, "cold"),
            (K2_WARM, Q_WARM_HI, "warm_Q30"),
            (K2_WARM, Q_WARM_LO, "warm_Q10"),
            (0.3, 1.0, "magma_k2_0.3_Q1"),
            (1.0, 1.0, "magma_k2_1_Q1"),
            (1.5, 0.5, "magma_k2Q_3"),
        ):
            cap_myr = 1.0 if name == "magma_k2Q_3" else (2.0 if name.startswith("magma") or e0 < 0.8 else 1.2)
            row = circularize_track(k2, q, e0, None, t_cap_myr=cap_myr)
            row["name"] = name
            tracks.append(row)
    return {
        "final_orbit": final_orbit_timescales(),
        "tail_at_final_a": tail_times(),
        "tracks": tracks,
        "energy": heat_budget(),
        "assumption": (
            "Tracks start on the angular-momentum curve that ends at e=0.03, a=240,000 km. "
            "A parabolic capture that ends there has periapsis near 120,000 km, not a grazing pass. est."
        ),
    }


def selftest_numbers() -> list[tuple[str, bool, str]]:
    locks = lock_times()
    sync = sync_radius_m() / 1000.0
    cap = catcher()
    energy = capture_energy_j()
    f1 = hut_functions(0.0)[0]
    day = day_length()
    checks = [
        ("der_cold_3.2", 3.05 <= locks["der_cold_myr"] <= 3.40, f"{locks['der_cold_myr']:.3f} Myr"),
        ("der_warm_0.43", 0.40 <= locks["der_warm_Q30_myr"] <= 0.46, f"{locks['der_warm_Q30_myr']:.3f} Myr"),
        ("der_warm_0.14", 0.13 <= locks["der_warm_Q10_myr"] <= 0.16, f"{locks['der_warm_Q10_myr']:.3f} Myr"),
        ("shudder_0.33_scale", 0.30 <= locks["shudder_scaled_from_7myr"] <= 0.36, f"{locks['shudder_scaled_from_7myr']:.3f} Myr"),
        ("sync_54076", 54074.0 <= sync <= 54078.0, f"{sync:.2f} km"),
        ("catcher_7.5_km_4g", 3.9 <= cap["rows"][1]["g"] <= 4.2, f"{cap['rows'][1]['g']:.3f} G"),
        ("catcher_7_gt_8", cap["g_at_7_km"] > cap["g_at_8_km"] > 3.0, f"{cap['g_at_7_km']:.3f} vs {cap['g_at_8_km']:.3f}"),
        ("capture_energy", 2.6e28 <= energy <= 2.8e28, f"{energy:.3e} J"),
        ("hut_f1_at_0", abs(f1 - 1.0) < 1e-9, f"{f1}"),
        ("day_81ms", 70.0 <= day["ms_per_century"] <= 95.0, f"{day['ms_per_century']:.2f} ms/century"),
        ("conjunction_112000", abs(dependents(0.20)["conjunction_km"] - 112000) < 2000, f"{dependents(0.20)['conjunction_km']:.0f} km"),
    ]
    return checks
