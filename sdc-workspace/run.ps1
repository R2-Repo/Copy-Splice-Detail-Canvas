$ErrorActionPreference = "Stop"
$WorkspaceDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent $WorkspaceDir

Write-Host ""
Write-Host "Splice Detail Canvas - auto layout workspace" -ForegroundColor Cyan
Write-Host ""

Set-Location $RepoRoot
if (-not (Test-Path "node_modules\tsx\dist\cli.mjs")) {
  Write-Host "Installing npm dependencies..."
  npm install
}

node scripts/sdc-workspace-run.mjs $WorkspaceDir
$code = $LASTEXITCODE

Write-Host ""
if ($code -ne 0) {
  Write-Host "FAILED" -ForegroundColor Red
} else {
  Write-Host "Import output\rank-*.sdc.json in the web app (Import file)." -ForegroundColor Green
}
exit $code
