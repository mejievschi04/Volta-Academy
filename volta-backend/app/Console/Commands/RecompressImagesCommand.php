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
    protected $signature = 'volta:recompress-images
        {--repair : Doar repară referințele vechi (.png/.jpg) către fișiere deja transformate în .webp}';

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

    /** @var list<array{0: string, 1: string}>|null */
    private ?array $pathColumns = null;

    public function handle(): int
    {
        $disk = Storage::disk('public');
        if ($this->option('repair')) {
            return $this->repairReferences($disk);
        }
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
                $this->rewriteReferences([$result['from']], $result['to'], $result['after']);
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

    /**
     * O rulare anterioară a transformat fișierele, dar n-a găsit căile din coloanele JSON (slash-uri escapate),
     * așa că versiunile publicate încă cer .png/.jpg care nu mai există. Le îndreptăm spre .webp.
     */
    private function repairReferences($disk): int
    {
        $fixed = 0;
        foreach ($disk->allFiles() as $path) {
            if (! str_ends_with($path, '.webp') || str_ends_with($path, '.thumb.webp')) {
                continue;
            }
            $base = substr($path, 0, -5);
            $missing = array_values(array_filter(
                array_map(fn (string $ext) => $base.$ext, ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG']),
                fn (string $old) => ! $disk->exists($old),
            ));
            $rows = $this->rewriteReferences($missing, $path, (int) $disk->size($path));
            if ($rows > 0) {
                $fixed += $rows;
                $this->line("{$base}.* → {$path} ({$rows} rânduri)");
            }
        }
        $this->info("{$fixed} rânduri reparate.");

        return self::SUCCESS;
    }

    /**
     * Înlocuiește căile vechi cu cea nouă, inclusiv în forma escapată din JSON (`content-blocks\/image\/x.png`).
     *
     * @param  list<string>  $fromPaths
     * @return int rânduri schimbate
     */
    private function rewriteReferences(array $fromPaths, string $to, int $bytes): int
    {
        if ($fromPaths === []) {
            return 0;
        }
        $pairs = [];
        foreach ($fromPaths as $from) {
            $pairs[$from] = $to;
            $pairs[str_replace('/', '\\/', $from)] = str_replace('/', '\\/', $to);
        }
        // Numele fără extensie apare la fel în ambele forme; filtrul fin îl face strtr.
        $needle = '%'.pathinfo($fromPaths[0], PATHINFO_FILENAME).'.%';
        $changed = 0;

        foreach ($this->pathColumns() as [$table, $column]) {
            // Pe PostgreSQL, LIKE nu merge direct pe coloane json/jsonb: comparăm textul.
            $rows = DB::table($table)
                ->whereRaw('CAST('.DB::getQueryGrammar()->wrap($column).' AS TEXT) LIKE ?', [$needle])
                ->get(['id', $column]);
            foreach ($rows as $row) {
                $current = $row->{$column};
                if (! is_string($current)) {
                    continue;
                }
                $next = strtr($current, $pairs);
                if ($next === $current) {
                    continue;
                }
                DB::table($table)->where('id', $row->id)->update([$column => $next]);
                $changed++;
            }
        }

        MediaAsset::query()->whereIn('path', $fromPaths)->each(function (MediaAsset $asset) use ($to, $bytes) {
            $asset->path = $to;
            $asset->mime_type = 'image/webp';
            $asset->size = $bytes;
            $asset->filename = preg_replace('/\.(png|jpe?g|webp)$/i', '.webp', (string) $asset->filename) ?? $asset->filename;
            $asset->save();
        });

        return $changed;
    }

    /** @return list<array{0: string, 1: string}> coloanele din PATH_COLUMNS care există în baza curentă */
    private function pathColumns(): array
    {
        return $this->pathColumns ??= array_values(array_filter(
            self::PATH_COLUMNS,
            fn (array $c) => Schema::hasTable($c[0]) && Schema::hasColumn($c[0], $c[1]) && Schema::hasColumn($c[0], 'id'),
        ));
    }
}
