<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamQuestion;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExamQuestionFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_bank_sync_respects_question_count_and_includes_starred_inside_that_count(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $bank = QuestionBank::create([
            'title' => 'Bancă examen',
            'status' => 'draft',
            'created_by' => $admin->id,
        ]);

        foreach (range(1, 6) as $i) {
            Question::factory()->forQuestionBank($bank->id)->create([
                'content' => "Intrebare {$i}",
                'order' => $i,
                'is_starred' => $i <= 2,
                'answers' => [
                    ['text' => 'Da', 'is_correct' => true, 'order' => 0],
                    ['text' => 'Nu', 'is_correct' => false, 'order' => 1],
                ],
            ]);
        }

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/exams', [
            'title' => 'Examen din bancă',
            'status' => 'draft',
            'settings' => [
                'question_count' => 4,
                'selection_mode' => 'folders',
                'folder_ids' => [$bank->id],
                'include_starred' => true,
                'shuffle_questions' => false,
            ],
        ]);

        $response->assertCreated();
        $examId = (int) $response->json('exam.id');
        $exam = Exam::findOrFail($examId);
        $this->assertSame(4, $exam->questions()->count());

        $sourceIds = $exam->questions->map(fn ($q) => $q->payload['source_question_id'] ?? null)->filter()->values();
        $starredInExam = Question::whereIn('id', $sourceIds)->where('is_starred', true)->count();
        $this->assertSame(2, $starredInExam);
    }

    public function test_shuffle_questions_changes_order_per_attempt_but_keeps_scoring(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $exam = Exam::create([
            'title' => 'Examen amestecat',
            'status' => 'published',
            'course_id' => null,
            'passing_score' => 50,
            'max_attempts' => 3,
            'settings' => [
                'shuffle_questions' => true,
                'access_mode' => 'all_students',
                'manual_review' => false,
            ],
        ]);

        $labels = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'];
        foreach ($labels as $index => $label) {
            $question = ExamQuestion::create([
                'exam_id' => $exam->id,
                'question_text' => $label,
                'question_type' => 'single_choice',
                'points' => 1,
                'order' => $index,
            ]);
            ExamAnswer::create([
                'exam_question_id' => $question->id,
                'answer_text' => 'Corect',
                'is_correct' => true,
                'order' => 0,
            ]);
            ExamAnswer::create([
                'exam_question_id' => $question->id,
                'answer_text' => 'Gresit',
                'is_correct' => false,
                'order' => 1,
            ]);
        }

        $first = $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$exam->id}");
        $first->assertOk();
        $firstIds = array_column($first->json('questions'), 'id');
        $storedOrder = $exam->questions()->orderBy('order')->pluck('id')->all();
        $this->assertNotSame($storedOrder, $firstIds, 'Amestecarea trebuie să schimbe ordinea față de snapshot.');

        $again = $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$exam->id}");
        $again->assertOk();
        $this->assertSame($firstIds, array_column($again->json('questions'), 'id'));

        $answers = [];
        foreach ($exam->questions as $question) {
            $answers[(string) $question->id] = 0;
        }

        $submit = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$exam->id}/submit", [
            'answers' => $answers,
        ]);
        $submit->assertOk();
        $this->assertTrue((bool) $submit->json('result.passed'));
        $this->assertSame(100.0, (float) $submit->json('result.percentage'));

        $secondAttempt = $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$exam->id}?new_attempt=1");
        $secondAttempt->assertOk();
        $secondIds = array_column($secondAttempt->json('questions'), 'id');
        $this->assertNotSame($firstIds, $secondIds, 'O nouă încercare trebuie să amestece din nou.');
        $this->assertEqualsCanonicalizing($firstIds, $secondIds);
    }

    public function test_unshuffled_exam_keeps_saved_question_order(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $exam = Exam::create([
            'title' => 'Examen fără amestec',
            'status' => 'published',
            'course_id' => null,
            'passing_score' => 50,
            'max_attempts' => 2,
            'settings' => [
                'shuffle_questions' => false,
                'access_mode' => 'all_students',
            ],
        ]);

        foreach (['Una', 'Doua', 'Trei'] as $index => $label) {
            ExamQuestion::create([
                'exam_id' => $exam->id,
                'question_text' => $label,
                'question_type' => 'true_false',
                'points' => 1,
                'order' => $index,
            ]);
        }

        $response = $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$exam->id}");
        $response->assertOk();
        $this->assertSame(['Una', 'Doua', 'Trei'], array_column($response->json('questions'), 'text'));
    }
}
