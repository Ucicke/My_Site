[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('deadweed', 'scroll_hunter', 'dark_pool', 'rus_vs_yashcher', 'merge_rpg')]
    [string]$Game,

    [Parameter(Mandatory)]
    [string]$SourceRoot,

    [switch]$Push
)

$ErrorActionPreference = 'Stop'
$siteRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$SourceRoot = [IO.Path]::GetFullPath($SourceRoot)

if (-not (Test-Path -LiteralPath $SourceRoot -PathType Container)) {
    throw "Game source directory does not exist: $SourceRoot"
}

$pagesRoot = Join-Path $siteRoot 'pages-games'
$relativeGamePath = "pages-games/$Game"
$destination = Join-Path $pagesRoot $Game
$operationId = (Get-Date -Format 'yyyyMMddTHHmmssfff') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$operationRoot = Join-Path $siteRoot ".recycle-bin\pages-game-sync\$operationId"
$staging = Join-Path $operationRoot 'package'
$previous = Join-Path $operationRoot 'previous'
$failed = Join-Path $operationRoot 'failed-package'
$hadPrevious = Test-Path -LiteralPath $destination

function Copy-RequiredFile {
    param([string]$Source, [string]$TargetDirectory)

    if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
        throw "Required game file is missing: $Source"
    }
    Copy-Item -LiteralPath $Source -Destination $TargetDirectory
}

function Copy-RequiredDirectory {
    param([string]$Source, [string]$TargetDirectory)

    if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
        throw "Required game directory is missing: $Source"
    }
    Copy-Item -LiteralPath $Source -Destination $TargetDirectory -Recurse
}

function Invoke-CheckedTool {
    param([string]$Command, [string[]]$Arguments, [string]$WorkingDirectory)

    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "Required command is unavailable: $Command"
    }
    Push-Location -LiteralPath $WorkingDirectory
    try {
        & $Command @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$Command failed with exit code $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }
}

New-Item -ItemType Directory -Path $staging -Force | Out-Null

switch ($Game) {
    'deadweed' {
        Copy-RequiredFile (Join-Path $SourceRoot 'index.html') $staging
        foreach ($directory in @('css', 'js', 'assets')) {
            Copy-RequiredDirectory (Join-Path $SourceRoot $directory) $staging
        }
    }
    'scroll_hunter' {
        Copy-RequiredFile (Join-Path $SourceRoot 'index.html') $staging
        Copy-RequiredFile (Join-Path $SourceRoot 'style.css') $staging
        foreach ($directory in @('js', 'assets')) {
            Copy-RequiredDirectory (Join-Path $SourceRoot $directory) $staging
        }
    }
    'dark_pool' {
        Invoke-CheckedTool 'node.exe' @('tools/release.mjs') $SourceRoot
        $releaseRoot = Join-Path $SourceRoot 'dist'
        Copy-RequiredFile (Join-Path $releaseRoot 'index.html') $staging
        Copy-RequiredFile (Join-Path $releaseRoot 'game.js') $staging
        $spriteSource = Join-Path $releaseRoot 'assets\sprites'
        $spriteTarget = Join-Path $staging 'assets\sprites'
        if (-not (Test-Path -LiteralPath $spriteSource -PathType Container)) {
            throw "Dark Pool sprites are missing: $spriteSource"
        }
        New-Item -ItemType Directory -Path $spriteTarget -Force | Out-Null
        Get-ChildItem -LiteralPath $spriteSource -File | Copy-Item -Destination $spriteTarget
    }
    'rus_vs_yashcher' {
        Invoke-CheckedTool 'npm.cmd' @('run', 'build') $SourceRoot
        Copy-RequiredFile (Join-Path $SourceRoot 'index.html') $staging
        Copy-RequiredFile (Join-Path $SourceRoot 'styles.css') $staging
        $javascriptSource = Join-Path $SourceRoot 'js'
        if (-not (Test-Path -LiteralPath $javascriptSource -PathType Container)) {
            throw "Compiled JavaScript directory is missing: $javascriptSource"
        }
        $javascriptFiles = @(Get-ChildItem -LiteralPath $javascriptSource -File -Filter '*.js')
        if ($javascriptFiles.Count -eq 0) {
            throw "No compiled JavaScript files were found in $javascriptSource"
        }
        $javascriptTarget = Join-Path $staging 'js'
        New-Item -ItemType Directory -Path $javascriptTarget -Force | Out-Null
        $javascriptFiles | Copy-Item -Destination $javascriptTarget
    }
    'merge_rpg' {
        Copy-RequiredFile (Join-Path $SourceRoot 'index.html') $staging
        foreach ($directory in @('src', 'styles', 'assets')) {
            Copy-RequiredDirectory (Join-Path $SourceRoot $directory) $staging
        }
    }
}

