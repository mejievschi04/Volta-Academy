<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class LearningVisibility
{
    public static function isStaff(?User $user): bool
    {
        return $user && in_array($user->role ?? '', ['admin', 'instructor'], true);
    }

    public static function isStaffRequest(Request $request): bool
    {
        return self::isStaff($request->user());
    }

    public static function courseVisibleToLearner(?User $user, object $course): bool
    {
        if (self::isStaff($user)) {
            return true;
        }

        if (! Schema::hasColumn('courses', 'status')) {
            return true;
        }

        return ($course->status ?? 'draft') === 'published';
    }

    public static function applyPublishedCourseFilter($query, bool $isStaff): void
    {
        if (! $isStaff && Schema::hasColumn('courses', 'status')) {
            $query->where('status', 'published');
        }
    }

    public static function publishedLessonScope($query, bool $isStaff): void
    {
        $query->orderBy('order');
        if (! $isStaff && Schema::hasColumn('lessons', 'status')) {
            $query->where('status', 'published');
        }
    }

    public static function publishedModuleScope($query, bool $isStaff): void
    {
        $query->orderBy('order');
        if (! $isStaff && Schema::hasColumn('modules', 'status')) {
            $query->where('status', 'published');
        }
    }

    public static function isEnrolledInCourse(?User $user, int $courseId): bool
    {
        if (! $user) {
            return false;
        }
        if (self::isStaff($user)) {
            return true;
        }
        if (! Schema::hasTable('course_user')) {
            return false;
        }

        $query = DB::table('course_user')
            ->where('user_id', $user->id)
            ->where('course_id', $courseId);
        if (Schema::hasColumn('course_user', 'enrolled')) {
            $query->where('enrolled', true);
        }

        return $query->exists();
    }

    public static function learnerMaySeeLessonBody(?User $user, object $lesson, ?object $course): bool
    {
        if (self::isStaff($user)) {
            return true;
        }

        $lessonPublished = ($lesson->status ?? 'draft') === 'published';
        $coursePublished = ! $course || ($course->status ?? 'draft') === 'published';
        if (! $lessonPublished || ! $coursePublished) {
            return false;
        }
        if ((bool) ($lesson->is_preview ?? false)) {
            return true;
        }
        if (! $course) {
            return false;
        }

        return self::isEnrolledInCourse($user, (int) $course->id);
    }
}
