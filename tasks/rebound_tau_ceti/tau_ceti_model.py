"""Tau Ceti N-body initial conditions for the REBOUND stability check.

Units are year, AU, solar mass (REBOUND G = 4 pi^2).

Values were re-read from Tau_Cet_system_v2.md Draft v2.40 on 2026-09-30.
Where that doc is silent, the defaults in DEFAULTS are used. They are not
setting-doc values.
"""

from __future__ import annotations

import math

import numpy as np
import rebound

# GM_earth / GM_sun. The setting doc states M_earth = 5.972e24 kg but not
# this ratio. Used only to convert Earth-mass figures into solar masses.
M_EARTH = 3.986004418e14 / 1.32712440018e20

# Setting-doc calculation note: 1 AU = 1.496e8 km.
AU_KM = 1.496e8
M_EARTH_KG = 5.972e24

M_STAR = 0.78
SEED = 20260930

# Doc masses. Kakakiko, Der and Shudder are the published kilogram values
# divided by the doc's M_earth, so Der/Kakakiko is exactly 1/100.
MASSES_ME = {
    "gane": 0.06,
    "hornstooth": 0.08,
    "husk": 0.10,
    "sable": 2.0,
    "kakakiko": 6.243e24 / M_EARTH_KG,
    "shudder": 1.491e22 / M_EARTH_KG,
    "der": 6.243e22 / M_EARTH_KG,
    "croquet": 95.0,
    "cue": 17.0,
    "eight": 13.0,
}

A_AU = {
    "gane": 0.133,
    "hornstooth": 0.243,
    "husk": 0.34,
    "sable": 0.538,
    "kakakiko": 0.71,
    "croquet": 2.8,
    "cue": 5.5,
    "eight": 9.2,
    "shudder": 251_350.0 / AU_KM,
    "der": 400_000.0 / AU_KM,
}

# None means the doc does not give a number (TBD or "not given").
E_DOC = {
    "gane": None,
    "hornstooth": None,
    "husk": None,
    "sable": None,  # Locked ceiling e <= 0.1, no single value
    "kakakiko": 0.0396,
    "shudder": 0.20,
    "der": 0.03,
    "croquet": None,
    "cue": None,
    "eight": None,
}

INNER_FOLDED = ("gane", "hornstooth", "husk", "sable")
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

# Choices made here because the doc does not give a number.
DEFAULTS = {
    "e_gane": 0.0,
    "e_hornstooth": 0.0,
    "e_husk": 0.0,
    "e_sable_baseline": 0.0,
    "e_croquet": 0.0,
    "e_cue": 0.0,
    "e_eight": 0.0,
    "inc_deg": 0.0,
    "omega_rad": 0.0,
    "Omega_rad": 0.0,
    "mean_anomaly": "uniform on [0, 2pi), numpy PCG64 seed 20260930, one draw per planet in PLANET_ORDER",
    "moon_phase_baseline": "apsides aligned, both mean anomalies 0, so phi1 = phi2 = 0 (conjunction at Shudder perigee)",
    "moon_tilt_variant_deg": 12.0,
    "moon_node_rad": 0.0,
    "croquet_trojan_da_AU": 0.01,
    "croquet_trojan_dl_deg": 5.0,
    "der_trojan_da_frac": 0.01,
    "der_trojan_dl_deg": 5.0,
    "trojan_grid": "5 x 5 = 25 particles per Lagrange point",
}


def mass_msun(name: str) -> float:
    return MASSES_ME[name] * M_EARTH


def mean_anomalies(seed: int = SEED) -> dict[str, float]:
    rng = np.random.Generator(np.random.PCG64(seed))
    return {name: float(rng.uniform(0.0, 2.0 * math.pi)) for name in PLANET_ORDER}


def random_moon_anomalies(seed: int = SEED) -> tuple[float, float]:
    rng = np.random.Generator(np.random.PCG64(seed + 1))
    return float(rng.uniform(0.0, 2.0 * math.pi)), float(rng.uniform(0.0, 2.0 * math.pi))


def wrap_pi(angle):
    return (np.asarray(angle, dtype=float) + np.pi) % (2.0 * np.pi) - np.pi


