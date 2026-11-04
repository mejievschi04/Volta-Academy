<?php

namespace Tests\Feature;

use App\Models\Question;
use App\Models\Test;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Analiza pe întrebări corectează încercarea pe întrebarea pe care a văzut-o cursantul
 * (nu pe forma editată ulterior) și numără alegerile la varianta aleasă, chiar dacă variantele erau amestecate.
 */
class TestQuestionAnalyticsSnapshotTest extends TestCase
{
    use RefreshDatabase;

    public function test_analytics_follow_the_attempt_after_the_question_is_edited(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'student']);
        $test = Test::factory()->published()->create(['randomize_answers' => true, 'max_attempts' => 3]);
        $original = ['Roșu', 'Verde', 'Albastru', 'Galben', 'Mov'];
        $question = Question::factory()->create([
            'test_id' => $test->id, 'type' => 'single_choice', 'points' => 1,
            'answers' => array_map(fn ($text) => ['text' => $text, 'is_correct' => $text === 'Verde'], $original),
        ]);

        $this->actingAs($student, 'sanctum');
        $options = $this->getJson("/api/exams/{$test->id}?new_attempt=1")->assertOk()->json('questions.0.options');
        $chosen = array_search('Verde', $options, true);
        $this->postJson("/api/exams/{$test->id}/submit", ['answers' => [$question->id => $chosen]])
            ->assertOk()->assertJsonPath('result.passed', true);

        // după încercare, adminul schimbă răspunsul corect
        $question->update(['answers' => array_map(fn ($text) => ['text' => $text, 'is_correct' => $text === 'Mov'], $original)]);

        $row = collect($this->actingAs($admin, 'sanctum')->getJson("/api/admin/tests/{$test->id}/question-analytics")
            ->assertOk()->json())->firstWhere('question_id', $question->id);

        $this->assertEquals(1, $row['average_points_earned']);
        $this->assertSame(1, $row['correct_count']);
        $counts = collect($row['option_stats'])->pluck('count', 'text')->all();
        $this->assertSame(1, $counts['Verde']);
        $this->assertSame(0, array_sum($counts) - $counts['Verde']);
    }
}
