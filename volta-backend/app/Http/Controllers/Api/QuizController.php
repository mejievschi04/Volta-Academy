<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamResult;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class QuizController extends Controller
{
    public function show($courseId)
    {
        $course = Course::findOrFail($courseId);
        
        // Load exam for this course
        $exam = Exam::with(['questions.answers' => function($query) {
            $query->orderBy('order');
        }])->where('course_id', $courseId)->first();
        
        if (!$exam) {
            return response()->json([
                'error' => 'Nu există test disponibil pentru acest curs'
            ], 404);
        }
        
        // Check if user has already completed this exam
        $user = Auth::user();
        $existingResults = [];
        $currentAttempt = 0;
        $canRetake = true;
        $latestResult = null;
        
        if ($user) {
            $existingResults = ExamResult::where('exam_id', $exam->id)
                ->where('user_id', $user->id)
                ->orderBy('attempt_number', 'desc')
                ->get();
            
            if ($existingResults->count() > 0) {
                $latestResult = $existingResults->first();
                $currentAttempt = $latestResult->attempt_number;
                
                // Check if user can retake (if max_attempts is set and reached)
                if ($exam->max_attempts !== null && $currentAttempt >= $exam->max_attempts) {
                    $canRetake = false;
                }
            }
        }
        
        // Transform exam structure to match frontend expectations
        $questions = $exam->questions->map(function($question, $index) {
            $answers = $question->answers;
            $correctAnswerIndex = null;
            
            // Find correct answer index
            foreach ($answers as $idx => $answer) {
                if ($answer->is_correct) {
                    $correctAnswerIndex = $idx;
                    break;
                }
            }
            
            return [
                'id' => $question->id,
                'text' => $question->question_text,
                'options' => $answers->pluck('answer_text')->toArray(),
                'answerIndex' => $correctAnswerIndex,
                'points' => $question->points ?? 1,
            ];
        });
        
        return response()->json([
            'id' => $exam->id,
            'title' => $exam->title,
            'courseId' => $course->id,
            'maxScore' => $exam->max_score,
            'maxAttempts' => $exam->max_attempts,
            'questions' => $questions,
            'hasResult' => $latestResult !== null,
            'currentAttempt' => $currentAttempt,
            'canRetake' => $canRetake,
            'result' => $latestResult ? [
                'score' => $latestResult->score,
                'total' => $latestResult->total_points,
                'percentage' => $latestResult->percentage,
                'passed' => $latestResult->passed,
                'answers' => $latestResult->answers,
                'completed_at' => $latestResult->completed_at,
                'attempt_number' => $latestResult->attempt_number,
            ] : null,
        ]);
    }

    public function submit(Request $request, $courseId)
    {
        $course = Course::findOrFail($courseId);
        $answers = $request->input('answers', []);
        
        // Load exam with questions and answers
        $exam = Exam::with(['questions.answers' => function($query) {
            $query->orderBy('order');
        }])->where('course_id', $courseId)->first();
        
        if (!$exam) {
            return response()->json([
                'error' => 'Nu există test disponibil pentru acest curs'
            ], 404);
        }
        
        // Check if user can submit (check attempt limits)
        $user = Auth::user();
        if ($user) {
            $existingResults = ExamResult::where('exam_id', $exam->id)
                ->where('user_id', $user->id)
                ->get();
            
            $currentAttempt = $existingResults->count() > 0 ? $existingResults->max('attempt_number') : 0;
            $nextAttempt = $currentAttempt + 1;
            
            // Check if max attempts reached
            if ($exam->max_attempts !== null && $nextAttempt > $exam->max_attempts) {
                return response()->json([
                    'error' => "Ai atins limita de {$exam->max_attempts} încercări pentru acest test.",
                    'maxAttemptsReached' => true,
                ], 403);
            }
        }
        
        // Calculate score based on correct answers
        $score = 0;
        $totalPoints = 0;
        
        foreach ($exam->questions as $question) {
            $questionAnswers = $question->answers->values(); // Reset keys to 0,1,2,3...
            $totalPoints += $question->points ?? 1;
            
            // Find correct answer index
            $correctAnswerIndex = null;
            foreach ($questionAnswers as $idx => $answer) {
                if ($answer->is_correct) {
                    $correctAnswerIndex = $idx;
                    break;
                }
            }
            
            // Check if user's answer matches correct answer
            if (isset($answers[$question->id]) && $answers[$question->id] == $correctAnswerIndex) {
                $score += $question->points ?? 1;
            }
        }
        
        $percentage = $totalPoints > 0 ? round(($score / $totalPoints) * 100) : 0;
        $passed = $percentage >= 50; // Pass if at least 50%
        
        // Save quiz result to database
        if ($user) {
            $existingResults = ExamResult::where('exam_id', $exam->id)
                ->where('user_id', $user->id)
                ->get();
            
            $currentAttempt = $existingResults->count() > 0 ? $existingResults->max('attempt_number') : 0;
            $nextAttempt = $currentAttempt + 1;
            
            ExamResult::create([
                'exam_id' => $exam->id,
                'user_id' => $user->id,
                'attempt_number' => $nextAttempt,
                'score' => $score,
                'total_points' => $totalPoints,
                'percentage' => $percentage,
                'passed' => $passed,
                'answers' => $answers,
                'completed_at' => now(),
            ]);
            
            // Update course progress if exam is passed
            if ($passed) {
                $courseLessons = $course->lessons->pluck('id')->toArray();
                $completedLessons = DB::table('lesson_progress')
                    ->where('user_id', $user->id)
                    ->where('completed', true)
                    ->whereIn('lesson_id', $courseLessons)
                    ->count();
                
                $totalLessons = count($courseLessons);
                $progressPercentage = $totalLessons > 0 ? round(($completedLessons / $totalLessons) * 100) : 0;
                
                // Course is completed only if all lessons are done AND exam is passed
                $allLessonsCompleted = $completedLessons >= $totalLessons && $totalLessons > 0;
                $isCompleted = $allLessonsCompleted && $passed;
                
                // Update course_user entry
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
                
                // Invalidate cache for dashboard and profile
                Cache::forget("dashboard_user_{$user->id}_stats");
                Cache::forget("profile_user_{$user->id}");
            }
        }
        
        return response()->json([
            'score' => $score,
            'total' => $totalPoints,
            'maxScore' => $exam->max_score,
            'passed' => $passed,
            'percentage' => $percentage,
        ]);
    }
}

