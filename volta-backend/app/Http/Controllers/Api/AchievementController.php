<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AchievementController extends Controller
{
    /**
     * Get all achievements for authenticated user
     */
    public function index()
    {
        $user = Auth::user();

        // Get completed courses count
        $completedCourses = DB::table('course_user')
            ->where('user_id', $user->id)
            ->where('enrolled', true)
            ->whereNotNull('completed_at')
            ->count();

        // Get completed lessons count
        $completedLessons = 0;
        if (Schema::hasTable('lesson_progress')) {
            $completedLessons = DB::table('lesson_progress')
                ->where('user_id', $user->id)
                ->where('completed', true)
                ->count();
        }

        // Get learning time (sum of completed lessons duration)
        $learningHours = 0;
        if (Schema::hasTable('lesson_progress') && Schema::hasTable('lessons')) {
            $totalMinutes = DB::table('lesson_progress')
                ->join('lessons', 'lesson_progress.lesson_id', '=', 'lessons.id')
                ->where('lesson_progress.user_id', $user->id)
                ->where('lesson_progress.completed', true)
                ->whereNotNull('lessons.duration_minutes')
                ->sum('lessons.duration_minutes');
            
            $learningHours = round($totalMinutes / 60, 1);
        }

        // Get badges (based on milestones)
        $badges = $this->getUserBadges($user);

        // Get milestones
        $milestones = $this->getUserMilestones($user);

        return response()->json([
            'completed_courses' => $completedCourses,
            'completed_lessons' => $completedLessons,
            'learning_hours' => $learningHours,
            'badges_count' => count($badges),
            'badges' => $badges,
            'milestones' => $milestones,
        ]);
    }

    /**
     * Get user badges
     */
    private function getUserBadges($user)
    {
        $badges = [];

        // First course completed
        $firstCourse = DB::table('course_user')
            ->where('user_id', $user->id)
            ->where('enrolled', true)
            ->whereNotNull('completed_at')
            ->orderBy('completed_at', 'asc')
            ->first();

        if ($firstCourse) {
            $badges[] = [
                'icon' => '🎓',
                'title' => 'Primul curs finalizat',
                'description' => 'Ai finalizat primul tău curs!',
                'earned_at' => $firstCourse->completed_at,
            ];
        }

        // 5 courses completed
        $completedCourses = DB::table('course_user')
            ->where('user_id', $user->id)
            ->where('enrolled', true)
            ->whereNotNull('completed_at')
            ->count();

        if ($completedCourses >= 5) {
            $badges[] = [
                'icon' => '🌟',
                'title' => '5 cursuri finalizate',
                'description' => 'Ai finalizat 5 cursuri!',
                'earned_at' => DB::table('course_user')
                    ->where('user_id', $user->id)
                    ->where('enrolled', true)
                    ->whereNotNull('completed_at')
                    ->orderBy('completed_at', 'asc')
                    ->offset(4)
                    ->value('completed_at'),
            ];
        }

        // 10 courses completed
        if ($completedCourses >= 10) {
            $badges[] = [
                'icon' => '🏆',
                'title' => '10 cursuri finalizate',
                'description' => 'Ai finalizat 10 cursuri!',
                'earned_at' => DB::table('course_user')
                    ->where('user_id', $user->id)
                    ->where('enrolled', true)
                    ->whereNotNull('completed_at')
                    ->orderBy('completed_at', 'asc')
                    ->offset(9)
                    ->value('completed_at'),
            ];
        }

        // 50 lessons completed
        if (Schema::hasTable('lesson_progress')) {
            $completedLessons = DB::table('lesson_progress')
                ->where('user_id', $user->id)
                ->where('completed', true)
                ->count();

            if ($completedLessons >= 50) {
                $badges[] = [
                    'icon' => '📚',
                    'title' => '50 lecții finalizate',
                    'description' => 'Ai finalizat 50 de lecții!',
                    'earned_at' => DB::table('lesson_progress')
                        ->where('user_id', $user->id)
                        ->where('completed', true)
                        ->orderBy('completed_at', 'asc')
                        ->offset(49)
                        ->value('completed_at'),
                ];
            }
        }

        return $badges;
    }

    /**
     * Get user milestones
     */
    private function getUserMilestones($user)
    {
        $milestones = [];

        // Get course progress milestones
        $courses = DB::table('course_user')
            ->join('courses', 'course_user.course_id', '=', 'courses.id')
            ->where('course_user.user_id', $user->id)
            ->where('course_user.enrolled', true)
            ->select('courses.id', 'courses.title', 'course_user.progress_percentage', 'course_user.updated_at')
            ->get();

        foreach ($courses as $course) {
            $progress = $course->progress_percentage;

            // 25% milestone
            if ($progress >= 25 && $progress < 50) {
                $milestones[] = [
                    'icon' => '🎯',
                    'title' => '25% finalizat - ' . $course->title,
                    'description' => 'Ai finalizat primul sfert din curs!',
                    'achieved_at' => $course->updated_at,
                ];
            }

            // 50% milestone
            if ($progress >= 50 && $progress < 75) {
                $milestones[] = [
                    'icon' => '🌟',
                    'title' => '50% finalizat - ' . $course->title,
                    'description' => 'Ai finalizat jumătate din curs!',
                    'achieved_at' => $course->updated_at,
                ];
            }

            // 75% milestone
            if ($progress >= 75 && $progress < 100) {
                $milestones[] = [
                    'icon' => '🚀',
                    'title' => '75% finalizat - ' . $course->title,
                    'description' => 'Ești aproape de finalizare!',
                    'achieved_at' => $course->updated_at,
                ];
            }

            // 100% milestone
            if ($progress >= 100) {
                $milestones[] = [
                    'icon' => '🎓',
                    'title' => 'Curs finalizat - ' . $course->title,
                    'description' => 'Felicitări! Ai finalizat cursul!',
                    'achieved_at' => DB::table('course_user')
                        ->where('user_id', $user->id)
                        ->where('course_id', $course->id)
                        ->value('completed_at'),
                ];
            }
        }

        // Sort by date (most recent first)
        usort($milestones, function($a, $b) {
            return strtotime($b['achieved_at']) - strtotime($a['achieved_at']);
        });

        return array_slice($milestones, 0, 20); // Return last 20 milestones
    }
}

