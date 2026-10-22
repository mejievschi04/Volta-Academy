<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\Notification;
use App\Support\StudentSessionLogger;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Curățare săptămânală a datelor care cresc continuu:
 * - timpul de învățare (un rând la fiecare minut pe lecție) și deschiderile de sesiune mai vechi de
 *   `--days` devin un singur rând pe oră pentru fiecare elev (și lecție). Totalurile, graficul pe zile
 *   și cel pe ore rămân identice: rândul comprimat păstrează suma secundelor și numărul de evenimente.
 * - notificările citite mai vechi de 30 de zile și cele de tipurile oprite se șterg.
 * Restul jurnalului (lecții finalizate, publicări, autentificări) rămâne neatins.
 */
class CompactActivityDataCommand extends Command
{
    protected $signature = 'volta:compact-activity {--days=7 : Vechimea de la care rândurile se comprimă}';

    protected $description = 'Comprimă jurnalul de activitate pe ore și curăță notificările vechi.';

    /** Tipuri de notificări care nu se mai creează (vezi NotificationService). */
    private const OBSOLETE_NOTIFICATION_TYPES = ['new_message', 'course_published', 'course_deadline'];

    private const COMPACTED_ACTIONS = ['telemetry.learner_focus_seconds', StudentSessionLogger::ACTION];

    public function handle(): int
    {
        $cutoff = now()->subDays(max(1, (int) $this->option('days')))->startOfHour();

        $before = ActivityLog::whereIn('action', self::COMPACTED_ACTIONS)->where('created_at', '<', $cutoff)->count();
        $oldest = ActivityLog::whereIn('action', self::COMPACTED_ACTIONS)->where('created_at', '<', $cutoff)->min('created_at');
        if ($oldest) {
            // pe zile, ca memoria să rămână mică indiferent de volum
            for ($day = Carbon::parse($oldest)->startOfDay(); $day->lt($cutoff); $day->addDay()) {
                $this->compactRange($day->copy(), $day->copy()->addDay()->min($cutoff));
            }
        }
        $after = ActivityLog::whereIn('action', self::COMPACTED_ACTIONS)->where('created_at', '<', $cutoff)->count();

        $deletedNotifications = Notification::whereIn('type', self::OBSOLETE_NOTIFICATION_TYPES)->delete()
            + Notification::whereNotNull('read_at')->where('read_at', '<', now()->subDays(30))->delete();

        $this->info("Activitate: {$before} rânduri vechi → {$after}. Notificări șterse: {$deletedNotifications}.");

        return self::SUCCESS;
    }

    private function compactRange(Carbon $from, Carbon $to): void
    {
        $rows = ActivityLog::whereIn('action', self::COMPACTED_ACTIONS)
            ->where('created_at', '>=', $from)
            ->where('created_at', '<', $to)
            ->get(['id', 'user_id', 'action', 'model_type', 'model_id', 'created_at', 'new_values']);

        $buckets = $rows->groupBy(fn (ActivityLog $log) => implode('|', [
            $log->action,
            $log->user_id,
            $log->action === StudentSessionLogger::ACTION ? '' : $log->model_id,
            $log->created_at->copy()->startOfHour()->getTimestamp(),
        ]));

        DB::transaction(function () use ($buckets) {
            foreach ($buckets as $logs) {
                if ($logs->count() < 2) {
                    continue;
                }
                $first = $logs->first();
                $count = $logs->sum(fn ($log) => (int) (($log->new_values ?? [])['count'] ?? 1));
                $isFocus = $first->action !== StudentSessionLogger::ACTION;
                $values = ['count' => $count, 'compacted' => true];
                if ($isFocus) {
                    $values['seconds'] = $logs->sum(fn ($log) => (int) (($log->new_values ?? [])['seconds'] ?? 0));
                    $values['lesson_id'] = (int) $first->model_id;
                }

                // forceCreate: created_at (ora rezumatului) nu e în fillable
                ActivityLog::forceCreate([
                    'user_id' => $first->user_id,
                    'action' => $first->action,
                    'model_type' => $first->model_type,
                    'model_id' => $first->model_id,
                    'description' => $isFocus
                        ? "Rezumat pe oră: {$values['seconds']} s de învățare"
                        : "Rezumat pe oră: {$count} sesiuni deschise",
                    'new_values' => $values,
                    'created_at' => $first->created_at->copy()->startOfHour(),
                    'updated_at' => now(),
                ]);
                ActivityLog::whereIn('id', $logs->pluck('id'))->delete();
            }
        });
    }
}
