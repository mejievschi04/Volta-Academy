<?php

namespace App\Console\Commands;

use App\Models\MediaAsset;
use App\Support\ImageOptimizer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * Trece imaginile deja salvate (coperte, poze din lecții) prin același WebP mai moale folosit la upload
 * și reface miniaturile din liste. Căile din bază se actualizează când se schimbă extensia.
 */
class RecompressImagesCommand extends Command
{
    protected $signature = 'volta:recompress-images';

    protected $description = 'Micșorează imaginile salvate în WebP și reface miniaturile.';

    /** Coloane text care pot conține calea veche. */
    private const PATH_COLUMNS = [
        ['course_maps', 'cover_image_path'],
        ['courses', 'image'],
        ['exams', 'cover_image_path'],
        ['guide_items', 'cover_image_path'],
        ['library_items', 'cover_image_path'],
        ['library_items', 'stored_path'],
        ['library_items', 'body'],
        ['lessons', 'content'],
        ['lessons', 'attachments'],
        ['modules', 'content'],
        ['content_blocks', 'source'],
        ['content_blocks', 'payload'],
        ['questions', 'content'],
        ['questions', 'answers'],
        ['questions', 'explanation'],
        ['questions', 'metadata'],
        ['exam_questions', 'payload'],
        ['course_version_snapshots', 'snapshot_json'],
        ['events', 'thumbnail'],
        ['users', 'avatar'],
        ['categories', 'image'],
    ];

    public function handle(): int
    {
        $disk = Storage::disk('public');
        $converted = 0;
        $savedBytes = 0;

        foreach ($disk->allFiles() as $path) {
            if (str_ends_with($path, '.thumb.webp')) {
                continue;
            }
            $result = ImageOptimizer::recompressStored($path, $this->maxSide($path));
            if ($result === null) {
                continue;
            }
            if ($result['changed']) {
                $this->rewriteReferences($result['from'], $result['to'], $result['after']);
                $converted++;
                $savedBytes += max(0, $result['before'] - $result['after']);
                $this->line(sprintf(
                    '%s → %s (%d KB → %d KB)',
                    $result['from'],
                    $result['to'],
                    (int) round($result['before'] / 1024),
                    (int) round($result['after'] / 1024),
                ));
            }
            ImageOptimizer::makeThumbnail($result['to']);
        }

        $this->info("{$converted} imagini transformate, ".round($savedBytes / 1024).' KB mai puțin. Miniaturile sunt refăcute.');

        return self::SUCCESS;
    }

    private function maxSide(string $path): int
    {
        if (str_contains($path, 'avatar')) {
            return ImageOptimizer::AVATAR_MAX;
        }
        if (str_starts_with($path, 'content-blocks/')) {
            return ImageOptimizer::CONTENT_MAX;
        }

        return ImageOptimizer::COVER_MAX;
    }

    private function rewriteReferences(string $from, string $to, int $bytes): void
    {
        foreach (self::PATH_COLUMNS as [$table, $column]) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column) || ! Schema::hasColumn($table, 'id')) {
                continue;
            }
            $rows = DB::table($table)->where($column, 'like', '%'.$from.'%')->get(['id', $column]);
            foreach ($rows as $row) {
                $current = $row->{$column};
                if (! is_string($current) || ! str_contains($current, $from)) {
                    continue;
                }
                DB::table($table)->where('id', $row->id)->update([
                    $column => str_replace($from, $to, $current),
                ]);
            }
        }

        MediaAsset::query()->where('path', $from)->each(function (MediaAsset $asset) use ($to, $bytes) {
            $asset->path = $to;
            $asset->mime_type = 'image/webp';
            $asset->size = $bytes;
            $asset->filename = preg_replace('/\.(png|jpe?g|webp)$/i', '.webp', (string) $asset->filename) ?? $asset->filename;
            $asset->save();
        });
    }
}
