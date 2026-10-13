$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. "$PSScriptRoot/rebuild-squirrel.ps1"

$workspace = Join-Path ([System.IO.Path]::GetTempPath()) ('irdashies-signing-test-' + [guid]::NewGuid())
try {
    $fixture = Join-Path $workspace 'fixture'
    $lib = Join-Path $fixture 'lib/net45'
    New-Item -ItemType Directory -Path $lib -Force | Out-Null
    $relationships = Join-Path $fixture '_rels'
    New-Item -ItemType Directory -Path $relationships -Force | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $fixture '[Content_Types].xml'), @'
<?xml version="1.0"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="nuspec" ContentType="application/octet" />
  <Default Extension="exe" ContentType="application/octet" />
</Types>
'@)
    [System.IO.File]::WriteAllText((Join-Path $relationships '.rels'), @'
<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Type="http://schemas.microsoft.com/packaging/2010/07/manifest" Target="/irdashies.nuspec" Id="manifest" />
</Relationships>
'@)
    [System.IO.File]::WriteAllText((Join-Path $fixture 'irdashies.nuspec'), @'
<?xml version="1.0"?>
<package xmlns="http://schemas.microsoft.com/packaging/2010/07/nuspec.xsd">
  <metadata>
    <id>irdashies</id><version>0.0.1</version><title>irDashies</title>
    <authors>irDashies</authors><description>Signing fixture</description>
    <copyright>Copyright irDashies</copyright>
  </metadata>
</package>
'@)
    [System.IO.File]::WriteAllText((Join-Path $lib 'irdashies.exe'), 'application fixture')
    [System.IO.File]::WriteAllText((Join-Path $lib 'irdashies_ExecutionStub.exe'), 'launcher fixture')
    $packagePath = Join-Path $workspace 'irdashies-0.0.1-full.nupkg'
    [System.IO.Compression.ZipFile]::CreateFromDirectory($fixture, $packagePath)
    $releaseDirectory = Join-Path $workspace 'releases'
    New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
    $releasesPath = Join-Path $releaseDirectory 'RELEASES'
    Write-SquirrelReleaseEntry -PackagePath $packagePath -ReleasesPath $releasesPath
    $before = Get-Content -LiteralPath $releasesPath -Raw

    # Simulate signing changing the package. The old manifest must no longer
    # apply; writing the new one must leave the ZIP itself untouched.
    $archive = [System.IO.Compression.ZipFile]::Open(
        $packagePath, [System.IO.Compression.ZipArchiveMode]::Update
    )
    try {
        $entry = $archive.GetEntry('lib/net45/irdashies_ExecutionStub.exe')
        $entry.Delete()
        $entry = $archive.CreateEntry('lib/net45/irdashies_ExecutionStub.exe')
        $writer = [System.IO.StreamWriter]::new($entry.Open())
        try { $writer.Write('launcher fixture with signature bytes') }
        finally { $writer.Dispose() }
    } finally { $archive.Dispose() }
    $expectedPackageHash = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash
    Write-SquirrelReleaseEntry -PackagePath $packagePath -ReleasesPath $releasesPath
    $after = Get-Content -LiteralPath $releasesPath -Raw
    if ($before -eq $after) { throw 'Manifest was not refreshed after signing.' }
    if ((Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash -ne $expectedPackageHash) {
        throw 'Writing the manifest changed the package.'
    }
    $fields = $after.Trim().Split(' ')
    $bytes = [System.IO.File]::ReadAllBytes($packagePath)
    $expectedSha1 = [Convert]::ToHexString([System.Security.Cryptography.SHA1]::HashData($bytes))
    if ($fields[0] -ne $expectedSha1 -or $fields[1] -ne 'irdashies-0.0.1-full.nupkg' -or
        $fields[2] -ne $bytes.Length.ToString()) {
        throw 'Manifest hash, filename or byte count is incorrect.'
    }
    if ([System.IO.File]::ReadAllBytes($releasesPath)[0] -eq 0xEF) {
        throw 'RELEASES contains a UTF-8 BOM.'
    }
    Write-Output 'PASS: manifest refresh uses the final package without changing it.'

    if ($IsWindows) {
        $installerRoot = node -p "require('node:path').dirname(require.resolve('electron-winstaller/package.json'))"
        if ($LASTEXITCODE -ne 0) { throw 'Could not locate electron-winstaller.' }
        Invoke-SquirrelInstallerRebuild -PackagePath $packagePath `
            -ReleaseDirectory $releaseDirectory `
            -SquirrelPath (Join-Path $installerRoot 'vendor/Squirrel.exe') `
            -LoadingGif (Join-Path $installerRoot 'resources/install-spinner.gif') `
            -SetupIcon (Resolve-Path -LiteralPath 'docs/assets/icons/logo.ico').Path

        # Read Setup.exe's DATA/131 resource with the bundled 7-Zip, then check
        # that its embedded package and RELEASES match the published artifacts.
        $resourceDirectory = Join-Path $workspace 'setup-resources'
        & (Join-Path $installerRoot 'vendor/7z.exe') x `
            (Join-Path $releaseDirectory 'Setup.exe') "-o$resourceDirectory" -tPE -y
        if ($LASTEXITCODE -ne 0) { throw 'Could not extract Setup.exe resources.' }
        $payloads = @(Get-ChildItem -LiteralPath $resourceDirectory -File -Recurse |
            Where-Object { $_.FullName -match '[\\/]DATA[\\/]131$' })
        if ($payloads.Count -ne 1) { throw 'Setup.exe DATA/131 payload not found.' }
        $payloadDirectory = Join-Path $workspace 'setup-payload'
        [System.IO.Compression.ZipFile]::ExtractToDirectory($payloads[0].FullName, $payloadDirectory)
        $embeddedPackage = Join-Path $payloadDirectory 'irdashies-0.0.1-full.nupkg'
        if ((Get-FileHash -LiteralPath $embeddedPackage -Algorithm SHA256).Hash -ne $expectedPackageHash) {
            throw 'Setup.exe embeds a different package or regenerated the launcher.'
        }
        if ((Get-Content -LiteralPath (Join-Path $payloadDirectory 'RELEASES') -Raw).Trim() -ne $after.Trim()) {
            throw 'Setup.exe embeds a different RELEASES manifest.'
        }
        Write-Output 'PASS: Squirrel preserves the launcher and embeds the matching package and manifest.'
    } else {
        Write-Output 'SKIP: native Squirrel rebuild requires Windows (runs in CI).'
    }
} finally {
    if (Test-Path -LiteralPath $workspace) {
        Remove-Item -LiteralPath $workspace -Recurse -Force
    }
}
