<?php

namespace App\Models\Concerns;

use App\Support\ImageOptimizer;

/**
 * La schimbarea copertei, creează miniatura folosită în liste (vezi ImageOptimizer::makeThumbnail).
 * Modelul definește COVER_COLUMN. Indiferent de unde e salvată coperta (builder, clonare, coperți PDF),
 * miniatura apare fără cod la fiecare upload; `volta:generate-thumbnails` completează ce lipsește.
 */
trait GeneratesCoverThumbnail
{
    protected static function bootGeneratesCoverThumbnail(): void
    {
        static::saved(function ($model) {
            $column = static::COVER_COLUMN;
            if ($model->wasChanged($column) || $model->wasRecentlyCreated) {
                try {
                    ImageOptimizer::makeThumbnail($model->{$column});
                } catch (\Throwable $e) {
                    report($e);
                }
            }
        });
    }
}
