param([string]$Version = "30.0.9")
$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$zipName = "electron-v$Version-win32-x64.zip"
$destRoot = Join-Path $env:LOCALAPPDATA "electron"
$dest     = Join-Path $destRoot "dist-$Version"
$zipPath  = Join-Path $env:TEMP $zipName

if (!(Test-Path $dest)) { New-Item -ItemType Directory -Force -Path $dest | Out-Null }

$urls = @(
  "https://github.com/electron/electron/releases/download/v$Version/$zipName",
  "https://npmmirror.com/mirrors/electron/$Version/$zipName"
)

$downloaded = $false
foreach ($u in $urls) {
  try {
    Write-Host "Downloading Electron $Version from $u ..."
    Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile $zipPath -TimeoutSec 180
    $downloaded = $true; break
  } catch {
    Write-Warning "Download failed from $u : $($_.Exception.Message)"
  }
}
if (-not $downloaded -or -not (Test-Path $zipPath)) {
  throw "Electron $Version zip could not be downloaded from known mirrors."
}

Write-Host "Extracting $zipPath -> $dest ..."
Expand-Archive -Force -Path $zipPath -DestinationPath $dest

# Robustly locate electron.exe regardless of nested folders
$exe = Get-ChildItem -Path $dest -Recurse -Filter electron.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $exe) {
  throw "electron.exe not found anywhere under $dest (extraction may have failed)."
}
$overrideDir = $exe.Directory.FullName
$env:ELECTRON_OVERRIDE_DIST_PATH = $overrideDir

Write-Host "Electron ready at: $overrideDir"
Write-Host "ELECTRON_OVERRIDE_DIST_PATH=$env:ELECTRON_OVERRIDE_DIST_PATH"