def mutual_hill(a1: float, a2: float, m1: float, m2: float, mstar: float) -> float:
    return ((m1 + m2) / (3.0 * mstar)) ** (1.0 / 3.0) * 0.5 * (a1 + a2)


def hill_radius(a: float, m: float, mstar: float) -> float:
    return a * (m / (3.0 * mstar)) ** (1.0 / 3.0)


def _new_sim() -> rebound.Simulation:
    sim = rebound.Simulation()
    sim.units = ("yr", "AU", "Msun")
    return sim


def _add_planet(sim, name, m, a, e, inc, M, omega=0.0, Omega=0.0, primary=None):
    sim.add(
        m=m,
        a=a,
        e=e,
        inc=inc,
        Omega=Omega,
        omega=omega,
        M=M,
        primary=primary,
        name=name,
    )


def configure_whfast(sim: rebound.Simulation, dt: float) -> None:
    sim.integrator = "whfast"
    sim.dt = float(dt)
    sim.integrator.safe_mode = 0
    sim.integrator.corrector = 17
    sim.integrator.keep_unsynchronized = 1
    sim.integrator.coordinates = "jacobi"


def shortest_period(sim: rebound.Simulation, names: list[str]) -> float:
    star = sim.particles["star"]
    periods = []
    for name in names:
        o = sim.particles[name].orbit(primary=star)
        if o.P > 0:
            periods.append(o.P)
    return float(min(periods))


def kepler_xyz(a, e, inc, Omega, omega, M):
    """Heliocentric Keplerian positions. Scalars broadcast against array M."""
    e = float(np.clip(e, 0.0, 0.999999))
    M = np.asarray(M, dtype=float)
    E = np.array(M, copy=True)
    if e < 1e-12:
        E = M
    else:
        for _ in range(15):
            f = E - e * np.sin(E) - M
            fp = 1.0 - e * np.cos(E)
            E = E - f / fp
    cE = np.cos(E)
    sE = np.sin(E)
    x = a * (cE - e)
    y = a * np.sqrt(max(0.0, 1.0 - e * e)) * sE
    co, so = math.cos(omega), math.sin(omega)
    cO, sO = math.cos(Omega), math.sin(Omega)
    ci, si = math.cos(inc), math.sin(inc)
    x1 = co * x - so * y
    y1 = so * x + co * y
    x2 = x1
    y2 = ci * y1
    z2 = si * y1
    x3 = cO * x2 - sO * y2
    y3 = sO * x2 + cO * y2
    z3 = z2
    return x3, y3, z3


