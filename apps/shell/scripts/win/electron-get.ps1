param(
  [string]$Version = "30.0.9"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'

$zipName = "electron-v$Version-win32-x64.zip"
$destRoot = Join-Path $env:LOCALAPPDATA "electron"
$dest = Join-Path $destRoot "dist-$Version"
$destBin = Join-Path $dest "electron-v$Version-win32-x64"
$zipPath = Join-Path $env:TEMP $zipName

$urls = @(
  "https://github.com/electron/electron/releases/download/v$Version/$zipName",
  "https://npmmirror.com/mirrors/electron/$Version/$zipName"
)

if (!(Test-Path $destBin)) {
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  foreach ($u in $urls) {
    try {
      Write-Host "Downloading Electron $Version from $u ..."
      Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile $zipPath -TimeoutSec 120
      break
    } catch {
      Write-Warning "Download failed from $u : $($_.Exception.Message)"
    }
  }
  if (!(Test-Path $zipPath)) {
    throw "Electron $Version zip could not be downloaded from known mirrors."
  }
  Write-Host "Extracting $zipPath -> $dest ..."
  Expand-Archive -Force -Path $zipPath -DestinationPath $dest
}

$exe = Join-Path $destBin "electron.exe"
if (!(Test-Path $exe)) {
  throw "electron.exe not found at $exe (extraction failed)."
}

Write-Host "Electron ready at: $destBin"
Write-Host "Tip: this session can set ELECTRON_OVERRIDE_DIST_PATH:"
$env:ELECTRON_OVERRIDE_DIST_PATH = $destBin
Write-Host "ELECTRON_OVERRIDE_DIST_PATH=$env:ELECTRON_OVERRIDE_DIST_PATH"
