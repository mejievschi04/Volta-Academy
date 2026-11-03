<?php

namespace Tests\Feature;

use App\Models\Question;
use App\Models\Test;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pragul „7 din 9” rămâne 77,78% (nu 78%): se afișează exact și cine are exact 7 din 9 promovează.
 */
class ExactPassingScoreTest extends TestCase
{
    use RefreshDatabase;

    private function nineQuestionTest(): array
    {
        $test = Test::factory()->published()->create([
            'passing_score' => 77.78, 'max_attempts' => null, 'randomize_answers' => false, 'randomize_questions' => false,
        ]);
        $questions = Question::factory()->count(9)->create(['test_id' => $test->id, 'points' => 1]);

        return [$test, $questions];
    }

    /** primele $correct răspunsuri corecte (varianta 0), restul greșite */
    private function answers($questions, int $correct): array
    {
        return $questions->values()->mapWithKeys(fn ($q, $i) => [$q->id => $i < $correct ? 0 : 1])->all();
    }

    public function test_start_screen_shows_the_exact_threshold(): void
    {
        [$test] = $this->nineQuestionTest();
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);

        $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$test->id}")
            ->assertOk()
            ->assertJsonPath('passing_score', 77.78);
    }

    public function test_exactly_seven_of_nine_passes_and_six_fails(): void
    {
        [$test, $questions] = $this->nineQuestionTest();
        $passer = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $this->actingAs($passer, 'sanctum')->getJson("/api/exams/{$test->id}?start=1")->assertOk();
        $this->actingAs($passer, 'sanctum')->postJson("/api/exams/{$test->id}/submit", ['answers' => $this->answers($questions, 7)])
            ->assertOk()
            ->assertJsonPath('result.passed', true)
            ->assertJsonPath('result.percentage', 77.78);

        $failer = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $this->actingAs($failer, 'sanctum')->getJson("/api/exams/{$test->id}?start=1")->assertOk();
        $this->actingAs($failer, 'sanctum')->postJson("/api/exams/{$test->id}/submit", ['answers' => $this->answers($questions, 6)])
            ->assertOk()
            ->assertJsonPath('result.passed', false);
    }
}
