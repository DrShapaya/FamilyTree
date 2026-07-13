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

function Test-PortOpen {
  param([int]$Port)
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $result = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if (-not $result.AsyncWaitHandle.WaitOne(250, $false)) {
      return $false
    }
    $client.EndConnect($result)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
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

$port = 8765
$serverAlreadyRunning = $false
while ($port -lt 8800) {
  if (Test-FamilyTreeHealth -Port $port) {
    $serverAlreadyRunning = $true
    break
  }
  if (-not (Test-PortOpen -Port $port)) {
    break
  }
  Write-Host "Port $port is busy with another server; trying $($port + 1)." -ForegroundColor Yellow
  $port += 1
}

if ($port -ge 8800) {
  Write-Host "Could not find a free port between 8765 and 8799." -ForegroundColor Red
  exit 1
}

$serverUrl = "http://127.0.0.1:$port"
if ($serverAlreadyRunning) {
  Write-Host "FamilyTree server is already running at $serverUrl"
} else {
  Write-Host "Starting FamilyTree server at $serverUrl ..."
  Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$root'; `$env:PORT='$port'; npm start"
  ) -WindowStyle Normal

  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    Start-Sleep -Milliseconds 500
    if (Test-FamilyTreeHealth -Port $port) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    Write-Host "FamilyTree server did not become ready at $serverUrl/api/health." -ForegroundColor Red
    Write-Host "Check the server window for errors."
    exit 1
  }
}

Write-Host ""
Write-Host "Starting Cloudflare Quick Tunnel..."
Write-Host "Copy the https://*.trycloudflare.com address shown below and open it on your phone."
Write-Host ""
& $cloudflaredExe tunnel --url $serverUrl
