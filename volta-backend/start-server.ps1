# Start Laravel development server with explicit host/port to avoid Laravel 12 parsing issues
Write-Host "Starting Laravel development server on http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "Note: You may see 'Undefined array key 1' errors - these are harmless and can be ignored." -ForegroundColor Yellow
$env:APP_ENV = "local"
php artisan serve --host=127.0.0.1 --port=8000 2>&1 | Where-Object { $_ -notmatch "Undefined array key" }

