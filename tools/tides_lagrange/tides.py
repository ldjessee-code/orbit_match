"""Equilibrium tides and 1D resonant bays for Kakakiko.

The live system doc names four resonant bays and their preserve areas.
It does not give length, depth, or mouth width. Those geometries are
scanned here and tagged est. in the report.

Open-ocean numbers are equilibrium theory (rigid, then × gamma2).
Shelf and bay numbers are a 1D co-oscillating channel with quadratic
bottom friction. They are not a global ocean model.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

from constants import (
    A_DER,
    A_PLANET,
    A_SHUDDER,
    ANOMALY_SEED,
    CD_BED,
    DAY_S,
    E_DER,
    E_PLANET,
    E_SHUDDER,
    FUNDY_RANGE_M,
    G,
    G_SURF,
    GAMMA2,
    M_DER,
    M_P,
    M_SHUDDER,
    M_STAR,
    MU_P,
    PLANET_ORDER,
    QIANTANG_BORE_M,
    R_P,
    SEVERN_BORE_TYPICAL_M,
    UNGAVA_RANGE_M,
    bulge,
    kepler_period,
    radius_at,
    true_anomaly,
)


def kakakiko_mean_anomaly() -> float:
    rng = np.random.Generator(np.random.PCG64(ANOMALY_SEED))
    draw = {name: float(rng.uniform(0.0, 2.0 * math.pi)) for name in PLANET_ORDER}
    return draw["kakakiko"]


def body_state(t_s: float, a: float, ecc: float, mu: float, mean0: float) -> tuple[float, float]:
    """Inertial longitude and radius of a Keplerian body. Periapsis at longitude 0."""
    period = kepler_period(a, mu)
    M = mean0 + 2.0 * math.pi * t_s / period
    nu, E = true_anomaly(M, ecc)
    return nu, radius_at(a, ecc, E)


def equilibrium_height(
    t_s: float,
    latitude_deg: float,
    star_mean0: float,
    star_aligned: bool,
) -> dict[str, float]:
    """Sum of lunar and solar equilibrium heights at one surface point.

    Longitude origin: at t = 0 the point on the equator at lon 0 sits under
    both moons (conjunction at Shudder perigee). Moons stay in the equator.
    """
    lat = math.radians(latitude_deg)
    lon = 2.0 * math.pi * t_s / DAY_S
    parts = {}
    total = 0.0
    for key, a, ecc, mass, mu, mean0 in (
        ("shudder", A_SHUDDER, E_SHUDDER, M_SHUDDER, G * (M_P + M_SHUDDER), 0.0),
        ("der", A_DER, E_DER, M_DER, G * (M_P + M_DER), 0.0),
    ):
        theta, radius = body_state(t_s, a, ecc, mu, mean0)
        H = bulge(mass, radius)
        hour = lon - theta
        cos_psi = math.cos(lat) * math.cos(hour)
        zeta = H * (3.0 * cos_psi * cos_psi - 1.0) / 2.0
        parts[key] = zeta
        parts[key + "_H"] = H
        parts[key + "_r_km"] = radius / 1000.0
        total += zeta
    if star_aligned:
        # Put perihelion conjunction on top of the moons at t = 0.
        star_mean0 = 0.0
        # Planet true longitude 0 means the star, as seen from the planet,
        # is at longitude pi. Shift the planet's periapsis so the substellar
        # point is at longitude 0 when true anomaly is 0: substellar = nu + pi
        # would be pi. We want substellar = 0, so store longitude as nu (a
        # phase choice) by using theta_star = nu, not nu+pi. See below.
        phase_flip = 0.0
    else:
        phase_flip = math.pi
    theta_p, r_star = body_state(
        t_s, A_PLANET, E_PLANET, G * (M_STAR + M_P), star_mean0
    )
    # Substellar longitude is the planet's heliocentric longitude + pi.
    substellar = theta_p + phase_flip
    if star_aligned:
        substellar = theta_p  # chosen so t = 0, nu = 0 faces the point
    H_star = bulge(M_STAR, r_star)
    hour = lon - substellar
    cos_psi = math.cos(lat) * math.cos(hour)
    zeta_s = H_star * (3.0 * cos_psi * cos_psi - 1.0) / 2.0
    parts["star"] = zeta_s
    parts["star_H"] = H_star
    parts["total"] = total + zeta_s
    return parts


def synodic_seconds(period_s: float) -> float:
    return 1.0 / (1.0 / DAY_S - 1.0 / period_s)


def constituent_table() -> dict:
    p_sh = kepler_period(A_SHUDDER, G * (M_P + M_SHUDDER))
    p_de = kepler_period(A_DER, G * (M_P + M_DER))
    p_st = kepler_period(A_PLANET, G * (M_STAR + M_P))
    rows = {}
    for name, period in (("shudder", p_sh), ("der", p_de), ("star", p_st)):
        syn = synodic_seconds(period)
        rows[name] = {
            "sidereal_days": period / 86400.0,
            "sidereal_hours": period / 3600.0,
            "tidal_day_hours": syn / 3600.0,
            "semidiurnal_hours": syn / 7200.0,
            "footprint_m_s": 2.0 * math.pi * R_P / syn,
        }
    rows["shudder"]["anomalistic_days"] = p_sh / 86400.0
    rows["der"]["anomalistic_days"] = p_de / 86400.0
    return rows


def static_bulge_table() -> dict:
    """Lore-style table: h(a) and h at periapsis and apoapsis."""

    def pack(mass: float, a: float, ecc: float) -> dict:
        h_a = bulge(mass, a)
        h_p = bulge(mass, a * (1.0 - ecc))
        h_q = bulge(mass, a * (1.0 + ecc))
        return {
            "h_a_m": h_a,
            "h_peri_m": h_p,
            "h_apo_m": h_q,
            "range_at_a_m": 1.5 * h_a,
        }

    sh = pack(M_SHUDDER, A_SHUDDER, E_SHUDDER)
    de = pack(M_DER, A_DER, E_DER)
    st = pack(M_STAR, A_PLANET, E_PLANET)
    # Rigid sub-point heights. "Spring max" is the geometric ceiling:
    # Shudder perigee + Der perigee + star perihelion, all aligned.
    spring_max = sh["h_peri_m"] + de["h_peri_m"] + st["h_peri_m"]
    # Lore's spring max used the mean star, not perihelion. Reported too.
    spring_max_mean_star = sh["h_peri_m"] + de["h_peri_m"] + st["h_a_m"]
    # Lore's "typical spring" added the three mean-a bulges. That is not the
    # recurring conjunction: the 2:1 puts every conjunction at Shudder perigee.
    lore_typical = sh["h_a_m"] + de["h_a_m"] + st["h_a_m"]
    conjunction = sh["h_peri_m"] + de["h_peri_m"] + st["h_a_m"]
    return {
        "shudder": sh,
        "der": de,
        "star": st,
        "spring_max_perihelion_m": spring_max,
        "spring_max_mean_star_m": spring_max_mean_star,
        "lore_style_typical_spring_m": lore_typical,
        "conjunction_mean_star_m": conjunction,
        "high_to_low_factor": 1.5,
        "gamma2": GAMMA2,
    }


def range_stats(times_h: np.ndarray, zeta: np.ndarray, window_h: float) -> dict:
    dt = float(times_h[1] - times_h[0])
    n = max(2, int(round(window_h / dt)))
    if len(zeta) <= n:
        return {"n": 0}
    # Stride the window so a 200-day series stays cheap.
    step = max(1, n // 8)
    ranges = []
    for i in range(0, len(zeta) - n, step):
        seg = zeta[i : i + n]
        ranges.append(float(seg.max() - seg.min()))
    arr = np.asarray(ranges)
    return {
        "window_hours": window_h,
        "n": int(arr.size),
        "min_m": float(arr.min()),
        "p05_m": float(np.percentile(arr, 5)),
        "p50_m": float(np.percentile(arr, 50)),
        "p95_m": float(np.percentile(arr, 95)),
        "max_m": float(arr.max()),
    }


def series_over(
    days: float,
    latitude_deg: float,
    star_aligned: bool,
    dt_h: float = 0.25,
    start_day: float = 0.0,
) -> dict:
    star0 = 0.0 if star_aligned else kakakiko_mean_anomaly()
    n = int(days * 24.0 / dt_h)
    times_h = start_day * 24.0 + np.arange(n) * dt_h
    total = np.empty(n)
    shudder = np.empty(n)
    der = np.empty(n)
    star = np.empty(n)
    for i, th in enumerate(times_h):
        parts = equilibrium_height(th * 3600.0, latitude_deg, star0, star_aligned)
        total[i] = parts["total"]
        shudder[i] = parts["shudder"]
        der[i] = parts["der"]
        star[i] = parts["star"]
    crust = GAMMA2 * total
    periods = constituent_table()
    window = periods["der"]["tidal_day_hours"]
    return {
        "days": days,
        "start_day": start_day,
        "latitude_deg": latitude_deg,
        "star_aligned": star_aligned,
        "star_mean0": star0,
        "rigid": range_stats(times_h, total, window),
        "crust": range_stats(times_h, crust, window),
        "times_h": times_h,
        "crust_m": crust,
        "rigid_m": total,
        "parts": {"shudder": shudder, "der": der, "star": star},
    }


def fit_constituents(times_h: np.ndarray, zeta: np.ndarray, periods_h: list[float]) -> list[dict]:
    """Least-squares amplitude and phase of known periods. zeta is metres."""
    t_s = times_h * 3600.0
    cols = [np.ones_like(t_s)]
    labels = ["mean"]
    for p_h in periods_h:
        w = 2.0 * math.pi / (p_h * 3600.0)
        cols.append(np.cos(w * t_s))
        cols.append(np.sin(w * t_s))
        labels.append(("cos", p_h))
        labels.append(("sin", p_h))
    design = np.column_stack(cols)
    coef, *_ = np.linalg.lstsq(design, zeta, rcond=None)
    out = []
    i = 1
    for p_h in periods_h:
        c = float(coef[i])
        s = float(coef[i + 1])
        out.append(
            {
                "period_hours": p_h,
                "amplitude_m": math.hypot(c, s),
                "phase_rad": math.atan2(s, c),
            }
        )
        i += 2
    out.append({"period_hours": None, "amplitude_m": float(coef[0]), "phase_rad": 0.0, "term": "mean"})
    return out


def solve_channel(
    length_m: float,
    H_head: float,
    H_mouth: float,
    b_head: float,
    b_mouth: float,
    eta_mouth,
    t_end_s: float,
    cd: float = CD_BED,
    g: float = G_SURF,
    n_cells: int = 80,
    warmup_s: float = 0.0,
    nonlinear: bool = False,
    cfl: float = 0.45,
    linear_drag: float = 0.0,
) -> dict:
    """Closed at x = 0, elevation imposed at x = L.

    H and b vary linearly from head to mouth. Quadratic drag uses the
    wet depth. `eta_mouth(t)` returns metres.
    """
    n = n_cells
    dx = length_m / n
    x = (np.arange(n) + 0.5) * dx
    frac = x / length_m
    H = np.maximum(H_head + (H_mouth - H_head) * frac, 0.5)
    b = np.maximum(b_head + (b_mouth - b_head) * frac, 1.0)
    cmax = math.sqrt(g * float(H.max()))
    dt = cfl * dx / cmax
    steps = int(math.ceil(t_end_s / dt))
    eta = np.zeros(n)
    u = np.zeros(n + 1)  # u[0] is the closed head and stays 0
    h_geom = np.empty(n + 1)
    b_face = np.empty(n + 1)
    h_geom[0] = H[0]
    h_geom[1:n] = 0.5 * (H[:-1] + H[1:])
    h_geom[n] = H[-1]
    b_face[0] = b[0]
    b_face[1:n] = 0.5 * (b[:-1] + b[1:])
    b_face[n] = b[-1]
    hmin = 0.2
    head_max = -1e9
    head_min = 1e9
    u_mouth_max = 0.0
    u_headish_max = 0.0
    peak_jump = 0.0
    record_after = warmup_s if warmup_s > 0 else 0.6 * t_end_s
    grad = np.empty(n + 1)
    for step in range(steps):
        t = step * dt
        em = float(eta_mouth(t))
        # Mouth elevation sits on the boundary, half a cell beyond the last
        # center. The ghost value that averages to em with the last cell is
        # 2*em - eta[-1], and the center-to-center gradient uses that ghost.
        grad[0] = 0.0
        grad[1:n] = -g * (eta[1:] - eta[:-1]) / dx
        grad[n] = -g * ((2.0 * em - eta[-1]) - eta[-1]) / dx
        if nonlinear:
            e_face = np.empty(n + 1)
            e_face[0] = eta[0]
            e_face[1:n] = 0.5 * (eta[:-1] + eta[1:])
            e_face[n] = eta[-1]
            h_face = np.maximum(h_geom + e_face, hmin)
        else:
            h_face = h_geom
        damp = linear_drag + cd * np.abs(u) / h_face
        u = (u + dt * grad) / (1.0 + dt * damp)
        u[0] = 0.0
        flux = b_face * h_face * u
        eta = eta - dt * (flux[1:] - flux[:-1]) / (b * dx)
        if nonlinear:
            np.maximum(eta, -H + hmin, out=eta)
        if t >= record_after:
            head_max = max(head_max, float(eta[0]))
            head_min = min(head_min, float(eta[0]))
            u_mouth_max = max(u_mouth_max, abs(float(u[n])))
            u_headish_max = max(u_headish_max, abs(float(u[max(1, n // 10)])))
            peak_jump = max(peak_jump, abs(float(eta[1] - eta[0])))
    mouth_amp = _mouth_span(eta_mouth, record_after, t_end_s, dt)
    head_range = head_max - head_min
    return {
        "head_max_m": head_max,
        "head_min_m": head_min,
        "head_range_m": head_range,
        "mouth_range_m": mouth_amp,
        "gain": head_range / mouth_amp if mouth_amp > 1e-6 else None,
        "u_mouth_max_m_s": u_mouth_max,
        "u_inner_max_m_s": u_headish_max,
        "adjacent_cell_jump_m": peak_jump,
        "dt_s": dt,
        "steps": steps,
        "dx_m": dx,
        "H_head_m": H_head,
        "H_mouth_m": H_mouth,
        "b_head_m": b_head,
        "b_mouth_m": b_mouth,
        "length_m": length_m,
        "cd": cd,
        "nonlinear": nonlinear,
        "area_km2": 0.5 * (b_head + b_mouth) * length_m / 1e6,
        "dried": bool(head_min < -0.8 * H_head),
    }


def _mouth_span(eta_mouth, t0: float, t1: float, dt: float) -> float:
    lo = 1e9
    hi = -1e9
    t = t0
    while t <= t1:
        v = float(eta_mouth(t))
        lo = min(lo, v)
        hi = max(hi, v)
        t += max(dt, 60.0)
    return hi - lo


def sine_mouth(amplitude: float, period_s: float):
    def eta(t: float) -> float:
        return amplitude * math.sin(2.0 * math.pi * t / period_s)

    return eta


def analytic_quarter_wave(length_m: float, depth_m: float, period_s: float, amp: float, g: float = G_SURF) -> float:
    c = math.sqrt(g * depth_m)
    k = 2.0 * math.pi / (period_s * c)
    return abs(amp / math.cos(k * length_m))


def quarter_wave_length(depth_m: float, period_s: float, g: float = G_SURF) -> float:
    return math.sqrt(g * depth_m) * period_s / 4.0


def solve_channel_harmonic(
    length_m: float,
    depth_m: float,
    period_s: float,
    amp: float,
    g: float = G_SURF,
    n_cells: int = 100,
    linear_drag: float = 0.0,
) -> float:
    """Inviscid rectangular bay in the frequency domain. Head amplitude, metres.

    Same staggered grid as solve_channel, with the mouth value imposed on
    the boundary (half a cell past the last center). No transient.
    """
    n = n_cells
    dx = length_m / n
    omega = 2.0 * math.pi / period_s
    H = depth_m
    alpha = H / dx
    beta = g / ((1j * omega + linear_drag) * dx)
    ab = alpha * beta
    mat = np.zeros((n, n), dtype=complex)
    rhs = np.zeros(n, dtype=complex)
    # Closed head, cell 0.
    mat[0, 0] = 1j * omega + ab
    if n > 1:
        mat[0, 1] = -ab
    for i in range(1, n - 1):
        mat[i, i - 1] = -ab
        mat[i, i] = 1j * omega + 2.0 * ab
        mat[i, i + 1] = -ab
    if n > 1:
        mat[n - 1, n - 2] = -ab
        mat[n - 1, n - 1] = 1j * omega + 3.0 * ab
        rhs[n - 1] = 2.0 * ab * amp
    else:
        mat[0, 0] = 1j * omega + 2.0 * ab
        rhs[0] = 2.0 * ab * amp
    eta = np.linalg.solve(mat, rhs)
    return abs(complex(eta[0]))


def channel_selftest() -> dict:
    """Inviscid rectangular bay versus the quarter-wave cosine solution."""
    depth = 40.0
    period = 19.0 * 3600.0
    c = math.sqrt(G_SURF * depth)
    # Pick L so kL = 1.0 rad, comfortably off resonance.
    length = c * period / (2.0 * math.pi)
    amp = 1.0
    expected = analytic_quarter_wave(length, depth, period, amp)
    harmonic = solve_channel_harmonic(length, depth, period, amp, n_cells=100)
    drag = 1.0e-4
    harmonic_drag = solve_channel_harmonic(
        length, depth, period, amp, n_cells=100, linear_drag=drag
    )
    damped = solve_channel(
        length,
        depth,
        depth,
        20_000.0,
        20_000.0,
        sine_mouth(amp, period),
        t_end_s=36.0 * period,
        cd=0.0,
        n_cells=100,
        warmup_s=24.0 * period,
        cfl=0.25,
        linear_drag=drag,
    )
    got_drag = 0.5 * damped["head_range_m"]
    rel_time = abs(got_drag - harmonic_drag) / harmonic_drag
    rel = abs(harmonic - expected) / expected
    return {
        "expected_head_amp_m": expected,
        "numeric_head_amp_m": harmonic,
        "damped_head_amp_m": got_drag,
        "harmonic_drag_amp_m": harmonic_drag,
        "relative_error": rel,
        "time_relative_error": rel_time,
        "length_m": length,
        "kL": 1.0,
        "pass": rel < 0.05 and rel_time < 0.08,
        "head_range_m": damped["head_range_m"],
        "head_max_m": damped["head_max_m"],
        "head_min_m": damped["head_min_m"],
        "mouth_range_m": damped["mouth_range_m"],
        "steps": damped["steps"],
        "dt_s": damped["dt_s"],
    }


def _interp_series(times_s: np.ndarray, values: np.ndarray):
    def eta(t: float) -> float:
        if t <= times_s[0]:
            return float(values[0])
        if t >= times_s[-1]:
            return float(values[-1])
        i = int((t - times_s[0]) / (times_s[1] - times_s[0]))
        i = min(max(i, 0), len(values) - 2)
        w = (t - times_s[i]) / (times_s[i + 1] - times_s[i])
        return float(values[i] * (1.0 - w) + values[i + 1] * w)

    return eta


def friction_limited_gain(depth_m: float, period_s: float, cd: float, g: float = G_SURF) -> dict:
    """Iterative estimate at exact quarter-wave resonance.

    |u|max ≈ (c/H) η_head, r = (8/3π) Cd |u| / H, gain ≈ 4ω / (π r)
    for r comparable to or smaller than ω. This is a cross-check, est.,
    not the channel integration.
    """
    c = math.sqrt(g * depth_m)
    omega = 2.0 * math.pi / period_s
    # Solve gain = 4ω / (π r), r = (8/3π) Cd (c/H) η_head / H,
    # η_head = gain * η_mouth. gain² ∝ 1/η_mouth.
    factor = (8.0 / (3.0 * math.pi)) * cd * (c / depth_m) / depth_m
    # r = factor * η_head, gain = 4ω/(π r) = η_head/η_mouth
    # η_head² = η_mouth * 4ω / (π factor)
    return {
        "c_m_s": c,
        "factor_r_per_eta": factor,
        "note": "eta_head = sqrt(eta_mouth * 4*omega / (pi*factor))",
        "omega": omega,
    }


def head_from_friction_estimate(depth_m: float, period_s: float, eta_mouth: float, cd: float) -> float:
    info = friction_limited_gain(depth_m, period_s, cd)
    return math.sqrt(max(eta_mouth, 0.0) * 4.0 * info["omega"] / (math.pi * info["factor_r_per_eta"]))


def bore_height(h1: float, u: float, g: float = G_SURF) -> float | None:
    """Hydraulic-jump height for a bore advancing into still water of depth h1.

    The flood speed u is the speed behind the bore relative to the still
    water. Returns the bore height (h2 - h1), or None if no jump (Fr <= 1).
    """
    if h1 <= 0.0 or u <= 0.0:
        return None
    c1 = math.sqrt(g * h1)
    if u <= c1:
        return None
    # Solve u = (h2 - h1) * sqrt(g (h1 + h2) / (2 h1 h2))
    # Use a scalar Newton solve on h2.
    h2 = h1 + u * u / g
    for _ in range(20):
        root = math.sqrt(g * (h1 + h2) / (2.0 * h1 * h2))
        fu = (h2 - h1) * root - u
        # derivative, approximate
        eps = 1e-3 * h1
        h3 = h2 + eps
        root3 = math.sqrt(g * (h1 + h3) / (2.0 * h1 * h3))
        df = ((h3 - h1) * root3 - (h2 - h1) * root) / eps
        if abs(df) < 1e-12:
            break
        h2 -= fu / df
        if h2 < h1:
            h2 = h1 * 1.01
    return max(0.0, h2 - h1)


def bay_grid(forcing, t_end_s: float, warmup_s: float, label: str) -> list[dict]:
    """Scan funnel and rectangular bays. Forcing is an eta(t) function in metres."""
    lengths_km = (80, 150, 250, 350, 500)
    depths = (12.0, 25.0, 50.0, 100.0)
    # (b_head_km, b_mouth_km, H_head/H_mouth, shape)
    shapes = (
        (30.0, 30.0, 1.0, "rectangular"),
        (8.0, 40.0, 0.35, "funnel"),
        (3.0, 50.0, 0.2, "sharp_funnel"),
    )
    rows = []
    for L_km in lengths_km:
        for H_m in depths:
            for b_h, b_m, frac, shape in shapes:
                H_h = max(4.0, H_m * frac)
                row = solve_channel(
                    L_km * 1000.0,
                    H_h,
                    H_m,
                    b_h * 1000.0,
                    b_m * 1000.0,
                    forcing,
                    t_end_s=t_end_s,
                    warmup_s=warmup_s,
                    n_cells=70,
                    cd=CD_BED,
                    nonlinear=False,
                )
                row["shape"] = shape
                row["label"] = label
                row["length_km"] = L_km
                rows.append(row)
    return rows


def shelf_grid(forcing, t_end_s: float, warmup_s: float) -> list[dict]:
    rows = []
    for width_km in (50, 100, 200, 400):
        for depth in (20.0, 50.0, 100.0, 200.0):
            row = solve_channel(
                width_km * 1000.0,
                depth,
                depth,
                100_000.0,
                100_000.0,
                forcing,
                t_end_s=t_end_s,
                warmup_s=warmup_s,
                n_cells=60,
                cd=CD_BED,
            )
            row["width_km"] = width_km
            row["shape"] = "shelf"
            rows.append(row)
    return rows


def helmholtz_scan(amplitude: float, period_s: float) -> list[dict]:
    """0-D basin with a narrow inlet and quadratic inlet drag.

    Tuned and detuned inlets. The ocean elevation is a pure sine of the
    given amplitude (metres, zero to peak).
    """
    rows = []
    omega = 2.0 * math.pi / period_s
    for area_km2 in (200, 500, 1500, 4000, 8000):
        area = area_km2 * 1e6
        for L_km in (5.0, 15.0, 40.0):
            for w_km in (1.0, 3.0, 8.0):
                for H in (10.0, 25.0, 50.0):
                    ac = w_km * 1000.0 * H
                    Lc = L_km * 1000.0
                    w0 = math.sqrt(G_SURF * ac / (area * Lc))
                    # Integrate ~12 periods, record the last 4.
                    dt = min(30.0, period_s / 400.0)
                    t_end = 12.0 * period_s
                    t_rec = 8.0 * period_s
                    eta = 0.0
                    u = 0.0
                    hi = -1e9
                    lo = 1e9
                    u_max = 0.0
                    steps = int(t_end / dt)
                    for k in range(steps):
                        t = k * dt
                        em = amplitude * math.sin(omega * t)
                        acc = G_SURF * (em - eta) / Lc
                        hwet = max(H, 0.5)
                        damp = CD_BED * abs(u) / hwet
                        u = (u + dt * acc) / (1.0 + dt * damp)
                        eta += dt * (ac * u) / area
                        if t >= t_rec:
                            hi = max(hi, eta)
                            lo = min(lo, eta)
                            u_max = max(u_max, abs(u))
                    rows.append(
                        {
                            "area_km2": area_km2,
                            "inlet_length_km": L_km,
                            "inlet_width_km": w_km,
                            "inlet_depth_m": H,
                            "natural_period_h": 2.0 * math.pi / w0 / 3600.0,
                            "head_range_m": hi - lo,
                            "mouth_range_m": 2.0 * amplitude,
                            "u_inlet_max_m_s": u_max,
                            "gain": (hi - lo) / (2.0 * amplitude),
                        }
                    )
    return rows


def trim(row: dict) -> dict:
    keep = (
        "head_range_m",
        "head_max_m",
        "head_min_m",
        "mouth_range_m",
        "gain",
        "u_mouth_max_m_s",
        "u_inner_max_m_s",
        "dried",
        "area_km2",
        "length_km",
        "length_m",
        "H_head_m",
        "H_mouth_m",
        "b_head_m",
        "b_mouth_m",
        "shape",
        "label",
        "cd",
        "width_km",
        "nonlinear",
        "adjacent_cell_jump_m",
    )
    return {k: row[k] for k in keep if k in row}


def best_rows(rows: list[dict], limit: int = 8) -> list[dict]:
    ranked = sorted(rows, key=lambda r: r["head_range_m"], reverse=True)
    return [trim(r) for r in ranked[:limit]]


def realistic_filter(row: dict) -> bool:
    """A bay Doug could actually have, given the preserve note and Continent B.

    Preserve per bay, including watershed, is 2,000–10,000 km² (doc).
    Continent B is 300–800 km wide, so a bay cut inland is limited.
    Depth must hold water: head range may exceed mean depth only if the
    flat dries, but a 60 m tide in 4 m of water is not a navigable bay.
    Require mean mouth depth >= 10 m and head range <= 4 × mouth depth
    so the channel is not a thin sheet under a wall of water. est.
    """
    if row.get("shape") == "shelf":
        return False
    area = row.get("area_km2") or 0.0
    length_km = row.get("length_km") or (row.get("length_m") or 0.0) / 1000.0
    if area > 12_000 or area < 80:
        return False
    if length_km > 400:
        return False
    if row["H_mouth_m"] < 10:
        return False
    if row["head_range_m"] > 4.0 * row["H_mouth_m"]:
        return False
    return True


def run_tides(out_path: Path) -> dict:
    periods = constituent_table()
    bulges = static_bulge_table()
    # 200-day equatorial series at the doc's stellar phase, for percentiles.
    equatorial = series_over(200.0, 0.0, star_aligned=False, dt_h=0.25)
    # Start 10 days before conjunction so the channel is already moving
    # when the king tide arrives, and keep that peak inside the record window.
    king = series_over(30.0, 0.0, star_aligned=True, dt_h=0.2, start_day=-10.0)
    lat35 = series_over(200.0, 35.0, star_aligned=False, dt_h=0.25)
    lat55 = series_over(200.0, 55.0, star_aligned=False, dt_h=0.25)
    lat22 = series_over(120.0, 22.5, star_aligned=False, dt_h=0.25)

    for run in (king,):
        mask = run["times_h"] >= 0.0
        window_h = periods["der"]["tidal_day_hours"]
        run["rigid"] = range_stats(run["times_h"][mask], run["rigid_m"][mask], window_h)
        run["crust"] = range_stats(run["times_h"][mask], run["crust_m"][mask], window_h)

    p = periods
    fit_periods = [
        p["der"]["semidiurnal_hours"],
        p["shudder"]["semidiurnal_hours"],
        p["star"]["semidiurnal_hours"],
        p["der"]["tidal_day_hours"],
        p["shudder"]["tidal_day_hours"],
        p["star"]["tidal_day_hours"],
        p["shudder"]["sidereal_hours"],
        p["der"]["sidereal_hours"],
    ]
    constituents = fit_constituents(equatorial["times_h"], equatorial["crust_m"], fit_periods)

    # Pure Der semidiurnal, crust-relative, using the fitted amplitude.
    der_semi = next(c for c in constituents if abs(c["period_hours"] - p["der"]["semidiurnal_hours"]) < 1e-6)
    # King-phase crust series as the bay boundary condition (upper-bound ocean).
    # Simulation clock starts at the first sample. King samples start at day -10.
    times_s = (king["times_h"] - king["times_h"][0]) * 3600.0
    king_force = _interp_series(times_s, king["crust_m"])
    # Unaligned star, but the moons still meet at t = 0. Same spin-up lead-in.
    typical_src = series_over(30.0, 0.0, star_aligned=False, dt_h=0.25, start_day=-10.0)
    typ_times = (typical_src["times_h"] - typical_src["times_h"][0]) * 3600.0
    typical_force = _interp_series(typ_times, typical_src["crust_m"])

    t_end = 30.0 * 86400.0
    warmup = 10.0 * 86400.0
    shelves = shelf_grid(typical_force, t_end, warmup)
    bays_typical = bay_grid(typical_force, t_end, warmup, "typical_16d")
    bays_king = bay_grid(king_force, t_end, warmup, "king_16d")

    # Pure tone at Der's semidiurnal period. Amplitude is the fitted
    # crust-relative constituent (zero to peak). A second tone uses the
    # king-window ocean range as a sine amplitude, which is a generous
    # single-frequency stand-in for the whole spring.
    tone_amp = der_semi["amplitude_m"]
    tone = sine_mouth(tone_amp, p["der"]["semidiurnal_hours"] * 3600.0)
    bays_tone = bay_grid(tone, 12.0 * p["der"]["semidiurnal_hours"] * 3600.0, 6.0 * p["der"]["semidiurnal_hours"] * 3600.0, "der_tone")

    king_ocean_amp = 0.5 * king["crust"]["max_m"]
    tone_king = sine_mouth(max(king_ocean_amp, 0.2), p["der"]["semidiurnal_hours"] * 3600.0)
    bays_tone_king = bay_grid(
        tone_king,
        10.0 * p["der"]["semidiurnal_hours"] * 3600.0,
        5.0 * p["der"]["semidiurnal_hours"] * 3600.0,
        "king_as_sine",
    )

    # Helmholtz uses the fitted Der amplitude and, separately, a 1.5 m sine
    # (a large shelf tide, zero to peak) to see whether a caldera can run away.
    helm = helmholtz_scan(tone_amp, p["der"]["semidiurnal_hours"] * 3600.0)
    helm_big = helmholtz_scan(1.5, p["der"]["semidiurnal_hours"] * 3600.0)

    # Nonlinear rerun of the strongest realistic and the strongest raw bay.
    def rerun_nonlinear(row: dict, forcing, label: str) -> dict:
        out = solve_channel(
            row["length_m"],
            row["H_head_m"],
            row["H_mouth_m"],
            row["b_head_m"],
            row["b_mouth_m"],
            forcing,
            t_end_s=t_end,
            warmup_s=warmup,
            n_cells=80,
            cd=CD_BED,
            nonlinear=True,
        )
        out["shape"] = row.get("shape")
        out["label"] = label
        out["length_km"] = row["length_m"] / 1000.0
        return out

    top_king = max(bays_king, key=lambda r: r["head_range_m"])
    realistic_king = [r for r in bays_king if realistic_filter(r)]
    top_real = max(realistic_king, key=lambda r: r["head_range_m"]) if realistic_king else top_king
    nonlin_top = rerun_nonlinear(top_king, king_force, "nonlinear_top_king")
    nonlin_real = rerun_nonlinear(top_real, king_force, "nonlinear_realistic")

    # Bore: take the inner flood speed from the nonlinear realistic bay and
    # a shallow river (est. 4 m and 8 m) standing in front of it.
    u_flood = nonlin_real["u_inner_max_m_s"]
    bores = []
    for h1 in (2.0, 4.0, 6.0, 8.0, 12.0):
        bh = bore_height(h1, u_flood)
        bores.append({"still_depth_m": h1, "flood_speed_m_s": u_flood, "bore_height_m": bh})

    # Fundy sketch, est. geometry, Earth g and a 12.42 h tide. Mouth amplitude
    # 2.5 m is an entrance tide, not the deep ocean. This only checks that the
    # solver can reach a Fundy-like range from a Fundy-like entrance.
    fundy = solve_channel(
        270_000.0,
        25.0,
        70.0,
        30_000.0,
        70_000.0,
        sine_mouth(2.5, 12.42 * 3600.0),
        t_end_s=8.0 * 12.42 * 3600.0,
        warmup_s=4.0 * 12.42 * 3600.0,
        g=9.80665,
        cd=0.0025,
        n_cells=80,
    )

    # What pure mouth amplitude, on the best realistic shape, would be
    # required to push the head range to 60 m and to 90 m? Scale the linear
    # gain. Quadratic friction does not scale linearly; the nonlinear rerun
    # is the check, and this line is only a linear extrapolation tagged est.
    gain_real = top_real["gain"] or 0.0
    mouth_for_60 = 60.0 / gain_real if gain_real > 0 else None
    mouth_for_90 = 90.0 / gain_real if gain_real > 0 else None

    q_curve = []
    base_period = p["der"]["semidiurnal_hours"]
    shape = top_real
    for factor in (0.7, 0.85, 1.0, 1.15, 1.3, 1.5):
        per = base_period * factor * 3600.0
        row = solve_channel(
            shape["length_m"],
            shape["H_head_m"],
            shape["H_mouth_m"],
            shape["b_head_m"],
            shape["b_mouth_m"],
            sine_mouth(tone_amp, per),
            t_end_s=10.0 * per,
            warmup_s=6.0 * per,
            n_cells=70,
            cd=CD_BED,
        )
        q_curve.append({"period_factor": factor, "period_hours": base_period * factor, "head_range_m": row["head_range_m"]})

    def pack_stats(run: dict) -> dict:
        return {"rigid": run["rigid"], "crust": run["crust"], "latitude_deg": run["latitude_deg"], "star_aligned": run["star_aligned"]}

    # Quarter-wave lengths at the real periods, for the report table.
    qw = []
    for depth in (10, 20, 40, 80, 150):
        qw.append(
            {
                "depth_m": depth,
                "L_der_semi_km": quarter_wave_length(depth, p["der"]["semidiurnal_hours"] * 3600.0) / 1000.0,
                "L_shudder_semi_km": quarter_wave_length(depth, p["shudder"]["semidiurnal_hours"] * 3600.0) / 1000.0,
                "L_der_diurnal_km": quarter_wave_length(depth, p["der"]["tidal_day_hours"] * 3600.0) / 1000.0,
                "L_shudder_anom_km": quarter_wave_length(depth, p["shudder"]["sidereal_hours"] * 3600.0) / 1000.0,
            }
        )

    max_bay = max(r["head_range_m"] for r in bays_king)
    max_realistic = max((r["head_range_m"] for r in realistic_king), default=0.0)
    max_shelf = max(r["head_range_m"] for r in shelves)
    max_helm = max(r["head_range_m"] for r in helm_big)

    doc = {
        "bulges_m": bulges,
        "periods": periods,
        "constituents_crust_m": constituents,
        "equator_seed_phase": pack_stats(equatorial),
        "equator_king_phase": pack_stats(king),
        "lat_22_5": pack_stats(lat22),
        "lat_35": pack_stats(lat35),
        "lat_55": pack_stats(lat55),
        "gamma2": GAMMA2,
        "cd": CD_BED,
        "g_m_s2": G_SURF,
        "quarter_wave_km": qw,
        "shelves_top": best_rows(shelves, 6),
        "bays_typical_top": best_rows(bays_typical, 6),
        "bays_king_top": best_rows(bays_king, 6),
        "bays_tone_top": best_rows(bays_tone, 4),
        "bays_king_sine_top": best_rows(bays_tone_king, 4),
        "bays_king_realistic_top": best_rows(realistic_king, 5),
        "nonlinear_top_king": trim(nonlin_top),
        "nonlinear_realistic": trim(nonlin_real),
        "helmholtz_tone_top": sorted(helm, key=lambda r: r["head_range_m"], reverse=True)[:5],
        "helmholtz_1p5m_top": sorted(helm_big, key=lambda r: r["head_range_m"], reverse=True)[:5],
        "bores_from_realistic_bay": bores,
        "fundy_sketch": trim(fundy) | {"g": 9.80665, "mouth_amp_m": 2.5, "period_h": 12.42},
        "q_curve_realistic": q_curve,
        "linear_mouth_range_for_60_m": mouth_for_60,
        "linear_mouth_range_for_90_m": mouth_for_90,
        "anchors": {
            "fundy_range_m": FUNDY_RANGE_M,
            "ungava_range_m": UNGAVA_RANGE_M,
            "qiantang_bore_m": QIANTANG_BORE_M,
            "severn_bore_typical_m": SEVERN_BORE_TYPICAL_M,
        },
        "ceilings_m": {
            "max_king_bay_range": max_bay,
            "max_realistic_king_bay_range": max_realistic,
            "max_shelf_range": max_shelf,
            "max_helmholtz_1p5m_range": max_helm,
            "nonlinear_realistic_range": nonlin_real["head_range_m"],
            "nonlinear_top_range": nonlin_top["head_range_m"],
        },
        "assumptions_est": [
            "Bay length, depth, and width are not in the system doc. The grid is a scan, not a surveyed bay.",
            "gamma2 = 0.69 is the Earth ocean-to-crust factor, used because Kakakiko is near Earth in size and density.",
            "Cd = 0.0025. No global ocean model, no Coriolis. The 1D model is the right limit at the equator and overstates resonance at 55° S.",
            "Sable eccentricity is not used in the tide series. The star is Kakakiko's Keplerian orbit.",
            "Apsides are fixed. The 2:1 lock keeps conjunction at Shudder perigee.",
        ],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(doc, indent=2), encoding="utf-8")
    return doc


def sync_radius() -> dict:
    period = DAY_S
    a = (MU_P * period**2 / (4.0 * math.pi**2)) ** (1.0 / 3.0)
    return {
        "a_m": a,
        "a_km": a / 1000.0,
        "period_h": 34.0,
        "circular_speed_m_s": math.sqrt(MU_P / a),
        "lore_km": 54070.0,
    }


if __name__ == "__main__":
    print(json.dumps(channel_selftest(), indent=2))
