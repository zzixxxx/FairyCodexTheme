param([Parameter(Mandatory=$true)][ValidateSet('Start','Restore','Status','Usage','Check')][string]$Action)
$ErrorActionPreference = 'Stop'
$fairyPluginRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$fairyWindowsPowerShell = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
if ($Action -eq 'Start') {
  & $fairyWindowsPowerShell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $fairyPluginRoot 'Start-Fairy.ps1')
} elseif ($Action -eq 'Restore') {
  & $fairyWindowsPowerShell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $fairyPluginRoot 'Restore-Fairy.ps1')
} elseif ($Action -eq 'Check') {
  & $fairyWindowsPowerShell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $fairyPluginRoot 'Start-Fairy.ps1') -Check
} elseif ($Action -eq 'Usage') {
  & node (Join-Path $PSScriptRoot 'read-usage.mjs')
} else {
  & node (Join-Path $fairyPluginRoot 'fairy.mjs') status
}
exit $LASTEXITCODE
