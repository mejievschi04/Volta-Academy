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
 * După trimiterea unui test, profilul (din cache 5 minute) arată imediat rezultatul.
 */
class ProfileFreshAfterSubmitTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_shows_the_test_result_right_after_submit(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $course = Course::factory()->published()->create(['workflow_status' => 'published']);
        DB::table('course_user')->insert(['user_id' => $student->id, 'course_id' => $course->id, 'enrolled' => true, 'created_at' => now(), 'updated_at' => now()]);
        $test = Test::factory()->published()->create(['passing_score' => 50, 'randomize_answers' => false]);
        $question = Question::factory()->create([
            'test_id' => $test->id, 'type' => 'single_choice',
            'answers' => [['text' => 'Da', 'is_correct' => true], ['text' => 'Nu', 'is_correct' => false]],
        ]);
        CourseTest::create(['course_id' => $course->id, 'test_id' => $test->id, 'scope' => 'course', 'required' => true, 'passing_score' => 50, 'order' => 0]);

        $this->actingAs($student, 'sanctum');
        $before = collect($this->getJson('/api/profile')->assertOk()->json('coursesAssigned'))->firstWhere('id', $course->id);
        $this->assertSame('not_started', $before['tests'][0]['status']);

        $this->getJson("/api/exams/{$test->id}?course_id={$course->id}&new_attempt=1")->assertOk();
        $this->postJson("/api/exams/{$test->id}/submit?course_id={$course->id}", ['answers' => [$question->id => 0]])
            ->assertOk()->assertJsonPath('result.passed', true);

        $after = collect($this->getJson('/api/profile')->assertOk()->json('coursesAssigned'))->firstWhere('id', $course->id);
        $this->assertSame('passed', $after['tests'][0]['status']);
    }

    public function test_first_lesson_activity_marks_the_course_started(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $course = Course::factory()->published()->create(['workflow_status' => 'published']);
        DB::table('course_user')->insert(['user_id' => $student->id, 'course_id' => $course->id, 'enrolled' => true, 'created_at' => now(), 'updated_at' => now()]);
        $lesson = \App\Models\Lesson::create(['course_id' => $course->id, 'title' => 'L1', 'order' => 1, 'status' => 'published', 'content' => '<p>text</p>']);

        $this->actingAs($student, 'sanctum');
        $status = fn () => collect($this->getJson('/api/profile')->assertOk()->json('coursesAssigned'))->firstWhere('id', $course->id)['status'];
        $this->assertSame('not_accessed', $status());

        $this->putJson("/api/lessons/{$lesson->id}/progress", ['add_time_spent_seconds' => 5])->assertOk();

        $this->assertSame('in_progress', $status());
    }
}
