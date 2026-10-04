param([switch]$Continue, [string]$PromptFile)
# launch.ps1 - UNATTENDED Grok Build SIMULATION run: REBOUND n-body stability check of the Tau Ceti setting.
# Job owner: LadyT (Turquenish bot), approved by Doug. Rewritten by notLloyd 2026-09-30 (LadyT's original:
# launch.ps1.orig_20260930 next to this file).
# Open in a visible PowerShell 7 window (what notLloyd runs):
#   Start-Process pwsh -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File','C:\Users\DougJ\Documents\GitHub\orbit_match\tasks\rebound_tau_ceti\launch.ps1'
# Continuation after an early stop (same session, new instruction file in this folder):
#   Start-Process pwsh -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File','C:\Users\DougJ\Documents\GitHub\orbit_match\tasks\rebound_tau_ceti\launch.ps1','-Continue','-PromptFile','C:\Users\DougJ\Documents\GitHub\orbit_match\tasks\rebound_tau_ceti\continue1_20260930.md'
#
# Pattern copied from F:\Dropbox\TheCourt\research-grok\patreon-member-attach-fix\launch.ps1 and indie-ios-deep-dive\launch.ps1:
#  * --always-approve + --deny rules, NOT --permission-mode dontAsk (a dontAsk decline silently ends a headless
#    run with exit 0; a deny / hook deny is reported to the model and the run continues).
#  * Simulation variant: shell allowed but narrowed by the sim hooks (sim-guard.ps1 / sim-stop-gate.ps1 in
#    F:\Dropbox\TheCourt\research-grok\_hooks\), registered in C:\Users\DougJ\.grok\hooks\unattended-job-gate.json
#    and armed only by the GROK_SJOB_* variables below (process-scoped). The repo-job and research hooks stay inert.
#  * Writes: only tasks\rebound_tau_ceti\ and the one report file in F:\Dropbox\Projects\Turquenish\review\.
#  * Fixed --session-id (session-id.txt); fixed report date (run-date.txt); run.log is appended, never overwritten.
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'
$repo    = 'C:\Users\DougJ\Documents\GitHub\orbit_match'
$dir     = Join-Path $repo 'tasks\rebound_tau_ceti'
$turq    = 'F:\Dropbox\Projects\Turquenish'
$grok    = 'C:\Users\DougJ\.grok\bin\grok.exe'
$brief   = Join-Path $repo 'tasks\rebound_tau_ceti.md'
$log     = Join-Path $dir 'run.log'
$sidf    = Join-Path $dir 'session-id.txt'
$datef   = Join-Path $dir 'run-date.txt'
$hookCfg = 'C:\Users\DougJ\.grok\hooks\unattended-job-gate.json'
$hookDir = 'F:\Dropbox\TheCourt\research-grok\_hooks'
$title = 'Grok Build - REBOUND Tau Ceti stability (unattended sim, LadyT)'
if ($Continue) { $title += ' [continue]' }
try { $Host.UI.RawUI.WindowTitle = $title } catch {}

if ($Continue -and -not $PromptFile) { Write-Host 'Continue needs -PromptFile.'; return }
$prompt = if ($Continue) { $PromptFile } else { $brief }
foreach ($p in @($repo, $dir, $grok, $prompt, $hookCfg, (Join-Path $hookDir 'sim-guard.ps1'), (Join-Path $hookDir 'sim-stop-gate.ps1'), (Join-Path $turq 'systems\tauCet\Tau_Cet_system_v2.md'), (Join-Path $turq 'review'))) {
  if (-not (Test-Path -LiteralPath $p)) { "[$(Get-Date -Format s)] MISSING: $p - not launching." | Tee-Object -FilePath $log -Append; return }
}
if (-not (Select-String -LiteralPath $hookCfg -Pattern 'sim-guard.ps1' -SimpleMatch -Quiet)) { "[$(Get-Date -Format s)] sim hooks not registered in $hookCfg - not launching." | Tee-Object -FilePath $log -Append; return }
if (-not (Test-Path -LiteralPath $sidf))  { Set-Content -LiteralPath $sidf  -Value ([guid]::NewGuid().ToString()) -NoNewline }
if (-not (Test-Path -LiteralPath $datef)) { Set-Content -LiteralPath $datef -Value (Get-Date -Format yyyyMMdd) -NoNewline }
$sid  = (Get-Content -LiteralPath $sidf -Raw).Trim()
$date = (Get-Content -LiteralPath $datef -Raw).Trim()
$report     = Join-Path $turq "review\Tau_Cet_rebound_stability_$date.md"
$repoReport = Join-Path $dir "Tau_Cet_rebound_stability_$date.md"

# Arm only the simulation hooks (process-scoped); keep repo-job and research hooks inert.
Remove-Item Env:GROK_JOB_DIR, Env:GROK_JOB_REPO, Env:GROK_JOB_REPORT, Env:GROK_RJOB_DIR, Env:GROK_RJOB_OUTDIR, Env:GROK_RJOB_REPORT -ErrorAction SilentlyContinue
$env:GROK_SJOB_DIR = $dir; $env:GROK_SJOB_REPO = $repo; $env:GROK_SJOB_REPORT = $report; $env:GROK_SJOB_REPORT2 = $repoReport
$env:GROK_SJOB_RO = $turq   # everything under Turquenish is read-only except $report (guard enforces)

