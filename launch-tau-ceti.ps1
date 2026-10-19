param([switch]$Continue, [string]$PromptFile)
# Start tasks\rebound_tau_ceti\launch.ps1 minimized through start-grok-run.ps1. Forwards -Continue and -PromptFile when they are set.
& 'F:\Dropbox\TheCourt\tools\start-grok-run.ps1' -Launch 'C:\Users\DougJ\Documents\GitHub\orbit_match\tasks\rebound_tau_ceti\launch.ps1' @PSBoundParameters
