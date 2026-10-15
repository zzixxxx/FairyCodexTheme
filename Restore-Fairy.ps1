param([int]$Port = 9341)
$ErrorActionPreference = 'Stop'
$fairyNode = (Get-Command node -ErrorAction Stop).Source
Set-Content -LiteralPath (Join-Path $PSScriptRoot '.watch-stop') -Value 'stop'
& $fairyNode (Join-Path $PSScriptRoot 'fairy.mjs') restore "--port=$Port"
if ($LASTEXITCODE -ne 0) { Write-Host 'Watcher stopped. If Codex is closed, the visual layer is already gone. Open Codex normally next time.' }
