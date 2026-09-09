<?php
namespace Tests\Feature;

use App\Models\{Course, CourseTest, Lesson, Test, TestResult, User};
use App\Services\{CourseBuilderService, CourseProgressService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class RequiredCourseTestsTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_attached_tests_must_be_passed_even_if_previously_optional(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $course = Course::factory()->published()->create();
        $lesson = Lesson::withoutEvents(fn () => Lesson::create([
            'course_id' => $course->id, 'module_id' => null, 'title' => 'Lesson',
            'content' => 'Content', 'type' => 'text', 'status' => 'published', 'order' => 1,
        ]));
        DB::table('lesson_progress')->insert([
            'user_id' => $student->id, 'lesson_id' => $lesson->id,
            'completed' => true, 'progress_percentage' => 100,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $service = app(CourseProgressService::class);
        $this->assertTrue($service->isCourseComplete($student, $course));
        $test = Test::factory()->published()->create();
        CourseTest::create([
            'course_id' => $course->id, 'test_id' => $test->id,
            'scope' => 'course', 'required' => false, 'passing_score' => 70, 'order' => 0,
        ]);
        $this->assertFalse($service->isCourseComplete($student, $course));
        $result = TestResult::create([
            'test_id' => $test->id, 'course_id' => $course->id, 'user_id' => $student->id,
            'score' => 40, 'max_score' => 100, 'percentage' => 40, 'passed' => false,
            'attempt_number' => 1, 'answers' => [], 'completed_at' => now(), 'status' => 'completed',
        ]);
        $this->assertFalse($service->isCourseComplete($student, $course));
        $result->update(['score' => 80, 'percentage' => 80, 'passed' => true]);
        $this->assertTrue($service->isCourseComplete($student, $course));
    }

    public function test_attachment_cannot_be_optional(): void
    {
        $link = app(CourseBuilderService::class)->attachTest(
            Course::factory()->published()->create(), Test::factory()->published()->create(), ['required' => false]
        );
        $this->assertTrue($link->required);
    }
}
