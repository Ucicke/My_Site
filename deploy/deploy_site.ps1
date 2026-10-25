param([string]$EnvFile = (Join-Path $PSScriptRoot 'deploy.env'))
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$settings = @{}
Get-Content -LiteralPath $EnvFile -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') { $settings[$Matches[1].Trim()] = $Matches[2].Trim() }
}
foreach ($name in @('DEPLOY_HOST', 'DEPLOY_USER', 'DEPLOY_SSH_KEY_PATH', 'DEPLOY_REMOTE_DIR', 'DEPLOY_DOCROOT')) {
    if ([string]::IsNullOrWhiteSpace($settings[$name])) { throw "Missing setting: $name" }
}
$remoteRoot = $settings['DEPLOY_REMOTE_DIR'].TrimEnd('/')
$docroot = $settings['DEPLOY_DOCROOT'].TrimEnd('/')
foreach ($remotePath in @($remoteRoot, $docroot)) {
    if ($remotePath -notmatch '^/[A-Za-z0-9_./-]+$' -or $remotePath -match '(^|/)\.\.(/|$)') {
        throw "Invalid remote path: $remotePath"
    }
}
$port = if ($settings['DEPLOY_SSH_PORT']) { $settings['DEPLOY_SSH_PORT'] } else { '22' }
$target = $settings['DEPLOY_USER'] + '@' + $settings['DEPLOY_HOST']
$common = @('-i', $settings['DEPLOY_SSH_KEY_PATH'], '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15')
$sshOptions = @('-p', $port) + $common
$scpOptions = @('-P', $port) + $common

Push-Location $projectRoot
try {
    & node scripts/build.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Website build failed' }
} finally { Pop-Location }

$release = (Get-Date -Format 'yyyyMMddTHHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$releaseDir = "$remoteRoot/releases/$release"
$archive = Join-Path ([IO.Path]::GetTempPath()) "ucicke-site-$release.tar"
$publishFile = Join-Path ([IO.Path]::GetTempPath()) "ucicke-publish-$release.sh"
try {
    & tar -cf $archive -C (Join-Path $projectRoot 'dist') index.html site-assets
    if ($LASTEXITCODE -ne 0) { throw 'Cannot pack website' }
    $publishText = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'publish.sh')).Replace("`r`n", "`n").Replace("`r", "`n")
    [IO.File]::WriteAllText($publishFile, $publishText, [Text.UTF8Encoding]::new($false))
    & ssh @sshOptions $target "mkdir -p '$releaseDir'"
    if ($LASTEXITCODE -ne 0) { throw 'SSH connection or release preparation failed' }
    & scp @scpOptions $archive "${target}:$releaseDir/site.tar"
    if ($LASTEXITCODE -ne 0) { throw 'Website upload failed' }
    & scp @scpOptions $publishFile "${target}:$releaseDir/publish.sh"
    if ($LASTEXITCODE -ne 0) { throw 'Publisher upload failed' }
    & ssh @sshOptions $target "tar -xf '$releaseDir/site.tar' -C '$releaseDir' && bash '$releaseDir/publish.sh' '$releaseDir' '$docroot'"
    if ($LASTEXITCODE -ne 0) { throw 'Website publication failed; check previous-public-files in the release' }
    Write-Host "Published: https://ucicke.ru/ (release $release)"
} finally {
    Remove-Item -LiteralPath $archive, $publishFile -Force -ErrorAction SilentlyContinue
}
