<?php

return [

    /*
    | Cale completă opțională către Ghostscript (ex. gswin64c.exe pe Windows).
    | Dacă e goală, se încearcă în ordine: gswin64c, gswin32c, gs (din PATH).
    */
    'library_pdf_gs' => env('LIBRARY_PDF_GS'),

];
