<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;

/**
 * Căutare după nume, prenume sau email, fără să ceară o echipă.
 * Fiecare cuvânt trebuie să apară în nume sau în email, indiferent de ordine,
 * majuscule sau diacritice românești.
 */
class DirectorySearch
{
    /** @var array<string, string> */
    private const FOLDS = [
        'ă' => 'a', 'Ă' => 'a', 'â' => 'a', 'Â' => 'a',
        'î' => 'i', 'Î' => 'i',
        'ș' => 's', 'Ș' => 's', 'ş' => 's', 'Ş' => 's',
        'ț' => 't', 'Ț' => 't', 'ţ' => 't', 'Ţ' => 't',
        'á' => 'a', 'Á' => 'a', 'à' => 'a', 'À' => 'a',
        'é' => 'e', 'É' => 'e', 'í' => 'i', 'Í' => 'i',
        'ó' => 'o', 'Ó' => 'o', 'ö' => 'o', 'Ö' => 'o',
        'ú' => 'u', 'Ú' => 'u', 'ü' => 'u', 'Ü' => 'u',
    ];

    public static function apply(Builder $query, ?string $search, array $columns = ['users.name', 'users.email']): void
    {
        $tokens = self::tokens($search);
        if ($tokens === []) {
            return;
        }

        $expressions = array_map(fn (string $column) => self::sqlFold($column), $columns);

        foreach ($tokens as $token) {
            $like = '%'.addcslashes($token, '%_\\').'%';
            $query->where(function (Builder $inner) use ($expressions, $like) {
                foreach ($expressions as $index => $expression) {
                    $method = $index === 0 ? 'whereRaw' : 'orWhereRaw';
                    $inner->{$method}($expression.' like ?', [$like]);
                }
            });
        }
    }

    /** @return list<string> */
    public static function tokens(?string $search): array
    {
        $folded = self::fold((string) $search);
        $parts = preg_split('/\s+/u', $folded, -1, PREG_SPLIT_NO_EMPTY);

        return $parts === false ? [] : array_values($parts);
    }

    public static function fold(string $value): string
    {
        $value = strtr($value, self::FOLDS);
        if (class_exists(\Normalizer::class)) {
            $normalized = \Normalizer::normalize($value, \Normalizer::FORM_D);
            if (is_string($normalized)) {
                $stripped = preg_replace('/\p{M}+/u', '', $normalized);
                if (is_string($stripped)) {
                    $value = $stripped;
                }
            }
        }

        return mb_strtolower($value);
    }

    private static function sqlFold(string $column): string
    {
        $expression = $column;
        foreach (self::FOLDS as $from => $to) {
            $expression = "replace({$expression}, '{$from}', '{$to}')";
        }

        return 'lower('.$expression.')';
    }
}
