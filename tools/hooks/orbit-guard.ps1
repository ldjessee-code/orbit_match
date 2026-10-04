# orbit-guard.ps1 - PreToolUse guard for orbit_match jobs.
# INERT (exit 0, no stdout) unless $env:ORBIT_JOB_DIR is set by that job's launcher.
# Armed policy: writes, edits, and patches only inside ORBIT_REPO (default the orbit_match
# repo, never .git\) or ORBIT_JOB_DIR. Deletes are denied. Git write commands in the shell
# are denied. A deny is JSON on stdout and exit 0, same shape as the court job guard.
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
      Deny "Shell command contains a git write (commit, push, add, reset, checkout, switch, restore, stash, clean, rm, mv, merge, rebase, pull, fetch, tag, config, apply, cherry-pick, worktree, init, remote, or branch -). Bots never commit or push. Doug commits. Read-only git (status, diff, log, show) is allowed."
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
