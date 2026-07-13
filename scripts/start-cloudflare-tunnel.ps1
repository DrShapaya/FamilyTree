$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not installed or is not in PATH." -ForegroundColor Red
  exit 1
}

$localCloudflared = Join-Path $root ".tools\cloudflared.exe"
$programFilesCloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$cloudflaredCommand = Get-Command cloudflared -ErrorAction SilentlyContinue
if (Test-Path -LiteralPath $programFilesCloudflared) {
  $cloudflaredExe = $programFilesCloudflared
} elseif (Test-Path -LiteralPath $localCloudflared) {
  $cloudflaredExe = $localCloudflared
} elseif ($cloudflaredCommand) {
  $cloudflaredExe = $cloudflaredCommand.Source
} else {
  Write-Host "cloudflared is not installed or is not in PATH." -ForegroundColor Red
  Write-Host "Install it from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $root "node_modules"))) {
  Write-Host "Installing npm dependencies..."
  npm install
}

Write-Host "Starting FamilyTree server at http://127.0.0.1:8765 ..."
Start-Process -FilePath "powershell" -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$root'; npm start"
) -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Starting Cloudflare Quick Tunnel..."
Write-Host "Copy the https://*.trycloudflare.com address shown below and open it on your phone."
Write-Host ""
& $cloudflaredExe tunnel --url http://127.0.0.1:8765
