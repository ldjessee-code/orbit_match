# Orbit Match — agent notes

Static web app in `site/`. GitHub Pages publishes that folder (`.github/workflows/pages.yml`, Pages source = GitHub Actions). Live page: https://ldjessee-code.github.io/orbit_match/

Design context: `README.md`, `BRIEF.md`, `GAME_SYSTEMS.md`, `INTERCONNECT.md`.

## Stack

HTML, CSS, and JavaScript. The Pages workflow uploads `site/` as-is. Do not add a package install or a bundler.

Use WebAssembly where it pays off: a hot numeric kernel (a transfer integrator) after the same function is correct in JavaScript and a profile shows the cost. Keep the JavaScript version as the reference.

3D is three.js, vendored under `site/` and loaded with a script tag.

Babylon.js is the runner-up. Reconsider it when a feature needs an engine (physics, collision, inspector, or GUI) and the glue around three.js would be larger than the rendering. Do not switch for one scene.

Blender is for authoring custom models only. Export glTF binary (`.glb`) into the site assets, for example `site/models/`. The published site does not run Blender.

## Tests first

Every change starts with a failing check, then the code that makes it pass.

From the repo root:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File tests\hooks.tests.ps1
```

`tests\hooks.tests.ps1` is plain asserts (no Pester). It prints `PASS <name>` or `FAIL <name>` and exits 1 if any check fails. Hook, launcher, and `AGENTS.md` changes are not done until that command exits 0.

When `test\` has Node tests, also run `node --test test/` (Node built-ins only). No installs during a job.

## Git

Bots and Grok Build commit and push only to `review`. Before committing, check `git branch --show-current` is `review`. Make small commits, one per section or change, with a conventional message. Never commit or push to `main` or `master`. Never merge, rebase, force-push, or delete branches. Doug merges and may cherry-pick. Read-only git (`status`, `diff`, `log`, `show`) is fine. Do not write under `.git\`.

## Job folders

New orbit jobs live in `F:\Dropbox\TheCourt\research\_jobs\orbit_match\<job>\`. Put the brief, `verify.ps1`, `run.log`, and the report there.

`tasks\<job>\` is the older in-repo pattern. The Tau Ceti REBOUND sim stays at `tasks\rebound_tau_ceti\`. Do not put new orbit jobs there, and do not edit that folder's `launch.ps1` to arm the orbit hooks.

## Launch the Tau Ceti run

```powershell
pwsh -NoProfile -File C:\Users\DougJ\Documents\GitHub\orbit_match\launch-tau-ceti.ps1
pwsh -NoProfile -File C:\Users\DougJ\Documents\GitHub\orbit_match\launch-tau-ceti.ps1 -Continue -PromptFile <prompt.md>
```

`launch-tau-ceti.ps1` calls `F:\Dropbox\TheCourt\tools\start-grok-run.ps1 -Launch` on `tasks\rebound_tau_ceti\launch.ps1`, minimized, and forwards `-Continue` and `-PromptFile` when they are set. That sim launcher arms the court sim hooks (`GROK_SJOB_*`). It does not set `ORBIT_*`.

Do not start a nested Grok run from inside a job.

## Hooks

| File | Role |
| --- | --- |
| `tools\hooks\orbit-guard.ps1` | PreToolUse |
| `tools\hooks\orbit-stop-gate.ps1` | Stop |
| `tools\hooks\orbit-hooks.json` | Registration snippet, same shape as `C:\Users\DougJ\.grok\hooks\unattended-job-gate.json` |

The orbit job launcher merges `orbit-hooks.json` into `unattended-job-gate.json` after tests pass, and keeps a backup. A bot does not edit `C:\Users\DougJ\.grok\` itself.

Both scripts are inert (exit 0, no stdout) unless `ORBIT_JOB_DIR` is set. A new orbit launcher sets these in its own process before `grok.exe` (do this in the new launcher, not in `tasks\rebound_tau_ceti\launch.ps1`):

```powershell
$env:ORBIT_JOB_DIR = 'F:\Dropbox\TheCourt\research\_jobs\orbit_match\<job>'
$env:ORBIT_REPO = 'C:\Users\DougJ\Documents\GitHub\orbit_match'   # optional; this is the default
$env:ORBIT_JOB_VERIFY = Join-Path $env:ORBIT_JOB_DIR 'verify.ps1'  # optional; this is the default
```

Stdin is the hook event JSON (`toolName`, `toolInput`, `cwd`, `reason`, and the common fields in `C:\Users\DougJ\.grok\docs\user-guide\10-hooks.md`).

When armed, `orbit-guard.ps1`:

- Allows a write, edit, or patch only when every path (including each file in a multi-file edit or patch) is inside `ORBIT_REPO` or `ORBIT_JOB_DIR`.
- Denies any path under `.git\`.
- Denies deletes, including delete/rename/move file tools, a patch that deletes a file, and shell `Remove-Item` / `del` / `rm`.
- Denies git write commands in shell tools (`run_terminal_command` and the usual aliases).
- Deny shape, then exit 0: `{"decision":"deny","reason":"...","hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}`.
- Logs to `<ORBIT_JOB_DIR>\orbit-guard.log`.

When armed, `orbit-stop-gate.ps1` logs to `<ORBIT_JOB_DIR>\orbit-gate.log`. On a genuine `end_turn` it runs `ORBIT_JOB_VERIFY` with `pwsh`. Exit 0 allows (exit 0, no stdout). A non-zero exit or a missing script prints `{"decision":"block","reason":"..."}` and includes the tail of the verify output. Any other stop reason is ignored. A subagent stop is ignored.

## Todos

Port follow-ups stay in `TODO_PORTS.md`. Do not hardcode the Jumpgate Starroute URL (`127.0.0.1:8080` in `BRIEF.md` is stale). Doug decides the port pair. The note there suggests jumpgate_starroute 8130 and orbit_match 8131, outside the gamer_eye block 8050-8119.
