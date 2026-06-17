$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$nodePort     = 3000
$analyzerPort = 5000
$nginxPort    = 80

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   CloudPolice - Starting Services"         -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Free occupied ports ---
Write-Host "[0/3] Checking ports ..." -ForegroundColor Yellow
foreach ($port in @($nodePort, $analyzerPort, $nginxPort)) {
    $proc = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
    if ($proc) {
        foreach ($pid_ in $proc) { Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Milliseconds 500
        Write-Host "  -> Port $port released" -ForegroundColor DarkYellow
    }
}

# --- Node.js on port 3000 ---
Write-Host "[1/3] Starting Node.js backend (port $nodePort) ..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "  -> Installing dependencies ..." -ForegroundColor DarkYellow
    npm install
}
$env:PORT = $nodePort
Start-Process powershell -ArgumentList @(
    "-NoProfile", "-NoExit",
    "-Command", "`$host.ui.RawUI.WindowTitle='CloudPolice - Node.js'; Set-Location '$scriptDir'; `$env:PORT='$nodePort'; node server.js"
) -WindowStyle Normal

# --- Python Flask on port 5000 ---
Write-Host "[2/3] Starting Python analyzer (port $analyzerPort) ..." -ForegroundColor Yellow
$analyzerDir = Join-Path $scriptDir "analyzer"
$pythonExe = $null
foreach ($c in @("python", "python3", "py")) {
    if (Get-Command $c -ErrorAction SilentlyContinue) { $pythonExe = $c; break }
}
if (-not $pythonExe) {
    Write-Error "Python not found in PATH."
    exit 1
}
Start-Process powershell -ArgumentList @(
    "-NoProfile", "-NoExit",
    "-Command", "`$host.ui.RawUI.WindowTitle='CloudPolice - Python'; Set-Location '$analyzerDir'; $pythonExe app.py"
) -WindowStyle Normal

# --- Nginx on port 80 ---
Write-Host "[3/3] Starting Nginx reverse proxy (port $nginxPort) ..." -ForegroundColor Yellow
$nginxDir  = Join-Path $scriptDir "nginx"
$nginxExe  = Join-Path $nginxDir "nginx.exe"
$nginxConf = Join-Path $nginxDir "conf\nginx.conf"
if (Test-Path $nginxExe) {
    & $nginxExe -p "$nginxDir" -s stop 2>&1 | Out-Null
    Start-Sleep -Milliseconds 800
    Start-Process $nginxExe -ArgumentList "-p `"$nginxDir`" -c `"$nginxConf`"" -WorkingDirectory $nginxDir -NoNewWindow
    Write-Host "  -> Nginx started" -ForegroundColor Green
} else {
    Write-Warning "  -> nginx.exe not found, skipped"
}

# --- Open browser ---
Start-Sleep -Seconds 2
Write-Host ""
Write-Host "Opening http://localhost ..." -ForegroundColor Cyan
Start-Process "http://localhost"

Write-Host ""
Write-Host "All services started. This window will close automatically." -ForegroundColor Green
Start-Sleep -Seconds 3
