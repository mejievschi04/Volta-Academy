<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamAttemptSession;
use App\Models\ExamQuestion;
use App\Models\Question;
use App\Models\Test;
use App\Models\TestResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Deschiderea unui test arată ecranul de start; încercarea și cronometrul pornesc doar la „Începe testul”.
 * Înainte, cine doar se uita la test și pleca pierdea încercarea la expirarea timpului.
 */
class TestStartScreenTest extends TestCase
{
    use RefreshDatabase;

    public function test_opening_a_timed_test_does_not_start_an_attempt(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $test = Test::factory()->published()->create(['time_limit_minutes' => 10, 'max_attempts' => 1]);
        Question::factory()->count(3)->create(['test_id' => $test->id]);

        $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$test->id}")
            ->assertOk()
            ->assertJsonPath('requires_start', true)
            ->assertJsonPath('question_count', 3)
            ->assertJsonPath('time_limit_minutes', 10)
            ->assertJsonPath('remaining_attempts', 1)
            ->assertJsonPath('active_attempt', null)
            ->assertJsonCount(0, 'questions');
        $this->assertSame(0, TestResult::where('test_id', $test->id)->count());
    }

    public function test_start_creates_the_attempt_and_reopening_resumes_it(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $test = Test::factory()->published()->create(['time_limit_minutes' => 10, 'max_attempts' => 1]);
        Question::factory()->count(2)->create(['test_id' => $test->id]);

        $started = $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$test->id}?start=1")
            ->assertOk()
            ->assertJsonPath('requires_start', false)
            ->assertJsonCount(2, 'questions');
        $this->assertNotNull($started->json('active_attempt.expires_at'));

        // revenit pe pagină (fără start): continuă aceeași încercare, fără ecran de start
        $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$test->id}")
            ->assertOk()
            ->assertJsonPath('requires_start', false)
            ->assertJsonPath('active_attempt.id', $started->json('active_attempt.id'))
            ->assertJsonCount(2, 'questions');
        $this->assertSame(1, TestResult::where('test_id', $test->id)->count());
    }

    public function test_monthly_exam_session_starts_only_on_start(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $exam = Exam::create([
            'title' => 'Test lunar', 'status' => 'published', 'course_id' => null,
            'passing_score' => 50, 'max_attempts' => 1, 'time_limit_minutes' => 15,
            'settings' => ['access_mode' => 'all_students', 'manual_review' => false],
        ]);
        foreach (['Unu', 'Doi'] as $i => $label) {
            $question = ExamQuestion::create(['exam_id' => $exam->id, 'question_text' => $label, 'question_type' => 'single_choice', 'points' => 1, 'order' => $i]);
            ExamAnswer::create(['exam_question_id' => $question->id, 'answer_text' => 'Da', 'is_correct' => true, 'order' => 0]);
            ExamAnswer::create(['exam_question_id' => $question->id, 'answer_text' => 'Nu', 'is_correct' => false, 'order' => 1]);
        }

        $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$exam->id}?kind=exam")
            ->assertOk()
            ->assertJsonPath('requires_start', true)
            ->assertJsonPath('question_count', 2)
            ->assertJsonCount(0, 'questions');
        $this->assertSame(0, ExamAttemptSession::where('exam_id', $exam->id)->count());

        $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$exam->id}?kind=exam&start=1")
            ->assertOk()
            ->assertJsonPath('requires_start', false)
            ->assertJsonCount(2, 'questions');
        $this->assertSame(1, ExamAttemptSession::where('exam_id', $exam->id)->count());
    }
}
