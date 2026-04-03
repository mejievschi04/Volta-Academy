<?php

/**
 * Evităm `Sanctum::currentApplicationUrlWithPort()` aici: la `migrate` / `config:cache` fișierul de config
 * se încarcă foarte devreme; dacă autoload-ul sau pachetul lipsește parțial, apare „Class Sanctum not found”.
 * Logica este aceeași ca în Laravel\Sanctum\Sanctum::currentApplicationUrlWithPort().
 */
$defaultStatefulDomains = 'localhost,localhost:3000,localhost:5173,127.0.0.1,127.0.0.1:8000,::1';
$appUrl = env('APP_URL');
if (is_string($appUrl) && $appUrl !== '') {
    $host = parse_url($appUrl, PHP_URL_HOST);
    if (is_string($host) && $host !== '') {
        $port = parse_url($appUrl, PHP_URL_PORT);
        $defaultStatefulDomains .= ','.$host.($port ? ':'.$port : '');
    }
}

return [

    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', $defaultStatefulDomains)),

    'guard' => ['web'],

    'expiration' => null,

    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    'middleware' => [
        'authenticate_session' => Laravel\Sanctum\Http\Middleware\AuthenticateSession::class,
        'encrypt_cookies' => Illuminate\Cookie\Middleware\EncryptCookies::class,
        'validate_csrf_token' => Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
    ],

];
