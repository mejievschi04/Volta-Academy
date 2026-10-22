<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminUsersListTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_users_can_be_loaded_with_filters_and_trash_scope(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        User::factory()->count(20)->create(['role' => 'student', 'status' => 'active']);
        $deleted = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $deleted->delete();

        $this->actingAs($admin, 'sanctum');
        $this->getJson('/api/admin/users?all=1')->assertOk()->assertJsonCount(21);
        $this->getJson('/api/admin/users?all=1&role=student&status=active')->assertOk()->assertJsonCount(20);
        $this->getJson('/api/admin/users?all=1&trashed=1')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $deleted->id);
        $this->getJson('/api/admin/users')->assertOk()->assertJsonCount(15, 'data')->assertJsonPath('total', 21);
    }

    public function test_list_returns_course_stats_without_full_course_relations(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $course = \App\Models\Course::factory()->create(['teacher_id' => $admin->id]);
        $student->assignedCourses()->attach($course->id, ['enrolled' => true]);

        $this->actingAs($admin, 'sanctum');
        $row = collect($this->getJson('/api/admin/users?all=1')->assertOk()->json())
            ->firstWhere('id', $student->id);

        $this->assertSame(1, $row['total_courses']);
        $this->assertArrayHasKey('teams', $row);
        $this->assertArrayNotHasKey('assigned_courses', $row);
        $this->assertArrayNotHasKey('courses', $row);
    }

    public function test_search_finds_users_without_a_team_by_given_name_surname_or_email(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'name' => 'Admin Root',
            'email' => 'admin-root@example.test',
        ]);
        $withoutTeam = User::factory()->create([
            'role' => 'student',
            'status' => 'active',
            'name' => 'Ștefan Popescu',
            'email' => 'stefan.popescu@example.test',
        ]);
        User::factory()->create([
            'role' => 'student',
            'status' => 'active',
            'name' => 'Maria Ionescu',
            'email' => 'maria.ionescu@example.test',
        ]);

        $this->actingAs($admin, 'sanctum');

        $this->assertSame(0, $withoutTeam->teams()->count());

        $bySurname = $this->getJson('/api/admin/users?all=1&search=popescu')->assertOk()->json();
        $this->assertSame([$withoutTeam->id], collect($bySurname)->pluck('id')->all());

        $byGivenName = $this->getJson('/api/admin/users?all=1&search=stefan')->assertOk()->json();
        $this->assertSame([$withoutTeam->id], collect($byGivenName)->pluck('id')->all());

        $byReversedName = $this->getJson('/api/admin/users?all=1&search=POPESCU stefan')->assertOk()->json();
        $this->assertSame([$withoutTeam->id], collect($byReversedName)->pluck('id')->all());

        $byEmail = $this->getJson('/api/admin/users?all=1&search=stefan.popescu@example.test')->assertOk()->json();
        $this->assertSame([$withoutTeam->id], collect($byEmail)->pluck('id')->all());
    }

    public function test_brief_directory_lists_users_without_a_team_for_member_search(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'name' => 'Admin Root',
            'email' => 'admin-root@example.test',
        ]);
        $withoutTeam = User::factory()->create([
            'role' => 'student',
            'name' => 'Ioana Georgescu',
            'email' => 'ioana.georgescu@example.test',
        ]);

        $this->actingAs($admin, 'sanctum');

        $response = $this->getJson('/api/admin/users?brief=1&search=georgescu')->assertOk();
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.id', $withoutTeam->id);
        $response->assertJsonPath('0.email', 'ioana.georgescu@example.test');
        $response->assertJsonMissingPath('0.teams');
    }

    public function test_users_are_paged_filtered_and_sorted_by_team_on_the_server(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'name' => 'Admin Root']);
        $alpha = \App\Models\Team::create(['name' => 'Alfa', 'owner_id' => $admin->id]);
        $zulu = \App\Models\Team::create(['name' => 'Zulu', 'owner_id' => $admin->id]);
        $inZulu = User::factory()->create(['role' => 'student', 'name' => 'Ana Markerescu']);
        $inAlpha = User::factory()->create(['role' => 'student', 'name' => 'Bogdan Markerescu']);
        $inBoth = User::factory()->create(['role' => 'student', 'name' => 'Cristi Markerescu']);
        $noTeam = User::factory()->create(['role' => 'student', 'name' => 'Dan Markerescu']);
        $zulu->users()->attach([$inZulu->id, $inBoth->id]);
        $alpha->users()->attach([$inAlpha->id, $inBoth->id]);
        User::factory()->count(60)->create(['role' => 'student']);

        $this->actingAs($admin, 'sanctum');

        $page = $this->getJson('/api/admin/users?per_page=50&page=2&role=student&sort_by=name&sort_direction=asc')->assertOk();
        $page->assertJsonPath('total', 64)->assertJsonPath('last_page', 2)->assertJsonCount(14, 'data');

        $byTeam = collect($this->getJson('/api/admin/users?per_page=50&role=student&search=markerescu&sort_by=team&sort_direction=asc')->json('data'))
            ->pluck('id')->all();
        $this->assertCount(4, $byTeam);
        $this->assertSame($noTeam->id, $byTeam[0]);
        $this->assertSame($inZulu->id, $byTeam[3]);
        $this->assertEqualsCanonicalizing([$inAlpha->id, $inBoth->id], [$byTeam[1], $byTeam[2]]);
    }
}
