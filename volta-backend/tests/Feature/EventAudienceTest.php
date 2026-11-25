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

    public function test_student_history_includes_ended_and_completed_events_for_their_audience(): void
    {
        $older = $this->event('Eveniment mai vechi', null, -3);
        $ended = $this->event('Eveniment încheiat', $this->myTeam, -1);
        $ended->update(['status' => 'live']);
        $completed = $this->event('Eveniment finalizat', null, 1);
        $completed->update(['status' => 'completed']);
        $private = $this->event('Altă echipă', $this->otherTeam, -1);
        $this->event('Ciornă', null, -1)->update(['status' => 'draft']);
        $this->event('Anulat', null, -1)->update(['status' => 'cancelled']);
        $active = $this->event('Eveniment activ', null, 2);

        $this->actingAs($this->student, 'sanctum')
            ->getJson('/api/events')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $active->id);

        $this->getJson('/api/events?date_filter=past&per_page=2')
            ->assertOk()
            ->assertJsonPath('total', 3)
            ->assertJsonPath('data.0.id', $completed->id)
            ->assertJsonPath('data.1.id', $ended->id)
            ->assertJsonPath('data.1.is_completed', true)
            ->assertJsonPath('data.1.is_live', false);
        $this->getJson('/api/events?date_filter=past&per_page=2&page=2')
            ->assertOk()
            ->assertJsonPath('data.0.id', $older->id);
        $this->getJson("/api/events/{$ended->id}")->assertOk();
        $this->getJson("/api/events/{$private->id}")->assertNotFound();
    }

    public function test_expired_student_event_preserves_existing_registration(): void
    {
        $event = $this->event('Eveniment activ', null, 2);
        $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/events/{$event->id}/register")->assertOk();

        $this->travel(3)->days();

        $this->getJson('/api/events?date_filter=past')
            ->assertOk()
            ->assertJsonPath('data.0.user_registered', true);
        $this->postJson("/api/events/{$event->id}/cancel-registration")->assertStatus(400);
        $this->postJson("/api/events/{$event->id}/questions", ['body' => 'Unde găsesc materialele?'])->assertStatus(400);
        $this->assertDatabaseHas('event_user', [
            'event_id' => $event->id,
            'user_id' => $this->student->id,
            'registered' => true,
        ]);
    }

    public function test_admin_can_search_and_open_past_events(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $ended = $this->event('Instruire încheiată', null, -1);
        $active = $this->event('Instruire viitoare', null, 1);
        $this->event('Ciornă instruire', null, -2)->update(['status' => 'draft']);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/events?date_filter=past&search=Instruire')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $ended->id);
        $this->getJson('/api/admin/events?date_filter=active')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $active->id);
        $this->getJson("/api/admin/events/{$ended->id}")->assertOk();
    }

    public function test_can_register_to_own_team_event(): void
    {
        $event = $this->event('Al meu', $this->myTeam, 3);

        $this->actingAs($this->student, 'sanctum')->postJson("/api/events/{$event->id}/register")->assertOk();
    }
}
