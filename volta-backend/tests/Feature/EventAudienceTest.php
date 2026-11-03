<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Evenimentele pe echipe: lista și înscrierea folosesc aceleași reguli.
 */
class EventAudienceTest extends TestCase
{
    use RefreshDatabase;

    private User $student;

    private Team $myTeam;

    private Team $otherTeam;

    protected function setUp(): void
    {
        parent::setUp();
        $this->student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $owner = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $this->myTeam = Team::create(['name' => 'Echipa mea', 'owner_id' => $owner->id]);
        $this->otherTeam = Team::create(['name' => 'Altă echipă', 'owner_id' => $owner->id]);
        $this->student->teams()->attach($this->myTeam->id);
    }

    private function event(string $title, ?Team $team, int $daysFromNow, int $durationHours = 2): Event
    {
        $start = now()->addDays($daysFromNow);
        $event = Event::create([
            'title' => $title, 'description' => '-', 'type' => 'webinar', 'status' => 'published',
            'start_date' => $start->format('Y-m-d H:i:s'),
            'end_date' => $start->copy()->addHours($durationHours)->format('Y-m-d H:i:s'),
            'access_type' => 'free',
            'audience_type' => $team ? 'teams' : 'all',
        ]);
        if ($team) {
            DB::table('event_team')->insert(['event_id' => $event->id, 'team_id' => $team->id]);
        }

        return $event;
    }

    public function test_own_team_events_are_not_pushed_off_the_first_page_by_other_teams(): void
    {
        for ($i = 1; $i <= 22; $i++) {
            $this->event("Altă echipă {$i}", $this->otherTeam, $i);
        }
        $this->event('Evenimentul meu', $this->myTeam, 30);
        $this->event('Pentru toți', null, 31);

        $response = $this->actingAs($this->student, 'sanctum')->getJson('/api/events')->assertOk();

        $this->assertSame(['Evenimentul meu', 'Pentru toți'], collect($response->json('data'))->pluck('title')->all());
        $this->assertSame(2, $response->json('total'));
    }

    public function test_cannot_register_to_another_teams_event(): void
    {
        $event = $this->event('Altă echipă', $this->otherTeam, 3);

        $this->actingAs($this->student, 'sanctum')->postJson("/api/events/{$event->id}/register")->assertNotFound();
        $this->assertDatabaseMissing('event_user', ['event_id' => $event->id, 'user_id' => $this->student->id]);
    }

    public function test_cannot_register_to_an_event_that_already_ended(): void
    {
        $event = $this->event('Trecut', null, -2);

        $this->actingAs($this->student, 'sanctum')->postJson("/api/events/{$event->id}/register")->assertStatus(400);
    }

    public function test_can_register_to_own_team_event(): void
    {
        $event = $this->event('Al meu', $this->myTeam, 3);

        $this->actingAs($this->student, 'sanctum')->postJson("/api/events/{$event->id}/register")->assertOk();
    }
}
