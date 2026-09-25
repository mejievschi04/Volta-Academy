<?php

return [

    // FRONTEND_URL poate fi o listă separată prin virgulă (CORS); linkurile din emailuri folosesc prima adresă.
    'frontend_url' => rtrim(trim(explode(',', (string) env('FRONTEND_URL', env('APP_URL', 'http://localhost:5173')))[0]), '/'),

    'mail_from_name' => env('MAIL_FROM_NAME', env('APP_NAME', 'Volta Academy')),

];
