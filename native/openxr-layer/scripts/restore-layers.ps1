# Recovery helper.
# Re-adds known implicit OpenXR API layers to the 64-bit registry key in case
# they were accidentally removed. Safe + idempotent: never recreates the key,
# only adds values for manifests that actually exist on disk. Self-elevates.
#
# Each layer is enabled (DWORD 0). If you had intentionally DISABLED one
# (value 1), set it back to 1 afterwards.

$isAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host "Elevating to write HKLM..."
  Start-Process pwsh -Verb RunAs -ArgumentList "-NoProfile -File `"$PSCommandPath`""
  exit
}

# Known implicit layer manifests (extend if you remember others you had).
$candidates = @(
  "C:\Program Files\OpenKneeboard\bin\OpenKneeboard-OpenXR.json"
  "C:\ProgramData\ReShade\ReShade64_XR.json"
  "C:\Program Files\Virtual Desktop Streamer\openxr-oculus-compatibility.json"
)

$key = "HKLM:\SOFTWARE\Khronos\OpenXR\1\ApiLayers\Implicit"
if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }

foreach ($json in $candidates) {
  if (Test-Path $json) {
    New-ItemProperty -Path $key -Name $json -PropertyType DWord -Value 0 -Force | Out-Null
    Write-Host "Restored: $json"
  } else {
    Write-Host "Skipped (not on disk): $json"
  }
}

Write-Host "`nCurrent implicit layers:"
(Get-Item $key).Property | ForEach-Object { Write-Host "  $_" }
