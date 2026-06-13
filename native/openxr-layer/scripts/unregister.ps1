# Unregisters the irDashies OpenXR implicit API layer (HKLM, needs admin).
# Usage: pwsh -File unregister.ps1 [-Json <path-to-irDashies-OpenXR.json>]
param(
  [string]$Json = "$PSScriptRoot\..\build\Release\irDashies-OpenXR.json"
)

if (Test-Path $Json) { $Json = (Resolve-Path $Json).Path }

$isAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host "Elevating to write HKLM..."
  Start-Process pwsh -Verb RunAs -ArgumentList `
    "-NoProfile -File `"$PSCommandPath`" -Json `"$Json`""
  exit
}

$key = "HKLM:\SOFTWARE\Khronos\OpenXR\1\ApiLayers\Implicit"
if (Test-Path $key) {
  Remove-ItemProperty -Path $key -Name $Json -ErrorAction SilentlyContinue
  Write-Host "Unregistered: $Json"
} else {
  Write-Host "Implicit layer key not present; nothing to do."
}
