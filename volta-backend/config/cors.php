<?php
return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // pune exact URL-ul frontend-ului tău aici
    'allowed_origins' => ['http://localhost:5173'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    // important pentru cookies/autentificare
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
