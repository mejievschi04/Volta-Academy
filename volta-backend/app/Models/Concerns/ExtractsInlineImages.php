<?php

namespace App\Models\Concerns;

use App\Support\InlineImageExtractor;

/**
 * Imaginile base64 ajunse în conținut (ex. lipite în editor) devin fișiere la salvare, ca răspunsurile
 * care includ conținutul să nu crească la zeci de MB. Modelul definește INLINE_IMAGE_COLUMNS.
 * Lucrăm pe valoarea brută din baza de date, deci merge și pentru coloanele JSON (cast array).
 */
trait ExtractsInlineImages
{
    protected static function bootExtractsInlineImages(): void
    {
        static::saving(function ($model) {
            $extractor = null;
            $raw = $model->getAttributes();
            $changed = false;
            foreach (static::INLINE_IMAGE_COLUMNS as $column) {
                $value = $raw[$column] ?? null;
                if (! is_string($value) || ! $model->isDirty($column) || ! InlineImageExtractor::contains($value)) {
                    continue;
                }
                $extractor ??= new InlineImageExtractor();
                try {
                    $replaced = $extractor->replace($value);
                } catch (\Throwable $e) {
                    report($e);

                    continue;
                }
                if ($replaced !== $value) {
                    $raw[$column] = $replaced;
                    $changed = true;
                }
            }
            if ($changed) {
                $model->setRawAttributes($raw);
            }
        });
    }
}
