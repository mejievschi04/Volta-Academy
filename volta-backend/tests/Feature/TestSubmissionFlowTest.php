<?php

namespace Tests\Feature;

use App\Models\Question;
use App\Models\Test;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TestSubmissionFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_score_saved_results_and_attempt_limit_agree(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $test = Test::factory()->published()->create(['max_attempts' => 1, 'randomize_answers' => false]);
        $first = Question::factory()->create(['test_id' => $test->id, 'points' => 3]);
        $second = Question::factory()->create(['test_id' => $test->id, 'points' => 1]);
        $this->actingAs($student, 'sanctum');
        $response = $this->postJson("/api/exams/{$test->id}/submit", ['answers' => [
            $first->id => 0, $second->id => 1,
        ]])->assertOk()->assertJsonPath('result.score', 3)
            ->assertJsonPath('result.percentage', 75)
            ->assertJsonPath('result.correct_answers_count', 1)
            ->assertJsonPath('result.total_questions', 2)
            ->assertJsonPath('result.remaining_attempts', 0);
        $id = $response->json('result.id');
        $this->getJson("/api/exam-results/{$id}?type=test")->assertOk()
            ->assertJsonPath('percentage', fn ($value) => (float) $value === 75.0);
        $this->postJson("/api/exams/{$test->id}/submit", ['answers' => []])->assertForbidden();
        $other = User::factory()->create(['role' => 'student']);
        $response = $this->actingAs($other, 'sanctum')->getJson("/api/exam-results/{$id}?type=test");
        $this->assertContains($response->status(), [403, 404]);
        $this->assertDatabaseCount('test_results', 1);
    }

    public function test_legacy_quiz_respects_configured_passing_score(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $course = \App\Models\Course::factory()->published()->create();
        $exam = \App\Models\Exam::create([
            'course_id' => $course->id, 'title' => 'Quiz', 'status' => 'published',
            'passing_score' => 80, 'max_attempts' => 2,
        ]);
        $answers = [];
        foreach ([0, 1] as $index) {
            $question = $exam->questions()->create([
                'question_text' => 'Întrebare', 'question_type' => 'single_choice', 'points' => 1, 'order' => $index,
            ]);
            $question->answers()->create(['answer_text' => 'Corect', 'is_correct' => true, 'order' => 0]);
            $question->answers()->create(['answer_text' => 'Greșit', 'is_correct' => false, 'order' => 1]);
            $answers[$question->id] = $index;
        }
        $this->actingAs($student, 'sanctum')->postJson("/api/courses/{$course->id}/quiz/submit", [
            'answers' => $answers,
        ])->assertOk()->assertJsonPath('percentage', 50)->assertJsonPath('passed', false);
    }

    public function test_written_answers_wait_for_manual_review(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $test = Test::factory()->published()->create();
        $question = Question::factory()->create(['test_id' => $test->id, 'type' => 'essay', 'answers' => []]);
        $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$test->id}/submit", [
            'answers' => [$question->id => 'Răspuns de verificat'],
        ])->assertOk()->assertJsonPath('result.status', 'pending_review')
            ->assertJsonPath('result.needs_manual_review', true)->assertJsonPath('result.passed', false);
    }
}
