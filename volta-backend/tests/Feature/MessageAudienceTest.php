<?php

namespace Tests\Feature;

use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageAudienceTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_admins_can_load_teams_and_everyone_for_messaging(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $suspended = User::factory()->create(['role' => 'student', 'status' => 'suspended']);
        $team = Team::create(['name' => 'Casieri', 'owner_id' => $admin->id]);
        $team->users()->attach([$student->id, $suspended->id, $admin->id]);

        $this->actingAs($student, 'sanctum')->getJson('/api/messages/audience')->assertForbidden();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/messages/audience')->assertOk();

        $this->assertSame(1, $response->json('data.everyone_count'));
        $this->assertSame('Casieri', $response->json('data.teams.0.name'));
        $this->assertSame(1, $response->json('data.teams.0.members_count'));
        $this->assertSame([$student->id], $response->json('data.teams.0.members.*.id'));
    }

    public function test_admin_can_create_a_group_from_a_team_and_from_everyone(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $first = User::factory()->create(['role' => 'student', 'status' => 'active', 'name' => 'Ana']);
        $second = User::factory()->create(['role' => 'student', 'status' => 'active', 'name' => 'Ion']);
        $outsider = User::factory()->create(['role' => 'student', 'status' => 'active', 'name' => 'Maria']);
        User::factory()->create(['role' => 'student', 'status' => 'suspended', 'name' => 'Oprit']);
        $team = Team::create(['name' => 'Casieri', 'owner_id' => $admin->id]);
        $team->users()->attach([$first->id, $second->id]);

        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $this->actingAs($student, 'sanctum')
            ->postJson('/api/messages/conversations', [
                'type' => 'group',
                'team_ids' => [$team->id],
            ])
            ->assertForbidden();

        $created = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/messages/conversations', [
                'type' => 'group',
                'name' => 'Casieri',
                'team_ids' => [$team->id],
            ])
            ->assertCreated();

        $this->assertEqualsCanonicalizing(
            [$first->id, $second->id],
            collect($created->json('data.participants'))->pluck('id')->all()
        );
        $this->assertDatabaseMissing('conversation_participants', [
            'conversation_id' => $created->json('data.id'),
            'user_id' => $outsider->id,
        ]);

        $everyone = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/messages/conversations', [
                'type' => 'group',
                'include_everyone' => true,
            ])
            ->assertCreated();

        $everyoneIds = collect($everyone->json('data.participants'))->pluck('id')->all();
        $this->assertEqualsCanonicalizing(
            [$first->id, $second->id, $outsider->id, $student->id],
            $everyoneIds
        );
    }

    public function test_admin_can_add_a_team_to_an_existing_group(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $already = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $newcomer = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $extra = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $team = Team::create(['name' => 'Servicii', 'owner_id' => $admin->id]);
        $team->users()->attach([$already->id, $newcomer->id]);

        $created = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/messages/conversations', [
                'type' => 'group',
                'name' => 'Grup',
                'participant_ids' => [$already->id, $extra->id],
            ])
            ->assertCreated();

        $updated = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/messages/conversations/'.$created->json('data.id').'/participants', [
                'team_ids' => [$team->id],
            ])
            ->assertOk();

        $this->assertEqualsCanonicalizing(
            [$admin->id, $already->id, $extra->id, $newcomer->id],
            collect($updated->json('data'))->pluck('id')->all()
        );
    }
}
