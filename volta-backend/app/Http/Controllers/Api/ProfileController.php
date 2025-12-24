<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
// use App\Models\Lesson; // Removed - lessons table no longer exists
use App\Models\Exam;
use App\Models\ExamResult;
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
            // Get courses with modules (optimized query)
            $courses = Course::with(['modules:id,course_id,title,order', 'teacher:id,name'])->get();
            
            // Get user progress from course_user pivot table
            $courseProgress = DB::table('course_user')
                ->where('user_id', $user->id)
                ->where('enrolled', true)
                ->get()
                ->keyBy('course_id');

            // Get all exams for courses and their latest results for this user
            $courseIds = $courses->pluck('id')->toArray();
            $exams = Exam::whereIn('course_id', $courseIds)->get();
            $examIds = $exams->pluck('id')->toArray();
            
            // Get the latest exam result for each exam for this user
            $latestExamResults = ExamResult::whereIn('exam_id', $examIds)
                ->where('user_id', $user->id)
                ->orderBy('exam_id')
                ->orderBy('attempt_number', 'desc')
                ->get()
                ->unique('exam_id')
                ->keyBy('exam_id');
            
            // Create a map of course_id => has_passed_exam (based on latest result)
            $courseExamMap = [];
            foreach ($exams as $exam) {
                $latestResult = $latestExamResults->get($exam->id);
                if ($latestResult && $latestResult->passed === true) {
                    $courseExamMap[$exam->course_id] = true;
                }
            }
            
            // Count passed quizzes
            $passedExamResults = $latestExamResults->filter(function($result) {
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
            $completedQuizzes = $passedExamResults->count();
            $progressPercentage = $totalModules > 0 ? round(($completedModules / $totalModules) * 100) : 0;

            // Get courses in progress
            $coursesInProgress = [];
            $coursesCompleted = [];
            
            foreach ($courses as $course) {
                $progress = $courseProgress->get($course->id);
                $courseProgressPercentage = $progress ? ($progress->progress_percentage ?? 0) : 0;
                $isCompleted = $progress && $progress->completed_at;
                
                // Check if user has passed the exam for this course
                $quizPassed = isset($courseExamMap[$course->id]) && $courseExamMap[$course->id] === true;
                
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
    }
}

