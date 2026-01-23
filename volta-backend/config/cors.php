<?php
return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Frontend URL from environment variable, fallback to localhost
    'allowed_origins' => env('FRONTEND_URL') 
        ? array_map('trim', explode(',', env('FRONTEND_URL')))
        : [
            'http://localhost:5173', 
            'http://localhost:5174', 
            'http://localhost:5175',
        ],
    
    // Permite toate domeniile ngrok (pentru development)
    'allowed_origins_patterns' => [
        '#^https?://.*\.ngrok-free\.app$#',
        '#^https?://.*\.ngrok\.io$#',
        '#^https?://.*\.ngrok\.app$#',
    ],


    'allowed_headers' => ['*'],

    // important pentru cookies/autentificare
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
