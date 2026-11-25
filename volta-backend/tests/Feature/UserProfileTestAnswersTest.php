<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Question;
use App\Models\Test;
use App\Models\TestResult;
use App\Models\User;
use App\Services\UserAssignedCoursesService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserProfileTestAnswersTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_profile_links_to_the_attempt_for_each_course_and_limits_staff_access(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $instructor = User::factory()->create(['role' => 'instructor']);
        $otherInstructor = User::factory()->create(['role' => 'instructor']);
        $student = User::factory()->create(['role' => 'student']);
        $test = Test::factory()->published()->create(['created_by' => $instructor->id]);
        $firstCourse = Course::factory()->published()->create();
        $secondCourse = Course::factory()->published()->create();
        $thirdCourse = Course::factory()->published()->create();
        $assignments = app(UserAssignedCoursesService::class);
        foreach ([$firstCourse, $secondCourse, $thirdCourse] as $course) {
            $course->tests()->attach($test->id, ['scope' => 'course']);
            $assignments->assignCourseDirectly($student, $course, []);
        }
        $question = Question::factory()->create([
            'test_id' => $test->id,
            'type' => 'ordering',
            'content' => 'Ordonează etapele.',
            'points' => 1,
            'answers' => [['text' => 'Pregătire'], ['text' => 'Verificare']],
        ]);

        $first = $this->createAttempt($student, $test, $firstCourse, 1, [$question->id => ['0', '1']], true);
        $second = $this->createAttempt($student, $test, $secondCourse, 2, [$question->id => ['1', '0']], false);
        $this->createAttempt($student, $test, null, 3, [], false);

        $profile = $this->actingAs($admin, 'sanctum')->getJson("/api/admin/users/{$student->id}")->assertOk();
        $courses = collect($profile->json('courses_assigned'))->keyBy('id');
        $this->assertSame($first->id, $courses[$firstCourse->id]['tests'][0]['result_id']);
        $this->assertSame('passed', $courses[$firstCourse->id]['tests'][0]['status']);
        $this->assertSame($second->id, $courses[$secondCourse->id]['tests'][0]['result_id']);
        $this->assertNull($courses[$thirdCourse->id]['tests'][0]['result_id']);
        $this->assertSame('not_started', $courses[$thirdCourse->id]['tests'][0]['status']);

        $path = "/api/admin/test-results/{$second->id}/breakdown";
        $this->getJson($path)->assertOk()
            ->assertJsonPath('result.id', $second->id)
            ->assertJsonPath('questions.0.user_answer', ['1', '0'])
            ->assertJsonPath('questions.0.ordering.items.1.text', 'Verificare')
            ->assertJsonPath('questions.0.ordering.correctOrder', ['0', '1'])
            ->assertJsonPath('questions.0.points_earned', 0);
        $this->actingAs($instructor, 'sanctum')->getJson($path)->assertOk();
        $this->actingAs($otherInstructor, 'sanctum')->getJson($path)->assertForbidden();
        $this->actingAs($student, 'sanctum')->getJson($path)->assertForbidden();
    }

    public function test_the_profile_can_open_a_legacy_attempt_for_a_test_linked_to_one_course(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'student']);
        $course = Course::factory()->published()->create();
        $test = Test::factory()->published()->create();
        $course->tests()->attach($test->id, ['scope' => 'course']);
        app(UserAssignedCoursesService::class)->assignCourseDirectly($student, $course, []);
        $result = $this->createAttempt($student, $test, null, 1, [], true);

        $this->actingAs($admin, 'sanctum')->getJson("/api/admin/users/{$student->id}")
            ->assertOk()->assertJsonPath('courses_assigned.0.tests.0.result_id', $result->id);
    }

    private function createAttempt(User $student, Test $test, ?Course $course, int $attempt, array $answers, bool $passed): TestResult
    {
        return TestResult::create([
            'user_id' => $student->id,
            'test_id' => $test->id,
            'course_id' => $course?->id,
            'attempt_number' => $attempt,
            'answers' => $answers,
            'score' => $passed ? 1 : 0,
            'max_score' => 1,
            'percentage' => $passed ? 100 : 0,
            'passed' => $passed,
            'status' => 'completed',
            'completed_at' => now(),
        ]);
    }
}
