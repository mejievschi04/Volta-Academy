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

    public function test_reopening_a_test_refreshes_questions_and_keeps_only_compatible_answers(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $test = Test::factory()->published()->create([
            'time_limit_minutes' => 10,
            'max_attempts' => 1,
            'randomize_questions' => false,
            'randomize_answers' => false,
        ]);
        $data = [
            'test_id' => $test->id,
            'type' => 'single_choice',
            'points' => 1,
            'answers' => [['text' => 'A', 'is_correct' => true], ['text' => 'B', 'is_correct' => false]],
        ];
        $unchanged = Question::factory()->create($data + ['content' => 'Întrebarea păstrată', 'order' => 0]);
        $edited = Question::factory()->create($data + ['content' => 'Formulare inițială', 'order' => 1]);
        $deleted = Question::factory()->create($data + ['content' => 'Întrebarea retrasă', 'order' => 2]);
        $url = "/api/exams/{$test->id}";
        $started = $this->actingAs($student, 'sanctum')->getJson("$url?start=1")->assertOk()->json('active_attempt');
        $writes = ['attempt_id' => $started['id'], 'questions_version' => $started['questions_version']];
        $this->postJson("$url/progress", $writes + ['answers' => [$unchanged->id => 0]])->assertOk();
        $this->postJson("$url/progress", $writes + ['answers' => [$edited->id => 0]])->assertOk();

        $edited->update(['content' => 'Formulare nouă', 'answers' => [['text' => 'C', 'is_correct' => true], ['text' => 'D', 'is_correct' => false]]]);
        $deleted->delete();
        $added = Question::factory()->create($data + ['content' => 'Întrebare adăugată', 'order' => 2]);

        $reopened = $this->getJson($url)->assertOk()
            ->assertJsonPath('active_attempt.id', $started['id'])
            ->assertJsonPath('active_attempt.expires_at', $started['expires_at'])
            ->assertJsonPath('active_attempt.answers', [$unchanged->id => 0])
            ->assertJsonPath('questions.1.text', 'Formulare nouă')
            ->assertJsonPath('questions.1.options', ['C', 'D'])
            ->assertJsonPath('questions.2.id', $added->id);

        $version = $reopened->json('active_attempt.questions_version');
        $this->assertNotSame($started['questions_version'], $version);
        $this->postJson("$url/progress", $writes + ['answers' => [$edited->id => 1]])->assertStatus(409);
        $this->postJson("$url/submit", $writes + ['answers' => [$edited->id => 1]])->assertStatus(409);
        $this->postJson("$url/submit", [
            'attempt_id' => $started['id'],
            'questions_version' => $version,
            'answers' => [$edited->id => 0, $added->id => 0],
        ])->assertOk()->assertJsonPath('result.score', 3);

        $edited->update(['content' => 'Modificare după trimitere']);
        $this->getJson($url)->assertOk()->assertJsonPath('questions.1.text', 'Formulare nouă');
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

    public function test_reopening_a_monthly_test_loads_the_current_questions_on_the_same_session(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $exam = Exam::create([
            'title' => 'Test lunar',
            'status' => 'published',
            'time_limit_minutes' => 15,
            'settings' => ['manual_review' => false],
        ]);
        $question = $exam->questions()->create([
            'question_text' => 'Formulare inițială',
            'question_type' => 'single_choice',
            'points' => 1,
        ]);
        $question->answers()->create(['answer_text' => 'Da', 'is_correct' => true, 'order' => 0]);
        $question->answers()->create(['answer_text' => 'Nu', 'is_correct' => false, 'order' => 1]);
        $url = "/api/exams/{$exam->id}";
        $started = $this->actingAs($student, 'sanctum')->getJson("$url?kind=exam&start=1")->assertOk()->json('active_attempt');
        $this->postJson("$url/progress?kind=exam", [
            'questions_version' => $started['questions_version'],
            'answers' => [$question->id => 0],
        ])->assertOk();
        $question->update(['question_text' => 'Formulare actualizată']);

        $reopened = $this->getJson("$url?kind=exam")->assertOk()
            ->assertJsonPath('active_attempt.attempt_number', 1)
            ->assertJsonPath('active_attempt.expires_at', $started['expires_at'])
            ->assertJsonPath('active_attempt.answers', [])
            ->assertJsonPath('questions.0.text', 'Formulare actualizată');

        $this->postJson("$url/submit?kind=exam", [
            'questions_version' => $started['questions_version'],
            'answers' => [$question->id => 0],
        ])->assertStatus(409);
        $this->postJson("$url/submit?kind=exam", [
            'questions_version' => $reopened->json('active_attempt.questions_version'),
            'answers' => [$question->id => 0],
        ])->assertOk()->assertJsonPath('result.score', 1);
    }
}
