<?php

namespace App\Support;

use App\Models\User;

class UserEmail
{
    public static function normalize(string $email): string
    {
        return strtolower(trim($email));
    }

    /** Inclusiv conturile din coș: aceeași adresă nu deschide un al doilea cont. */
    public static function taken(string $email, ?int $ignoreUserId = null): bool
    {
        $query = User::withTrashed()->whereRaw('LOWER(email) = ?', [self::normalize($email)]);
        if ($ignoreUserId) {
            $query->whereKeyNot($ignoreUserId);
        }

        return $query->exists();
    }
}
