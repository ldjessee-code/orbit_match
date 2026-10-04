# hooks.tests.ps1 — plain asserts for orbit-guard.ps1 and orbit-stop-gate.ps1.
# Run from anywhere: pwsh -NoProfile -ExecutionPolicy Bypass -File tests\hooks.tests.ps1
# Prints "PASS <name>" or "FAIL <name>". Exits 1 if any check fails. No Pester.
# Uses a temp folder only. Does not read or write live job folders.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$script:fail = 0
$tmp = $null

function Pass([string]$name, [bool]$ok, [string]$detail) {
  if ($ok) { Write-Output "PASS $name"; return }
  $d = ''
  if ($detail) {
    $d = ($detail -replace '[\r\n]+', ' ')
    if ($d.Length -gt 400) { $d = $d.Substring(0, 400) }
    $d = ' ' + $d
  }
  Write-Output "FAIL $name$d"
  $script:fail++
}

function EventJson([string]$tool, $inputObj, [string]$cwd) {
  $o = @{ toolName = $tool; toolInput = $inputObj }
  if ($cwd) { $o['cwd'] = $cwd }
  $o | ConvertTo-Json -Compress -Depth 8
}

function Invoke-Hook([string]$script, [hashtable]$envs, [string]$eventJson) {
  $psi = [Diagnostics.ProcessStartInfo]::new('pwsh')
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  foreach ($a in @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script)) { $psi.ArgumentList.Add($a) }
  foreach ($k in @('ORBIT_JOB_DIR', 'ORBIT_REPO', 'ORBIT_JOB_VERIFY')) {
    $null = $psi.Environment.Remove($k)
  }
  foreach ($k in @($envs.Keys)) { $psi.Environment[$k] = [string]$envs[$k] }
  $p = [Diagnostics.Process]::Start($psi)
  try {
    $p.StandardInput.Write($eventJson)
    $p.StandardInput.Close()
  } catch {
    try { $p.StandardInput.Close() } catch {}
  }
  $oTask = $p.StandardOutput.ReadToEndAsync()
  $eTask = $p.StandardError.ReadToEndAsync()
  if (-not $p.WaitForExit(45000)) {
    try { $p.Kill($true) } catch { try { $p.Kill() } catch {} }
    $null = $p.WaitForExit(5000)
  }
  [pscustomobject]@{
    Out  = [string]$oTask.Result
    Err  = [string]$eTask.Result
    Code = $p.ExitCode
  }
}

function Is-Deny([string]$out) {
  try {
    $j = $out | ConvertFrom-Json
    return ($j.decision -eq 'deny' -and $j.hookSpecificOutput.hookEventName -eq 'PreToolUse' -and $j.hookSpecificOutput.permissionDecision -eq 'deny' -and [string]$j.reason)
  } catch { return $false }
}

function Is-Block([string]$out) {
  try {
    $j = $out | ConvertFrom-Json
    return ($j.decision -eq 'block' -and [string]$j.reason)
  } catch { return $false }
}

function Parse-Errors([string]$path) {
  $e = $null
  $null = [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$null, [ref]$e)
  if (-not $e -or $e.Count -eq 0) { return '' }
  return (($e | ForEach-Object { $_.ToString() }) -join ' | ')
}

