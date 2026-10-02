# Grok Build task: REBOUND stability check of the Tau Ceti system

Written 2026-09-30 by Doug's court bot, for one unattended headless run on PC-NorCal. (Launcher and shell rules updated 2026-09-30 by notLloyd: see Doug's setup and Limits.)

> **This is a single headless run. Any reply without a tool call ends the run. Never announce a next step in text; just make the tool call. Only send a text-only reply after the output file is written.**

## Autonomy level

**Autopilot.** Write and run Python in the job folder, make plots, write the report. No questions back to Doug; there is nobody watching. Where the source doc is silent, pick a documented default, say so in the report, and keep going.

## Goal (why Doug wants this)

The Tau Ceti setting doc (`Tau_Cet_system_v2.md`, Draft v2.40) places eight planets and two moons of Kakakiko by hand, and checks stability only with mutual-Hill rules of thumb. Its own notes say "tC 6–7 is the tightest pair, so an N-body check is recommended before locking giant masses." Doug wants a real N-body check with REBOUND. It should say which Locked or estimated values hold up and which are at risk, so he can decide before locking more numbers. **The report informs; it does not change the setting doc.**

## Start here (read first)

1. The source doc (read only, never edit):
   `F:\Dropbox\Projects\Turquenish\systems\tauCet\Tau_Cet_system_v2.md`
   (Dropbox path `/Projects/Turquenish/systems/tauCet/Tau_Cet_system_v2.md`). It is long (~1,060 lines, ~200 KB). Read these sections: §4 Star (lines ~48–66), §5 System overview (~70–87), §6.1–6.5 (~89–130), the moons tC 5a Shudder and tC 5b Der Eindringling (~282–340), §6.6–6.8 giants (~464–530), §7a realism pass and stability (~560–607), §12 Known tensions (~730–757). If line numbers have shifted, search for the headings.
2. The starting values below were extracted from v2.40 on 2026-09-30. **Re-check each against the doc before using it.** If the doc now differs, use the doc's value and note the change in the report.

| Body | a | e | Mass | Doc tag / note |
|---|---|---|---|---|
| Star τ Cet | — | — | **0.78 M☉** | real; doc uses 0.78 for everything |
| tC 1 Gane | 0.133 AU | `TBD` in doc | ~0.06 M⊕ | est. |
| tC 2 Hornstooth | 0.243 AU | not given | ~0.08 M⊕ | est. |
| tC 3 Husk | 0.34 AU | not given | ~0.10 M⊕ | est. |
| tC 4 Sable | 0.538 AU | **≤ 0.1** (Locked, near-circular) | **2 M⊕** (Locked) | |
| tC 5 Kakakiko | **0.71 AU** | **0.0396** (Locked) | 1.045 M⊕ (6.243×10²⁴ kg) | est., derived |
| tC 5a Shudder (Moon I, formerly "Tumbleweed") | 251,350 km from Kakakiko | 0.20 | 1.491×10²² kg | est., derived "2:1 with Der"; P 14.18 d |
| tC 5b Der Eindringling | 400,000 km from Kakakiko | 0.03 | **1/100 of Kakakiko** = 6.243×10²² kg | ratio Locked; P 28.36 d |
| tC 6 Croquet Ball | ~2.8 AU | not given | ~95 M⊕ (Saturn-like, est.) | |
| tC 7 Cue Ball | ~5.5 AU | not given | ~17 M⊕ (Neptune-like, est.) | |
| tC 8 Eight Ball | ~9.2 AU | not given | **~13 M⊕** (Locked) | |

Other facts from the doc:
- The moons orbit prograde, near Kakakiko's equatorial plane. Kakakiko's axial tilt is 12°.
- **"Tumbleweed" is the old name of Shudder (Moon I).** So "Der Eindringling's 2:1 resonance with Tumbleweed" means the Shudder–Der 2:1 mean-motion resonance (Locked concept). The doc says the two moons line up only when Shudder is at perigee (GJ 876 c/b-style architecture). It also says they are 2.85 mutual Hill radii apart and come within 1.65 mutual Hill radii, so without the resonance they would not be stable.
- The doc puts the Kakakiko–Der L4 ("Yard", leading) and L5 ("Haven", trailing) habitats 400,000 km from both. Croquet Ball's L4/L5 hold the jump gate (which one is still TBD) and a Trojan swarm.
- The doc's mutual-Hill spacings: Gane–Hornstooth 103.7, Hornstooth–Husk 54.2, Husk–Sable 32.4, Sable–Kakakiko 17.5, Kakakiko–Croquet 23.9, Croquet–Cue 12.4, Cue–Eight 14.9.

## Doug's setup

