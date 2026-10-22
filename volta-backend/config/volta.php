<?php

return [

    // FRONTEND_URL poate fi o listă separată prin virgulă (CORS); linkurile din emailuri folosesc prima adresă.
    'frontend_url' => rtrim(trim(explode(',', (string) env('FRONTEND_URL', env('APP_URL', 'http://localhost:5173')))[0]), '/'),

    'mail_from_name' => env('MAIL_FROM_NAME', env('APP_NAME', 'Volta Academy')),

    // Folderul backup-urilor LMS (baza de date + storage/app/public)
    'backup_root' => storage_path('app/lms-backups'),

    // Cererile API mai lente de atât (ms) se scriu în storage/logs/slow-requests-*.log. 0 = oprit.
    'slow_request_ms' => (int) env('VOLTA_SLOW_REQUEST_MS', 1000),

];
