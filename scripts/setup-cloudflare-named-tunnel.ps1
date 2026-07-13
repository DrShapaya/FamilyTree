param(
  [string]$TunnelName = "familytree",
  [string]$Hostname = "tree.drshapaya.ru",
  [int]$Port = 8785
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$cloudflaredCandidates = @(
  "C:\Program Files (x86)\cloudflared\cloudflared.exe",
  "C:\Program Files\cloudflared\cloudflared.exe",
  (Join-Path $root ".tools\cloudflared.exe")
)
$cloudflaredExe = $cloudflaredCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $cloudflaredExe) {
  $command = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($command) { $cloudflaredExe = $command.Source }
}
if (-not $cloudflaredExe) {
  Write-Host "cloudflared is not installed." -ForegroundColor Red
  exit 1
}

$cloudflaredDir = Join-Path $env:USERPROFILE ".cloudflared"
$certPath = Join-Path $cloudflaredDir "cert.pem"
New-Item -ItemType Directory -Force -Path $cloudflaredDir | Out-Null

if (-not (Test-Path -LiteralPath $certPath)) {
  Write-Host "Cloudflare login is required."
  Write-Host "A browser page will open. Sign in, choose drshapaya.ru, and approve the tunnel certificate."
  & $cloudflaredExe tunnel login
}

if (-not (Test-Path -LiteralPath $certPath)) {
  Write-Host "Cloudflare login did not create $certPath." -ForegroundColor Red
  Write-Host "Run this script again after finishing login in the browser."
  exit 1
}

$existing = & $cloudflaredExe tunnel list --output json | ConvertFrom-Json
$tunnel = $existing | Where-Object { $_.name -eq $TunnelName } | Select-Object -First 1
if (-not $tunnel) {
  Write-Host "Creating tunnel '$TunnelName'..."
  & $cloudflaredExe tunnel create $TunnelName
  $existing = & $cloudflaredExe tunnel list --output json | ConvertFrom-Json
  $tunnel = $existing | Where-Object { $_.name -eq $TunnelName } | Select-Object -First 1
}

if (-not $tunnel) {
  Write-Host "Could not find created tunnel '$TunnelName'." -ForegroundColor Red
  exit 1
}

$tunnelId = $tunnel.id
$credentialsPath = Join-Path $cloudflaredDir "$tunnelId.json"
if (-not (Test-Path -LiteralPath $credentialsPath)) {
  Write-Host "Tunnel credentials file was not found: $credentialsPath" -ForegroundColor Red
  exit 1
}

$configPath = Join-Path $cloudflaredDir "familytree.yml"
$config = @"
tunnel: $tunnelId
credentials-file: "$($credentialsPath.Replace('\', '\\'))"

ingress:
  - hostname: $Hostname
    service: http://127.0.0.1:$Port
  - service: http_status:404
"@
$config | Set-Content -Path $configPath -Encoding UTF8

Write-Host "Routing $Hostname to tunnel '$TunnelName'..."
& $cloudflaredExe tunnel route dns $TunnelName $Hostname

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Config: $configPath"
Write-Host "Permanent URL: https://$Hostname"
Write-Host ""
Write-Host "Start it with:"
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\start-cloudflare-named-tunnel.ps1"
