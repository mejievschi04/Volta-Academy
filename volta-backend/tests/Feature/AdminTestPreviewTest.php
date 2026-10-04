<?php

namespace Tests\Feature;

use App\Models\Question;
use App\Models\Test;
use App\Models\TestResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Adminul parcurge un test ca un cursant (din lista de teste, fără curs): îl vede, îl trimite și
 * primește rezultatul, dar încercarea nu se salvează.
 */
class AdminTestPreviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_take_a_test_without_saving_the_attempt(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        foreach (['published', 'draft'] as $status) {
            $test = Test::factory()->create(['status' => $status, 'created_by' => $admin->id, 'max_attempts' => 1, 'passing_score' => 50]);
            $question = Question::factory()->create([
                'test_id' => $test->id, 'type' => 'single_choice', 'points' => 1,
                'answers' => [['text' => 'Da', 'is_correct' => true], ['text' => 'Nu', 'is_correct' => false]],
            ]);

            $this->actingAs($admin, 'sanctum')->getJson("/api/exams/{$test->id}")->assertOk()->assertJsonPath('id', $test->id);

            // de două ori: limita de o încercare nu se aplică, pentru că nimic nu se salvează
            foreach ([1, 2] as $_) {
                $this->postJson("/api/exams/{$test->id}/submit", ['answers' => [$question->id => 0]])
                    ->assertOk()
                    ->assertJsonPath('result.passed', true);
            }

            $this->assertSame(0, TestResult::where('test_id', $test->id)->count(), "test {$status}: nicio încercare salvată");
        }
    }
}
