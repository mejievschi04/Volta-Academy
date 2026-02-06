<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class NotificationService
{
    /**
     * Notify students when a course is published.
     * If team_ids provided: notify only members of those teams.
     * If no teams: notify all students.
     */
    public function notifyCoursePublished(Course $course, array $teamIds = []): int
    {
        $userIds = $this->getTargetStudentIds($course, $teamIds);
        $count = 0;

        foreach ($userIds as $userId) {
            Notification::create([
                'user_id' => $userId,
                'type' => 'course_published',
                'title' => 'Curs nou disponibil',
                'description' => "Cursul „{$course->title}" este acum disponibil.",
                'data' => ['course_id' => $course->id],
                'action_url' => "/courses/{$course->id}",
                'severity' => 'info',
            ]);
            $count++;
        }

        return $count;
    }

    /**
     * Notify admins when a student completes a course.
     */
    public function notifyCourseCompleted(User $student, Course $course): void
    {
        $admins = User::where('role', 'admin')->pluck('id');

        foreach ($admins as $adminId) {
            Notification::create([
                'user_id' => $adminId,
                'type' => 'course_completed',
                'title' => 'Curs finalizat',
                'description' => $student->name . ' a finalizat cursul „' . $course->title . '"',
                'data' => ['course_id' => $course->id, 'user_id' => $student->id],
                'action_url' => "/admin/courses/{$course->id}",
                'severity' => 'info',
            ]);
        }
    }

    /**
     * Notify admins when someone requests registration (status pending).
     */
    public function notifyRegistrationRequested(User $user): void
    {
        $admins = User::where('role', 'admin')->pluck('id');

        foreach ($admins as $adminId) {
            Notification::create([
                'user_id' => $adminId,
                'type' => 'registration_requested',
                'title' => 'Cerere de înregistrare',
                'description' => "{$user->name} ({$user->email}) a solicitat înregistrarea.",
                'data' => ['user_id' => $user->id],
                'action_url' => "/admin/users/{$user->id}",
                'severity' => 'warning',
            ]);
        }
    }

    /**
     * Notify admins when course success rate is below or above average.
     */
    public function notifyCourseSuccessRate(Course $course, string $direction): void
    {
        $admins = User::where('role', 'admin')->pluck('id');
        $rate = $this->getCourseCompletionRate($course->id);

        if ($direction === 'below') {
            $title = 'Rată de finalizare sub medie';
            $desc = "Cursul „{$course->title}" are o rată de finalizare de {$rate}% (sub medie).";
            $severity = 'warning';
        } else {
            $title = 'Rată de finalizare peste medie';
            $desc = "Cursul „{$course->title}" are o rată de finalizare de {$rate}% (peste medie).";
            $severity = 'success';
        }

        foreach ($admins as $adminId) {
            Notification::create([
                'user_id' => $adminId,
                'type' => 'course_success_' . $direction,
                'title' => $title,
                'description' => $desc,
                'data' => ['course_id' => $course->id, 'rate' => $rate],
                'action_url' => "/admin/courses/{$course->id}",
                'severity' => $severity,
            ]);
        }
    }

    private function getTargetStudentIds(Course $course, array $teamIds): array
    {
        if (count($teamIds) > 0) {
            return DB::table('team_user')
                ->whereIn('team_id', $teamIds)
                ->join('users', 'team_user.user_id', '=', 'users.id')
                ->where('users.role', 'student')
                ->distinct()
                ->pluck('team_user.user_id')
                ->all();
        }

        return User::where('role', 'student')->pluck('id')->all();
    }

    private function getCourseCompletionRate(int $courseId): float
    {
        if (!Schema::hasTable('course_user')) {
            return 0;
        }

        $enrollments = DB::table('course_user')
            ->where('course_id', $courseId)
            ->where('enrolled', true)
            ->count();

        if ($enrollments === 0) {
            return 0;
        }

        $completed = DB::table('course_user')
            ->where('course_id', $courseId)
            ->where('enrolled', true)
            ->whereNotNull('completed_at')
            ->count();

        return round(($completed / $enrollments) * 100, 1);
    }
}
