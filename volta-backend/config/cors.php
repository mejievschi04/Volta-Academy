<?php
return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // pune exact URL-ul frontend-ului tău aici
    'allowed_origins' => ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    // important pentru cookies/autentificare
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
