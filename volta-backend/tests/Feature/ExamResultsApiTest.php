<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseTest;
use App\Models\Question;
use App\Models\Test;
use App\Models\TestResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExamResultsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_exam_results_lists_all_attempts_and_uses_saved_course_context(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $owner = User::factory()->create(['role' => 'teacher']);
        $firstCourse = Course::factory()->published()->create([
            'title' => 'Curs A',
            'teacher_id' => $owner->id,
        ]);
        $secondCourse = Course::factory()->published()->create([
            'title' => 'Curs B',
            'teacher_id' => $owner->id,
        ]);
        $test = Test::factory()->published()->create([
            'title' => 'Test reutilizat',
            'created_by' => $owner->id,
            'max_attempts' => 3,
        ]);

        CourseTest::create([
            'course_id' => $firstCourse->id,
            'test_id' => $test->id,
            'scope' => 'course',
            'scope_id' => $firstCourse->id,
            'required' => true,
            'passing_score' => 70,
            'order' => 1,
        ]);

        CourseTest::create([
            'course_id' => $secondCourse->id,
            'test_id' => $test->id,
            'scope' => 'course',
            'scope_id' => $secondCourse->id,
            'required' => true,
            'passing_score' => 70,
            'order' => 1,
        ]);

        TestResult::create([
            'test_id' => $test->id,
            'course_id' => $firstCourse->id,
            'user_id' => $student->id,
            'score' => 50,
            'max_score' => 100,
            'percentage' => 50,
            'passed' => false,
            'attempt_number' => 1,
            'answers' => ['1' => 0],
            'completed_at' => now()->subMinutes(10),
            'status' => 'completed',
        ]);

        $latest = TestResult::create([
            'test_id' => $test->id,
            'course_id' => $secondCourse->id,
            'user_id' => $student->id,
            'score' => 90,
            'max_score' => 100,
            'percentage' => 90,
            'passed' => true,
            'attempt_number' => 1,
            'answers' => ['1' => 0],
            'completed_at' => now()->subMinutes(2),
            'status' => 'completed',
        ]);

        $response = $this->actingAs($student, 'sanctum')->getJson('/api/exam-results');

        $response->assertOk();
        $results = collect($response->json());

        $this->assertCount(2, $results);
        $this->assertSame($secondCourse->id, $results->first()['course_id']);
        $this->assertSame('Curs B', $results->first()['exam']['course']['title']);
        $this->assertTrue($results->contains(fn ($row) => $row['course_id'] === $firstCourse->id && $row['exam']['course']['title'] === 'Curs A'));

        $detail = $this->actingAs($student, 'sanctum')->getJson("/api/exam-results/{$latest->id}?type=test");

        $detail->assertOk()
            ->assertJsonPath('course_id', $secondCourse->id)
            ->assertJsonPath('exam.course.title', 'Curs B')
            ->assertJsonPath('test.course.title', 'Curs B');
    }

    public function test_exam_result_detail_maps_text_answer_to_selected_correct_option(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $owner = User::factory()->create(['role' => 'teacher']);
        $test = Test::factory()->published()->create([
            'created_by' => $owner->id,
            'randomize_answers' => false,
        ]);
        $question = Question::factory()->create([
            'test_id' => $test->id,
            'content' => 'De ce sau dece?',
            'points' => 1,
            'answers' => [
                ['text' => 'de ce', 'is_correct' => true, 'order' => 0],
                ['text' => 'dece', 'is_correct' => false, 'order' => 1],
            ],
        ]);
        $result = TestResult::create([
            'test_id' => $test->id,
            'user_id' => $student->id,
            'score' => 0,
            'max_score' => 1,
            'percentage' => 0,
            'passed' => false,
            'attempt_number' => 1,
            'answers' => [(string) $question->id => 'de ce'],
            'completed_at' => now(),
            'status' => 'completed',
        ]);

        $response = $this->actingAs($student, 'sanctum')->getJson("/api/exam-results/{$result->id}?type=test");

        $response->assertOk()
            ->assertJsonPath('exam.questions.0.is_correct', true)
            ->assertJsonPath('exam.questions.0.user_answer_index', 0)
            ->assertJsonPath('exam.questions.0.answers.0.is_selected', true)
            ->assertJsonPath('exam.questions.0.answers.0.is_correct', true);
    }
}
