<?php

namespace Tests\Feature;

use App\Mail\VoltaUserNotificationMail;
use App\Models\Course;
use App\Models\Setting;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class EmailNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        Setting::set('email_notifications', '1', 'boolean', 'Notificări email active');
    }

    public function test_course_assignment_notifies_student_even_without_deadline(): void
    {
        $student = User::factory()->create(['role' => 'student', 'email' => 'student@test.local']);
        $course = Course::factory()->published()->create(['title' => 'Laravel Basics']);

        app(NotificationService::class)->notifyCourseEnrolled($student, $course);
        app(NotificationService::class)->notifyCourseEnrolled($student, $course);

        Mail::assertQueued(VoltaUserNotificationMail::class, 1);
        $notification = \App\Models\Notification::where('user_id', $student->id)->sole();
        $this->assertSame('course_assigned', $notification->type);
        $this->assertSame('Curs nou atribuit', $notification->title);
        $this->assertStringContainsString('Laravel Basics', $notification->description);
    }

    public function test_course_assignment_mentions_the_deadline(): void
    {
        $student = User::factory()->create(['role' => 'student', 'email' => 'student@test.local']);
        $course = Course::factory()->published()->create(['title' => 'Laravel Basics']);
        $settings = is_array($course->settings) ? $course->settings : [];
        $settings['deadline_at'] = now()->addDays(7)->toDateTimeString();
        $course->settings = $settings;
        $course->save();

        app(NotificationService::class)->notifyCourseEnrolled($student, $course);

        Mail::assertQueued(VoltaUserNotificationMail::class, function (VoltaUserNotificationMail $mail) use ($student) {
            return $mail->hasTo($student->email)
                && str_contains($mail->body, 'de finalizat până la');
        });
    }

    public function test_deadline_email_is_not_sent_to_pending_or_suspended_users(): void
    {
        if (! Schema::hasTable('notifications')) {
            $this->markTestSkipped('notifications table missing');
        }

        $pending = User::factory()->create([
            'role' => 'student',
            'email' => 'pending@test.local',
            'status' => 'pending',
        ]);
        $suspended = User::factory()->create([
            'role' => 'student',
            'email' => 'suspended@test.local',
            'status' => 'suspended',
        ]);
        $course = Course::factory()->published()->create(['title' => 'Curs cu termen']);
        $settings = is_array($course->settings) ? $course->settings : [];
        $settings['deadline_at'] = now()->addDays(3)->toDateTimeString();
        $course->settings = $settings;
        $course->save();

        $notifications = app(NotificationService::class);
        $notifications->notifyCourseEnrolled($pending, $course);
        $notifications->notifyCourseEnrolled($suspended, $course);

        Mail::assertNothingOutgoing();
    }

    public function test_no_email_when_globally_disabled(): void
    {
        if (! Schema::hasTable('notifications')) {
            $this->markTestSkipped('notifications table missing');
        }

        Setting::set('email_notifications', '0', 'boolean', 'Notificări email active');

        $student = User::factory()->create(['role' => 'student', 'email' => 'student2@test.local']);
        $course = Course::factory()->published()->create();

        app(NotificationService::class)->notifyCourseEnrolled($student, $course);

        Mail::assertNothingOutgoing();
    }

    public function test_registration_requested_emails_admins(): void
    {
        if (! Schema::hasTable('notifications')) {
            $this->markTestSkipped('notifications table missing');
        }

        $admin = User::factory()->create(['role' => 'admin', 'email' => 'admin@test.local']);
        $applicant = User::factory()->create(['role' => 'student', 'email' => 'new@test.local']);

        app(NotificationService::class)->notifyRegistrationRequested($applicant);

        Mail::assertQueued(VoltaUserNotificationMail::class, function (VoltaUserNotificationMail $mail) use ($admin) {
            return $mail->hasTo($admin->email);
        });
    }
}
