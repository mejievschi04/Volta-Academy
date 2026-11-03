<?php

namespace App\Console\Commands;

use App\Models\Course;
use App\Models\CourseVersion;
use App\Models\Lesson;
use App\Models\Module;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Cursuri publicate în care nicio lecție nu e publicată: cursanții le vedeau din cauza unui bug (lecțiile
 * ascunse din versiunea publicată apăreau), iar după reparare au rămas goale. Comanda le readuce exact
 * conținutul pe care îl vedeau: lecțiile și modulele lor devin publicate în ultima versiune publicată și
 * în builder. Alte modificări nepublicate din builder rămân nepublicate.
 *
 * Fără --apply doar afișează cursurile.
 */
class RestoreDraftOnlyCoursesCommand extends Command
{
    protected $signature = 'volta:restore-draft-only-courses {--apply : Aplică modificările (altfel doar le afișează)}';

    protected $description = 'Publică lecțiile cursurilor publicate care nu au nicio lecție vizibilă pentru cursanți.';

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');
        $fixed = 0;

        foreach (Course::query()->where('status', 'published')->orderBy('id')->get() as $course) {
            $version = CourseVersion::query()
                ->with('snapshot')
                ->where('course_id', $course->id)
                ->where('status', 'published')
                ->orderByDesc('version')
                ->first();
            $snapshot = $version?->snapshot?->snapshot_json;
            $snapshotLessons = is_array($snapshot) ? collect($snapshot['lessons'] ?? [])->filter(fn ($row) => is_array($row)) : collect();

            $liveLessons = Lesson::query()->where('course_id', $course->id)->get(['id', 'status', 'module_id']);
            $snapshotHasVisible = $snapshotLessons->contains(fn ($row) => ($row['status'] ?? 'published') === 'published');
            $liveHasVisible = $liveLessons->contains(fn ($lesson) => $lesson->status === 'published');

            // Doar cursurile la care cursanții nu văd nicio lecție.
            $studentsSeeNothing = $course->workflow_status === 'editing' && is_array($snapshot)
                ? ! $snapshotHasVisible && $snapshotLessons->isNotEmpty()
                : ! $liveHasVisible && $liveLessons->isNotEmpty();
            if (! $studentsSeeNothing) {
                continue;
            }

            $lessonIds = $snapshotLessons->isNotEmpty()
                ? $snapshotLessons->pluck('id')->map(fn ($id) => (int) $id)->all()
                : $liveLessons->pluck('id')->all();
            $this->line(sprintf('#%d %s — %d lecții', $course->id, $course->title, count($lessonIds)));
            $fixed++;

            if (! $apply) {
                continue;
            }

            DB::transaction(function () use ($course, $version, $snapshot, $lessonIds) {
                if ($version && is_array($snapshot)) {
                    $publish = fn (array $rows) => array_map(
                        fn ($row) => is_array($row) ? array_merge($row, ['status' => 'published']) : $row,
                        $rows
                    );
                    $snapshot['lessons'] = $publish($snapshot['lessons'] ?? []);
                    $snapshot['modules'] = $publish($snapshot['modules'] ?? []);
                    $version->snapshot->forceFill(['snapshot_json' => $snapshot])->save();
                }

                // în builder lecțiile acestea erau deja „vizibile” pentru cursanți; le marcăm publicate ca
                // următoarea publicare să nu le ascundă din nou
                Lesson::query()->where('course_id', $course->id)->whereIn('id', $lessonIds)
                    ->where('status', '!=', 'published')->update(['status' => 'published']);
                $moduleIds = Lesson::query()->whereIn('id', $lessonIds)->whereNotNull('module_id')->pluck('module_id')->unique()->all();
                if ($moduleIds !== []) {
                    Module::query()->where('course_id', $course->id)->whereIn('id', $moduleIds)
                        ->where('status', '!=', 'published')->update(['status' => 'published']);
                }
            });
        }

        $this->info($apply
            ? "{$fixed} cursuri reparate."
            : "{$fixed} cursuri de reparat. Rulează cu --apply ca să le repari.");

        return self::SUCCESS;
    }
}
