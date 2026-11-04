<?php

namespace App\Console\Commands;

use App\Support\InlineImageExtractor;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Mută imaginile salvate base64 în conținut (HTML sau JSON) în fișiere comprimate din
 * storage/app/public/content/images și le înlocuiește cu URL-ul lor. Aceeași imagine devine un singur
 * fișier. Rulare unică după deploy; `--dry-run` doar numără.
 */
class ExtractInlineImagesCommand extends Command
{
    protected $signature = 'volta:extract-inline-images {--dry-run : Doar raportează, fără modificări}';

    protected $description = 'Mută imaginile base64 din conținut în fișiere și le înlocuiește cu URL-uri.';

    /** Coloanele în care editoarele sau copiile lor (versiuni publicate, snapshot-uri) pot conține imagini. */
    private const COLUMNS = [
        'lessons' => ['content'],
        'modules' => ['content'],
        'content_blocks' => ['payload'],
        'course_version_snapshots' => ['snapshot_json'],
        'questions' => ['content', 'answers', 'explanation'],
        'exam_questions' => ['question_text', 'payload'],
        'test_results' => ['question_snapshot'],
        'exam_attempt_sessions' => ['question_snapshot'],
        'courses' => ['description'],
        'events' => ['description'],
        'library_items' => ['body'],
    ];

    private int $bytesRemoved = 0;

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $extractor = new InlineImageExtractor($dryRun);
        $this->bytesRemoved = 0;

        foreach (self::COLUMNS as $table => $columns) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            foreach ($columns as $column) {
                if (! Schema::hasColumn($table, $column)) {
                    continue;
                }
                $rows = 0;
                DB::table($table)->select(['id', $column])->where($column, 'like', '%data:image%')
                    ->orderBy('id')
                    ->chunkById(50, function ($chunk) use ($table, $column, $dryRun, $extractor, &$rows) {
                        foreach ($chunk as $row) {
                            $value = (string) $row->{$column};
                            $replaced = $extractor->replace($value);
                            if ($replaced !== $value) {
                                $rows++;
                                $this->bytesRemoved += strlen($value) - strlen($replaced);
                                if (! $dryRun) {
                                    DB::table($table)->where('id', $row->id)->update([$column => $replaced]);
                                }
                            }
                        }
                    });
                if ($rows > 0) {
                    $this->line("{$table}.{$column}: {$rows} rânduri");
                }
            }
        }

        $mb = round($this->bytesRemoved / 1048576, 1);
        $this->info(($dryRun ? '[dry-run] ' : '') . "{$extractor->images} imagini, " . $extractor->uniqueFiles() . " fișiere unice, {$mb} MB scoși din baza de date.");

        return self::SUCCESS;
    }
}
