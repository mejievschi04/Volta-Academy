<?php

namespace Tests\Feature;

use App\Models\RegistrationInvitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
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

    public function test_register_is_closed_even_when_the_email_already_exists(): void
    {
        User::factory()->create(['email' => 'ion@example.com']);

        $this->postJson('/api/auth/register', [
            'name' => 'Ion Popescu',
            'email' => 'Ion@Example.com',
            'password' => 'Password123',
        ])->assertForbidden();

        $this->assertSame(1, User::whereRaw('LOWER(email) = ?', ['ion@example.com'])->count());
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

    public function test_profile_cannot_take_an_email_that_differs_only_in_case(): void
    {
        $owner = User::factory()->create(['email' => 'maria@example.com', 'role' => 'student']);
        $other = User::factory()->create(['email' => 'ana@example.com', 'role' => 'student']);

        $this->actingAs($other, 'sanctum')->putJson('/api/profile', [
            'email' => ' Maria@Example.com ',
        ])->assertStatus(422)->assertJsonValidationErrors(['email']);

        $this->assertSame('ana@example.com', $other->fresh()->email);
        $this->assertSame(1, User::withTrashed()->whereRaw('LOWER(email) = ?', ['maria@example.com'])->count());
        $this->assertSame($owner->id, User::where('email', 'maria@example.com')->value('id'));
    }

    public function test_deleted_account_still_keeps_the_email(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $student = User::factory()->create(['email' => 'ion@example.com', 'role' => 'student']);
        $student->delete();

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'name' => 'Ion Din Nou',
            'email' => 'Ion@Example.com',
            'password' => 'Password123',
            'role' => 'student',
        ])->assertStatus(422)->assertJsonValidationErrors(['email']);

        $plainToken = Str::random(64);
        RegistrationInvitation::create([
            'email' => 'ion@example.com',
            'token' => hash('sha256', $plainToken),
            'encrypted_token' => Crypt::encryptString($plainToken),
            'name' => 'Ion Din Nou',
            'role' => 'student',
            'expires_at' => now()->addDays(7),
            'email_status' => 'sent',
        ]);

        $this->postJson('/api/auth/invitations/'.$plainToken.'/accept', [
            'name' => 'Ion Din Nou',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
        ])->assertStatus(422);

        $this->assertSame(1, User::withTrashed()->whereRaw('LOWER(email) = ?', ['ion@example.com'])->count());
    }
}