- Windows PC, Python 3.13 (`python`, user install under `C:\Users\DougJ\AppData\Local\Programs\Python\Python313`). numpy 2.5.2 is installed. **rebound 5.2.1 and matplotlib 3.11.2 were installed on 2026-09-30 before this run** (`python -m pip install --user rebound matplotlib`, verified with `import rebound, matplotlib`).
- Job folder (your working area): `C:\Users\DougJ\Documents\GitHub\orbit_match\tasks\rebound_tau_ceti\` (relative to the repo root: `tasks/rebound_tau_ceti/`). The repo is Doug's `orbit_match` git repo (a web tool). Do not touch its existing files.
- Shell rules (enforced by a guard hook; a refused command is reported back to you and is NOT fatal, so just adjust and make your next tool call):
  - Allowed: `python <script>.py` for scripts that live in `tasks\rebound_tau_ceti\`, `python -c "..."`, `python -m pip list|show`, read-only git (`git status|diff|log|show`), read-only listing (`Get-ChildItem`, `Get-Content`, `Select-String`, `Test-Path`), `Start-Sleep`, and `mkdir` / `Remove-Item` / `Move-Item` on paths inside `tasks\rebound_tau_ceti\` only.
  - Refused: any install (`pip install` etc.), network shell tools, `Start-Process`, git writes (add/commit/push/reset/checkout...), deleting or moving anything outside the job folder, and output redirection from shell (use your write tool).
  - Python code is scanned before it runs (the `-c` text, the entry script, and every `.py` in the job folder): no `subprocess`/`os.system`, no network modules, and **a script that writes files must not name any `Turquenish` path**. Read the setting doc with your read_file tool (or a read-only script), and write the Dropbox report copy with your write tool, not with python.
  - Run one simulation chunk per shell command and keep each under ~10 minutes of wall time (checkpoint and resume).
- You can fetch the REBOUND docs (https://rebound.readthedocs.io/) if the installed API differs from what you expect. Check `rebound.__version__` first; 5.x may rename things relative to 3.x/4.x examples.

## Steps

0. **Pre-flight.** Run `python -c "import rebound, matplotlib; print(rebound.__version__, matplotlib.__version__)"`. Both are already installed; do not run pip install (it is refused). If the import fails, write both report files with a "BLOCKED: import failed" section that includes the error, end them with `RUN FINISHED`, and stop.
1. **Model builder.** Write `tasks/rebound_tau_ceti/tau_ceti_model.py`. Use units `('yr', 'AU', 'Msun')`, star 0.78 M☉, and the table above (after re-checking it against the doc). Defaults where the doc is silent (state each one in the report): e = 0 for Gane, Hornstooth, Husk and the three giants in the baseline; coplanar orbits; random mean longitudes with a fixed seed. Move to the center-of-mass frame.
2. **Runs.** For each run, record the integrator, timestep, simulated span, wall time, and the relative energy error. Use WHFast (timestep ≤ 1/20 of the shortest orbital period in that run). Switch to MERCURIUS, or IAS15/TRACE for the moon runs, where close encounters or hierarchical moons make WHFast unsuitable. Put an ejection/close-encounter stop in every run (a planet's distance leaving [0.5a, 2a], or Hill-radius encounters). Save checkpoints, so that **no single python command runs longer than ~10 minutes of wall time**. Split long integrations into chunks and resume from the archive. Total compute budget: about 5 hours of wall time. Go as long as the budget allows, from 1 Myr up to 100 Myr, and report the span reached.
   - **A. Giant pair / outer system.** Star + Kakakiko + Croquet + Cue + Eight, with the inner planets' mass folded into the star. Target **100 Myr**. Track a, e, and the Croquet–Cue period ratio and minimum separation. Also run MEGNO (or a shadow-particle Lyapunov estimate) over ≥ 1 Myr. Sensitivity runs: giant e = 0.05, and Cue Ball at 1.5× mass. This answers "is the giant pair stable?"
   - **B. Full planetary system.** All eight planets. Target 1–10 Myr, as far as the budget allows. **Kakakiko's eccentricity:** plot e(t), and report its min, max, and secular period. Report whether it stays near the Locked 0.0396, or its range if it oscillates. Run Sable at e = 0.1 (worst case of its Locked limit) and at e = 0.05. Report the Sable–Kakakiko closest approach.
   - **C. Kakakiko moon system.** Star + Sable + Kakakiko + Shudder + Der + Croquet Ball (the other planets are negligible at moon scale; justify this in a sentence). Use planetocentric initial conditions. Integrate as long as is practical (aim for ≥ 10⁴ yr; go further if feasible). Report Der's a/e/i ranges and whether it stays bound (compare with Kakakiko's Hill radius). **Der–Shudder 2:1 resonance:** track the resonant angles φ₁ = 2λ_Der − λ_Shudder − ϖ_Shudder and φ₂ = 2λ_Der − λ_Shudder − ϖ_Der. Say whether each librates (and about what center, with what amplitude) or circulates. Check whether the doc's "line up only at Shudder's perigee" holds. If the doc's a, e values do not start in resonance, report that plainly. Then *separately* try a nudged configuration (for example, Shudder's a tuned to the exact 2:1 period ratio, with φ₁ started at 0). Label it as a suggestion, not the doc's value. Variant: moon plane tilted 12° to Kakakiko's orbit (the equatorial plane).
   - **D. Trojan test particles.**
     - Croquet Ball L4 and L5: in model A's setup (or A plus Kakakiko and Sable), place ≥ 20 massless particles per point in a small cloud around L4 and L5 (a spread of ±0.01 AU, ±5° in longitude). Target the same span as A. Report the surviving fraction at the end, the libration amplitudes, and any losses caused by Cue Ball.
     - Kakakiko–Der L4 ("Yard") and L5 ("Haven"): in model C, place ≥ 20 massless particles per point in a small cloud. Report the survival and libration amplitudes over run C's span, and note the Routh criterion (Kakakiko/Der = 100 > 24.96). Include Shudder's perturbation; that is the real question.
3. **Plots** (PNG in `tasks/rebound_tau_ceti/plots/`): giant a/e vs time; Croquet–Cue period ratio and separation; Kakakiko e(t); Der and Shudder a/e vs time; the resonant angles φ₁, φ₂ vs time; Trojan clouds in the co-rotating frame (Croquet L4/L5, Der L4/L5); energy error vs time for each run.

## Output

- Report: `C:\Users\DougJ\Documents\GitHub\orbit_match\tasks\rebound_tau_ceti\Tau_Cet_rebound_stability_20260930.md` (the run date is fixed as 20260930, even if the run passes midnight). Structure:
  1. **Answer first:** one paragraph with a verdict on each of the five checks (giant pair, Kakakiko e, Der's orbit, the four Lagrange-point clouds, the Der–Shudder 2:1). Label each "stable / marginal / unstable / not tested", with the span reached.
  2. A table of inputs: each value, whether it came from the doc (with its tag: Locked / est. / not given) or is a default chosen here.
  3. One section per check, with numbers, the plots inlined as relative links, the integrator, dt, span, and energy error.
  4. **Measured vs estimated:** keep what the simulation showed separate from anything inferred or extrapolated beyond the span reached.
  5. **Suggestions for Doug:** which Locked/est. values the results support or put at risk, and any nudged values (clearly labeled as suggestions). Do not edit the setting doc.
  6. Sources: the setting doc path and version, the REBOUND version, and any docs pages opened (split into "opened and verified" and "search-indexed only").
  7. Reproduce: the exact python commands, in order.
- **Copy of the report:** write the same markdown (with plot links changed to absolute `C:\Users\DougJ\Documents\GitHub\orbit_match\tasks\rebound_tau_ceti\plots\...` paths or plain file names) to exactly `F:\Dropbox\Projects\Turquenish\review\Tau_Cet_rebound_stability_20260930.md`, **using your write tool** (not python). This is the only file you may create or edit under `F:\Dropbox\Projects\Turquenish\`; never touch anything else in that folder. You may re-write this one file when you update the report. If the write is refused, say so at the top of the repo report ("Dropbox copy NOT written: <reason>") and continue.
- **Both report files must end with the line `RUN FINISHED`** and must not contain the text `(pending)`. A stop gate checks this and will send you back to work if either is missing. Write the report early with partial results and keep updating it; do not use `(pending)` placeholders.
- Your final text-only reply (only after both report files are written) must be: the Dropbox report path on one line, then `RUN FINISHED` as the very last line, with nothing after it.

## Limits

- **Never edit, move, or delete anything under `F:\Dropbox\Projects\Turquenish\`**, except creating the one new report copy in `review\`. The setting docs are read-only.
- Write only inside `tasks/rebound_tau_ceti/` in the repo (scripts, `plots/`, checkpoints, the report), plus that one Dropbox copy. Do not modify existing repo files. No git add/commit/push.
- No installs (rebound and matplotlib are already installed), signups, purchases, or messages.
- Keep checkpoint/archive files under ~500 MB in total. Delete your own scratch checkpoints at the end if they are larger than that, and keep the final ones.
- Turn cap: the launch line sets `--max-turns 250`. By about 80% of the turn cap or of the 5-hour compute budget, whichever comes first, stop starting new runs and write the report with partial results. Mark which checks are incomplete and how far each got. A partial report beats no report.
- If a check can't be done (for example, a doc value is missing), write "not tested: <reason>". Never invent a doc value; defaults must be labeled as defaults.
