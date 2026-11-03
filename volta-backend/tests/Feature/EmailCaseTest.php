<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Emailul nu depinde de majuscule: pe telefon tastatura scrie „Ion@…”, iar emailurile se salvează cu litere mici.
 */
class EmailCaseTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_ignores_email_case_and_spaces(): void
    {
        User::factory()->create([
            'email' => 'ion.popescu@example.com',
            'password' => Hash::make('Password123'),
            'role' => 'student',
            'status' => 'active',
        ]);

        $this->postJson('/api/auth/login', ['email' => ' Ion.Popescu@Example.com ', 'password' => 'Password123'])
            ->assertOk();
    }

    public function test_pending_account_is_recognized_whatever_the_case(): void
    {
        User::factory()->create([
            'email' => 'nou@example.com',
            'password' => Hash::make('Password123'),
            'status' => 'pending',
        ]);

        $this->postJson('/api/auth/login', ['email' => 'Nou@example.com', 'password' => 'Password123'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_register_with_existing_email_in_other_case_is_a_validation_error(): void
    {
        User::factory()->create(['email' => 'ion@example.com']);

        $this->postJson('/api/auth/register', [
            'name' => 'Ion Popescu',
            'email' => 'Ion@Example.com',
            'password' => 'Password123',
        ])->assertStatus(422)->assertJsonValidationErrors(['email']);
    }

    public function test_admin_cannot_create_a_duplicate_that_differs_only_in_case(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        User::factory()->create(['email' => 'maria@example.com']);

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'name' => 'Maria',
            'email' => 'Maria@Example.com',
            'password' => 'Password123',
            'role' => 'student',
        ])->assertStatus(422)->assertJsonValidationErrors(['email']);

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'name' => 'Ana',
            'email' => 'Ana@Example.com',
            'password' => 'Password123',
            'role' => 'student',
        ])->assertSuccessful();
        $this->assertDatabaseHas('users', ['email' => 'ana@example.com']);
    }
}
