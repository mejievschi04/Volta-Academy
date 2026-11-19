<?php

namespace Tests\Feature;

use App\Mail\VoltaUserNotificationMail;
use App\Models\Event;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class EventQuestionTest extends TestCase
{
    use RefreshDatabase;

    private function event(): Event
    {
        $start = now()->addDay();

        return Event::create([
            'title' => 'Webinar invertoare',
            'description' => 'Tema: DEYE',
            'type' => 'webinar',
            'status' => 'published',
            'start_date' => $start->format('Y-m-d H:i:s'),
            'end_date' => $start->copy()->addHours(2)->format('Y-m-d H:i:s'),
            'access_type' => 'free',
            'audience_type' => 'all',
        ]);
    }

    public function test_a_user_can_ask_and_only_an_admin_can_read_the_questions(): void
    {
        $event = $this->event();
        $student = User::factory()->create(['role' => 'student', 'name' => 'Ana Pop']);
        $instructor = User::factory()->create(['role' => 'instructor']);
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/events/{$event->id}/questions", ['body' => 'Cum se setează bateriile?'])
            ->assertCreated()
            ->assertJsonPath('message', 'Întrebarea a fost trimisă.');

        $this->actingAs($student, 'sanctum')
            ->getJson("/api/admin/events/{$event->id}/questions")
            ->assertForbidden();

        $this->actingAs($instructor, 'sanctum')
            ->getJson("/api/admin/events/{$event->id}/questions")
            ->assertForbidden();

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/events')
            ->assertOk()
            ->assertJsonMissing(['body' => 'Cum se setează bateriile?']);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/events/{$event->id}/questions")
            ->assertOk()
            ->assertJsonPath('data.0.body', 'Cum se setează bateriile?')
            ->assertJsonPath('data.0.user.name', 'Ana Pop');
    }

    public function test_admins_are_notified_when_a_user_asks_about_an_event(): void
    {
        Mail::fake();
        $event = $this->event();
        $student = User::factory()->create(['role' => 'student', 'name' => 'Ana Pop']);
        $admin = User::factory()->create(['role' => 'admin', 'email' => 'admin@test.local', 'status' => 'active']);
        $otherAdmin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $instructor = User::factory()->create(['role' => 'instructor', 'status' => 'active']);

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/events/{$event->id}/questions", ['body' => 'Cum se setează bateriile?'])
            ->assertCreated();

        $notifications = Notification::query()->where('type', 'event_question')->get();
        $this->assertEqualsCanonicalizing(
            [$admin->id, $otherAdmin->id],
            $notifications->pluck('user_id')->all()
        );
        $this->assertSame('/admin/events?event='.$event->id, $notifications->first()->action_url);
        $this->assertStringContainsString('Ana Pop', $notifications->first()->description);
        $this->assertStringContainsString('Webinar invertoare', $notifications->first()->description);
        $this->assertSame(0, Notification::where('user_id', $instructor->id)->count());

        Mail::assertQueued(VoltaUserNotificationMail::class, function (VoltaUserNotificationMail $mail) use ($admin) {
            return $mail->hasTo($admin->email);
        });
    }
}
