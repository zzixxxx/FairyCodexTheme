param([int]$Port = 9341, [switch]$Check)
$ErrorActionPreference = 'Stop'
# Appx discovery is supported by Windows PowerShell, not all PowerShell 7 hosts.
if ($PSVersionTable.PSEdition -eq 'Core') {
  $fairyForward = @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',$PSCommandPath,'-Port',[string]$Port)
  if ($Check) { $fairyForward += '-Check' }
  & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" @fairyForward
  exit $LASTEXITCODE
}
Set-Location -LiteralPath $PSScriptRoot
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Invalid port' }
$fairyNode = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $fairyNode) { throw 'Node.js 22+ is required.' }
if ([int]((& $fairyNode --version).TrimStart('v').Split('.')[0]) -lt 22) { throw 'Node.js 22+ is required.' }
$fairyAvailable = $false
try { $null = Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 2; $fairyAvailable = $true } catch {}
if (-not $fairyAvailable -or $Check) {
  $fairyCandidates = @(Get-AppxPackage | Where-Object { $_.Name -match '^OpenAI\.(Codex|ChatGPT)$' } | Sort-Object Version -Descending)
  $fairyAppId = $null
  foreach ($fairyPackage in $fairyCandidates) {
    $fairyManifest = Get-AppxPackageManifest -Package $fairyPackage.PackageFullName
    foreach ($fairyApplication in $fairyManifest.Package.Applications.Application) {
      if ([string]$fairyApplication.Executable -match '(ChatGPT|Codex)\.exe$') {
        $fairyAppId = $fairyPackage.PackageFamilyName + '!' + [string]$fairyApplication.Id
        break
      }
    }
    if ($fairyAppId) { break }
  }
  if (-not $fairyAppId) { throw 'Codex Store application registration not found.' }
  # Use the registered app identity instead of executing the protected WindowsApps binary.
  # Microsoft API: IApplicationActivationManager::ActivateApplication.
  if (-not ('FairyPackagedApp' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[ComImport, Guid("2E941141-7F97-4756-BA1D-9DECDE894A3D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IFairyActivationManager {
    [PreserveSig] int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appId,
        [MarshalAs(UnmanagedType.LPWStr)] string arguments, uint options, out uint processId);
    [PreserveSig] int ActivateForFile([MarshalAs(UnmanagedType.LPWStr)] string appId,
        IntPtr items, [MarshalAs(UnmanagedType.LPWStr)] string verb, out uint processId);
    [PreserveSig] int ActivateForProtocol([MarshalAs(UnmanagedType.LPWStr)] string appId,
        IntPtr items, out uint processId);
}
public static class FairyPackagedApp {
    static object Create() {
        return Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")));
    }
    public static void Check() {
        object instance = Create();
        try { var manager = (IFairyActivationManager)instance; }
        finally { Marshal.FinalReleaseComObject(instance); }
    }
    public static uint Launch(string appId, string arguments) {
        object instance = Create();
        try {
            uint pid;
            int hr = ((IFairyActivationManager)instance).ActivateApplication(appId, arguments, 0, out pid);
            Marshal.ThrowExceptionForHR(hr);
            return pid;
        } finally { Marshal.FinalReleaseComObject(instance); }
    }
}
'@
  }
  [FairyPackagedApp]::Check()
  if ($Check) {
    Write-Host "PASS: Node.js, registered app $fairyAppId, Windows activation COM interface."
    Write-Host 'Check only: Codex was not launched or restarted.'
    exit 0
  }
  $fairyRunning = @(Get-Process -Name ChatGPT,Codex -ErrorAction SilentlyContinue | Where-Object { $_.Path -match '(ChatGPT|Codex)\.exe$' -and $_.Path -notmatch '\\bin\\' })
  if ($fairyRunning.Count) {
    Write-Host 'Please quit Codex from its menu, then run Start-Fairy.cmd again. This script will not terminate your active chat.'
    exit 1
  }
  $fairyAppPid = [FairyPackagedApp]::Launch($fairyAppId, "--remote-debugging-address=127.0.0.1 --remote-debugging-port=$Port")
  Write-Host "Codex activated through Windows (PID $fairyAppPid). Waiting for CDP..."
  for ($fairyAttempt=0;$fairyAttempt -lt 40;$fairyAttempt++) {
    try { $null=Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 1; $fairyAvailable=$true;break } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $fairyAvailable) { throw 'Codex did not expose CDP. See README troubleshooting; no theme has been applied.' }
}
# A lock directory prevents duplicate watcher processes.
$fairyLock = Join-Path $PSScriptRoot '.watcher-lock'
if (Test-Path -LiteralPath $fairyLock) {
  $fairyOldPid = Get-Content -LiteralPath (Join-Path $fairyLock 'pid') -ErrorAction SilentlyContinue
  if ($fairyOldPid -and (Get-Process -Id ([int]$fairyOldPid) -ErrorAction SilentlyContinue)) {
    & $fairyNode (Join-Path $PSScriptRoot 'fairy.mjs') apply "--port=$Port"
    exit $LASTEXITCODE
  }
}
New-Item -ItemType Directory -Path $fairyLock -Force | Out-Null
$fairyProcess = Start-Process -FilePath $fairyNode -ArgumentList @(('"' + (Join-Path $PSScriptRoot 'fairy.mjs') + '"'),'watch',"--port=$Port") -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $PSScriptRoot 'fairy.log') -RedirectStandardError (Join-Path $PSScriptRoot 'fairy-error.log')
Set-Content -LiteralPath (Join-Path $fairyLock 'pid') -Value $fairyProcess.Id
Write-Host 'Fairy started. Switch to Codex mode. To restore, run Restore-Fairy.ps1.'
