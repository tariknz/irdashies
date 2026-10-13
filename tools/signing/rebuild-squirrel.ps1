param(
    [string] $PackageDirectory,
    [string] $SignedPackagePath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-SquirrelReleaseEntry {
    param(
        [Parameter(Mandatory)] [string] $PackagePath,
        [Parameter(Mandatory)] [string] $ReleasesPath
    )

    $package = Get-Item -LiteralPath $PackagePath
    $hash = (Get-FileHash -LiteralPath $PackagePath -Algorithm SHA1).Hash
    # Hash the final ZIP bytes, after signing, and omit the UTF-8 BOM.
    [System.IO.File]::WriteAllText(
        $ReleasesPath, "$hash $($package.Name) $($package.Length)`n",
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Invoke-SquirrelInstallerRebuild {
    param(
        [Parameter(Mandatory)] [string] $PackagePath,
        [Parameter(Mandatory)] [string] $ReleaseDirectory,
        [Parameter(Mandatory)] [string] $SquirrelPath,
        [Parameter(Mandatory)] [string] $LoadingGif,
        [Parameter(Mandatory)] [string] $SetupIcon
    )

    # A -full.nupkg is already releasified: Squirrel skips the transformation
    # that generates stubs. Seed RELEASES with its new hash, then let Squirrel
    # build Setup.exe from that exact ZIP. Do not run Forge make again.
    $releasesPath = Join-Path $ReleaseDirectory 'RELEASES'
    Write-SquirrelReleaseEntry -PackagePath $PackagePath -ReleasesPath $releasesPath
    $expectedReleaseEntry = Get-Content -LiteralPath $releasesPath -Raw
    $signedPackageHash = (Get-FileHash -LiteralPath $PackagePath -Algorithm SHA256).Hash
    # Squirrel is a Windows GUI executable. Piping its output makes PowerShell
    # wait for completion before checking its exit code and generated files.
    & $SquirrelPath --releasify $PackagePath --releaseDir $ReleaseDirectory `
        --loadingGif $LoadingGif --setupIcon $SetupIcon --no-msi --no-delta | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Squirrel rebuild failed: $LASTEXITCODE" }

    $rebuiltPackage = Join-Path $ReleaseDirectory ([System.IO.Path]::GetFileName($PackagePath))
    if ((Get-FileHash -LiteralPath $rebuiltPackage -Algorithm SHA256).Hash -ne $signedPackageHash) {
        throw 'Squirrel changed the signed package during installer rebuild.'
    }
    if ((Get-Content -LiteralPath $releasesPath -Raw).Trim() -ne $expectedReleaseEntry.Trim()) {
        throw 'RELEASES does not match the signed Squirrel package.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $ReleaseDirectory 'Setup.exe') -PathType Leaf)) {
        throw 'Squirrel did not rebuild Setup.exe.'
    }
}

# Dot-sourcing exposes the manifest helper for the fixture checks.
if ($MyInvocation.InvocationName -eq '.') { return }

if (-not $PackageDirectory -or -not $SignedPackagePath) {
    throw 'Specify -PackageDirectory and -SignedPackagePath.'
}

$packages = @(Get-ChildItem -LiteralPath $PackageDirectory -Filter '*.nupkg' -File)
if ($packages.Count -ne 1 -or $packages[0].Name -notlike '*-full.nupkg') {
    throw 'Expected one full Squirrel package and no delta packages.'
}
$installers = @(Get-ChildItem -LiteralPath $PackageDirectory -Filter '*Setup.exe' -File)
if ($installers.Count -ne 1) {
    throw 'Expected exactly one Squirrel installer.'
}

$installerRoot = node -p "require('node:path').dirname(require.resolve('electron-winstaller/package.json'))"
if ($LASTEXITCODE -ne 0) { throw 'Could not locate electron-winstaller.' }
$squirrel = Join-Path $installerRoot 'vendor/Squirrel.exe'
$loadingGif = Join-Path $installerRoot 'resources/install-spinner.gif'
$setupIcon = (Resolve-Path -LiteralPath 'docs/assets/icons/logo.ico').Path
$workspace = Join-Path ([System.IO.Path]::GetTempPath()) ('irdashies-signing-' + [guid]::NewGuid())

try {
    $releaseDirectory = Join-Path $workspace 'releases'
    New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
    $packagePath = Join-Path $workspace $packages[0].Name
    Copy-Item -LiteralPath $SignedPackagePath -Destination $packagePath

    $extractDirectory = Join-Path $workspace 'verify'
    [System.IO.Compression.ZipFile]::ExtractToDirectory($packagePath, $extractDirectory)
    foreach ($name in @('irdashies.exe', 'irdashies_ExecutionStub.exe')) {
        $executable = Join-Path $extractDirectory "lib/net45/$name"
        if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
            throw "Squirrel package is missing $name."
        }
        $signature = Get-AuthenticodeSignature -LiteralPath $executable
        if ($signature.Status -ne 'Valid') {
            throw "Squirrel package contains $name with signature status $($signature.Status)."
        }
        Write-Output "Verified signed $name in $($packages[0].Name)."
    }

    Invoke-SquirrelInstallerRebuild -PackagePath $packagePath `
        -ReleaseDirectory $releaseDirectory -SquirrelPath $squirrel `
        -LoadingGif $loadingGif -SetupIcon $setupIcon
    $rebuiltPackage = Join-Path $releaseDirectory $packages[0].Name
    $rebuiltInstaller = Join-Path $releaseDirectory 'Setup.exe'

    # Preserve the paths in Forge's make manifest. Setup.exe is signed next,
    # after its embedded package and manifest have been finalized.
    Copy-Item -LiteralPath $rebuiltPackage -Destination $packages[0].FullName -Force
    Copy-Item -LiteralPath (Join-Path $releaseDirectory 'RELEASES') `
        -Destination (Join-Path $PackageDirectory 'RELEASES') -Force
    Copy-Item -LiteralPath $rebuiltInstaller -Destination $installers[0].FullName -Force
} finally {
    if (Test-Path -LiteralPath $workspace) {
        Remove-Item -LiteralPath $workspace -Recurse -Force
    }
}
