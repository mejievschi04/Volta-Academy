<?php

namespace App\Services;

use App\Jobs\SendRegistrationInvitationEmailJob;
use App\Models\RegistrationInvitation;
use App\Models\Setting;
use App\Models\User;
use App\Support\RegistrationInvitationUrl;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RegistrationInvitationService
{
    /**
     * @return array{invitation: RegistrationInvitation, invite_url: string}
     */
    public function createAndSend(
        string $email,
        User $invitedBy,
        ?string $name = null,
        string $role = 'student',
        ?int $teamId = null,
        int $expiresInDays = 7
    ): array {
        $email = strtolower(trim($email));
        $this->assertEmailAvailable($email);

        RegistrationInvitation::query()
            ->where('email', $email)
            ->whereNull('accepted_at')
            ->delete();

        [$plainToken, $inviteUrl] = $this->makeTokenPair();
        $emailEnabled = $this->emailNotificationsEnabled();

        $invitation = RegistrationInvitation::create([
            'email' => $email,
            'token' => hash('sha256', $plainToken),
            'encrypted_token' => Crypt::encryptString($plainToken),
            'name' => $name ? strip_tags(trim($name)) : null,
            'role' => $role,
            'team_id' => $teamId,
            'invited_by' => $invitedBy->id,
            'expires_at' => now()->addDays($expiresInDays),
            'email_status' => $emailEnabled ? 'pending' : 'skipped',
        ]);

        if ($emailEnabled) {
            $this->queueInvitationEmail($invitation, $plainToken, $invitedBy);
        }

        Log::info('Registration invitation created', [
            'invitation_id' => $invitation->id,
            'email' => $email,
            'invited_by' => $invitedBy->id,
        ]);

        return [
            'invitation' => $invitation,
            'invite_url' => $inviteUrl,
        ];
    }

    /**
     * @return array{invitation: RegistrationInvitation, invite_url: string}
     */
    public function resendEmail(RegistrationInvitation $invitation, User $invitedBy): array
    {
        $this->assertInvitationActive($invitation);
        $this->assertEmailAvailable($invitation->email);

        [$plainToken, $inviteUrl] = $this->rotateToken($invitation, $invitedBy);
        $emailEnabled = $this->emailNotificationsEnabled();

        $invitation->update([
            'email_status' => $emailEnabled ? 'pending' : 'skipped',
            'email_sent_at' => null,
            'email_last_error' => null,
        ]);

        $invitation = $invitation->fresh();

        if ($emailEnabled) {
            $this->queueInvitationEmail($invitation, $plainToken, $invitedBy);
        }

        return [
            'invitation' => $invitation,
            'invite_url' => $inviteUrl,
        ];
    }

    public function getInviteUrl(RegistrationInvitation $invitation): string
    {
        $this->assertInvitationActive($invitation);

        if (empty($invitation->encrypted_token)) {
            throw ValidationException::withMessages([
                'invitation' => ['Linkul nu este disponibil. Retrimite invitația pe email.'],
            ]);
        }

        $plainToken = Crypt::decryptString($invitation->encrypted_token);

        return RegistrationInvitationUrl::build($plainToken);
    }

    public function findPendingByPlainToken(string $plainToken): ?RegistrationInvitation
    {
        if ($plainToken === '') {
            return null;
        }

        return RegistrationInvitation::query()
            ->where('token', hash('sha256', $plainToken))
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->first();
    }

    private function assertEmailAvailable(string $email): void
    {
        if (User::where('email', $email)->exists()) {
            throw ValidationException::withMessages([
                'email' => ['Există deja un cont cu acest email.'],
            ]);
        }
    }

    private function assertInvitationActive(RegistrationInvitation $invitation): void
    {
        if ($invitation->isAccepted()) {
            throw ValidationException::withMessages([
                'invitation' => ['Invitația a fost deja folosită.'],
            ]);
        }

        if ($invitation->isExpired()) {
            throw ValidationException::withMessages([
                'invitation' => ['Invitația a expirat. Creează una nouă.'],
            ]);
        }
    }

    /**
     * @return array{0: string, 1: string} plain token + public url
     */
    private function makeTokenPair(): array
    {
        $plainToken = Str::random(64);

        return [$plainToken, RegistrationInvitationUrl::build($plainToken)];
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function rotateToken(RegistrationInvitation $invitation, User $invitedBy): array
    {
        [$plainToken, $inviteUrl] = $this->makeTokenPair();

        $invitation->update([
            'token' => hash('sha256', $plainToken),
            'encrypted_token' => Crypt::encryptString($plainToken),
            'expires_at' => now()->addDays(7),
            'invited_by' => $invitedBy->id,
        ]);

        return [$plainToken, $inviteUrl];
    }

    private function emailNotificationsEnabled(): bool
    {
        return (bool) Setting::get('email_notifications', true);
    }

    private function queueInvitationEmail(
        RegistrationInvitation $invitation,
        string $plainToken,
        User $invitedBy
    ): void {
        SendRegistrationInvitationEmailJob::dispatch(
            $invitation->id,
            $plainToken,
            $invitedBy->name ?: 'Administrator',
        )->afterResponse();
    }
}
