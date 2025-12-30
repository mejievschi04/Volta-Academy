<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Test;
use App\Models\TestResult;
use App\Models\CourseTest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class ProfileController extends Controller
{
    public function index(Request $request)
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json(['error' => 'Neautentificat'], 401);
            }

            // Cache key for user-specific profile data
            $cacheKey = "profile_user_{$user->id}";
            
            // Try to get cached data (cache for 5 minutes)
            $cachedData = Cache::remember($cacheKey, 300, function () use ($user) {
            // Get courses with modules (optimized query)
            $courses = Course::with(['modules:id,course_id,title,order', 'teacher:id,name'])->get();
            
            // Get user progress from course_user pivot table
            $courseProgress = DB::table('course_user')
                ->where('user_id', $user->id)
                ->where('enrolled', true)
                ->get()
                ->keyBy('course_id');

            // Get all tests for courses through CourseTest pivot and their latest results for this user
            $courseIds = $courses->pluck('id')->toArray();
            
            // Get CourseTest entries for these courses
            $courseTests = CourseTest::whereIn('course_id', $courseIds)
                ->with('test')
                ->get();
            
            $testIds = $courseTests->pluck('test_id')->filter()->unique()->toArray();
            
            // Get the latest test result for each test for this user
            $latestTestResults = collect();
            if (!empty($testIds)) {
                $latestTestResults = TestResult::whereIn('test_id', $testIds)
                    ->where('user_id', $user->id)
                    ->orderBy('test_id')
                    ->orderBy('attempt_number', 'desc')
                    ->get()
                    ->unique('test_id')
                    ->keyBy('test_id');
            }
            
            // Create a map of course_id => has_passed_test (based on latest result)
            $courseTestMap = [];
            foreach ($courseTests as $courseTest) {
                if ($courseTest->test_id) {
                    $latestResult = $latestTestResults->get($courseTest->test_id);
                    if ($latestResult && $latestResult->passed === true) {
                        $courseTestMap[$courseTest->course_id] = true;
                    }
                }
            }
            
            // Count passed tests/quizzes
            $passedTestResults = $latestTestResults->filter(function($result) {
                return $result->passed === true;
            });

            // Calculate stats using modules instead of lessons
            $totalCourses = $courses->count();
            $totalModules = $courses->sum(function($course) {
                return $course->modules->count();
            });
            $completedModules = $courses->sum(function($course) use ($courseProgress) {
                $progress = $courseProgress->get($course->id);
                // If course is completed, all modules are considered completed
                return ($progress && $progress->completed_at) ? $course->modules->count() : 0;
            });
            $completedQuizzes = $passedTestResults->count();
            $progressPercentage = $totalModules > 0 ? round(($completedModules / $totalModules) * 100) : 0;

            // Get courses in progress
            $coursesInProgress = [];
            $coursesCompleted = [];
            
            foreach ($courses as $course) {
                $progress = $courseProgress->get($course->id);
                $courseProgressPercentage = $progress ? ($progress->progress_percentage ?? 0) : 0;
                $isCompleted = $progress && $progress->completed_at;
                
                // Check if user has passed the test for this course
                $quizPassed = isset($courseTestMap[$course->id]) && $courseTestMap[$course->id] === true;
                
                if ($courseProgressPercentage > 0 && !$isCompleted) {
                    $coursesInProgress[] = [
                        'id' => $course->id,
                        'title' => $course->title,
                        'description' => $course->description,
                        'progress' => $courseProgressPercentage,
                        'completedModules' => round(($courseProgressPercentage / 100) * $course->modules->count()),
                        'totalModules' => $course->modules->count(),
                    ];
                } elseif ($isCompleted) {
                    $coursesCompleted[] = [
                        'id' => $course->id,
                        'title' => $course->title,
                        'description' => $course->description,
                        'quizPassed' => $quizPassed,
                    ];
                }
            }
            
            return [
                'totalCourses' => $totalCourses,
                'totalModules' => $totalModules,
                'completedModules' => $completedModules,
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
                'totalModules' => $cachedData['totalModules'],
                'completedModules' => $cachedData['completedModules'],
                'completedQuizzes' => $cachedData['completedQuizzes'],
                'inProgressCourses' => count($cachedData['coursesInProgress']),
                'completedCourses' => count($cachedData['coursesCompleted']),
                'progressPercentage' => $cachedData['progressPercentage'],
            ],
            'coursesInProgress' => $cachedData['coursesInProgress'],
            'coursesCompleted' => $cachedData['coursesCompleted'],
        ]);
        } catch (\Exception $e) {
            Log::error('ProfileController error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'user_id' => Auth::id(),
            ]);
            return response()->json([
                'error' => 'Eroare la încărcarea profilului',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}