# Hard denies for every Turquenish entry except review\ (a deny would also cover the one allowed report file).
$turqDeny = foreach ($e in Get-ChildItem -LiteralPath $turq -Force | Where-Object { $_.Name -ne 'review' }) {
  $pat = if ($e.PSIsContainer) { "$($e.FullName)\**" } else { $e.FullName }
  "--deny"; "Write($pat)"; "--deny"; "Edit($pat)"
}

$sessionArgs = if ($Continue) { @('--resume', $sid) } else { @('--session-id', $sid) }
"[$(Get-Date -Format s)] start mode=$(if($Continue){'continue'}else{'new'}) session=$sid prompt=$prompt report=$report" | Tee-Object -FilePath $log -Append
Set-Location -LiteralPath $repo
& $grok @sessionArgs --cwd $repo --prompt-file $prompt --always-approve `
  --deny 'MCPTool(*)' @turqDeny `
  --deny 'Read(**/.env*)' --deny 'Edit(**/.env*)' --deny 'Write(**/.env*)' `
  --deny 'Read(**/.ssh/**)' --deny 'Read(**/*cookie*)' --deny 'Read(C:\Users\DougJ\.grok\**)' `
  --deny 'Read(**/.git/**)' --deny 'Edit(**/.git/**)' --deny 'Write(**/.git/**)' `
  --deny 'Bash(*pip install*)' --deny 'Bash(*pip.exe install*)' --deny 'Bash(*pip3 install*)' --deny 'Bash(*uv pip*)' `
  --deny 'Bash(npm*)' --deny 'Bash(npx*)' --deny 'Bash(winget*)' --deny 'Bash(choco*)' `
  --deny 'Bash(*curl*)' --deny 'Bash(*wget*)' --deny 'Bash(*Invoke-WebRequest*)' --deny 'Bash(*Invoke-RestMethod*)' `
  --deny 'Bash(iwr *)' --deny 'Bash(irm *)' --deny 'Bash(*Start-BitsTransfer*)' --deny 'Bash(ssh *)' --deny 'Bash(scp *)' `
  --deny 'Bash(*Start-Process*)' --deny 'Bash(*Set-ExecutionPolicy*)' --deny 'Bash(*schtasks*)' `
  --deny 'Bash(*Turquenish*Remove-Item*)' --deny 'Bash(*Remove-Item*Turquenish*)' `
  --deny 'Bash(git add*)' --deny 'Bash(git commit*)' --deny 'Bash(git push*)' `
  --deny 'Bash(git checkout*)' --deny 'Bash(git switch*)' --deny 'Bash(git reset*)' `
  --deny 'Bash(git restore*)' --deny 'Bash(git stash*)' --deny 'Bash(git clean*)' `
  --deny 'Bash(git rm*)' --deny 'Bash(git mv*)' --deny 'Bash(git merge*)' `
  --deny 'Bash(git rebase*)' --deny 'Bash(git pull*)' --deny 'Bash(git fetch*)' `
  --deny 'Bash(git tag*)' --deny 'Bash(git config*)' --deny 'Bash(git apply*)' `
  --deny 'Bash(git cherry-pick*)' --deny 'Bash(git worktree*)' --deny 'Bash(git branch -*)' `
  --max-turns 250 2>&1 | Tee-Object -FilePath $log -Append
$code = $LASTEXITCODE
# Post-run checks go to postrun.log + the screen, so run.log itself ends with the agent's own last line (RUN FINISHED).
$post = Join-Path $dir 'postrun.log'
"[$(Get-Date -Format s)] session=$sid exit code $code" | Tee-Object -FilePath $post -Append
foreach ($r in @($report, $repoReport)) {
  if (Test-Path -LiteralPath $r) {
    $pending = Select-String -LiteralPath $r -Pattern '\(pending\)' -Quiet
    $done = Select-String -LiteralPath $r -Pattern 'RUN FINISHED' -SimpleMatch -Quiet
    "Report: $r  (pending sections: $pending, RUN FINISHED line: $done)" | Tee-Object -FilePath $post -Append
  } else { "WARNING: expected report not found: $r (exit code 0 is not proof of work)" | Tee-Object -FilePath $post -Append }
}
$last = (Get-Content -LiteralPath $log -Tail 5 | Where-Object { $_.Trim() }) | Select-Object -Last 1
if ($last -notmatch 'RUN FINISHED') { "WARNING: run.log does not end with RUN FINISHED (last line: '$last') - the run may have stopped early; continue with -Continue -PromptFile (see header)." | Tee-Object -FilePath $post -Append }
else { "run.log ends with RUN FINISHED." | Tee-Object -FilePath $post -Append }
Write-Host 'Run ended. This window stays open.'
