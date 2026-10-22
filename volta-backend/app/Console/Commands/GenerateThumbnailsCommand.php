<?php

namespace App\Console\Commands;

use App\Models\Course;
use App\Models\CourseMap;
use App\Models\GuideItem;
use App\Models\LibraryItem;
use App\Support\ImageOptimizer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Creează miniaturile lipsă ale copertelor (cursuri, mape, bibliotecă, ghiduri). Copertele noi primesc
 * miniatura la salvare; comanda acoperă copertele existente și fișierele copiate pe alte căi.
 */
class GenerateThumbnailsCommand extends Command
{
    protected $signature = 'volta:generate-thumbnails {--force : Recreează și miniaturile existente}';

    protected $description = 'Creează miniaturile copertelor folosite în liste.';

    public function handle(): int
    {
        $created = 0;
        foreach ([Course::class, CourseMap::class, LibraryItem::class, GuideItem::class] as $model) {
            $column = $model::COVER_COLUMN;
            $model::query()->whereNotNull($column)->where($column, '!=', '')
                ->select(['id', $column])
                ->chunkById(200, function ($items) use ($column, &$created) {
                    foreach ($items as $item) {
                        $path = ltrim(preg_replace('#^/?storage/#', '', (string) $item->{$column}), '/');
                        if (! $this->option('force') && Storage::disk('public')->exists(ImageOptimizer::thumbnailPath($path))) {
                            continue;
                        }
                        if (ImageOptimizer::makeThumbnail($path)) {
                            $created++;
                        }
                    }
                });
        }

        $this->info("{$created} miniaturi create.");

        return self::SUCCESS;
    }
}
