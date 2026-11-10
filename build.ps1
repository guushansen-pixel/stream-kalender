<#
.SYNOPSIS
    Baut die Stream-Kalender-APK ueber apk-builder.
.DESCRIPTION
    Stellt in build\www die Web-App plus die aktuelle data\matches.json zusammen
    (mitgelieferter Fallback, falls die App beim ersten Start offline ist) und ruft
    dann apk-builder auf. -Online ist Pflicht: die App laedt ihre Daten aus dem
    GitHub-Repo, externe Sender-Links oeffnen im System-Browser (das erledigt das
    apk-builder-Template bereits selbst, kein Patch noetig).
.EXAMPLE
    .\build.ps1 -Release
    .\build.ps1 -VersionName "1.1" -VersionCode 2 -Release -Install
#>
[CmdletBinding()]
param(
    [string]$VersionName = '1.0',
    [int]$VersionCode = 1,
    [switch]$Release,
    [switch]$Install
)

$ErrorActionPreference = 'Stop'

$ApkBuilder = "D:\claude code projects\apk-builder"
$Project    = $PSScriptRoot
$AppName    = "StreamKalender"
$PackageId  = "com.daniel.streamkalender"

$staging = Join-Path $Project 'build\www'
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Force (Join-Path $staging 'data') | Out-Null
Copy-Item (Join-Path $Project 'web\*') $staging -Recurse
$data = Join-Path $Project 'data\matches.json'
if (-not (Test-Path $data)) { throw "data\matches.json fehlt - erst 'node pipeline\build.mjs' laufen lassen." }
Copy-Item $data (Join-Path $staging 'data\matches.json')
# Dieselben Daten als Skript: fetch() auf file:///android_asset scheitert im WebView, ein
# <script src> nicht. index.html liest window.BUNDLED_DATA, wenn der Online-Abruf fehlschlaegt.
# Ohne BOM schreiben, und U+2028/2029 maskieren (in JSON erlaubt, in aelteren JS-Engines nicht).
$json = [System.IO.File]::ReadAllText($data).Trim().Replace([string][char]0x2028, ' ').Replace([string][char]0x2029, ' ')
[System.IO.File]::WriteAllText((Join-Path $staging 'data\matches.js'), "window.BUNDLED_DATA = $json;`n", (New-Object System.Text.UTF8Encoding($false)))

& "$ApkBuilder\new-app.ps1" -Name $AppName -PackageId $PackageId `
    -WebRoot $staging `
    -Icon (Join-Path $Project 'icon.xml') `
    -IconBackground "#0F1419" `
    -VersionName $VersionName -VersionCode $VersionCode -Online -Force

$buildArgs = @{ App = $AppName }
if ($Release) { $buildArgs.Release = $true }
if ($Install) { $buildArgs.Install = $true }
& "$ApkBuilder\build-apk.ps1" @buildArgs
