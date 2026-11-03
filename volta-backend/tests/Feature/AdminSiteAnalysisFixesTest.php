<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Probleme găsite la analiza academy.volta.md (3 nov. 2026).
 */
class AdminSiteAnalysisFixesTest extends TestCase
{
    use RefreshDatabase;

    private function enroll(User $user, Course $course, array $extra = []): void
    {
        DB::table('course_user')->insert($extra + [
            'user_id' => $user->id, 'course_id' => $course->id, 'enrolled' => true,
            'enrolled_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_password_hash_and_remember_token_never_leave_the_api(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $student = User::factory()->create(['role' => 'student', 'status' => 'active', 'remember_token' => 'secret-token']);

        foreach (['/api/admin/users', "/api/admin/users/{$student->id}"] as $url) {
            $body = $this->actingAs($admin, 'sanctum')->getJson($url)->assertOk()->getContent();
            $this->assertStringNotContainsString('"password"', $body, $url);
            $this->assertStringNotContainsString('remember_token', $body, $url);
            $this->assertDoesNotMatchRegularExpression('/\$2y\$\d\d\$/', $body, $url);
        }
    }

    public function test_funnel_counts_enrollments_with_progress_as_started(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $this->enroll($student, Course::factory()->published()->create(), ['progress_percentage' => 40]);
        $this->enroll($student, Course::factory()->published()->create(), ['progress_percentage' => 100, 'completed_at' => now()]);
        $this->enroll($student, Course::factory()->published()->create(), ['progress_percentage' => 0]);

        $this->actingAs($admin, 'sanctum')->getJson('/api/admin/dashboard?period=14d')
            ->assertOk()
            ->assertJsonPath('learning_funnel.enrolled', 3)
            ->assertJsonPath('learning_funnel.started', 2);
    }

    public function test_chart_ends_today_not_tomorrow(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $dates = collect($this->actingAs($admin, 'sanctum')->getJson('/api/admin/dashboard?period=14d')
            ->assertOk()
            ->json('chart_data'))->pluck('date');

        $this->assertSame(now()->format('Y-m-d'), $dates->last());
        $this->assertSame(now()->subDays(14)->format('Y-m-d'), $dates->first());
    }

    public function test_learner_profile_hides_assigned_draft_courses(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $published = Course::factory()->published()->create(['title' => 'Curs publicat']);
        $draft = Course::factory()->create(['title' => 'Curs în ciornă', 'status' => 'draft']);
        $this->enroll($student, $published);
        $this->enroll($student, $draft);

        $titles = collect($this->actingAs($student, 'sanctum')->getJson('/api/profile')
            ->assertOk()
            ->json('coursesAssigned'))->pluck('title')->all();

        $this->assertSame(['Curs publicat'], $titles);
    }
}