def min_kepler_separation(el1: dict, el2: dict, dt: float, nsub: int) -> float:
    """Minimum separation over [0, dt] with frozen osculating elements."""
    if dt <= 0.0 or nsub < 2:
        return float("inf")
    ts = np.linspace(0.0, dt, int(nsub))
    x1, y1, z1 = kepler_xyz(el1["a"], el1["e"], el1["inc"], el1["Omega"], el1["omega"], el1["M"] + el1["n"] * ts)
    x2, y2, z2 = kepler_xyz(el2["a"], el2["e"], el2["inc"], el2["Omega"], el2["omega"], el2["M"] + el2["n"] * ts)
    d2 = (x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2
    return float(np.sqrt(np.min(d2)))


def elements_against(sim, name: str, primary_name: str) -> dict:
    o = sim.particles[name].orbit(primary=sim.particles[primary_name])
    return {
        "a": float(o.a),
        "e": float(o.e),
        "inc": float(o.inc),
        "Omega": float(o.Omega),
        "omega": float(o.omega),
        "M": float(o.M),
        "n": float(o.n),
        "P": float(o.P),
        "l": float(o.l),
        "pomega": float(o.pomega),
        "f": float(o.f),
        "rhill": float(o.rhill),
    }


def resonant_angles(sim) -> tuple[float, float]:
    sh = elements_against(sim, "shudder", "kakakiko")
    de = elements_against(sim, "der", "kakakiko")
    phi1 = float(wrap_pi(2.0 * de["l"] - sh["l"] - sh["pomega"]))
    phi2 = float(wrap_pi(2.0 * de["l"] - sh["l"] - de["pomega"]))
    return phi1, phi2


def _star_mass(fold_inner: bool) -> float:
    m = M_STAR
    if fold_inner:
        for name in INNER_FOLDED:
            m += mass_msun(name)
    return m


def build_outer(variant: str = "baseline", anomalies: dict | None = None):
    """Star + Kakakiko + three giants. Inner-planet mass is added to the star.

    variant: baseline | e05 | cue15
    """
    anomalies = anomalies or mean_anomalies()
    sim = _new_sim()
    mstar = _star_mass(True)
    sim.add(m=mstar, name="star")
    star = sim.particles["star"]
    e_giant = 0.05 if variant == "e05" else 0.0
    m_cue = mass_msun("cue") * (1.5 if variant == "cue15" else 1.0)
    specs = [
        ("kakakiko", mass_msun("kakakiko"), A_AU["kakakiko"], E_DOC["kakakiko"]),
        ("croquet", mass_msun("croquet"), A_AU["croquet"], e_giant),
        ("cue", m_cue, A_AU["cue"], e_giant),
        ("eight", mass_msun("eight"), A_AU["eight"], e_giant),
    ]
    for name, m, a, e in specs:
        _add_planet(sim, name, m, a, e, 0.0, anomalies[name], primary=star)
    sim.move_to_com()
    meta = {
        "kind": "outer",
        "variant": variant,
        "fold_inner": True,
        "mstar": mstar,
        "bodies": [s[0] for s in specs],
        "primary": {s[0]: "star" for s in specs},
        "a0": {s[0]: s[2] for s in specs},
        "m": {s[0]: s[1] for s in specs},
        "pairs": [("croquet", "cue"), ("cue", "eight"), ("kakakiko", "croquet")],
    }
    return sim, meta


def build_full(sable_e: float = 0.0, anomalies: dict | None = None):
    """All eight planets. Baseline Sable eccentricity is the chosen default."""
    anomalies = anomalies or mean_anomalies()
    sim = _new_sim()
    sim.add(m=M_STAR, name="star")
    star = sim.particles["star"]
    bodies = []
    masses = {}
    a0 = {}
    for name in PLANET_ORDER:
        if name == "sable":
            e = float(sable_e)
        elif E_DOC[name] is None:
            e = 0.0
        else:
            e = float(E_DOC[name])
        m = mass_msun(name)
        _add_planet(sim, name, m, A_AU[name], e, 0.0, anomalies[name], primary=star)
        bodies.append(name)
        masses[name] = m
        a0[name] = A_AU[name]
    sim.move_to_com()
    meta = {
        "kind": "full",
        "sable_e": float(sable_e),
        "fold_inner": False,
        "mstar": M_STAR,
        "bodies": bodies,
        "primary": {n: "star" for n in bodies},
        "a0": a0,
        "m": masses,
        "pairs": [
            ("sable", "kakakiko"),
            ("husk", "sable"),
            ("croquet", "cue"),
            ("cue", "eight"),
            ("kakakiko", "croquet"),
        ],
    }
    return sim, meta


def build_moons(
    phase: str = "resonant",
    inc_deg: float = 0.0,
    a_shudder: float | None = None,
    anomalies: dict | None = None,
    tune: bool = False,
    moon_M: tuple[float, float] | None = None,
    moon_omega: tuple[float, float] | None = None,
    isolated: bool = False,
    a_der: float | None = None,
    companions: bool = True,
):
    """Star, Sable, Kakakiko, Shudder, Der, Croquet. Planetocentric moons.

    phase: 'resonant' (phi1 = phi2 = 0) or 'random'.
    tune: adjust Shudder's a so the initial osculating mean motions are 2:1.
    """
    anomalies = anomalies or mean_anomalies()
    a_s = A_AU["shudder"] if a_shudder is None else float(a_shudder)
    a_d = A_AU["der"] if a_der is None else float(a_der)
    if tune:
        a_s = tune_shudder_semimajor(phase=phase, inc_deg=inc_deg, anomalies=anomalies)

    if moon_M is not None:
        m_sh, m_de = moon_M
        w_sh, w_de = (0.0, 0.0) if moon_omega is None else moon_omega
    elif phase == "resonant":
        m_sh, m_de = 0.0, 0.0
        w_sh, w_de = 0.0, 0.0
    elif phase == "random":
        m_sh, m_de = random_moon_anomalies()
        w_sh, w_de = 0.0, 0.0
    elif phase == "apocenter":
        # Conjunction at Shudder's apocenter: phi1 = phi2 = pi.
        m_sh, m_de = math.pi, math.pi
        w_sh, w_de = 0.0, 0.0
    else:
        raise ValueError(phase)

    inc = math.radians(inc_deg)
    sim = _new_sim()
    if isolated:
        sim.add(m=mass_msun("kakakiko"), name="kakakiko", x=0.0, y=0.0, z=0.0)
    else:
        sim.add(m=M_STAR, name="star")
        star = sim.particles["star"]
        if companions:
            _add_planet(sim, "sable", mass_msun("sable"), A_AU["sable"], 0.0, 0.0, anomalies["sable"], primary=star)
        _add_planet(
            sim,
            "kakakiko",
            mass_msun("kakakiko"),
            A_AU["kakakiko"],
            E_DOC["kakakiko"],
            0.0,
            anomalies["kakakiko"],
            primary=star,
        )
    kak = sim.particles["kakakiko"]
    _add_planet(
        sim,
        "shudder",
        mass_msun("shudder"),
        a_s,
        E_DOC["shudder"],
        inc,
        m_sh,
        omega=w_sh,
        Omega=0.0,
        primary=kak,
    )
    _add_planet(
        sim,
        "der",
        mass_msun("der"),
        a_d,
        E_DOC["der"],
        inc,
        m_de,
        omega=w_de,
        Omega=0.0,
        primary=kak,
    )
    if not isolated and companions:
        _add_planet(sim, "croquet", mass_msun("croquet"), A_AU["croquet"], 0.0, 0.0, anomalies["croquet"], primary=star)
    sim.move_to_com()
    if isolated:
        bodies = ["shudder", "der"]
        primary = {"shudder": "kakakiko", "der": "kakakiko"}
        a0 = {"shudder": a_s, "der": a_d}
        masses = {n: mass_msun(n) for n in ("kakakiko", "shudder", "der")}
        pairs = [("shudder", "der")]
        mstar = mass_msun("kakakiko")
    else:
        bodies = ["kakakiko", "shudder", "der"]
        primary = {"kakakiko": "star", "shudder": "kakakiko", "der": "kakakiko"}
        a0 = {"kakakiko": A_AU["kakakiko"], "shudder": a_s, "der": a_d}
        masses = {n: mass_msun(n) for n in bodies}
        pairs = [("shudder", "der")]
        if companions:
            bodies = ["sable", "kakakiko", "shudder", "der", "croquet"]
            primary = {
                "sable": "star",
                "kakakiko": "star",
                "shudder": "kakakiko",
                "der": "kakakiko",
                "croquet": "star",
            }
            a0 = {
                "sable": A_AU["sable"],
                "kakakiko": A_AU["kakakiko"],
                "shudder": a_s,
                "der": a_d,
                "croquet": A_AU["croquet"],
            }
            masses = {n: mass_msun(n) for n in bodies}
            pairs = [("shudder", "der"), ("sable", "kakakiko")]
        mstar = M_STAR
    meta = {
        "kind": "moons",
        "phase": phase,
        "inc_deg": float(inc_deg),
        "a_shudder_input": a_s,
        "tuned": bool(tune or a_shudder is not None),
        "isolated": bool(isolated),
        "fold_inner": False,
        "mstar": mstar,
        "bodies": bodies,
        "primary": primary,
        "a0": a0,
        "m": masses,
        "pairs": pairs,
        "moon_names": ["shudder", "der"],
    }
    return sim, meta


def tune_shudder_semimajor(phase: str = "resonant", inc_deg: float = 0.0, anomalies: dict | None = None) -> float:
    """Shift Shudder's a until n_Shudder = 2 n_Der on the initial osculating orbits."""
    anomalies = anomalies or mean_anomalies()
    a_s = A_AU["shudder"]
    for _ in range(8):
        sim, _meta = build_moons(phase=phase, inc_deg=inc_deg, a_shudder=a_s, anomalies=anomalies, tune=False)
        sim.synchronize()
        ns = elements_against(sim, "shudder", "kakakiko")["n"]
        nd = elements_against(sim, "der", "kakakiko")["n"]
        ratio = ns / (2.0 * nd)
        if abs(ratio - 1.0) < 1e-10:
            break
        a_s = a_s * ratio ** (2.0 / 3.0)
    return float(a_s)


def _grid(da_values, dl_deg_values):
    for da in da_values:
        for dl in dl_deg_values:
            yield float(da), float(dl)


def build_croquet_trojans(anomalies: dict | None = None):
    """Model A plus 25 massless particles at Croquet L4 and 25 at L5."""
    sim, meta = build_outer("baseline", anomalies=anomalies)
    sim.N_active = sim.N
    sim.testparticle_type = 0
    star = sim.particles["star"]
    sim.synchronize()
    host = elements_against(sim, "croquet", "star")
    da = DEFAULTS["croquet_trojan_da_AU"]
    dl = DEFAULTS["croquet_trojan_dl_deg"]
    das = [-da, -0.5 * da, 0.0, 0.5 * da, da]
    dls = [-dl, -0.5 * dl, 0.0, 0.5 * dl, dl]
    tps = []
    for group, center_deg in (("L4", 60.0), ("L5", -60.0)):
        k = 0
        for da_i, dl_i in _grid(das, dls):
            name = f"croquet_{group}_{k:02d}"
            lam = host["l"] + math.radians(center_deg + dl_i)
            _add_planet(sim, name, 0.0, host["a"] + da_i, 0.0, 0.0, lam, primary=star)
            tps.append({"name": name, "group": group, "center_deg": center_deg})
            k += 1
    meta = dict(meta)
    meta["kind"] = "trojan_croquet"
    meta["test_particles"] = tps
    meta["host"] = "croquet"
    meta["perturber"] = "cue"
    return sim, meta


def build_der_trojans(anomalies: dict | None = None):
    """Model C (resonant, coplanar moons) plus 25 particles at Der L4 and L5."""
    sim, meta = build_moons(phase="resonant", inc_deg=0.0, anomalies=anomalies, tune=False)
    sim.N_active = sim.N
    sim.testparticle_type = 0
    kak = sim.particles["kakakiko"]
    sim.synchronize()
    host = elements_against(sim, "der", "kakakiko")
    frac = DEFAULTS["der_trojan_da_frac"]
    dl = DEFAULTS["der_trojan_dl_deg"]
    das = [host["a"] * f for f in (-frac, -0.5 * frac, 0.0, 0.5 * frac, frac)]
    dls = [-dl, -0.5 * dl, 0.0, 0.5 * dl, dl]
    tps = []
    for group, center_deg in (("L4", 60.0), ("L5", -60.0)):
        k = 0
        for da_i, dl_i in _grid(das, dls):
            name = f"der_{group}_{k:02d}"
            lam = host["l"] + math.radians(center_deg + dl_i)
            # e = 0, so mean longitude equals M when omega = Omega = 0.
            # Keep Der's plane (inc, node). omega = 0 because e = 0.
            _add_planet(
                sim,
                name,
                0.0,
                host["a"] + da_i,
                0.0,
                host["inc"],
                lam,
                omega=0.0,
                Omega=host["Omega"],
                primary=kak,
            )
            tps.append({"name": name, "group": group, "center_deg": center_deg})
            k += 1
    meta = dict(meta)
    meta["kind"] = "trojan_der"
    meta["test_particles"] = tps
    meta["host"] = "der"
    meta["host_primary"] = "kakakiko"
    meta["perturber"] = "shudder"
    return sim, meta


def spacing_table() -> list[tuple[str, str, float]]:
    """Adjacent mutual-Hill spacings Delta = (a2-a1) / R_H,m for the eight planets."""
    rows = []
    names = list(PLANET_ORDER)
    for n1, n2 in zip(names, names[1:]):
        rhm = mutual_hill(A_AU[n1], A_AU[n2], mass_msun(n1), mass_msun(n2), M_STAR)
        rows.append((n1, n2, (A_AU[n2] - A_AU[n1]) / rhm))
    return rows


def two_body_moon_period_ratio() -> float:
    """P_Der / P_Shudder from the two-body Kepler law with each moon's own mass."""
    mk = 6.243e24
    a_s = 251_350.0
    a_d = 400_000.0
    ms = 1.491e22
    md = 6.243e22
    return (a_d / a_s) ** 1.5 * math.sqrt((mk + ms) / (mk + md))


def self_check() -> None:
    anomalies = mean_anomalies()
    print("M_EARTH/Msun", M_EARTH)
    print("Kakakiko Mearth", MASSES_ME["kakakiko"])
    print("Der/Kak", MASSES_ME["der"] / MASSES_ME["kakakiko"])
    print("Shudder Mearth", MASSES_ME["shudder"])
    print("two-body Pder/Psh", two_body_moon_period_ratio())
    print("folded inner Msun", _star_mass(True) - M_STAR)
    for n1, n2, delta in spacing_table():
        print(f"spacing {n1:12s} {n2:12s} {delta:8.2f}")
    sim, meta = build_outer()
    sim.synchronize()
    pmin = shortest_period(sim, meta["bodies"])
    print("outer Pmin yr", pmin, "dt", pmin / 20.0)
    for name in meta["bodies"]:
        el = elements_against(sim, name, "star")
        print(f"  {name:12s} a={el['a']:.6f} e={el['e']:.6f} P={el['P']:.6f}")
    sim, meta = build_full(0.0)
    sim.synchronize()
    pmin = shortest_period(sim, meta["bodies"])
    print("full Pmin yr", pmin, "dt", pmin / 20.0)
    for name in meta["bodies"]:
        el = elements_against(sim, name, "star")
        print(f"  {name:12s} a={el['a']:.6f} e={el['e']:.6e} P={el['P']:.6f} M={anomalies[name]:.4f}")
    sim, meta = build_moons(phase="resonant")
    sim.synchronize()
    phi1, phi2 = resonant_angles(sim)
    sh = elements_against(sim, "shudder", "kakakiko")
    de = elements_against(sim, "der", "kakakiko")
    r_h = hill_radius(elements_against(sim, "kakakiko", "star")["a"], mass_msun("kakakiko"), M_STAR)
    rhm = mutual_hill(sh["a"], de["a"], mass_msun("shudder"), mass_msun("der"), mass_msun("kakakiko"))
    print(f"moons phi1={phi1:.3e} phi2={phi2:.3e}")
    print(f"  shudder a={sh['a']:.8e} e={sh['e']:.4f} P={sh['P']:.6f} yr ({sh['P']*365.25:.3f} d)")
    print(f"  der     a={de['a']:.8e} e={de['e']:.4f} P={de['P']:.6f} yr ({de['P']*365.25:.3f} d)")
    print(f"  n ratio ns/(2 nd)={sh['n']/(2*de['n']):.8f}")
    print(f"  P ratio {de['P']/sh['P']:.8f}")
    print(f"  Kak Hill AU {r_h:.6e} km {r_h*AU_KM:.4e}")
    print(f"  moon mutual Hill km {rhm*AU_KM:.2f}  spacing {(de['a']-sh['a'])/rhm:.3f}")
    a_tuned = tune_shudder_semimajor()
    print(f"tuned shudder a AU {a_tuned:.8e} km {a_tuned*AU_KM:.2f}  doc km 251350  delta km {(a_tuned-A_AU['shudder'])*AU_KM:.2f}")
    sim, meta = build_croquet_trojans()
    sim.synchronize()
    host = elements_against(sim, "croquet", "star")
    deltas = []
    for tp in meta["test_particles"]:
        el = elements_against(sim, tp["name"], "star")
        deltas.append(math.degrees(float(wrap_pi(el["l"] - host["l"]))))
    print(f"croquet trojans N={len(meta['test_particles'])} angle span {min(deltas):.2f} to {max(deltas):.2f}")
    sim, meta = build_der_trojans()
    sim.synchronize()
    host = elements_against(sim, "der", "kakakiko")
    deltas = []
    for tp in meta["test_particles"]:
        el = elements_against(sim, tp["name"], "kakakiko")
        deltas.append(math.degrees(float(wrap_pi(el["l"] - host["l"]))))
    print(f"der trojans N={len(meta['test_particles'])} angle span {min(deltas):.2f} to {max(deltas):.2f}")
    print("SELFCHECK OK")


if __name__ == "__main__":
    self_check()
