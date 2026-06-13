# Build the irDashies native VR components (OpenXR layer + SHM test tools).
#
# Usage:
#   pwsh -File native/build.ps1                 # build Release
#   pwsh -File native/build.ps1 -Config Debug
#   pwsh -File native/build.ps1 -Clean          # wipe build dirs first
#   pwsh -File native/build.ps1 -Register       # also (re)register the layer
#
# Requires: CMake >= 3.22, Visual Studio 2022 (C++ workload), git (FetchContent).

[CmdletBinding()]
param(
  [ValidateSet('Release', 'Debug')]
  [string]$Config = 'Release',
  [string]$Generator = 'Visual Studio 17 2022',
  [string]$Arch = 'x64',
  [switch]$Clean,
  [switch]$Register
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# project dir -> target(s) to build ($null = default ALL)
$projects = [ordered]@{
  'openxr-layer'     = 'irDashiesOpenXRLayer'
  'shm-test-producer' = $null
}

function Invoke-Native([string]$exe, [string[]]$cmdArgs) {
  & $exe @cmdArgs
  if ($LASTEXITCODE -ne 0) {
    throw "$exe exited with code $LASTEXITCODE"
  }
}

foreach ($name in $projects.Keys) {
  $src = Join-Path $root $name
  $build = Join-Path $src 'build'
  $target = $projects[$name]

  Write-Host "=== $name ($Config) ===" -ForegroundColor Cyan

  if ($Clean -and (Test-Path $build)) {
    Write-Host "  cleaning $build"
    Remove-Item -Recurse -Force $build
  }

  Invoke-Native 'cmake' @('-S', $src, '-B', $build, '-G', $Generator, '-A', $Arch)

  $buildArgs = @('--build', $build, '--config', $Config)
  if ($target) { $buildArgs += @('--target', $target) }
  Invoke-Native 'cmake' $buildArgs
}

$outDir = Join-Path $root "openxr-layer/build/$Config"
$dll = Join-Path $outDir 'irDashies-OpenXR-Layer.dll'
$manifest = Join-Path $outDir 'irDashies-OpenXR.json'
$prodDir = Join-Path $root "shm-test-producer/build/$Config"

Write-Host "`nBuild complete." -ForegroundColor Green
Write-Host "  layer    : $dll"
Write-Host "  manifest : $manifest"
Write-Host "  producer : $(Join-Path $prodDir 'irdashies-shm-test-producer.exe')"
Write-Host "  probe    : $(Join-Path $prodDir 'irdashies-shm-probe.exe')"

if ($Register) {
  Write-Host "`nRegistering layer (UAC prompt)..." -ForegroundColor Cyan
  & (Join-Path $root 'openxr-layer/scripts/register.ps1') -Json $manifest
}
