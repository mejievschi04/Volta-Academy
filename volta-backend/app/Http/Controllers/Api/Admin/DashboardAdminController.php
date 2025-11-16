<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\User;
use App\Models\Reward;
use App\Models\Event;
use App\Models\Team;
use Illuminate\Support\Facades\DB;

class DashboardAdminController extends Controller
{
    public function index()
    {
        // Total courses available
        $totalCourses = Course::count();
        
        // Calculate completed courses (courses where all lessons are completed by at least one user)
        $completedCourses = 0;
        $courses = Course::with('lessons')->get();
        
        foreach ($courses as $course) {
            $totalLessons = $course->lessons->count();
            if ($totalLessons > 0) {
                // Check if at least one user has completed all lessons of this course
                $courseLessonIds = $course->lessons->pluck('id')->toArray();
                $usersWithAllLessonsCompleted = DB::table('lesson_progress')
                    ->whereIn('lesson_id', $courseLessonIds)
                    ->where('completed', true)
                    ->groupBy('user_id')
                    ->havingRaw('COUNT(DISTINCT lesson_id) = ?', [count($courseLessonIds)])
                    ->count();
                
                if ($usersWithAllLessonsCompleted > 0) {
                    $completedCourses++;
                }
            }
        }
        
        // Calculate average course completion percentage
        $totalCompletionPercentage = 0;
        $coursesWithProgress = 0;
        
        foreach ($courses as $course) {
            $totalLessons = $course->lessons->count();
            if ($totalLessons > 0) {
                $courseLessonIds = $course->lessons->pluck('id')->toArray();
                $completedLessonsCount = DB::table('lesson_progress')
                    ->whereIn('lesson_id', $courseLessonIds)
                    ->where('completed', true)
                    ->distinct()
                    ->count('lesson_id');
                
                $courseCompletion = ($completedLessonsCount / $totalLessons) * 100;
                $totalCompletionPercentage += $courseCompletion;
                $coursesWithProgress++;
            }
        }
        
        $averageCompletion = $coursesWithProgress > 0 
            ? round($totalCompletionPercentage / $coursesWithProgress, 1) 
            : 0;

        $stats = [
            'available_courses' => $totalCourses,
            'completed_courses' => $completedCourses,
            'total_users' => User::count(),
            'total_events' => Event::count(),
            'total_teams' => Team::count(),
            'average_completion' => $averageCompletion,
            'recent_courses' => Course::with('teacher')->latest()->take(5)->get(),
            'recent_users' => User::latest()->take(5)->get(['id', 'name', 'email', 'role', 'created_at']),
        ];

        return response()->json($stats);
    }
}

