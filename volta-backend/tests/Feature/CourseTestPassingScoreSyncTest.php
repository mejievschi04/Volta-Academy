<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseTest;
use App\Models\Question;
use App\Models\Test;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Pragul setat de admin pe test ajunge la cursant (care e corectat după legătura curs–test).
 */
class CourseTestPassingScoreSyncTest extends TestCase
{
    use RefreshDatabase;

    private function courseWithStudent(): array
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $course = Course::factory()->published()->create(['teacher_id' => $admin->id, 'workflow_status' => 'published']);
        DB::table('course_user')->insert(['user_id' => $student->id, 'course_id' => $course->id, 'enrolled' => true, 'created_at' => now(), 'updated_at' => now()]);

        return [$admin, $student, $course];
    }

    public function test_attaching_without_threshold_uses_the_tests_threshold(): void
    {
        [$admin, $student, $course] = $this->courseWithStudent();
        $test = Test::factory()->published()->create(['passing_score' => 77.78]);
        Question::factory()->create(['test_id' => $test->id]);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/tests/{$test->id}/link-to-course", [
            'course_id' => $course->id, 'scope' => 'course',
        ])->assertOk();

        $this->assertEquals(77.78, CourseTest::where('test_id', $test->id)->value('passing_score'));
    }

    public function test_changing_the_threshold_in_admin_reaches_the_student(): void
    {
        [$admin, $student, $course] = $this->courseWithStudent();
        $test = Test::factory()->published()->create(['passing_score' => 70]);
        Question::factory()->create(['test_id' => $test->id]);
        CourseTest::create(['course_id' => $course->id, 'test_id' => $test->id, 'scope' => 'course', 'required' => true, 'passing_score' => 70, 'order' => 0]);

        $this->actingAs($admin, 'sanctum')->putJson("/api/admin/tests/{$test->id}", ['passing_score' => 85.5])->assertOk();

        $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$test->id}?course_id={$course->id}")
            ->assertOk()->assertJsonPath('passing_score', 85.5);
    }

    public function test_migration_aligns_existing_course_links(): void
    {
        [, , $course] = $this->courseWithStudent();
        $test = Test::factory()->published()->create(['passing_score' => 80]);
        CourseTest::create(['course_id' => $course->id, 'test_id' => $test->id, 'scope' => 'course', 'required' => true, 'passing_score' => 70, 'order' => 0]);

        (require database_path('migrations/2026_11_04_140000_sync_course_test_passing_scores.php'))->up();

        $this->assertEquals(80, CourseTest::where('test_id', $test->id)->value('passing_score'));
    }
}
