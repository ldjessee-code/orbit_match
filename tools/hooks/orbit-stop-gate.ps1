# orbit-stop-gate.ps1 - Stop hook for orbit_match jobs.
# INERT (exit 0, no stdout) unless $env:ORBIT_JOB_DIR is set by that job's launcher.
# On a genuine end_turn, run ORBIT_JOB_VERIFY (default <ORBIT_JOB_DIR>\verify.ps1) with pwsh.
# Exit 0 allows with no stdout. A missing script or a non-zero exit prints
# {"decision":"block","reason":"..."} including the tail of the verify output.
# Any other stop reason is ignored. Log: <ORBIT_JOB_DIR>\orbit-gate.log.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if (-not $env:ORBIT_JOB_DIR -or -not $env:ORBIT_JOB_DIR.Trim()) { exit 0 }

$jobDir = [IO.Path]::GetFullPath($env:ORBIT_JOB_DIR.Trim().Trim('"').Trim("'")).TrimEnd('\')
$verify = if ($env:ORBIT_JOB_VERIFY -and $env:ORBIT_JOB_VERIFY.Trim()) { $env:ORBIT_JOB_VERIFY.Trim().Trim('"').Trim("'") } else { Join-Path $jobDir 'verify.ps1' }
if (-not [IO.Path]::IsPathRooted($verify)) { $verify = Join-Path $jobDir $verify }
try { $verify = [IO.Path]::GetFullPath($verify) } catch {}
$logf = Join-Path $jobDir 'orbit-gate.log'

function Log([string]$m) {
  try { Add-Content -LiteralPath $logf -Value ("[{0}] {1}" -f (Get-Date -Format s), $m) -Encoding utf8 } catch {}
}
function Block([string]$why) {
  Log "BLOCK $why"
  @{ decision = 'block'; reason = "Stop gate: the job is NOT finished. $why Keep working with tool calls; do not reply with text only until this is fixed." } | ConvertTo-Json -Compress
  exit 0
}
function Invoke-Verify([string]$path) {
  $psi = [Diagnostics.ProcessStartInfo]::new('pwsh')
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  if (Test-Path -LiteralPath $jobDir) { $psi.WorkingDirectory = $jobDir }
  foreach ($a in @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $path)) { $psi.ArgumentList.Add($a) }
  $p = [Diagnostics.Process]::Start($psi)
  $oTask = $p.StandardOutput.ReadToEndAsync()
  $eTask = $p.StandardError.ReadToEndAsync()
  if (-not $p.WaitForExit(20000)) {
    try { $p.Kill($true) } catch { try { $p.Kill() } catch {} }
    $null = $p.WaitForExit(5000)
    $timed = ''
    try { $timed = [string]$oTask.Result + [string]$eTask.Result } catch { $timed = $_.Exception.Message }
    return @{ Code = 124; Out = ($timed + "`nverify timed out") }
  }
  $text = ''
  try { $text = [string]$oTask.Result + [string]$eTask.Result } catch { $text = $_.Exception.Message }
  return @{ Code = $p.ExitCode; Out = $text }
}

try {
  $raw = [Console]::In.ReadToEnd()
  $ev = $raw | ConvertFrom-Json
  $reason = [string]$ev.reason
  Log "stop fired reason=$reason stopHookActive=$($ev.stopHookActive)"
  if ($reason -and $reason -notmatch '^(?i)end_turn$') { Log "IGNORE non-end_turn reason=$reason"; exit 0 }
  if ($ev.subagentType) { Log 'IGNORE subagent stop'; exit 0 }
} catch {
  Log "gate error: $($_.Exception.Message)"
  exit 0
}

try {
  if (-not (Test-Path -LiteralPath $verify)) { Block "Verify script is missing: $verify" }
  $result = Invoke-Verify $verify
  if ($result.Code -ne 0) {
    $tail = [string]$result.Out
    if ($tail.Length -gt 1500) { $tail = $tail.Substring($tail.Length - 1500) }
    Block "Verify script failed (exit $($result.Code)): $verify. Tail:`n$tail"
  }
  Log "ALLOW stop: verify exit 0 ($verify)"
  exit 0
} catch {
  Log "gate error: $($_.Exception.Message)"
  @{ decision = 'block'; reason = "Stop gate: the job is NOT finished. The stop gate hit an error and did not get a passing verify: $($_.Exception.Message)" } | ConvertTo-Json -Compress
  exit 0
}
