# One-shot headless screenshot. The job guard only allows pwsh -File tests\<suite>\<file>.ps1.
$ErrorActionPreference = 'Continue'
Get-CimInstance Win32_Process -Filter "name = 'msedge.exe'" |
  Where-Object { $_.CommandLine -like '*fix_20261015\edge-profile*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$script = 'F:\Dropbox\TheCourt\research\_jobs\orbit-match-viewer-proto\fix_20261015\shoot-viewer3d.mjs'
& node $script
exit $LASTEXITCODE
