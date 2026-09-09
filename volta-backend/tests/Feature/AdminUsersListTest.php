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
}
