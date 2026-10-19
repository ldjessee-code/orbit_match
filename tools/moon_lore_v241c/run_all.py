"""Dispatcher for the v2.41c capture calculations.

No arguments: fast self-test. The stop gate runs it that way.
Subcommands: capture, lock, ecc, daylen, catcher, rebound, draft, selftest.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import calc  # noqa: E402


def results_dir() -> Path:
    path = calc.JOB_DIR / "results"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _write(name: str, payload: dict) -> Path:
    path = results_dir() / name
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"wrote {path}", flush=True)
    return path


def _read(name: str) -> dict | None:
    path = results_dir() / name
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def cmd_selftest() -> int:
    checks = calc.selftest_numbers()
    failed = False
    for name, ok, detail in checks:
        print(("PASS " if ok else "FAIL ") + name + " " + detail, flush=True)
        failed = failed or not ok
    # Confirm the time unit once, a single 0.01 yr step. Not a science run.
    unit = None
    try:
        import nbody_run

        unit = nbody_run.time_unit_check()
        days = unit["der_period_days_if_unit_is_year"]
        ok = 12.0 < days < 14.5
        print(("PASS " if ok else "FAIL ") + "rebound_time_unit " + f"{days:.3f} d", flush=True)
        failed = failed or not ok
    except Exception as exc:  # noqa: BLE001 — surface the import or build failure in the self-test.
        print("FAIL rebound_time_unit " + str(exc), flush=True)
        failed = True
    payload = {
        "pass": not failed,
        "checks": [{"name": n, "pass": ok, "detail": d} for n, ok, d in checks],
        "time_unit": unit,
    }
    _write("selftest.json", payload)
    print("SELFTEST " + ("PASS" if not failed else "FAIL"), flush=True)
    return 1 if failed else 0


def cmd_lock() -> int:
    doc = {"lock": calc.lock_times(), "final_orbit_tau_e": calc.final_orbit_timescales(), "resonance": calc.resonance_analytic()}
    _write("lock.json", doc)
    lock = doc["lock"]
    print(
        f"lock der cold {lock['der_cold_myr']:.3f} Myr warm {lock['der_warm_Q30_myr']:.3f}-{lock['der_warm_Q10_myr']:.3f} "
        f"shudder scale {lock['shudder_scaled_from_7myr']:.3f}",
        flush=True,
    )
    return 0


def cmd_capture() -> int:
    doc = calc.run_capture()
    _write("capture.json", doc)
    reached = [t for t in doc["tracks"] if t["reached"]]
    print(f"capture tracks {len(doc['tracks'])} reached_e_0.03 {len(reached)}", flush=True)
    return 0


def cmd_ecc() -> int:
    doc = {"equilibrium": calc.equilibrium_e(), "at_0_20": calc.dependents(0.20), "at_0_15": calc.dependents(0.15), "at_0_10": calc.dependents(0.10)}
    _write("ecc_analytic.json", doc)
    import nbody_run

    scan = nbody_run.scan(years=80.0, epsilon=1e-8)
    _write("ecc_scan.json", scan)
    print(
        f"ecc scan smallest amplitude at e0={scan['smallest_amplitude_e0']} amp={scan['smallest_amplitude']:.4f}",
        flush=True,
    )
    return 0


def cmd_daylen() -> int:
    doc = calc.day_length()
    _write("daylen.json", doc)
    print(
        f"day {doc['ms_per_century']:.2f} ms/century  {doc['seconds_per_millennium']:.3f} s/millennium  "
        f"1 Myr {doc['hours_gained_per_myr_at_present_rate']:.3f} h",
        flush=True,
    )
    return 0


def cmd_catcher() -> int:
    doc = calc.catcher()
    _write("catcher.json", doc)
    print(f"catcher 7 km {doc['g_at_7_km']:.3f} G  8 km {doc['g_at_8_km']:.3f} G", flush=True)
    return 0


def cmd_rebound() -> int:
    import nbody_run

    scan = _read("ecc_scan.json")
    # Recommend the published 0.20 unless the scan's quiet center is far from it
    # AND that center is the one that actually librates. The long run uses 0.20
    # when the 0.20 row librates, because a free eccentricity near 0.20 is the
    # configuration the 20,000 yr integration already held.
    e_run = 0.20
    if scan:
        row20 = next((r for r in scan["rows"] if abs(r["e0"] - 0.20) < 1e-6), None)
        if row20 and not row20["librating"]:
            e_run = float(scan["smallest_amplitude_e0"])
    existing = _read("rebound.json")
    if existing and existing.get("done") and existing.get("years_done", 0) >= 1000 and abs(existing.get("e0", -1) - e_run) < 1e-6:
        print(
            f"rebound resume e={e_run} years={existing['years_done']} err={existing['energy_rel_max']:.3e}",
            flush=True,
        )
        return 0
    doc = nbody_run._integrate_clean(e_run, years=1200.0, sample_yr=2.0, epsilon=1e-9)
    slim = {k: doc[k] for k in doc if k != "meta"}
    slim["meta"] = doc["meta"]
    slim["e0"] = e_run
    slim["done"] = doc["years_done"] >= 1000 and not doc["lost"]
    _write("rebound.json", slim)
    print(
        f"rebound e0={e_run} years={slim['years_done']} phi={slim['phi_deg_min']:.2f}..{slim['phi_deg_max']:.2f} "
        f"e={slim['e_shudder_min']:.4f}-{slim['e_shudder_max']:.4f} err={slim['energy_rel_max']:.3e} "
        f"sep={slim['sep_km_min']:.0f} km wall={slim['wall_s']:.1f}s",
        flush=True,
    )
    return 0 if slim["done"] else 1


def cmd_draft() -> int:
    import apply_draft

    return apply_draft.write_and_verify()


def main(argv: list[str]) -> int:
    if not argv or argv[0] == "selftest":
        return cmd_selftest()
    cmd = argv[0]
    if cmd == "lock":
        return cmd_lock()
    if cmd == "capture":
        return cmd_capture()
    if cmd == "ecc":
        return cmd_ecc()
    if cmd == "daylen":
        return cmd_daylen()
    if cmd == "catcher":
        return cmd_catcher()
    if cmd == "rebound":
        return cmd_rebound()
    if cmd == "draft":
        return cmd_draft()
    print("unknown command " + cmd, flush=True)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
