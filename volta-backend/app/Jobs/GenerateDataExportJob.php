<?php

namespace App\Jobs;

use App\Models\ActivityLog;
use App\Models\Course;
use App\Models\Event;
use App\Models\Exam;
use App\Models\Setting;
use App\Models\Team;
use App\Models\Test;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Storage;

/**
 * Exportul JSON din Setări, generat în coadă: înainte toată baza se încărca în memorie într-o singură
 * cerere și pe date mari dădea timeout. Fișierul se scrie secțiune cu secțiune, în bucăți de câte 200
 * de rânduri; statusul stă lângă el (`<id>.meta.json`), iar fișierele mai vechi de o zi se șterg
 * la următorul export.
 */
class GenerateDataExportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public const DIRECTORY = 'exports';

    /** Sub DB_QUEUE_RETRY_AFTER (240 s), ca exportul să nu fie pornit a doua oară în paralel. */
    public int $timeout = 220;

    public int $tries = 1;

    public function __construct(public string $exportId, public int $userId)
    {
    }

    /** @return array{status: string, user_id: int}|null */
    public static function readStatus(string $exportId): ?array
    {
        $raw = Storage::disk('local')->get(self::DIRECTORY . '/' . $exportId . '.meta.json');
        $meta = $raw ? json_decode($raw, true) : null;

        return is_array($meta) ? $meta : null;
    }

    public static function writeStatus(string $exportId, string $status, int $userId): void
    {
        Storage::disk('local')->put(
            self::DIRECTORY . '/' . $exportId . '.meta.json',
            json_encode(['status' => $status, 'user_id' => $userId])
        );
    }

    public static function path(string $exportId): string
    {
        return self::DIRECTORY . '/' . $exportId . '.json';
    }

    public function handle(): void
    {
        $disk = Storage::disk('local');
        foreach ($disk->files(self::DIRECTORY) as $old) {
            if ($disk->lastModified($old) < now()->subDay()->getTimestamp()) {
                $disk->delete($old);
            }
        }
        $disk->makeDirectory(self::DIRECTORY);

        $handle = fopen($disk->path(self::path($this->exportId) . '.part'), 'w');
        try {
            fwrite($handle, '{');
            $this->writeValue($handle, 'format_version', 2);
            $this->writeValue($handle, 'backup_complete', false);
            $this->writeValue($handle, 'backup_scope', 'partial_settings_export');
            $this->writeValue($handle, 'missing', ['storage_files', 'media_binaries', 'full_test_results', 'message_threads']);
            $this->writeValue($handle, 'warning', 'Acest export nu este un backup LMS complet. Pentru recuperare folosiți dump-ul bazei de date și copia storage.');
            $this->writeValue($handle, 'export_date', now()->toISOString());
            $this->writeRows($handle, 'users', User::with(['teams', 'courses']));
            $this->writeRows($handle, 'courses', Course::with(['modules.lessons.contentBlocks', 'lessons.contentBlocks', 'teacher', 'courseTests.test.questions']));
            $this->writeRows($handle, 'teams', Team::with(['users', 'courses', 'owner']));
            $this->writeRows($handle, 'events', Event::with(['instructor']));
            $this->writeRows($handle, 'exams', Exam::with(['course', 'questions.answers']));
            $this->writeRows($handle, 'tests', Test::with(['questions']));
            $this->writeValue($handle, 'activity_logs', ActivityLog::with(['user'])->latest()->limit(1000)->get());
            $this->writeValue($handle, 'settings', Setting::all(), last: true);
            fwrite($handle, '}');
        } finally {
            fclose($handle);
        }

        $disk->move(self::path($this->exportId) . '.part', self::path($this->exportId));
        self::writeStatus($this->exportId, 'ready', $this->userId);
    }

    public function failed(\Throwable $e): void
    {
        self::writeStatus($this->exportId, 'failed', $this->userId);
        Storage::disk('local')->delete(self::path($this->exportId) . '.part');
    }

    /** @param resource $handle */
    private function writeValue($handle, string $key, mixed $value, bool $last = false): void
    {
        fwrite($handle, json_encode($key) . ':' . json_encode($value) . ($last ? '' : ','));
    }

    /** @param resource $handle */
    private function writeRows($handle, string $key, Builder $query): void
    {
        fwrite($handle, json_encode($key) . ':[');
        $first = true;
        foreach ($query->lazyById(200) as $row) {
            fwrite($handle, ($first ? '' : ',') . json_encode($row));
            $first = false;
        }
        fwrite($handle, '],');
    }
}
