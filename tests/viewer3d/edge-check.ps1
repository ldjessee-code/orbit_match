$ErrorActionPreference = 'Continue'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$job = 'F:\Dropbox\TheCourt\research\_jobs\orbit-match-viewer-proto\fix_20261015'
$png = Join-Path $job 'viewer3d_fix_20261015.png'
$profile = Join-Path $job 'edge-profile'
function Stop-ShotEdge {
  Get-CimInstance Win32_Process -Filter "name = 'msedge.exe'" |
    Where-Object { $_.CommandLine -like '*fix_20261015\edge-profile*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
Stop-ShotEdge
$modes = @('--headless=old', '--headless=new', '--headless')
foreach ($mode in $modes) {
  $tag = $mode.Replace('--', '').Replace('=', '-')
  $err = Join-Path $job ("edge-" + $tag + "-err.txt")
  $out = Join-Path $job ("edge-" + $tag + "-out.txt")
  $arg = @(
    $mode,
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
    "--user-data-dir=$profile",
    "--screenshot=$png",
    '--window-size=800,600',
    'about:blank'
  )
  $p = Start-Process -FilePath $edge -ArgumentList $arg -PassThru -WindowStyle Hidden -RedirectStandardError $err -RedirectStandardOutput $out
  $finished = $p.WaitForExit(12000)
  Start-Sleep -Seconds 2
  $size = if (Test-Path $png) { (Get-Item $png).Length } else { 0 }
  Write-Output ("mode " + $mode + " wait " + $finished + " exit " + $p.ExitCode + " png " + $size)
  if (Test-Path $err) {
    Get-Content $err -TotalCount 20 | ForEach-Object { Write-Output ("stderr " + $_) }
  }
  Stop-ShotEdge
  if ($size -gt 1000) { break }
}
Write-Output 'edge-check done'