try {
  $root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
  $guard = Join-Path $root 'tools\hooks\orbit-guard.ps1'
  $gate = Join-Path $root 'tools\hooks\orbit-stop-gate.ps1'
  $snipPath = Join-Path $root 'tools\hooks\orbit-hooks.json'
  $launcher = Join-Path $root 'launch-tau-ceti.ps1'
  $agents = Join-Path $root 'AGENTS.md'

  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('orbt_' + [guid]::NewGuid().ToString('N'))
  if ($tmp -notlike '*\orbt_*') { throw "refusing to use temp path $tmp" }
  $repoTmp = Join-Path $tmp 'repo'
  $job = Join-Path $tmp 'job'
  New-Item -ItemType Directory -Force -Path (Join-Path $repoTmp 'site'), $job | Out-Null
  $armed = @{ ORBIT_JOB_DIR = $job; ORBIT_REPO = $repoTmp }
  $inside = Join-Path $repoTmp 'site\x.txt'
  $inJob = Join-Path $job 'r.md'
  $outside = 'C:\Windows\orbit-outside.txt'
  $endTurn = '{"reason":"end_turn","stopHookActive":false}'
  $notEnd = '{"reason":"max_turns","stopHookActive":false}'

  $r = Invoke-Hook $guard @{} (EventJson 'write' @{ file_path = $outside; content = 'x' })
  Pass 'guard inert without env' ($r.Code -eq 0 -and [string]::IsNullOrWhiteSpace($r.Out)) "code=$($r.Code) out=$($r.Out) err=$($r.Err)"

  $r = Invoke-Hook $guard $armed (EventJson 'write' @{ file_path = $inside; content = 'x' })
  Pass 'write inside repo allowed' ($r.Code -eq 0 -and [string]::IsNullOrWhiteSpace($r.Out)) "code=$($r.Code) out=$($r.Out) err=$($r.Err)"

  $r = Invoke-Hook $guard $armed (EventJson 'write' @{ file_path = $inJob; content = 'x' })
  Pass 'write inside job dir allowed' ($r.Code -eq 0 -and [string]::IsNullOrWhiteSpace($r.Out)) "code=$($r.Code) out=$($r.Out) err=$($r.Err)"

  $r = Invoke-Hook $guard $armed (EventJson 'write' @{ file_path = $outside; content = 'x' })
  Pass 'write outside denied' ((Is-Deny $r.Out) -and $r.Code -eq 0 -and $r.Out -match 'orbit-outside') "code=$($r.Code) out=$($r.Out)"

  $evilEdit = 'C:\Windows\orbit-edit-outside.txt'
  $r = Invoke-Hook $guard $armed (EventJson 'multiedit' @{
      edits = @(
        @{ file_path = $inside; old_string = 'a'; new_string = 'b' }
        @{ file_path = $evilEdit; old_string = 'a'; new_string = 'b' }
      )
    })
  Pass 'multi-file edit one outside denied' ((Is-Deny $r.Out) -and $r.Code -eq 0 -and $r.Out -match 'orbit-edit-outside') "code=$($r.Code) out=$($r.Out)"

  $patchOutside = 'C:\Windows\orbit-patch-outside.txt'
  $patch = "*** Update File: $inside`n*** Update File: $patchOutside`n"
  $r = Invoke-Hook $guard $armed (EventJson 'apply_patch' @{ patch = $patch })
  Pass 'patch one outside denied' ((Is-Deny $r.Out) -and $r.Code -eq 0 -and $r.Out -match 'orbit-patch-outside') "code=$($r.Code) out=$($r.Out)"

  $r = Invoke-Hook $guard $armed (EventJson 'multiedit' @{
      edits = @(
        @{ file_path = (Join-Path $repoTmp 'site\a.txt') }
        @{ file_path = (Join-Path $repoTmp 'site\b.txt') }
      )
    })
  Pass 'multi-file edit all inside allowed' ($r.Code -eq 0 -and [string]::IsNullOrWhiteSpace($r.Out)) "code=$($r.Code) out=$($r.Out)"

  $r = Invoke-Hook $guard $armed (EventJson 'write' @{ file_path = (Join-Path $repoTmp '.git\HEAD'); content = 'x' })
  Pass 'git dir write denied' ((Is-Deny $r.Out) -and $r.Code -eq 0 -and $r.Out -match '(?i)\.git') "code=$($r.Code) out=$($r.Out)"

  $sibling = $repoTmp + '-evil\x.txt'
  $r = Invoke-Hook $guard $armed (EventJson 'write' @{ file_path = $sibling; content = 'x' })
  Pass 'repo prefix sibling denied' ((Is-Deny $r.Out) -and $r.Code -eq 0 -and $r.Out -match 'repo-evil') "code=$($r.Code) out=$($r.Out)"

  $r = Invoke-Hook $guard $armed (EventJson 'delete_file' @{ file_path = $inside })
  Pass 'delete denied' ((Is-Deny $r.Out) -and $r.Code -eq 0 -and $r.Out -match '(?i)delet') "code=$($r.Code) out=$($r.Out)"

  $r = Invoke-Hook $guard $armed (EventJson 'run_terminal_command' @{ command = 'git commit -m x' })
  Pass 'git commit in shell denied' ((Is-Deny $r.Out) -and $r.Code -eq 0 -and $r.Out -match '(?i)git') "code=$($r.Code) out=$($r.Out)"

  $r = Invoke-Hook $guard $armed (EventJson 'run_terminal_command' @{ command = 'git status' })
  Pass 'git status in shell allowed' ($r.Code -eq 0 -and [string]::IsNullOrWhiteSpace($r.Out)) "code=$($r.Code) out=$($r.Out)"

  $r = Invoke-Hook $guard $armed (EventJson 'run_terminal_command' @{ command = 'Remove-Item C:\Windows\orbit-no-delete.txt' })
  Pass 'shell delete denied' ((Is-Deny $r.Out) -and $r.Code -eq 0 -and $r.Out -match '(?i)delet') "code=$($r.Code) out=$($r.Out)"

  $r = Invoke-Hook $guard $armed (EventJson 'write' @{ file_path = 'site\rel.txt'; content = 'x' } $repoTmp)
  Pass 'relative write inside repo allowed' ($r.Code -eq 0 -and [string]::IsNullOrWhiteSpace($r.Out)) "code=$($r.Code) out=$($r.Out) err=$($r.Err)"

  $r = Invoke-Hook $gate @{} $endTurn
  Pass 'stop gate inert without env' ($r.Code -eq 0 -and [string]::IsNullOrWhiteSpace($r.Out)) "code=$($r.Code) out=$($r.Out) err=$($r.Err)"

  $okScript = Join-Path $job 'v_ok.ps1'
  $badScript = Join-Path $job 'v_fail.ps1'
  $defaultScript = Join-Path $job 'verify.ps1'
  Set-Content -LiteralPath $okScript -Value "Write-Output 'verify-ok'; exit 0" -Encoding utf8
  Set-Content -LiteralPath $badScript -Value "Write-Output 'ORBIT_VERIFY_FAIL_MARKER'; exit 1" -Encoding utf8
  Set-Content -LiteralPath $defaultScript -Value "Write-Output 'verify-default-ok'; exit 0" -Encoding utf8

  $r = Invoke-Hook $gate @{ ORBIT_JOB_DIR = $job; ORBIT_REPO = $repoTmp; ORBIT_JOB_VERIFY = $okScript } $endTurn
  Pass 'verify exit 0 allows' ($r.Code -eq 0 -and [string]::IsNullOrWhiteSpace($r.Out)) "code=$($r.Code) out=$($r.Out) err=$($r.Err)"

  $r = Invoke-Hook $gate @{ ORBIT_JOB_DIR = $job; ORBIT_REPO = $repoTmp; ORBIT_JOB_VERIFY = $badScript } $endTurn
  Pass 'verify exit 1 blocks' ((Is-Block $r.Out) -and $r.Code -eq 0 -and $r.Out -match 'ORBIT_VERIFY_FAIL_MARKER') "code=$($r.Code) out=$($r.Out)"

  $missing = Join-Path $job 'missing-verify.ps1'
  $r = Invoke-Hook $gate @{ ORBIT_JOB_DIR = $job; ORBIT_REPO = $repoTmp; ORBIT_JOB_VERIFY = $missing } $endTurn
  Pass 'missing verify blocks' ((Is-Block $r.Out) -and $r.Code -eq 0 -and $r.Out -match '(?i)missing') "code=$($r.Code) out=$($r.Out)"

  $r = Invoke-Hook $gate @{ ORBIT_JOB_DIR = $job; ORBIT_REPO = $repoTmp; ORBIT_JOB_VERIFY = $badScript } $notEnd
  Pass 'non-end_turn ignored' ($r.Code -eq 0 -and [string]::IsNullOrWhiteSpace($r.Out) -and $r.Out -notmatch 'ORBIT_VERIFY_FAIL_MARKER') "code=$($r.Code) out=$($r.Out)"

  $r = Invoke-Hook $gate @{ ORBIT_JOB_DIR = $job; ORBIT_REPO = $repoTmp } $endTurn
  Pass 'default verify.ps1 allows' ($r.Code -eq 0 -and [string]::IsNullOrWhiteSpace($r.Out)) "code=$($r.Code) out=$($r.Out) err=$($r.Err)"

  $launchLines = @(Get-Content -LiteralPath $launcher)
  Pass 'launcher is 3 lines' ($launchLines.Count -eq 3) "count=$($launchLines.Count)"
  $launchErr = Parse-Errors $launcher
  Pass 'launcher parses' ($launchErr -eq '') $launchErr
  $launchRaw = Get-Content -LiteralPath $launcher -Raw
  Pass 'launcher targets tau ceti' ($launchRaw.Contains('start-grok-run.ps1') -and $launchRaw.Contains('rebound_tau_ceti\launch.ps1')) 'missing start-grok-run.ps1 or tasks\rebound_tau_ceti\launch.ps1'
  Pass 'launcher forwards Continue and PromptFile' ($launchRaw.Contains('$Continue') -and $launchRaw.Contains('$PromptFile') -and $launchRaw.Contains('PSBoundParameters')) 'param or splat missing'

  $guardErr = Parse-Errors $guard
  Pass 'guard script parses' ($guardErr -eq '') $guardErr
  $gateErr = Parse-Errors $gate
  Pass 'stop gate script parses' ($gateErr -eq '') $gateErr

  $snipOk = $false
  $snipDetail = ''
  try {
    $snip = Get-Content -LiteralPath $snipPath -Raw | ConvertFrom-Json
    $preHook = @(@($snip.hooks.PreToolUse)[0].hooks)[0]
    $stopHook = @(@($snip.hooks.Stop)[0].hooks)[0]
    $preCmd = [string]$preHook.command
    $stopCmd = [string]$stopHook.command
    $snipOk = ($preCmd -match 'orbit-guard\.ps1') -and ($stopCmd -match 'orbit-stop-gate\.ps1') -and ($preHook.type -eq 'command') -and ($stopHook.type -eq 'command')
    if (-not $snipOk) { $snipDetail = "pre=$preCmd stop=$stopCmd" }
  } catch { $snipDetail = $_.Exception.Message }
  Pass 'orbit-hooks.json registers guard and stop' $snipOk $snipDetail

  if (-not (Test-Path -LiteralPath $agents)) {
    Pass 'AGENTS.md has required words' $false 'AGENTS.md missing'
  } else {
    $agentsTxt = Get-Content -LiteralPath $agents -Raw
    $missingWords = @()
    foreach ($k in @('GitHub Pages', 'three.js', 'Babylon', 'Blender', 'glTF', 'WebAssembly', 'test', 'commit')) {
      if ($agentsTxt -notmatch "(?i)$([regex]::Escape($k))") { $missingWords += $k }
    }
    Pass 'AGENTS.md has required words' ($missingWords.Count -eq 0) ($missingWords -join ', ')
  }
} catch {
  Pass 'uncaught' $false $_.Exception.Message
} finally {
  if ($tmp -and ($tmp -like '*\orbt_*') -and (Test-Path -LiteralPath $tmp)) {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

if ($script:fail -gt 0) { exit 1 }
exit 0
