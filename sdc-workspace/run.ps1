param(
  [switch]$Deep
)

$ErrorActionPreference = "Stop"
$WorkspaceDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent $WorkspaceDir

Write-Host ""
Write-Host "Splice Detail Canvas - auto layout workspace" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: Node.js not found. Install Node 20+ from https://nodejs.org" -ForegroundColor Red
  exit 1
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: Python not found. Install Python 3.11+ from https://www.python.org/downloads/" -ForegroundColor Red
  exit 1
}

Set-Location $RepoRoot
$env:SDC_REPO_ROOT = $RepoRoot

if (-not (Test-Path "node_modules\tsx\dist\cli.mjs")) {
  Write-Host "[1/2] Installing npm dependencies..."
  npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Host "[1/2] npm dependencies OK"
}

Write-Host "[2/2] Installing Python sidecar..."
python -m pip install -e "tools/sdc-sidecar" -q
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Refreshing rules engine and running layout export..." -ForegroundColor Cyan
Write-Host "  Rules: src/features/rules/*.ts (TypeScript — same as web app)"
Write-Host ""

$nodeArgs = @($WorkspaceDir)
if ($Deep) { $nodeArgs += "--deep" }

node scripts/sdc-workspace-run.mjs @nodeArgs
$code = $LASTEXITCODE

Write-Host ""
if ($code -ne 0) {
  Write-Host "FAILED" -ForegroundColor Red
} else {
  Write-Host "SUCCESS - Import output\rank-*.sdc.json in the web app." -ForegroundColor Green
}
exit $code
