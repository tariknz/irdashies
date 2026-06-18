# Registers the irDashies OpenXR implicit API layer (HKLM, needs admin).
# Usage: pwsh -File register.ps1 [-Json <path-to-irDashies-OpenXR.json>]
param(
  [string]$Json = "$PSScriptRoot\..\build\Release\irDashies-OpenXR.json"
)

if (-not (Test-Path $Json)) {
  Write-Error "Manifest not found: $Json (build the layer first)"
  exit 1
}
$Json = (Resolve-Path $Json).Path

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
# IMPORTANT: do NOT use `New-Item -Force` on an existing registry key - it
# deletes and recreates the key, wiping every other registered layer. Only
# create the key when it is genuinely missing.
if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
New-ItemProperty -Path $key -Name $Json -PropertyType DWord -Value 0 -Force | Out-Null
Write-Host "Registered implicit API layer:"
Write-Host "  $Json"
Write-Host "Disable without unregistering: set env DISABLE_IRDASHIES_OPENXR=1"
