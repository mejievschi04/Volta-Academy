<?php

namespace App\Http\Controllers;

use App\Models\Lesson;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamResult;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class LessonController extends Controller
{
    public function index(Request $request)
    {
        $query = Lesson::with('course');
        
        if ($request->has('course_id')) {
            $query->where('course_id', $request->course_id);
        }
        
        $lessons = $query->get();
        return response()->json($lessons);
    }

    public function show($id)
    {
        $lesson = Lesson::with('course')->findOrFail($id);
        return response()->json($lesson);
    }

    public function complete($id)
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['error' => 'Neautentificat'], 401);
        }

        $lesson = Lesson::findOrFail($id);
        
        // Check if already completed
        $existing = DB::table('lesson_progress')
            ->where('user_id', $user->id)
            ->where('lesson_id', $lesson->id)
            ->first();

        if (!$existing) {
            DB::table('lesson_progress')->insert([
                'user_id' => $user->id,
                'lesson_id' => $lesson->id,
                'completed' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Award points from course
            $course = $lesson->course;
            if ($course && $course->reward_points) {
                $pointsPerLesson = $course->reward_points / $course->lessons->count();
                $user->points += round($pointsPerLesson);
                $user->save();
            }
            
            // Update course progress in course_user table
            if ($course) {
                $courseLessons = $course->lessons->pluck('id')->toArray();
                $completedLessons = DB::table('lesson_progress')
                    ->where('user_id', $user->id)
                    ->where('completed', true)
                    ->whereIn('lesson_id', $courseLessons)
                    ->count();
                
                $totalLessons = count($courseLessons);
                $progressPercentage = $totalLessons > 0 ? round(($completedLessons / $totalLessons) * 100) : 0;
                
                // Check if exam exists for this course
                $exam = Exam::where('course_id', $course->id)->first();
                $examPassed = false;
                
                if ($exam) {
                    // Check if user has passed the exam
                    $examResult = ExamResult::where('exam_id', $exam->id)
                        ->where('user_id', $user->id)
                        ->where('passed', true)
                        ->orderBy('attempt_number', 'desc')
                        ->first();
                    
                    $examPassed = $examResult !== null;
                }
                
                // Course is completed only if all lessons are done AND exam is passed (if exam exists)
                $allLessonsCompleted = $completedLessons >= $totalLessons && $totalLessons > 0;
                $isCompleted = $allLessonsCompleted && ($exam ? $examPassed : true);
                
                // Update or create course_user entry
                DB::table('course_user')
                    ->updateOrInsert(
                        [
                            'course_id' => $course->id,
                            'user_id' => $user->id,
                        ],
                        [
                            'progress_percentage' => $progressPercentage,
                            'completed_at' => $isCompleted ? now() : null,
                            'started_at' => DB::raw('COALESCE(started_at, NOW())'),
                            'updated_at' => now(),
                        ]
                    );
            }
            
            // Invalidate cache for dashboard and profile
            Cache::forget("dashboard_user_{$user->id}_stats");
            Cache::forget("profile_user_{$user->id}");
        }

        return response()->json([
            'message' => 'Lesson completed successfully',
            'lesson' => $lesson,
        ]);
    }

    public function getProgress($courseId, $userId = null)
    {
        $user = Auth::user();
        
        // Use authenticated user if available, otherwise use provided userId
        $targetUserId = $user ? $user->id : $userId;
        
        if (!$targetUserId) {
            return response()->json(['error' => 'User ID required'], 400);
        }
        
        $course = Course::with('lessons')->findOrFail($courseId);
        
        $completedLessons = DB::table('lesson_progress')
            ->where('user_id', $targetUserId)
            ->where('completed', true)
            ->whereIn('lesson_id', $course->lessons->pluck('id'))
            ->pluck('lesson_id')
            ->toArray();

        return response()->json([
            'courseId' => $courseId,
            'completedLessons' => $completedLessons,
            'quizPassed' => false, // TODO: implement quiz tracking
        ]);
    }
}

