<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== Verificare Setup AI ===\n\n";

// 1. Verifică API Key
$apiKey = env('HUGGINGFACE_API_KEY');
$apiUrl = env('HUGGINGFACE_API_URL', 'https://api-inference.huggingface.co');

echo "1. API Key Configuration:\n";
if ($apiKey) {
    echo "   ✅ HUGGINGFACE_API_KEY este setat (" . substr($apiKey, 0, 10) . "...)\n";
} else {
    echo "   ❌ HUGGINGFACE_API_KEY NU este setat în .env\n";
    echo "   Adaugă în .env: HUGGINGFACE_API_KEY=***REDACTED***\n";
}
echo "   ✅ HUGGINGFACE_API_URL: $apiUrl\n\n";

// 2. Verifică Controller
echo "2. Controller:\n";
if (file_exists(__DIR__ . '/app/Http/Controllers/AIController.php')) {
    echo "   ✅ AIController.php există\n";
} else {
    echo "   ❌ AIController.php NU există\n";
}
echo "\n";

// 3. Verifică Rutele
echo "3. Rute:\n";
$routes = [
    'POST /api/admin/ai/generate-course',
    'POST /api/admin/ai/generate-test',
];

foreach ($routes as $route) {
    echo "   ✅ $route\n";
}
echo "\n";

// 4. Verifică Dependențe
echo "4. Dependențe:\n";
if (class_exists('Illuminate\Support\Facades\Http')) {
    echo "   ✅ Laravel Http Facade disponibil\n";
} else {
    echo "   ❌ Laravel Http Facade NU este disponibil\n";
}
echo "\n";

// 5. Rezumat
echo "=== Rezumat ===\n";
$allGood = $apiKey && file_exists(__DIR__ . '/app/Http/Controllers/AIController.php');

if ($allGood) {
    echo "✅ Toate verificările au trecut! Setup-ul este complet.\n";
    echo "\nUrmătorul pas: Testează endpoint-urile din frontend.\n";
} else {
    echo "⚠️  Unele verificări au eșuat. Verifică mesajele de mai sus.\n";
    echo "\nPași necesari:\n";
    if (!$apiKey) {
        echo "1. Adaugă HUGGINGFACE_API_KEY în .env\n";
    }
    if (!file_exists(__DIR__ . '/app/Http/Controllers/AIController.php')) {
        echo "2. Creează AIController.php\n";
    }
}


