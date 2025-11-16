<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class ProfileController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['error' => 'Neautentificat'], 401);
        }

        // Cache key for user-specific profile data
        $cacheKey = "profile_user_{$user->id}";
        
        // Try to get cached data (cache for 5 minutes)
        $cachedData = Cache::remember($cacheKey, 300, function () use ($user) {
            // Get courses without full content (optimized query)
            $courses = Course::with(['lessons:id,course_id,title,order', 'teacher:id,name'])->get();
            
            // Get user progress in one query
            $progress = DB::table('lesson_progress')
                ->where('user_id', $user->id)
                ->where('completed', true)
                ->pluck('lesson_id')
                ->toArray();

            // Calculate stats
            $totalCourses = $courses->count();
            $totalLessons = $courses->sum(function($course) {
                return $course->lessons->count();
            });
            $completedLessons = count($progress);
            $completedQuizzes = 0; // TODO: implement quiz tracking
            $progressPercentage = $totalLessons > 0 ? round(($completedLessons / $totalLessons) * 100) : 0;

            // Get courses in progress
            $coursesInProgress = [];
            $coursesCompleted = [];
            
            foreach ($courses as $course) {
                $courseLessons = $course->lessons->pluck('id')->toArray();
                $completedCourseLessons = array_intersect($courseLessons, $progress);
                $courseCompleted = count($completedCourseLessons);
                $courseTotal = count($courseLessons);
                $courseProgress = $courseTotal > 0 ? round(($courseCompleted / $courseTotal) * 100) : 0;
                
                if ($courseCompleted > 0 && $courseCompleted < $courseTotal) {
                    $coursesInProgress[] = [
                        'id' => $course->id,
                        'title' => $course->title,
                        'description' => $course->description,
                        'progress' => $courseProgress,
                        'completedLessons' => count($completedCourseLessons),
                        'totalLessons' => $courseTotal,
                    ];
                } elseif ($courseCompleted === $courseTotal && $courseTotal > 0) {
                    $coursesCompleted[] = [
                        'id' => $course->id,
                        'title' => $course->title,
                        'description' => $course->description,
                        'quizPassed' => false, // TODO: implement quiz tracking
                    ];
                }
            }
            
            return [
                'totalCourses' => $totalCourses,
                'totalLessons' => $totalLessons,
                'completedLessons' => $completedLessons,
                'completedQuizzes' => $completedQuizzes,
                'progressPercentage' => $progressPercentage,
                'coursesInProgress' => $coursesInProgress,
                'coursesCompleted' => $coursesCompleted,
            ];
        });

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'level' => $user->level,
                'points' => $user->points,
                'role' => $user->role,
            ],
            'stats' => [
                'totalCourses' => $cachedData['totalCourses'],
                'totalLessons' => $cachedData['totalLessons'],
                'completedLessons' => $cachedData['completedLessons'],
                'completedQuizzes' => $cachedData['completedQuizzes'],
                'inProgressCourses' => count($cachedData['coursesInProgress']),
                'completedCourses' => count($cachedData['coursesCompleted']),
                'progressPercentage' => $cachedData['progressPercentage'],
            ],
            'coursesInProgress' => $cachedData['coursesInProgress'],
            'coursesCompleted' => $cachedData['coursesCompleted'],
        ]);
    }
}

