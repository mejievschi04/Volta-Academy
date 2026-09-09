<?php

namespace App\Jobs;

use App\Mail\RegistrationInvitationMail;
use App\Models\RegistrationInvitation;
use App\Models\Setting;
use App\Support\RegistrationInvitationUrl;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendRegistrationInvitationEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public int $timeout = 60;

    public function __construct(
        public int $invitationId,
        public string $plainToken,
        public string $inviterName,
    ) {}

    public function handle(): void
    {
        $invitation = RegistrationInvitation::find($this->invitationId);
        if (! $invitation || $invitation->isAccepted() || $invitation->isExpired()
            || ! hash_equals($invitation->token, hash('sha256', $this->plainToken))) {
            return;
        }

        if (! (bool) Setting::get('email_notifications', true)) {
            $this->updateCurrentInvitation([
                'email_status' => 'skipped',
                'email_last_error' => null,
            ]);

            return;
        }

        $registerUrl = RegistrationInvitationUrl::build($this->plainToken);

        try {
            Mail::to($invitation->email)->send(new RegistrationInvitationMail(
                inviterName: $this->inviterName,
                recipientEmail: $invitation->email,
                registerUrl: $registerUrl,
                recipientName: $invitation->name,
            ));

            $this->updateCurrentInvitation([
                'email_status' => 'sent',
                'email_sent_at' => now(),
                'email_last_error' => null,
            ]);
        } catch (\Throwable $e) {
            Log::warning('SendRegistrationInvitationEmailJob failed', [
                'invitation_id' => $invitation->id,
                'email' => $invitation->email,
                'error' => $e->getMessage(),
            ]);

            $this->updateCurrentInvitation([
                'email_status' => 'pending',
                'email_last_error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    public function failed(?\Throwable $exception): void
    {
        $this->updateCurrentInvitation([
            'email_status' => 'failed',
            'email_last_error' => $exception?->getMessage() ?? 'Trimiterea emailului a eșuat.',
        ]);
    }

    private function updateCurrentInvitation(array $attributes): void
    {
        // An older attempt must not overwrite the state of a resent invitation.
        RegistrationInvitation::query()
            ->whereKey($this->invitationId)
            ->where('token', hash('sha256', $this->plainToken))
            ->whereNull('accepted_at')
            ->update($attributes);
    }
}
