<?php

namespace App\Console\Commands;

use App\Support\ImageOptimizer;
use Illuminate\Console\Command;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

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

    // În JSON slash-urile pot fi scăpate (`data:image\/png`), iar base64 poate conține `\/`.
    private const PATTERN = '#data:image(\\\\?/)(png|jpe?g|gif|webp);base64,((?:[A-Za-z0-9+/=]|\\\\/)+)#i';

    /** @var array<string, string> sha1 → URL, ca aceeași imagine să fie salvată o dată */
    private array $stored = [];

    private int $images = 0;

    private int $bytesRemoved = 0;

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $this->stored = [];
        $this->images = 0;
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
                    ->chunkById(50, function ($chunk) use ($table, $column, $dryRun, &$rows) {
                        foreach ($chunk as $row) {
                            $value = (string) $row->{$column};
                            $replaced = $this->replaceImages($value, $dryRun);
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
        $this->info(($dryRun ? '[dry-run] ' : '') . "{$this->images} imagini, " . count($this->stored) . " fișiere unice, {$mb} MB scoși din baza de date.");

        return self::SUCCESS;
    }

    private function replaceImages(string $value, bool $dryRun): string
    {
        return preg_replace_callback(self::PATTERN, function (array $m) use ($dryRun) {
            $escaped = $m[1] === '\\/';
            $bytes = base64_decode(str_replace('\\/', '/', $m[3]), true);
            if ($bytes === false || $bytes === '') {
                return $m[0];
            }
            $this->images++;
            $url = $this->stored[sha1($bytes)] ??= $dryRun ? '/storage/content/images/dry-run' : $this->store($bytes, strtolower($m[2]));

            return $escaped ? str_replace('/', '\\/', $url) : $url;
        }, $value) ?? $value;
    }

    private function store(string $bytes, string $extension): string
    {
        $hash = sha1($bytes);
        $tmp = tempnam(sys_get_temp_dir(), 'inline');
        file_put_contents($tmp, $bytes);
        try {
            $mime = $extension === 'jpg' ? 'image/jpeg' : 'image/' . $extension;
            $file = ImageOptimizer::optimize(new UploadedFile($tmp, "{$hash}.{$extension}", $mime, null, true));
            $path = $file->storeAs('content/images', $hash . '.' . $file->getClientOriginalExtension(), 'public');
        } finally {
            @unlink($tmp);
        }

        return '/storage/' . $path;
    }
}
