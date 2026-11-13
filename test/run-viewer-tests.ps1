# Runs the viewer unit tests added for JOB 1. The job guard blocks a bare node command.
$ErrorActionPreference = 'Stop'
Set-Location 'F:\Projects\orbit_match'
& node --test --test-timeout=120000 test/viewer-common.test.js test/viewer-svg-page.test.js
exit $LASTEXITCODE
