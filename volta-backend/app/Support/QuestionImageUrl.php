<?php

namespace App\Support;

/**
 * Imaginea unei perechi din „potrivire imagini”. Acceptă fișierele încărcate în storage
 * (`/storage/...`) și, pentru întrebările vechi, linkuri http(s). Orice altceva devine gol.
 */
final class QuestionImageUrl
{
    public static function sanitize(mixed $url): string
    {
        $url = trim(is_string($url) ? $url : (string) $url);
        if ($url === '') {
            return '';
        }
        if (preg_match('#^/storage/[^\s]+$#', $url) === 1 && ! str_contains($url, '..')) {
            return $url;
        }
        if (preg_match('#^https?://[^\s]+$#i', $url) === 1) {
            return $url;
        }

        return '';
    }
}
