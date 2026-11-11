<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EventQuestionTest extends TestCase
{
    use RefreshDatabase;

    private function event(): Event
    {
        $start = now()->addDay();

        return Event::create([
            'title' => 'Webinar invertoare',
            'description' => 'Tema: DEYE',
            'type' => 'webinar',
            'status' => 'published',
            'start_date' => $start->format('Y-m-d H:i:s'),
            'end_date' => $start->copy()->addHours(2)->format('Y-m-d H:i:s'),
            'access_type' => 'free',
            'audience_type' => 'all',
        ]);
    }

    public function test_a_user_can_ask_and_only_an_admin_can_read_the_questions(): void
    {
        $event = $this->event();
        $student = User::factory()->create(['role' => 'student', 'name' => 'Ana Pop']);
        $instructor = User::factory()->create(['role' => 'instructor']);
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/events/{$event->id}/questions", ['body' => 'Cum se setează bateriile?'])
            ->assertCreated()
            ->assertJsonPath('message', 'Întrebarea a fost trimisă.');

        $this->actingAs($student, 'sanctum')
            ->getJson("/api/admin/events/{$event->id}/questions")
            ->assertForbidden();

        $this->actingAs($instructor, 'sanctum')
            ->getJson("/api/admin/events/{$event->id}/questions")
            ->assertForbidden();

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/events')
            ->assertOk()
            ->assertJsonMissing(['body' => 'Cum se setează bateriile?']);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/events/{$event->id}/questions")
            ->assertOk()
            ->assertJsonPath('data.0.body', 'Cum se setează bateriile?')
            ->assertJsonPath('data.0.user.name', 'Ana Pop');
    }
}
