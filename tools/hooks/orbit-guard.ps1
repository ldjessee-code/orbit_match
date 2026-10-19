# orbit-guard.ps1 - PreToolUse guard for orbit_match jobs.
# INERT (exit 0, no stdout) unless $env:ORBIT_JOB_DIR is set by that job's launcher.
# Armed policy: writes, edits, and patches only inside ORBIT_REPO (default the orbit_match
# repo, never .git\) or ORBIT_JOB_DIR. Deletes are denied. Git writes in the shell are
# denied unless the repo branch is review, and then only add of paths inside the repo or
# the job dir, commit -m or commit -F, and push origin review (or a bare push whose
# upstream is origin/review). A deny is JSON on stdout and exit 0.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if (-not $env:ORBIT_JOB_DIR -or -not $env:ORBIT_JOB_DIR.Trim()) { exit 0 }

function Clean-Root([string]$p) {
  $p = $p.Trim().Trim('"').Trim("'")
  return [IO.Path]::GetFullPath($p).TrimEnd('\')
}

$jobDir = Clean-Root $env:ORBIT_JOB_DIR
$repo = if ($env:ORBIT_REPO -and $env:ORBIT_REPO.Trim()) { Clean-Root $env:ORBIT_REPO } else { Clean-Root 'C:\Users\DougJ\Documents\GitHub\orbit_match' }
$logf = Join-Path $jobDir 'orbit-guard.log'

function Log([string]$m) {
  try { Add-Content -LiteralPath $logf -Value ("[{0}] {1}" -f (Get-Date -Format s), $m) -Encoding utf8 } catch {}
}
function Deny([string]$why) {
  Log "DENY $why"
  $reason = "Blocked by the orbit guard (this is NOT fatal - keep working and make your next tool call). $why"
  [ordered]@{
    decision = 'deny'
    reason = $reason
    hookSpecificOutput = [ordered]@{
      hookEventName = 'PreToolUse'
      permissionDecision = 'deny'
      permissionDecisionReason = $reason
    }
  } | ConvertTo-Json -Compress -Depth 5
  exit 0
}
function Inside([string]$full, [string]$root) {
  if (-not $root -or -not $full) { return $false }
  return ($full.Equals($root, [StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase))
}
function Resolve-ToolPath([string]$p, [string]$base) {
  $p = $p.Trim().Trim('"').Trim("'").Replace('/', '\')
  if ($p.StartsWith('~')) { $p = Join-Path $HOME $p.Substring(1).TrimStart('\') }
  if ([IO.Path]::IsPathRooted($p)) { return [IO.Path]::GetFullPath($p) }
  if (-not $base) { $base = (Get-Location).Path }
  return [IO.Path]::GetFullPath((Join-Path $base $p))
}
function Add-TextPath([System.Collections.Generic.List[string]]$list, $value) {
  if ($null -eq $value) { return }
  $s = ([string]$value).Trim()
  if ($s) { $list.Add($s) }
}

$gitWrite = '\bgit(?:\.exe)?\s+(?:-c\s+\S+\s+)*(commit|push|add|reset|checkout|switch|restore|stash|clean|rm|mv|merge|rebase|pull|fetch|tag|config|apply|cherry-pick|worktree|init|remote)\b'
$gitBranch = '\bgit(?:\.exe)?\s+(?:-c\s+\S+\s+)*branch\s+-'

function Get-RepoBranch([string]$repoPath) {
  $head = Join-Path $repoPath '.git\HEAD'
  if (-not (Test-Path -LiteralPath $head)) { return '' }
  try { $line = (Get-Content -LiteralPath $head -TotalCount 1).Trim() } catch { return '' }
  if ($line -match '^ref:\s+refs/heads/(.+)$') { return $Matches[1].Trim() }
  return ''
}
function Test-UpstreamOriginReview([string]$repoPath) {
  $cfg = Join-Path $repoPath '.git\config'
  if (-not (Test-Path -LiteralPath $cfg)) { return $false }
  try { $text = Get-Content -LiteralPath $cfg -Raw } catch { return $false }
  if ($text -notmatch '(?s)\[branch "review"\](.*?)(?:\r?\n\[|\z)') { return $false }
  $sec = $Matches[1]
  $remote = ''
  $merge = ''
  if ($sec -match '(?m)^\s*remote\s*=\s*(\S+)') { $remote = $Matches[1].Trim() }
  if ($sec -match '(?m)^\s*merge\s*=\s*(\S+)') { $merge = $Matches[1].Trim() }
  return ($remote -eq 'origin' -and $merge -eq 'refs/heads/review')
}
function Get-GitArgsAfterVerb([string]$cmd, [string]$verb) {
  $re = '(?i)\bgit(?:\.exe)?\s+(?:-c\s+\S+\s+)*' + [regex]::Escape($verb) + '\b(.*)$'
  $m = [regex]::Match($cmd, $re)
  if (-not $m.Success) { return $null }
  return $m.Groups[1].Value
}
function Split-GitTokens([string]$rest) {
  $list = New-Object System.Collections.Generic.List[string]
  if ($null -eq $rest) { return $list }
  foreach ($m in [regex]::Matches($rest, '"(?:[^"]*)"|''(?:[^'']*)''|\S+')) {
    $t = $m.Value
    if ($t.Length -ge 2 -and (($t.StartsWith('"') -and $t.EndsWith('"')) -or ($t.StartsWith("'") -and $t.EndsWith("'")))) {
      $t = $t.Substring(1, $t.Length - 2)
    }
    $list.Add($t)
  }
  return $list
}
function Test-ReviewGitAllow([string]$cmd, [string]$cwd) {
  if ([regex]::Matches($cmd, '(?i)\bgit(?:\.exe)?\b').Count -ne 1) { return $false }
  if ($cmd -match '(?i)(?:^|[\s;&|(])(remove-item|ri|rm|rmdir|rd|del|erase)\s') { return $false }
  if ((Get-RepoBranch $repo) -ne 'review') { return $false }
  if ($cmd -match '(?i)--force\b|--force-with-lease|--delete\b|--amend\b|--no-verify\b') { return $false }
  if ($cmd -match '(?i)\bgit(?:\.exe)?\s+(?:-c\s+\S+\s+)*(reset|checkout|switch|restore|stash|clean|rm|mv|merge|rebase|pull|fetch|tag|config|apply|cherry-pick|worktree|init|remote)\b') { return $false }
  if ($cmd -match '(?i)\bgit(?:\.exe)?\s+(?:-c\s+\S+\s+)*branch\s+-') { return $false }
  if ($cmd -match '(?i)\bgit(?:\.exe)?\s+(?:-c\s+\S+\s+)*commit\b') {
    $rest = Get-GitArgsAfterVerb $cmd 'commit'
    if ($null -eq $rest) { return $false }
    return ($rest -match '(?i)(^|\s)(-m|--message|-F|--file)(\s|=|$)')
  }
  if ($cmd -match '(?i)\bgit(?:\.exe)?\s+(?:-c\s+\S+\s+)*push\b') {
    if ($cmd -match '(?i)\b(main|master)\b') { return $false }
    $rest = Get-GitArgsAfterVerb $cmd 'push'
    if ($null -eq $rest) { return $false }
    $rest = $rest.Trim()
    if ($rest -eq '') { return (Test-UpstreamOriginReview $repo) }
    return ($rest -match '(?i)^origin\s+review\s*$')
  }
  if ($cmd -match '(?i)\bgit(?:\.exe)?\s+(?:-c\s+\S+\s+)*add\b') {
    $rest = Get-GitArgsAfterVerb $cmd 'add'
    if ($null -eq $rest) { return $false }
    $paths = New-Object System.Collections.Generic.List[string]
    $whole = $false
    foreach ($t in (Split-GitTokens $rest)) {
      if ($t -eq '--') { continue }
      if ($t -in @('-A', '--all', '-u', '--update', '.')) { $whole = $true; continue }
      if ($t.StartsWith('-')) { return $false }
      $paths.Add($t)
    }
    if ($whole) {
      if ($paths.Count -gt 0) { return $false }
      try { $fullCwd = [IO.Path]::GetFullPath($cwd) } catch { return $false }
      return (Inside $fullCwd $repo)
    }
    if ($paths.Count -eq 0) { return $false }
    foreach ($p in $paths) {
      try { $full = Resolve-ToolPath $p $cwd } catch { return $false }
      if ($full -match '(?i)(?:^|\\)\.git(?:\\|$)') { return $false }
      if (-not ((Inside $full $repo) -or (Inside $full $jobDir))) { return $false }
    }
    return $true
  }
  return $false
}
$writeRe = '(?i)^(search_replace|edit|write|multiedit|multi_edit|create_file|write_file|str_replace|str_replace_editor|apply_patch|notebook_edit|edit_notebook|delete_file|rename_file|move_file|remove_file)$'

try {
  $raw = [Console]::In.ReadToEnd()
  $ev = $raw | ConvertFrom-Json
  $tool = [string]$ev.toolName
  $in = $ev.toolInput
  $cwd = if ($ev.cwd) { [string]$ev.cwd } else { $repo }
  Log "$tool"

  if ($tool -match '(?i)^(run_terminal_command|bash|shell|execute|run_command|powershell|terminal)$') {
    $cmd = ''
    if ($in) {
      if ($in.command) { $cmd = [string]$in.command }
      elseif ($in.cmd) { $cmd = [string]$in.cmd }
    }
    $low = $cmd.ToLowerInvariant()
    if ($low -match $gitWrite -or $low -match $gitBranch) {
      if (Test-ReviewGitAllow $cmd $cwd) {
        Log "ALLOW git on review: $cmd"
        exit 0
      }
      $why = "Git write is not allowed. On branch review the guard allows git add of paths inside the repo or the job dir, git commit -m, git commit -F, and git push origin review (or a bare git push whose upstream is origin/review). Push to main or master, --force, --delete, merge, rebase, reset, checkout, and switch stay denied. Off review, every git write is denied. Read-only git (status, diff, log, show) is allowed."
      if ($cmd -match '(?i)\bmain\b') { $why = "Push to main is denied. $why" }
      elseif ($cmd -match '(?i)\bmaster\b') { $why = "Push to master is denied. $why" }
      Deny $why
    }
    if ($low -match '(^|[\s;&|(])(remove-item|ri|rm|rmdir|rd|del|erase)\s') {
      Deny "Deleting files is not allowed. Leave the file and note it in the report."
    }
    exit 0
  }

  $paths = New-Object System.Collections.Generic.List[string]
  $patchText = $null
  if ($in) {
    foreach ($k in @('file_path', 'path', 'target_file', 'filePath', 'target', 'file', 'new_path', 'destination')) {
      $v = $in.$k
      if ($null -eq $v) { continue }
      if ($v -is [string]) { Add-TextPath $paths $v; continue }
      foreach ($item in @($v)) {
        if ($item -is [string]) { Add-TextPath $paths $item }
        elseif ($item.$k) { Add-TextPath $paths ([string]$item.$k) }
      }
    }
    foreach ($propName in @('edits', 'files', 'changes')) {
      $arr = $in.$propName
      if ($null -eq $arr) { continue }
      foreach ($item in @($arr)) {
        if ($item -is [string]) { Add-TextPath $paths $item; continue }
        foreach ($k in @('file_path', 'path', 'target_file', 'filePath', 'file', 'new_path', 'destination')) {
          if ($item.$k) { Add-TextPath $paths ([string]$item.$k) }
        }
      }
    }
    if ($in.patch) { $patchText = [string]$in.patch }
    elseif ($in.input -and ([string]$in.input) -match '\*\*\* ') { $patchText = [string]$in.input }
    if ($patchText) {
      foreach ($m in [regex]::Matches($patchText, '(?m)\*\*\* (?:Add|Update|Delete|Move to) File: *(.+)$')) {
        Add-TextPath $paths $m.Groups[1].Value
      }
      foreach ($m in [regex]::Matches($patchText, '(?m)\*\*\* Move to: *(.+)$')) {
        Add-TextPath $paths $m.Groups[1].Value
      }
    }
  }

  $isDelete = ($tool -match '(?i)delete|remove_file|rename_file|move_file') -or ($patchText -and $patchText -match '(?i)\*\*\* Delete File:')
  $isWrite = $tool -match $writeRe
  if ($isDelete) { Deny "Deleting files is not allowed. Leave the file and note it in the report." }
  if (-not $isWrite) { exit 0 }
  if ($paths.Count -eq 0) { Deny "Could not tell which file this write targets. Use an explicit path inside $repo or $jobDir." }

  foreach ($p in $paths) {
    try { $full = Resolve-ToolPath $p $cwd } catch { Deny "Could not resolve path '$p'." }
    if ($full -match '(?i)(?:^|\\)\.git(?:\\|$)') { Deny "Writing inside .git is forbidden (got $full)." }
    if (-not ((Inside $full $repo) -or (Inside $full $jobDir))) {
      Deny "Writes are allowed only inside $repo or $jobDir (got $full)."
    }
  }
  exit 0
} catch {
  Log "guard error: $($_.Exception.Message)"
  exit 0
}
