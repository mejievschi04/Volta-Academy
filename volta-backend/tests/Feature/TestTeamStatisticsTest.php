<?php

namespace Tests\Feature;

use App\Models\Team;
use App\Models\Test;
use App\Models\TestResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TestTeamStatisticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_statistics_can_be_scoped_to_one_team_or_to_students_without_a_team(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $inTeam = User::factory()->create(['role' => 'student']);
        $outside = User::factory()->create(['role' => 'student']);
        $team = Team::create(['name' => 'Grupa A', 'owner_id' => $admin->id]);
        $team->users()->attach($inTeam->id);
        $test = Test::factory()->create(['created_by' => $admin->id]);

        foreach ([$inTeam, $outside] as $student) {
            TestResult::create([
                'test_id' => $test->id,
                'user_id' => $student->id,
                'score' => 8,
                'max_score' => 10,
                'percentage' => 80,
                'passed' => true,
                'attempt_number' => 1,
                'completed_at' => now(),
                'status' => 'completed',
            ]);
        }

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/tests/{$test->id}/statistics?team_id={$team->id}")
            ->assertOk()
            ->assertJsonPath('summary.attempts_count', 1)
            ->assertJsonPath('summary.unique_students', 1);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/tests/{$test->id}/statistics?unassigned=1")
            ->assertOk()
            ->assertJsonPath('summary.attempts_count', 1)
            ->assertJsonPath('summary.unique_students', 1);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/tests/{$test->id}/results?team_id={$team->id}")
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.user.teams.0', 'Grupa A');
    }
}
