"""Dispatcher for the Tau Ceti tide and Lagrange-point study.

No arguments: fast self-test. The stop gate runs it that way.
Subcommands: tides, lagrange, fallback, sync, nbody, controls, selftest.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from constants import JOB_DIR  # noqa: E402
import nbody  # noqa: E402
import tides  # noqa: E402


def results_dir() -> Path:
    path = Path(JOB_DIR) / "results"
    path.mkdir(parents=True, exist_ok=True)
    return path


def cmd_selftest() -> int:
    checks = []

    def check(name: str, ok: bool, detail: str):
        checks.append(ok)
        print(("PASS " if ok else "FAIL ") + name + " " + detail, flush=True)

    bulges = tides.static_bulge_table()
    check(
        "bulge-der",
        0.65 < bulges["der"]["h_a_m"] < 0.75,
        f"{bulges['der']['h_a_m']:.4f} m",
    )
    check(
        "bulge-shudder",
        1.20 < bulges["shudder"]["h_a_m"] < 1.50,
        f"{bulges['shudder']['h_a_m']:.4f} m",
    )
    check(
        "bulge-star",
        0.36 < bulges["star"]["h_a_m"] < 0.44,
        f"{bulges['star']['h_a_m']:.4f} m",
    )
    check(
        "spring-max",
        3.50 < bulges["spring_max_mean_star_m"] < 4.10,
        f"{bulges['spring_max_mean_star_m']:.4f} m",
    )
    periods = tides.constituent_table()
    check(
        "der-tidal-day",
        37.5 < periods["der"]["tidal_day_hours"] < 38.7,
        f"{periods['der']['tidal_day_hours']:.3f} h",
    )
    check(
        "der-semi",
        18.7 < periods["der"]["semidiurnal_hours"] < 19.4,
        f"{periods['der']['semidiurnal_hours']:.3f} h",
    )
    check(
        "shudder-period",
        6.4 < periods["shudder"]["sidereal_days"] < 6.8,
        f"{periods['shudder']['sidereal_days']:.4f} d",
    )
    check(
        "der-period",
        13.0 < periods["der"]["sidereal_days"] < 13.5,
        f"{periods['der']['sidereal_days']:.4f} d",
    )
    check(
        "footprint",
        290.0 < periods["der"]["footprint_m_s"] < 320.0,
        f"{periods['der']['footprint_m_s']:.1f} m/s",
    )
    sync = tides.sync_radius()
    check("sync-radius", 53_000.0 < sync["a_km"] < 55_000.0, f"{sync['a_km']:.1f} km")
    bay = tides.channel_selftest()
    check(
        "quarter-wave",
        bool(bay["pass"]),
        f"rel={bay['relative_error']:.4f} got={bay['numeric_head_amp_m']:.4f} "
        f"exp={bay['expected_head_amp_m']:.4f} range={bay.get('head_range_m')} "
        f"mouth={bay.get('mouth_range_m')} steps={bay.get('steps')}",
    )
    orbit = nbody.selftest_nbody()
    check(
        "nbody-0.25yr",
        bool(orbit["pass"]),
        f"dE={orbit['energy_rel']:.3e} Psh={orbit['shudder_days']:.3f} d "
        f"Pde={orbit['der_days']:.3f} d tune={orbit['tune_delta_km']:.2f} km",
    )
    out = results_dir() / "selftest.json"
    payload = {
        "bulges": bulges,
        "periods": periods,
        "sync": sync,
        "channel": bay,
        "nbody": orbit,
        "pass": all(checks),
    }
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("SELFTEST " + ("PASS" if all(checks) else "FAIL"), flush=True)
    return 0 if all(checks) else 1


def _years(argv: list[str], default: float) -> float:
    if "--years" in argv:
        return float(argv[argv.index("--years") + 1])
    return default


def _wall(argv: list[str]) -> float:
    if "--wall-min" in argv:
        return float(argv[argv.index("--wall-min") + 1]) * 60.0
    return 50.0 * 60.0


def _step(argv: list[str]) -> float:
    if "--step" in argv:
        return float(argv[argv.index("--step") + 1])
    return 0.05


def cmd_tides() -> int:
    out = results_dir() / "tides.json"
    doc = tides.run_tides(out)
    extra = results_dir() / "transfers.json"
    extra.write_text(json.dumps(nbody.transfers(), indent=2), encoding="utf-8")
    ceilings = doc["ceilings_m"]
    print(
        "tides wrote "
        + str(out)
        + " max_realistic_m="
        + f"{ceilings['max_realistic_king_bay_range']:.2f}"
        + " max_king_m="
        + f"{ceilings['max_king_bay_range']:.2f}"
        + " max_shelf_m="
        + f"{ceilings['max_shelf_range']:.2f}",
        flush=True,
    )
    return 0


def cmd_nbody(argv: list[str], groups: set[str], tag: str) -> int:
    meta = nbody.integrate(
        results_dir(),
        years=_years(argv, 1000.0),
        groups=groups,
        step_yr=_step(argv),
        wall_s=_wall(argv),
        tag=tag,
    )
    return 0 if meta.get("energy_err_max", 1.0) < 1e-6 else 1


def cmd_controls(argv: list[str]) -> int:
    years = _years(argv, 300.0)
    wall = _wall(argv)
    step = _step(argv)
    model = nbody._model()
    # Build once per control so the host elements match the dropped system.
    for tag, drop, host in (
        ("control_der_only", ("shudder",), "der"),
        ("control_shudder_only", ("der",), "shudder"),
    ):
        sim, _setup = nbody.build_massive(model, drop_names=drop)
        specs = nbody.control_specs(sim, model, host)
        # integrate() builds its own sim. Pass specs_override, and drop the
        # same moon inside integrate via drop_names. Specs were computed on
        # an identical build, so the elements match.
        del sim
        meta = nbody.integrate(
            results_dir(),
            years=years,
            groups={"lagrange"},
            step_yr=step,
            wall_s=wall,
            tag=tag,
            drop_names=drop,
            specs_override=specs,
        )
        if meta.get("energy_err_max", 1.0) >= 1e-6:
            return 1
    return 0


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("selftest",):
        return cmd_selftest()
    cmd = argv[0]
    rest = argv[1:]
    if cmd == "baydebug":
        bay = tides.channel_selftest()
        print(json.dumps(bay, indent=2), flush=True)
        return 0 if bay["pass"] else 1
    if cmd == "tides":
        return cmd_tides()
    if cmd == "lagrange":
        return cmd_nbody(rest, {"lagrange"}, "lagrange")
    if cmd == "fallback":
        return cmd_nbody(rest, {"fallback"}, "fallback")
    if cmd == "sync":
        return cmd_nbody(rest, {"sync"}, "sync")
    if cmd == "nbody":
        return cmd_nbody(rest, {"lagrange", "fallback", "sync"}, "main")
    if cmd == "controls":
        return cmd_controls(rest)
    print("unknown subcommand " + cmd, flush=True)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
