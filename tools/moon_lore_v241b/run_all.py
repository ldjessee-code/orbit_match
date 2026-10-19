"""Dispatcher for the v2.41b moon-lore calculations.

No arguments: fast self-test. The stop gate runs it that way.
Subcommands: trench, transfers, railgun, catcher, belts, selftest, all, stage, verify.
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


def cmd_selftest() -> int:
    checks = calc.selftest_numbers()
    failed = False
    for name, ok, detail in checks:
        print(("PASS " if ok else "FAIL ") + name + " " + detail, flush=True)
        failed = failed or not ok
    payload = {
        "pass": not failed,
        "checks": [{"name": n, "pass": ok, "detail": d} for n, ok, d in checks],
    }
    _write("selftest.json", payload)
    print("SELFTEST " + ("PASS" if not failed else "FAIL"), flush=True)
    return 1 if failed else 0


def cmd_trench() -> int:
    doc = calc.trench()
    _write("trench.json", doc)
    print(
        f"trench E={doc['capture_energy_j']:.3e} J plausible={doc['plausible']} "
        f"one_quake={doc['single_quake_opens_trench']}",
        flush=True,
    )
    return 0


def cmd_transfers() -> int:
    doc = calc.transfers()
    # The window grid is part of the transfer result.
    sync = doc["sync"]["a_m"]
    doc["windows"] = calc.scan_windows(calc.A_DER, sync)
    _write("transfers.json", doc)
    total = doc["der_to_sync"]["circular_planet_mu"]["total_m_s"]
    print(f"transfers der-to-sync {total:.1f} m/s sync {doc['sync']['a_km']:.2f} km", flush=True)
    return 0


def cmd_railgun() -> int:
    doc = calc.railgun()
    _write("railgun.json", doc)
    shot = doc["sync_shot"]
    print(
        f"railgun v_surface {shot['v_surface_m_s']:.1f} m/s "
        f"swing {shot['swing_deg']:.2f} deg site {shot['site_from_leading_deg']:.2f} deg off leading",
        flush=True,
    )
    return 0


def cmd_catcher() -> int:
    doc = calc.catcher()
    _write("catcher.json", doc)
    g = doc["lengths"]["existing_7_5_km"]["g"]
    print(
        f"catcher arrival {doc['arrival_m_s']:.1f} m/s "
        f"7.5 km funnel {g:.2f} G recommend {doc['recommendation']}",
        flush=True,
    )
    return 0


def cmd_belts() -> int:
    doc = calc.belts()
    _write("belts.json", doc)
    lo, hi = doc["dayside_standoff_rp"]
    print(
        f"belts dayside {lo:.2f}-{hi:.2f} Rp sync {doc['sync_rp']:.2f} Rp {doc['sync_dayside']}",
        flush=True,
    )
    return 0


def cmd_stage() -> int:
    """Copy the read-only v2.41 draft into the job folder. Python only; no shell copy."""
    src = Path(
        r"F:\Dropbox\Projects\Turquenish\systems\tauCet\review"
        r"\moon_orbits_20261008\Tau_Cet_system_v2.41_DRAFT.md"
    )
    dst = calc.JOB_DIR / "Tau_Cet_system_v2.41b_DRAFT.md"
    text = src.read_text(encoding="utf-8")
    dst.write_text(text, encoding="utf-8", newline="\n")
    print(f"staged {dst} bytes {dst.stat().st_size}", flush=True)
    return 0


def cmd_verify() -> int:
    """Same checks as the job's verify_draft.py. Writes results/verify.txt."""
    import re

    draft_p = calc.JOB_DIR / "Tau_Cet_system_v2.41b_DRAFT.md"
    out_p = results_dir() / "verify.txt"
    lines = draft_p.read_text(encoding="utf-8", errors="replace").splitlines()
    dash = r"\s*[-\u2010\u2011\u2012\u2013\u2014~to ]+\s*"
    checks = {
        "60-90 m": re.compile(r"60" + dash + r"90\s*m"),
        "9-30 m bore": re.compile(r"9" + dash + r"30\s*m"),
        "moderate quake": re.compile(r"(?i)moderate[^.|]{0,60}quake|quake[^.|]{0,60}moderate"),
    }
    place = re.compile(r"(?i)\b(yard|haven)\b")
    lpt = re.compile(r"\bL[45]\b")
    neg = re.compile(r"(?i)unstable|unusable|not usable|abandon|former|no longer|rejected|lost|moved|instead|old ")
    hits = []
    for i, line in enumerate(lines, 1):
        if line.strip().startswith("| C"):
            continue
        for key, rx in checks.items():
            if rx.search(line):
                hits.append((key, i))
        if place.search(line) and lpt.search(line) and not neg.search(line):
            hits.append(("Yard/Haven at L4/L5", i))
    hdr = bool(re.search(r"v2\.41b", "\n".join(lines[:60])))
    row = any(line.strip().startswith("| C") and "v2.41b" in line for line in lines)
    ok = not hits and hdr and row
    counts = {key: sum(1 for hit in hits if hit[0] == key) for key in list(checks) + ["Yard/Haven at L4/L5"]}
    report = "VERIFY: %s - banned hits %d (%s); header v2.41b %s; change-log row %s" % (
        "PASS" if ok else "FAIL",
        len(hits),
        ", ".join("%s=%d" % item for item in counts.items()),
        "yes" if hdr else "no",
        "yes" if row else "no",
    )
    detail = report + "\n\nHits (check -> line):\n" + (
        "\n".join("  %s -> line %d" % hit for hit in hits) or "  none"
    ) + "\n"
    out_p.write_text(detail, encoding="utf-8")
    print(report, flush=True)
    return 0 if ok else 1


def main(argv: list[str]) -> int:
    if not argv or argv[0] == "selftest":
        return cmd_selftest()
    cmd = argv[0]
    if cmd == "trench":
        return cmd_trench()
    if cmd == "transfers":
        return cmd_transfers()
    if cmd == "railgun":
        return cmd_railgun()
    if cmd == "catcher":
        return cmd_catcher()
    if cmd == "belts":
        return cmd_belts()
    if cmd == "stage":
        return cmd_stage()
    if cmd == "verify":
        return cmd_verify()
    if cmd == "apply":
        import apply_draft
        return apply_draft.main()
    if cmd == "all":
        code = 0
        for fn in (cmd_trench, cmd_transfers, cmd_railgun, cmd_catcher, cmd_belts):
            code = fn() or code
        return code
    print("unknown command " + cmd, flush=True)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
