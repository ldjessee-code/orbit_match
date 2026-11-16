#Requires -Version 7
# Orbit Match tailnet checks: the serve-site node file, then the hook suite.
$ErrorActionPreference = 'Continue'
$PSNativeCommandUseErrorActionPreference = $false
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location -LiteralPath $repo
& node --test --test-reporter=spec test/serve-site.test.js
$node = $LASTEXITCODE
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'tests\hooks.tests.ps1')
$hooks = $LASTEXITCODE
if ($node -ne 0 -or $hooks -ne 0) { exit 1 }
exit 0
