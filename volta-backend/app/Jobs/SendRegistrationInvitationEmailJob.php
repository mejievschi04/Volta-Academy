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

    public function __construct(
        public int $invitationId,
        public string $plainToken,
        public string $inviterName,
    ) {}

    public function handle(): void
    {
        $invitation = RegistrationInvitation::find($this->invitationId);
        if (! $invitation || $invitation->isAccepted()) {
            return;
        }

        if (! (bool) Setting::get('email_notifications', true)) {
            $invitation->update([
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

            $invitation->update([
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

            $invitation->update([
                'email_status' => 'failed',
                'email_last_error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}
