<?php

return [

    /*
    | Cale completă opțională către Ghostscript (ex. gswin64c.exe pe Windows).
    | Dacă e goală, se încearcă în ordine: gswin64c, gswin32c, gs (din PATH).
    */
    'library_pdf_gs' => env('LIBRARY_PDF_GS'),

    /*
    | Maximum library upload size in KB. Keep this below PHP/Nginx body limits.
    | Laravel's `max` file validator uses KB.
    */
    'library_upload_max_kb' => (int) env('LIBRARY_UPLOAD_MAX_KB', 524288),

];
