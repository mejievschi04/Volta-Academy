<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Notification;
use App\Models\User;
use App\Support\SchemaCache;

/**
 * Notificările păstrate intenționat: curs atribuit (elev), curs finalizat (staff) și cerere de
 * înregistrare (admin). Publicarea unui curs și mesajele din chat nu mai creează notificări.
 */
class NotificationService
{
    public function __construct(
        protected EmailNotificationService $emailNotificationService
    ) {}

    /**
     * Anunță elevul că i s-a atribuit un curs; termenul limită, dacă există, apare în text.
     */
    public function notifyCourseEnrolled(User $student, Course $course): void
    {
        if (! SchemaCache::hasTable('notifications') || $student->isLearningActivityExempt()) {
            return;
        }

        if ($this->hasRecentNotification($student->id, 'course_assigned', ['course_id' => $course->id])) {
            return;
        }

        $deadline = $this->resolveCourseDeadline($student, $course);
        $title = 'Curs nou atribuit';
        $description = 'Ți-a fost atribuit cursul "' . $course->title . '"'
            . ($deadline ? ', de finalizat până la ' . $deadline . '.' : '.');
        $actionUrl = '/courses/' . $course->id;

        Notification::create([
            'user_id' => $student->id,
            'type' => 'course_assigned',
            'title' => $title,
            'description' => $description,
            'data' => ['course_id' => $course->id],
            'action_url' => $actionUrl,
            'severity' => $deadline ? 'warning' : 'info',
        ]);

        $this->emailNotificationService->sendToUser($student, $title, $description, $actionUrl, 'Deschide cursul');
    }

    private function resolveCourseDeadline(User $student, Course $course): ?string
    {
        $settings = is_array($course->settings ?? null) ? $course->settings : [];
        $raw = $settings['deadline_at'] ?? $course->due_date ?? null;
        if (! $raw) {
            return null;
        }
        try {
            return \Carbon\Carbon::parse($raw)->timezone(config('app.timezone'))->format('d.m.Y H:i');
        } catch (\Throwable) {
            return is_string($raw) ? $raw : null;
        }
    }

    /**
     * Notify staff when a student completes a course.
     */
    public function notifyCourseCompleted(User $student, Course $course): void
    {
        if (! SchemaCache::hasTable('notifications')) {
            return;
        }

        $staffQuery = User::query()->whereIn('role', ['admin', 'instructor']);

        if ($course->teacher_id) {
            $staffQuery->where(function ($q) use ($course) {
                $q->where('role', 'admin')
                    ->orWhere('id', $course->teacher_id);
            });
        }

        $staffUsers = $staffQuery->get();
        $title = 'Curs finalizat';
        $description = $student->name . ' a finalizat cursul "' . $course->title . '"';
        $actionUrl = "/admin/courses/{$course->id}";

        foreach ($staffUsers as $staff) {
            Notification::create([
                'user_id' => $staff->id,
                'type' => 'course_completed',
                'title' => $title,
                'description' => $description,
                'data' => ['course_id' => $course->id, 'user_id' => $student->id],
                'action_url' => $actionUrl,
                'severity' => 'info',
            ]);
        }

        $this->emailNotificationService->sendToMany(
            $staffUsers,
            $title,
            $description,
            $actionUrl,
            'Vezi cursul'
        );
    }

    /**
     * Notify admins when someone requests registration (status pending).
     */
    public function notifyRegistrationRequested(User $user): void
    {
        if (! SchemaCache::hasTable('notifications')) {
            return;
        }

        $admins = User::where('role', 'admin')->get();
        $title = 'Cerere de înregistrare';
        $description = "{$user->name} ({$user->email}) a solicitat înregistrarea.";
        $actionUrl = "/admin/users/{$user->id}";

        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'type' => 'registration_requested',
                'title' => $title,
                'description' => $description,
                'data' => ['user_id' => $user->id],
                'action_url' => $actionUrl,
                'severity' => 'warning',
            ]);
        }

        $this->emailNotificationService->sendToMany(
            $admins,
            $title,
            $description,
            $actionUrl,
            'Revizuiește cererea'
        );
    }

    private function hasRecentNotification(int $userId, string $type, array $dataMatch, int $days = 1): bool
    {
        $query = Notification::where('user_id', $userId)
            ->where('type', $type)
            ->where('created_at', '>=', now()->subDays($days));

        foreach ($dataMatch as $key => $value) {
            $query->where('data->' . $key, $value);
        }

        return $query->exists();
    }
}
