<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TelemetryTest extends TestCase
{
    use RefreshDatabase;

    public function test_intermediate_test_steps_are_not_written_to_the_activity_log(): void
    {
        $student = User::factory()->create(['role' => 'student']);

        foreach (['learner_attempt_started', 'learner_result_viewed', 'learner_retake_weak_areas_started'] as $event) {
            $this->actingAs($student, 'sanctum')
                ->postJson('/api/telemetry/events', [
                    'event_name' => $event,
                    'payload' => ['exam_id' => 12],
                    'model_type' => 'exam',
                    'model_id' => 12,
                ])
                ->assertOk()
                ->assertJsonPath('ok', true);

            $this->assertDatabaseMissing('activity_logs', [
                'user_id' => $student->id,
                'action' => 'telemetry.'.$event,
            ]);
        }
    }

    public function test_student_can_send_learner_attempt_submitted(): void
    {
        $student = User::factory()->create(['role' => 'student']);

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/telemetry/events', [
                'event_name' => 'learner_attempt_submitted',
                'payload' => ['passed' => true, 'percentage' => 85],
                'model_type' => 'exam',
                'model_id' => 5,
            ])
            ->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $student->id,
            'action' => 'telemetry.learner_attempt_submitted',
        ]);
    }

    public function test_saved_answer_is_not_written_to_the_activity_log(): void
    {
        $student = User::factory()->create(['role' => 'student']);

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/telemetry/events', [
                'event_name' => 'learner_answer_saved',
                'payload' => ['answered_count' => 1, 'question_count' => 9],
                'model_type' => 'exam',
                'model_id' => 5,
            ])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertDatabaseMissing('activity_logs', [
            'user_id' => $student->id,
            'action' => 'telemetry.learner_answer_saved',
        ]);
    }

    public function test_invalid_telemetry_event_rejected(): void
    {
        $student = User::factory()->create(['role' => 'student']);

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/telemetry/events', [
                'event_name' => 'unknown_event',
                'payload' => [],
            ])
            ->assertStatus(422);
    }
}
