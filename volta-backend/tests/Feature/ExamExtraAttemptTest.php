<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamQuestion;
use App\Models\ExamResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExamExtraAttemptTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_grants_extra_exam_attempt_to_student_who_failed(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'student']);
        [$exam, $question] = $this->singleQuestionExam(maxAttempts: 1);

        // răspunsul 1 = „Greșit”
        $this->actingAs($student, 'sanctum')
            ->postJson("/api/exams/{$exam->id}/submit", ['answers' => [(string) $question->id => 1]])
            ->assertOk()
            ->assertJsonPath('result.passed', false);

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/exams/{$exam->id}/submit", ['answers' => [(string) $question->id => 0]])
            ->assertForbidden()
            ->assertJsonPath('max_attempts_reached', true);

        $result = ExamResult::where('exam_id', $exam->id)->where('user_id', $student->id)->firstOrFail();
        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/exams/{$exam->id}/results")
            ->assertOk()
            ->assertJsonPath('0.allowed_attempts', 1);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/exam-results/{$result->id}/extra-attempt")
            ->assertOk()
            ->assertJsonPath('allowed_attempts', 2)
            ->assertJsonPath('remaining_attempts', 1);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/exams/{$exam->id}/results")
            ->assertJsonPath('0.allowed_attempts', 2);

        $this->actingAs($student, 'sanctum')
            ->getJson("/api/exams/{$exam->id}")
            ->assertOk()
            ->assertJsonPath('can_retake', true)
            ->assertJsonPath('remaining_attempts', 1);

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/exams/{$exam->id}/submit", ['answers' => [(string) $question->id => 0]])
            ->assertOk()
            ->assertJsonPath('result.passed', true)
            ->assertJsonPath('result.remaining_attempts', 0);
    }

    public function test_extra_attempt_is_refused_when_student_passed_or_exam_is_unlimited(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'student']);

        [$limited, $question] = $this->singleQuestionExam(maxAttempts: 2);
        $this->actingAs($student, 'sanctum')
            ->postJson("/api/exams/{$limited->id}/submit", ['answers' => [(string) $question->id => 0]])
            ->assertOk()
            ->assertJsonPath('result.passed', true);
        $passed = ExamResult::where('exam_id', $limited->id)->firstOrFail();
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/exam-results/{$passed->id}/extra-attempt")
            ->assertStatus(422);

        [$unlimited, $question] = $this->singleQuestionExam(maxAttempts: null);
        $this->actingAs($student, 'sanctum')
            ->postJson("/api/exams/{$unlimited->id}/submit", ['answers' => [(string) $question->id => 1]])
            ->assertOk();
        $failed = ExamResult::where('exam_id', $unlimited->id)->firstOrFail();
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/exam-results/{$failed->id}/extra-attempt")
            ->assertStatus(422);
    }

    public function test_analyst_cannot_grant_extra_exam_attempt(): void
    {
        $analyst = User::factory()->create(['role' => 'analyst']);
        $student = User::factory()->create(['role' => 'student']);
        [$exam] = $this->singleQuestionExam(maxAttempts: 1);
        $result = ExamResult::create([
            'exam_id' => $exam->id,
            'user_id' => $student->id,
            'attempt_number' => 1,
            'score' => 0,
            'total_points' => 1,
            'percentage' => 0,
            'passed' => false,
            'answers' => [],
            'completed_at' => now(),
        ]);

        $this->actingAs($analyst, 'sanctum')
            ->postJson("/api/admin/exam-results/{$result->id}/extra-attempt")
            ->assertForbidden();
        $this->assertDatabaseCount('user_exam_attempt_grants', 0);
    }

    /**
     * @return array{0: Exam, 1: ExamQuestion}
     */
    private function singleQuestionExam(?int $maxAttempts): array
    {
        $exam = Exam::create([
            'title' => 'Examen cu limită',
            'status' => 'published',
            'course_id' => null,
            'passing_score' => 50,
            'max_attempts' => $maxAttempts,
            'settings' => [
                'access_mode' => 'all_students',
                'manual_review' => false,
            ],
        ]);
        $question = ExamQuestion::create([
            'exam_id' => $exam->id,
            'question_text' => 'Întrebare',
            'question_type' => 'single_choice',
            'points' => 1,
            'order' => 0,
        ]);
        ExamAnswer::create(['exam_question_id' => $question->id, 'answer_text' => 'Corect', 'is_correct' => true, 'order' => 0]);
        ExamAnswer::create(['exam_question_id' => $question->id, 'answer_text' => 'Greșit', 'is_correct' => false, 'order' => 1]);

        return [$exam, $question];
    }
}
