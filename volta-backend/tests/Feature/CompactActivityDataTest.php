<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class CompactActivityDataTest extends TestCase
{
    use RefreshDatabase;

    private function log(User $user, string $action, $at, array $values = [], ?int $modelId = null): void
    {
        ActivityLog::create([
            'user_id' => $user->id,
            'action' => $action,
            'model_type' => 'lesson',
            'model_id' => $modelId,
            'description' => 'test',
            'new_values' => $values,
        ])->forceFill(['created_at' => $at, 'updated_at' => $at])->save();
    }

    private function dashboardMetrics(User $admin): array
    {
        Cache::flush();
        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/dashboard?period=30d')->assertOk();

        return [
            'sessions_count' => $response->json('kpis.avg_learning_minutes.sessions_count'),
            'learning_minutes' => collect($response->json('chart_data'))->sum('learning_minutes'),
            'hourly' => collect($response->json('hourly_activity'))->map(fn ($row) => [$row['sessions'], $row['users']])->all(),
        ];
    }

    public function test_old_focus_and_session_rows_are_compacted_per_hour_without_changing_the_dashboard(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'student']);
        $hour = now()->subDays(10)->setTime(14, 0);
        foreach ([5, 20, 40] as $minute) {
            $this->log($student, 'telemetry.learner_focus_seconds', $hour->copy()->addMinutes($minute), ['seconds' => 600, 'lesson_id' => 3], 3);
        }
        $this->log($student, 'session_started', $hour->copy()->addMinutes(1));
        $this->log($student, 'session_started', $hour->copy()->addMinutes(50));
        $this->log($student, 'completed_lesson', $hour->copy()->addMinutes(30), ['lesson_title' => 'L1'], 3);
        $recent = now()->subHour();
        $this->log($student, 'telemetry.learner_focus_seconds', $recent, ['seconds' => 60, 'lesson_id' => 3], 3);
        $this->log($student, 'telemetry.learner_focus_seconds', $recent->copy()->addMinute(), ['seconds' => 60, 'lesson_id' => 3], 3);

        $before = $this->dashboardMetrics($admin);
        $this->artisan('volta:compact-activity')->assertSuccessful();
        $after = $this->dashboardMetrics($admin);

        $this->assertSame($before, $after);
        $this->assertSame(32, $before['learning_minutes']);
        $compacted = ActivityLog::where('action', 'telemetry.learner_focus_seconds')->where('created_at', '<', now()->subDays(7))->sole();
        $this->assertSame(['count' => 3, 'compacted' => true, 'seconds' => 1800, 'lesson_id' => 3], $compacted->new_values);
        $this->assertSame(1, ActivityLog::where('action', 'session_started')->count());
        // evenimentele importante și cele recente rămân rând cu rând
        $this->assertSame(1, ActivityLog::where('action', 'completed_lesson')->count());
        $this->assertSame(2, ActivityLog::where('action', 'telemetry.learner_focus_seconds')->where('created_at', '>=', now()->subDays(7))->count());

        // a doua rulare nu mai schimbă nimic
        $this->artisan('volta:compact-activity')->assertSuccessful();
        $this->assertSame(5, ActivityLog::count());
    }

    public function test_cleanup_removes_obsolete_and_old_read_notifications(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $make = fn (string $type, $readAt = null) => Notification::create([
            'user_id' => $student->id, 'type' => $type, 'title' => $type, 'severity' => 'info', 'read_at' => $readAt,
        ]);
        $make('new_message');
        $make('course_published');
        $make('course_assigned', now()->subDays(45));
        $keptUnread = $make('course_assigned');
        $keptRecent = $make('course_assigned', now()->subDays(3));

        $this->artisan('volta:compact-activity')->assertSuccessful();

        $this->assertEqualsCanonicalizing([$keptUnread->id, $keptRecent->id], Notification::pluck('id')->all());
    }

    public function test_lesson_time_tick_records_learning_time_without_a_separate_telemetry_call(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $course = \App\Models\Course::factory()->published()->create();
        $lesson = \App\Models\Lesson::create(['course_id' => $course->id, 'title' => 'L', 'content' => 'x', 'order' => 1, 'status' => 'published']);
        $student->assignedCourses()->attach($course->id, ['enrolled' => true]);

        $this->actingAs($student, 'sanctum')
            ->putJson("/api/lessons/{$lesson->id}/progress", ['add_time_spent_seconds' => 60])
            ->assertOk();

        $log = ActivityLog::where('action', 'telemetry.learner_focus_seconds')->sole();
        $this->assertSame(['seconds' => 60, 'lesson_id' => $lesson->id], $log->new_values);
        $this->assertSame($student->id, $log->user_id);
    }
}
