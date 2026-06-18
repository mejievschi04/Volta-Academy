<?php

namespace Tests\Feature;

use App\Jobs\SendRegistrationInvitationEmailJob;
use App\Models\RegistrationInvitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class RegistrationInvitationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_send_invitation_without_waiting_for_email(): void
    {
        Bus::fake([SendRegistrationInvitationEmailJob::class]);

        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users/invitations', [
            'email' => 'invitat@example.com',
            'name' => 'Invitat Test',
            'role' => 'student',
        ]);

        $response->assertCreated()
            ->assertJsonPath('invitation.email', 'invitat@example.com')
            ->assertJsonStructure(['invite_url']);

        Bus::assertDispatched(SendRegistrationInvitationEmailJob::class);

        $this->assertDatabaseHas('registration_invitations', [
            'email' => 'invitat@example.com',
            'role' => 'student',
            'email_status' => 'pending',
        ]);
    }

    public function test_admin_can_copy_invitation_link_without_resending_email(): void
    {
        Bus::fake([SendRegistrationInvitationEmailJob::class]);

        $plainToken = Str::random(64);
        $invitation = RegistrationInvitation::create([
            'email' => 'copy@example.com',
            'token' => hash('sha256', $plainToken),
            'encrypted_token' => Crypt::encryptString($plainToken),
            'role' => 'student',
            'expires_at' => now()->addDays(7),
            'email_status' => 'sent',
        ]);

        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/users/invitations/'.$invitation->id.'/copy-link');

        $response->assertOk()
            ->assertJsonStructure(['invite_url']);

        Bus::assertNothingDispatched();
    }

    public function test_user_can_accept_invitation_and_login(): void
    {
        $plainToken = Str::random(64);
        RegistrationInvitation::create([
            'email' => 'nou@example.com',
            'token' => hash('sha256', $plainToken),
            'encrypted_token' => Crypt::encryptString($plainToken),
            'name' => 'Nou Utilizator',
            'role' => 'student',
            'expires_at' => now()->addDays(7),
            'email_status' => 'sent',
        ]);

        $this->getJson('/api/auth/invitations/'.$plainToken)
            ->assertOk()
            ->assertJsonPath('valid', true)
            ->assertJsonPath('email', 'nou@example.com');

        $this->postJson('/api/auth/invitations/'.$plainToken.'/accept', [
            'name' => 'Nou Utilizator',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
        ])->assertCreated()
            ->assertJsonPath('user.email', 'nou@example.com');

        $user = User::where('email', 'nou@example.com')->firstOrFail();
        $this->assertTrue(Hash::check('Password123', $user->password));
        $this->assertAuthenticatedAs($user);
    }
}
