<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['error' => 'Neautentificat'], 401);
        }

        // Cache key for user-specific dashboard data
        $cacheKey = "dashboard_user_{$user->id}";
        
        // Try to get cached stats (cache for 5 minutes)
        $cachedStats = Cache::remember($cacheKey . '_stats', 300, function () use ($user) {
            // Get assigned courses (courses assigned directly to user)
            $assignedCourses = $user->assignedCourses()->with(['lessons:id,course_id,title,order', 'teacher:id,name'])->get();
            $assignedCourseIds = $assignedCourses->pluck('id')->toArray();
            
            // Get all courses for total calculation
            $allCourses = Course::with(['lessons:id,course_id,title,order'])->get();
            
            // Get user progress in one query
            $progress = DB::table('lesson_progress')
                ->where('user_id', $user->id)
                ->where('completed', true)
                ->pluck('lesson_id')
                ->toArray();

            // Calculate stats - use assigned courses for lesson counting
            $assignedCourseIdsSet = collect($assignedCourseIds);
            $assignedLessons = $allCourses
                ->filter(function($course) use ($assignedCourseIdsSet) {
                    return $assignedCourseIdsSet->contains($course->id);
                })
                ->sum(function($course) {
                    return $course->lessons->count();
                });
            
            $completedLessons = DB::table('lesson_progress')
                ->join('lessons', 'lesson_progress.lesson_id', '=', 'lessons.id')
                ->where('lesson_progress.user_id', $user->id)
                ->where('lesson_progress.completed', true)
                ->whereIn('lessons.course_id', $assignedCourseIds)
                ->count();
            
            $progressPercentage = $assignedLessons > 0 ? round(($completedLessons / $assignedLessons) * 100) : 0;

            // Get courses in progress (from assigned courses)
            $courseProgress = [];
            foreach ($assignedCourses as $course) {
                $courseLessons = $course->lessons->pluck('id')->toArray();
                $completedCourseLessons = array_intersect($courseLessons, $progress);
                $courseCompleted = count($completedCourseLessons);
                $courseTotal = count($courseLessons);
                
                if ($courseCompleted > 0 && $courseCompleted < $courseTotal) {
                    $courseProgress[] = [
                        'courseId' => $course->id,
                        'completedLessons' => array_values($completedCourseLessons),
                        'quizPassed' => false,
                    ];
                }
            }

            return [
                'stats' => [
                    'totalCourses' => $allCourses->count(),
                    'totalLessons' => $allCourses->sum(function($course) {
                        return $course->lessons->count();
                    }),
                    'assignedCourses' => $assignedCourses->count(), // Numărul de cursuri atribuite
                    'completedLessons' => $completedLessons,
                    'completedQuizzes' => 0,
                    'inProgressCourses' => count($courseProgress),
                    'progressPercentage' => $progressPercentage,
                ],
                'progress' => $courseProgress,
            ];
        });

        // Get courses list (lightweight, without full lesson content)
        $courses = Course::with(['lessons:id,course_id,title,order', 'teacher:id,name'])
            ->select('id', 'title', 'description', 'reward_points', 'teacher_id')
            ->get()
            ->map(function($course) {
                return [
                    'id' => $course->id,
                    'title' => $course->title,
                    'description' => $course->description,
                    'reward_points' => $course->reward_points,
                    'lessons' => $course->lessons->map(function($lesson) {
                        return [
                            'id' => $lesson->id,
                            'title' => $lesson->title,
                            'order' => $lesson->order,
                        ];
                    }),
                    'teacher' => $course->teacher ? [
                        'id' => $course->teacher->id,
                        'name' => $course->teacher->name,
                    ] : null,
                ];
            });

        return response()->json([
            'user' => [
                'name' => $user->name,
                'email' => $user->email,
                'level' => $user->level,
                'points' => $user->points,
            ],
            'stats' => $cachedStats['stats'],
            'progress' => $cachedStats['progress'],
            'courses' => $courses,
        ]);
    }
}