$requiredFiles = switch ($Game) {
    'deadweed' { @('index.html', 'css/style.css', 'js/main.js') }
    'scroll_hunter' { @('index.html', 'style.css', 'js/core/main.js') }
    'dark_pool' { @('index.html', 'game.js', 'assets/sprites') }
    'rus_vs_yashcher' { @('index.html', 'styles.css', 'js/game.js') }
    'merge_rpg' { @('index.html', 'src/data/game-config.js', 'src/services/local-runtime.js', 'styles/layout.css', 'styles/components.css', 'assets') }
}
foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $staging $relativePath))) {
        throw "The $Game package is incomplete; missing $relativePath"
    }
}

$packageFiles = @(Get-ChildItem -LiteralPath $staging -File -Recurse)
$forbiddenFiles = @($packageFiles | Where-Object {
    $_.Name -match '^\.env($|\.)' -or $_.Extension -in @('.pem', '.key', '.p12', '.pfx', '.map')
})
if ($forbiddenFiles.Count -gt 0) {
    throw "Refusing to package credentials or development files: $($forbiddenFiles.Name -join ', ')"
}
$oversizedFiles = @($packageFiles | Where-Object { $_.Length -ge 100MB })
if ($oversizedFiles.Count -gt 0) {
    throw "GitHub cannot accept files of 100 MB or more: $($oversizedFiles.Name -join ', ')"
}

New-Item -ItemType Directory -Path $pagesRoot -Force | Out-Null
if ($hadPrevious) {
    Move-Item -LiteralPath $destination -Destination $previous
}
try {
    Move-Item -LiteralPath $staging -Destination $destination
    Invoke-CheckedTool 'npm.cmd' @('test') $siteRoot
    Invoke-CheckedTool 'npm.cmd' @('run', 'build') $siteRoot
} catch {
    if (Test-Path -LiteralPath $destination) {
        Move-Item -LiteralPath $destination -Destination $failed
    }
    if ($hadPrevious -and (Test-Path -LiteralPath $previous)) {
        Move-Item -LiteralPath $previous -Destination $destination
    }
    throw
}

$packageSize = ($packageFiles | Measure-Object -Property Length -Sum).Sum
Write-Host "Validated $Game Pages package: $($packageFiles.Count) files, $([math]::Round($packageSize / 1MB, 2)) MB."
if ($hadPrevious) {
    Write-Host "Previous package backup: $previous"
}

if (-not $Push) {
    Write-Host "Package synced and site checks passed. To publish, rerun this script with -Push."
    return
}

$git = 'git.exe'
$branch = @(& $git -C $siteRoot branch --show-current)
if ($LASTEXITCODE -ne 0 -or $branch.Count -ne 1 -or $branch[0] -ne 'master') {
    throw 'Publishing requires the site repository to be on branch master.'
}
$ahead = @(& $git -C $siteRoot rev-list --count origin/master..HEAD)
if ($LASTEXITCODE -ne 0 -or $ahead.Count -ne 1 -or [int]$ahead[0] -ne 0) {
    throw 'The site repository has commits not present on origin/master; publish those manually first.'
}
$workingChanges = @(& $git -C $siteRoot status --porcelain --untracked-files=all)
if ($LASTEXITCODE -ne 0) {
    throw 'Could not inspect the site repository working tree.'
}
$unexpectedChanges = @($workingChanges | Where-Object {
    $changedPath = $_.Substring(3).Replace('\', '/')
    $changedPath -ne $relativeGamePath -and -not $changedPath.StartsWith("$relativeGamePath/")
})
if ($unexpectedChanges.Count -gt 0) {
    throw "Refusing to commit while unrelated site changes exist: $($unexpectedChanges -join '; ')"
}

Invoke-CheckedTool $git @('-C', $siteRoot, 'add', '--', $relativeGamePath) $siteRoot
$stagedGameChanges = @(& $git -C $siteRoot status --porcelain -- $relativeGamePath)
if ($LASTEXITCODE -ne 0) {
    throw 'Could not inspect staged game files.'
}
if ($stagedGameChanges.Count -eq 0) {
    Write-Host "The $Game package is unchanged; no commit or push was needed."
    return
}
Invoke-CheckedTool $git @('-C', $siteRoot, 'commit', '--only', '-m', "Update $Game on GitHub Pages", '--', $relativeGamePath) $siteRoot
Invoke-CheckedTool $git @('-C', $siteRoot, 'push', 'origin', 'master') $siteRoot
Write-Host 'Pushed the game package. GitHub Actions will publish it to Pages.'
