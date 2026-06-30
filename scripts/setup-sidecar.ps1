# One-time / refresh setup for SDC dev sidecar (Windows PowerShell)
# Usage: .\scripts\setup-sidecar.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not (Test-Path (Join-Path $Root "package.json"))) {
    $Root = (Get-Location).Path
}

Write-Host "SDC sidecar setup" -ForegroundColor Cyan
Write-Host "Repo: $Root"

Set-Location $Root
Write-Host "`nInstalling npm dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:SDC_REPO_ROOT = $Root
[Environment]::SetEnvironmentVariable("SDC_REPO_ROOT", $Root, "User")
Write-Host "Set SDC_REPO_ROOT (User): $Root"

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Warning "Python not found — install Python 3.11+ for the sidecar CLI."
} else {
    $ver = & python --version 2>&1
    Write-Host "Python: $ver"
    Set-Location (Join-Path $Root "tools\sdc-sidecar")
    Write-Host "`nInstalling Python sidecar (editable)..."
    python -m pip install -e .
    Write-Host "Optional Ray: python -m pip install -e `".[ray]`""
    Set-Location $Root
}

Write-Host "`nRunning verify..."
node scripts/sdc-verify.mjs
exit $LASTEXITCODE
