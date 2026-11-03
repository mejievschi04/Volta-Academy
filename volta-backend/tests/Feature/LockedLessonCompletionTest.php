<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Lesson;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Într-un curs cu deblocare pe rând, o lecție blocată nu se poate finaliza (nici direct prin API).
 */
class LockedLessonCompletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_locked_lesson_cannot_be_completed_and_unlocks_after_the_previous_one(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $course = Course::factory()->published()->create(['sequential_unlock' => true, 'workflow_status' => 'published']);
        [$first, $second] = collect([1, 2])->map(fn ($order) => Lesson::withoutEvents(fn () => Lesson::create([
            'course_id' => $course->id, 'module_id' => null, 'title' => "Lecția {$order}",
            'content' => '<p>x</p>', 'type' => 'text', 'status' => 'published', 'order' => $order,
        ])))->all();
        DB::table('course_user')->insert([
            'user_id' => $student->id, 'course_id' => $course->id, 'enrolled' => true,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->actingAs($student, 'sanctum')->postJson("/api/lessons/{$second->id}/complete")
            ->assertForbidden()
            ->assertJsonPath('locked', true);
        $this->assertDatabaseMissing('lesson_progress', ['user_id' => $student->id, 'lesson_id' => $second->id, 'completed' => true]);

        $this->actingAs($student, 'sanctum')->postJson("/api/lessons/{$first->id}/complete")->assertOk();
        $this->actingAs($student, 'sanctum')->postJson("/api/lessons/{$second->id}/complete")->assertOk();
    }
}
