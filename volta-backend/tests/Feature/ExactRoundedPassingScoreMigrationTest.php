<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseTest;
use App\Models\Question;
use App\Models\Test;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pragurile vechi rotunjite în sus („10 din 13” salvat ca 77%) devin exacte, ca 10 din 13 să promoveze.
 */
class ExactRoundedPassingScoreMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function testWith(float $score, int $questions): Test
    {
        $test = Test::factory()->published()->create(['passing_score' => $score]);
        Question::factory()->count($questions)->create(['test_id' => $test->id]);

        return $test;
    }

    public function test_rounded_up_fractions_become_exact_and_others_stay(): void
    {
        $roundedUp = $this->testWith(77, 13);      // 10/13 = 76,92
        $roundedDown = $this->testWith(83, 6);     // 5/6 = 83,33: promovează deja
        $notAFraction = $this->testWith(70, 3);    // 2/3 = 66,67 → 67, nu 70
        $alreadyExact = $this->testWith(77.78, 9);
        $course = Course::factory()->create();
        $link = CourseTest::create(['course_id' => $course->id, 'test_id' => $roundedUp->id, 'scope' => 'course', 'required' => true, 'passing_score' => 77, 'order' => 0]);

        (require database_path('migrations/2026_11_04_150000_exact_rounded_passing_scores.php'))->up();

        $this->assertEquals(76.92, $roundedUp->fresh()->passing_score);
        $this->assertEquals(76.92, $link->fresh()->passing_score);
        $this->assertEquals(83, $roundedDown->fresh()->passing_score);
        $this->assertEquals(70, $notAFraction->fresh()->passing_score);
        $this->assertEquals(77.78, $alreadyExact->fresh()->passing_score);
    }

    public function test_a_test_without_questions_cannot_be_published_from_the_list(): void
    {
        $admin = \App\Models\User::factory()->create(['role' => 'admin']);
        $empty = Test::factory()->create(['status' => 'draft']);
        $filled = $this->testWith(70, 2);
        $filled->update(['status' => 'draft']);

        $this->actingAs($admin, 'sanctum')->putJson("/api/admin/tests/{$empty->id}", ['status' => 'published'])
            ->assertStatus(422)->assertJsonValidationErrors('status');
        $this->assertSame('draft', $empty->fresh()->status);

        $this->actingAs($admin, 'sanctum')->putJson("/api/admin/tests/{$filled->id}", ['status' => 'published'])->assertOk();
        $this->assertSame('published', $filled->fresh()->status);
    }
}
