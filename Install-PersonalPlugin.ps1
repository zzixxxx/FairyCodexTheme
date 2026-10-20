param([switch]$RegisterOnly)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'plugin.json'))) { throw 'Plugin manifest missing; keep the complete package together.' }
$fairyPersonalRoot = [System.IO.Path]::GetFullPath($env:USERPROFILE).TrimEnd([char[]]'\/')
$fairySourceRoot = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd([char[]]'\/')
if (-not $fairySourceRoot.StartsWith($fairyPersonalRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Place this plugin under your user directory, for example USERPROFILE/Tools/Fairy-Codex-Windows.'
}
$fairySourceRelative = './' + $fairySourceRoot.Substring($fairyPersonalRoot.Length + 1).Replace('\','/')
$fairyCatalogDir = Join-Path $fairyPersonalRoot '.agents/plugins'
$fairyCatalogPath = Join-Path $fairyCatalogDir 'marketplace.json'
if (Test-Path -LiteralPath $fairyCatalogPath) {
  $fairyCatalog = Get-Content -LiteralPath $fairyCatalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if (-not $fairyCatalog.name -or -not ($fairyCatalog.PSObject.Properties.Name -contains 'plugins')) { throw 'Existing personal marketplace is invalid; left unchanged.' }
} else {
  $fairyCatalog = [pscustomobject]@{ name='fairy-personal'; interface=[pscustomobject]@{displayName='Fairy Personal Plugins'}; plugins=@() }
}
$fairyPluginEntry = [pscustomobject]@{
  name='fairy-codex'
  source=[pscustomobject]@{source='local';path=$fairySourceRelative}
  policy=[pscustomobject]@{installation='AVAILABLE';authentication='ON_INSTALL'}
  category='Productivity'
}
$fairyCatalog.plugins = @($fairyCatalog.plugins | Where-Object { $_.name -ne 'fairy-codex' }) + @($fairyPluginEntry)
New-Item -ItemType Directory -Path $fairyCatalogDir -Force | Out-Null
[System.IO.File]::WriteAllText($fairyCatalogPath, ($fairyCatalog | ConvertTo-Json -Depth 30), [System.Text.UTF8Encoding]::new($false))
Write-Host ('Registered fairy-codex@' + $fairyCatalog.name)
if (-not $RegisterOnly) {
  & codex plugin add ('fairy-codex@' + $fairyCatalog.name) --json
  if ($LASTEXITCODE -ne 0) { throw 'Plugin installation failed. The personal marketplace entry is available for manual installation.' }
  Write-Host 'Installed. Refresh the plugin list or open a new chat. Theme activation is a separate Start action.'
}
