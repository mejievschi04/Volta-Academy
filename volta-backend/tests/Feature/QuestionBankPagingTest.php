<?php

namespace Tests\Feature;

use App\Models\Question;
use App\Models\QuestionBank;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuestionBankPagingTest extends TestCase
{
    use RefreshDatabase;

    private function bankWithQuestions(User $owner, int $count): QuestionBank
    {
        $bank = QuestionBank::create(['title' => 'Folder mare', 'created_by' => $owner->id, 'status' => 'draft']);
        for ($i = 1; $i <= $count; $i++) {
            Question::create([
                'question_bank_id' => $bank->id,
                'type' => $i % 3 === 0 ? 'true_false' : 'single_choice',
                'content' => $i === 7 ? '<p>Care este Capitala României?</p>' : "<p>Întrebarea {$i}</p>",
                'answers' => [['text' => 'A', 'is_correct' => true]],
                'points' => 2,
                'order' => $i,
                'is_starred' => $i <= 4,
            ]);
        }

        return $bank;
    }

    public function test_bank_list_and_details_do_not_ship_every_question(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $bank = $this->bankWithQuestions($admin, 12);
        $this->actingAs($admin, 'sanctum');

        $row = $this->getJson('/api/admin/question-banks')->assertOk()->json('data.0');
        $this->assertSame(12, $row['questions_count']);
        $this->assertSame(4, $row['starred_questions_count']);
        $this->assertArrayNotHasKey('questions', $row);

        $this->assertArrayNotHasKey('questions', $this->getJson("/api/admin/question-banks/{$bank->id}")->assertOk()->json());
        $this->assertCount(12, $this->getJson("/api/admin/question-banks/{$bank->id}?with_questions=1")->assertOk()->json('questions'));
    }

    public function test_bank_questions_are_paged_searched_and_summarised_on_the_server(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $bank = $this->bankWithQuestions($admin, 120);
        $this->actingAs($admin, 'sanctum');

        $page = $this->getJson("/api/admin/question-banks/{$bank->id}/questions?page=2&per_page=50")->assertOk();
        $page->assertJsonCount(50, 'data')
            ->assertJsonPath('total', 120)
            ->assertJsonPath('last_page', 3)
            ->assertJsonPath('data.0.order', 51)
            ->assertJsonPath('stats.total', 120)
            ->assertJsonPath('stats.starred', 4)
            ->assertJsonPath('stats.types', ['single_choice', 'true_false']);
        $this->assertEquals(240, $page->json('stats.points'));

        $this->getJson("/api/admin/question-banks/{$bank->id}/questions?page=1&search=capitala")
            ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.order', 7);
        $this->getJson("/api/admin/question-banks/{$bank->id}/questions?page=1&type=true_false")
            ->assertOk()->assertJsonPath('total', 40)->assertJsonPath('stats.total', 120);

        // fără `page`: lista completă, pentru builder și selectorul din examene
        $this->assertCount(120, $this->getJson("/api/admin/question-banks/{$bank->id}/questions")->assertOk()->json());
    }

    public function test_instructors_cannot_page_through_someone_elses_bank(): void
    {
        $owner = User::factory()->create(['role' => 'instructor']);
        $other = User::factory()->create(['role' => 'instructor']);
        $bank = $this->bankWithQuestions($owner, 3);

        $this->actingAs($other, 'sanctum')
            ->getJson("/api/admin/question-banks/{$bank->id}/questions?page=1")
            ->assertForbidden();
    }
}
