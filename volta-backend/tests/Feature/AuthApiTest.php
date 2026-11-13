<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Mockery;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_public_registration_is_closed(): void
    {
        $this->mock(NotificationService::class, function ($mock) {
            $mock->shouldReceive('notifyRegistrationRequested')->never();
        });

        $this->postJson('/api/auth/register', [
            'name' => 'Ana Popescu',
            'email' => 'ana.popescu@example.com',
            'password' => 'Password123',
        ])->assertForbidden();

        $this->assertDatabaseMissing('users', [
            'email' => 'ana.popescu@example.com',
        ]);
    }

    public function test_login_rejects_pending_accounts(): void
    {
        User::factory()->create([
            'name' => 'Pending User',
            'email' => 'pending@example.com',
            'password' => Hash::make('Password123'),
            'role' => 'student',
            'status' => 'pending',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'pending@example.com',
            'password' => 'Password123',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_me_returns_current_user_profile(): void
    {
        $user = User::factory()->create([
            'name' => 'Maria Ionescu',
            'email' => 'maria.ionescu@example.com',
            'role' => 'student',
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/auth/me');

        $response->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.name', 'Maria Ionescu')
            ->assertJsonPath('user.email', 'maria.ionescu@example.com')
            ->assertJsonPath('user.role', 'student');
    }

    public function test_change_password_updates_the_password_and_clears_must_change_flag(): void
    {
        $user = User::factory()->create([
            'name' => 'Ion Pop',
            'email' => 'ion.pop@example.com',
            'password' => Hash::make('Password123'),
            'role' => 'student',
            'must_change_password' => true,
        ]);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/auth/change-password', [
            'current_password' => 'Password123',
            'new_password' => 'NewPassword123',
            'new_password_confirmation' => 'NewPassword123',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.must_change_password', false);

        $freshUser = $user->fresh();
        $this->assertNotNull($freshUser);
        $this->assertTrue(Hash::check('NewPassword123', $freshUser->password));
        $this->assertFalse((bool) $freshUser->must_change_password);
    }

    public function test_logout_revokes_bearer_token(): void
    {
        $user = User::factory()->create([
            'name' => 'Logout User',
            'email' => 'logout@example.com',
            'role' => 'student',
        ]);

        $tokenResult = $user->createToken('test-token');
        $plainToken = $tokenResult->plainTextToken;
        $tokenId = $tokenResult->accessToken->id;

        $response = $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->postJson('/api/auth/logout');

        $response->assertOk()
            ->assertJson([
                'message' => 'Deconectare reușită',
            ]);

        $this->assertDatabaseMissing('personal_access_tokens', [
            'id' => $tokenId,
        ]);
    }

    public function test_login_keeps_the_user_remembered_across_visits(): void
    {
        $user = User::factory()->create([
            'email' => 'remember@example.com',
            'password' => Hash::make('Password123'),
            'role' => 'student',
            'status' => 'active',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'remember@example.com',
            'password' => 'Password123',
        ])->assertOk();

        $recaller = \Illuminate\Support\Facades\Auth::guard('web')->getRecallerName();
        $response->assertCookie($recaller);
        $this->assertNotNull($user->fresh()->getRememberToken());
    }

    public function test_admin_password_change_forgets_remembered_devices(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $student = User::factory()->create(['role' => 'student', 'status' => 'active', 'remember_token' => 'old-device-token']);

        $this->actingAs($admin)
            ->putJson("/api/admin/users/{$student->id}", ['password' => 'NewPass123'])
            ->assertOk();

        $this->assertNotSame('old-device-token', $student->fresh()->getRememberToken());
    }
}
