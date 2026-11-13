<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\Team;
use App\Models\Test;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityLogContextTest extends TestCase
{
    use RefreshDatabase;

    public function test_journal_rows_carry_lesson_test_and_course_titles(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $course = Course::factory()->create(['title' => 'Electrică 1']);
        $lesson = Lesson::withoutEvents(fn () => Lesson::create([
            'course_id' => $course->id, 'title' => 'Siguranța la lucru',
            'content' => '<p>x</p>', 'type' => 'text', 'status' => 'published', 'order' => 1,
        ]));
        $test = Test::factory()->create(['title' => 'Test final']);

        ActivityLog::create([
            'user_id' => $student->id,
            'action' => 'telemetry.learner_focus_seconds',
            'model_type' => 'lesson',
            'model_id' => $lesson->id,
            'description' => 'Telemetry event: learner_focus_seconds',
            'new_values' => ['seconds' => 120, 'lesson_id' => $lesson->id],
        ]);
        ActivityLog::create([
            'user_id' => $student->id,
            'action' => 'telemetry.learner_attempt_submitted',
            'model_type' => 'exam',
            'model_id' => 999,
            'description' => 'Telemetry event: learner_attempt_submitted',
            'new_values' => ['test_id' => $test->id, 'course_id' => $course->id, 'percentage' => 80],
        ]);

        $rows = collect(
            $this->actingAs($admin)->getJson('/api/admin/activity-logs')
                ->assertOk()
                ->assertJsonPath('pagination.per_page', 100)
                ->json('data')
        )->keyBy('action');

        $this->assertSame(
            ['lesson_title' => 'Siguranța la lucru', 'course_title' => 'Electrică 1'],
            $rows['telemetry.learner_focus_seconds']['context']
        );
        $this->assertSame(
            ['test_title' => 'Test final', 'course_title' => 'Electrică 1'],
            $rows['telemetry.learner_attempt_submitted']['context']
        );
    }

    public function test_journal_shows_teams_and_filters_and_sorts_by_team(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $zeta = Team::create(['name' => 'Zeta', 'owner_id' => $admin->id]);
        $alfa = Team::create(['name' => 'Alfa', 'owner_id' => $admin->id]);
        $inZeta = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $inAlfa = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $noTeam = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $inZeta->teams()->attach($zeta);
        $inAlfa->teams()->attach($alfa);

        foreach ([$inZeta, $noTeam, $inAlfa] as $user) {
            ActivityLog::create(['user_id' => $user->id, 'action' => 'logged_in', 'description' => 'login']);
        }

        $sorted = $this->actingAs($admin)
            ->getJson('/api/admin/activity-logs?sort_by=team&sort_dir=asc')
            ->assertOk()
            ->json('data');
        $this->assertSame([$inAlfa->id, $inZeta->id, $noTeam->id], array_column($sorted, 'user_id'));
        $this->assertSame('Alfa', $sorted[0]['user']['teams'][0]['name']);

        $filtered = $this->getJson("/api/admin/activity-logs?team_id={$zeta->id}")->assertOk()->json('data');
        $this->assertSame([$inZeta->id], array_column($filtered, 'user_id'));

        $none = $this->getJson('/api/admin/activity-logs?team_id=none')->assertOk()->json('data');
        $this->assertSame([$noTeam->id], array_column($none, 'user_id'));
    }
}
