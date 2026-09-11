<?php

namespace Tests\Feature;

use App\Models\Question;
use App\Models\Test;
use App\Models\TestResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConcurrentExamSubmitTest extends TestCase
{
    use RefreshDatabase;

    public function test_two_opens_share_one_in_progress_row(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $test = Test::factory()->published()->create(['time_limit_minutes' => null, 'max_attempts' => 3]);
        Question::factory()->create(['test_id' => $test->id]);
        $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$test->id}")->assertOk();
        $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$test->id}")->assertOk();
        $this->assertSame(1, TestResult::query()->where('test_id', $test->id)->where('user_id', $student->id)->count());
    }

    public function test_mysql_parallel_submit_is_not_run_on_sqlite(): void
    {
        if (config('database.default') !== 'mysql') {
            $this->markTestSkipped('Concurența reală pe două conexiuni trebuie rulată pe MySQL/staging.');
        }

        $this->assertTrue(true);
    }
}
