param(
  [string]$ConfigPath = "$env:USERPROFILE\.cloudflared\familytree.yml",
  [int]$Port = 8785
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

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

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  Write-Host "Tunnel config not found: $ConfigPath" -ForegroundColor Red
  Write-Host "Run scripts\setup-cloudflare-named-tunnel.ps1 first."
  exit 1
}

function Test-FamilyTreeHealth {
  param([int]$Port)
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -Method Get -TimeoutSec 2
    return [bool]($health.ok -and $health.sync)
  } catch {
    return $false
  }
}

if (-not (Test-FamilyTreeHealth -Port $Port)) {
  Write-Host "Starting FamilyTree server at http://127.0.0.1:$Port ..."
  Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$root'; `$env:PORT='$Port'; npm start"
  ) -WindowStyle Normal

  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    Start-Sleep -Milliseconds 500
    if (Test-FamilyTreeHealth -Port $Port) {
      $ready = $true
      break
    }
  }
  if (-not $ready) {
    Write-Host "FamilyTree server did not become ready at http://127.0.0.1:$Port/api/health." -ForegroundColor Red
    exit 1
  }
}

Write-Host "Starting permanent Cloudflare Tunnel..."
Write-Host "Public URL: https://drshapaya.ru"
Write-Host "URL: https://tree.drshapaya.ru"
& $cloudflaredExe tunnel --config $ConfigPath run
