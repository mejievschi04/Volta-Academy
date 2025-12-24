# Script pentru pornirea aplicației cu ngrok
# Acest script pornește backend-ul, frontend-ul și ngrok cu un singur link

Write-Host "🚀 Pornire Volta Academy cu ngrok..." -ForegroundColor Green

# Verifică dacă ngrok este instalat
$ngrokInstalled = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokInstalled) {
    Write-Host "❌ ngrok nu este instalat!" -ForegroundColor Red
    Write-Host "Instalează ngrok de la: https://ngrok.com/download" -ForegroundColor Yellow
    exit 1
}

# Verifică dacă porturile sunt libere
$port8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue

if ($port8000) {
    Write-Host "⚠️  Portul 8000 este deja folosit!" -ForegroundColor Yellow
}
if ($port5173) {
    Write-Host "⚠️  Portul 5173 este deja folosit!" -ForegroundColor Yellow
}

# Pornește backend-ul în background
Write-Host "📦 Pornire backend (port 8000)..." -ForegroundColor Cyan
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    Set-Location volta-backend
    php artisan serve
}

# Așteaptă puțin pentru ca backend-ul să pornească
Start-Sleep -Seconds 3

# Pornește frontend-ul în background
Write-Host "🎨 Pornire frontend (port 5173)..." -ForegroundColor Cyan
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    Set-Location volta-frontend
    npm run dev
}

# Așteaptă puțin pentru ca frontend-ul să pornească
Start-Sleep -Seconds 5

# Pornește ngrok pentru frontend (care include și proxy-ul pentru backend)
Write-Host "🌐 Pornire ngrok pentru frontend..." -ForegroundColor Cyan
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ Aplicația rulează!" -ForegroundColor Green
Write-Host "📱 Link-ul ngrok va apărea mai jos:" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

# Pornește ngrok
ngrok http 5173

# Cleanup când se oprește ngrok
Write-Host ""
Write-Host "🛑 Oprire servicii..." -ForegroundColor Yellow
try {
    Stop-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
} catch {
    Write-Host "⚠️  Eroare la oprirea job-urilor: $_" -ForegroundColor Yellow
}

# Oprește procesele dacă job-urile nu funcționează
Get-Process | Where-Object { $_.ProcessName -eq "php" -and $_.CommandLine -like "*artisan serve*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process | Where-Object { $_.ProcessName -eq "node" -and $_.CommandLine -like "*vite*" } | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "✅ Servicii oprite!" -ForegroundColor Green

