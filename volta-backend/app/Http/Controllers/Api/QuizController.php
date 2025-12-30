<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamResult;
use App\Models\ActivityLog;
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
            
            // Find correct answer index (only for multiple choice)
            if ($question->question_type === 'multiple_choice') {
                foreach ($answers as $idx => $answer) {
                    if ($answer->is_correct) {
                        $correctAnswerIndex = $idx;
                        break;
                    }
                }
            }
            
            return [
                'id' => $question->id,
                'text' => $question->question_text,
                'type' => $question->question_type ?? 'multiple_choice',
                'options' => $question->question_type === 'multiple_choice' ? $answers->pluck('answer_text')->toArray() : [],
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
        $course = Course::with('modules')->findOrFail($courseId);
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
        $needsManualReview = false;
        $openTextQuestions = [];
        
        foreach ($exam->questions as $question) {
            $totalPoints += $question->points ?? 1;
            
            // Check if question is open_text type
            if ($question->question_type === 'open_text') {
                $needsManualReview = true;
                $openTextQuestions[] = $question->id;
                // For open_text questions, don't calculate score automatically
                // Score will be set to 0 initially, to be updated after manual review
            } else {
                // Multiple choice question - calculate score automatically
                $questionAnswers = $question->answers->values(); // Reset keys to 0,1,2,3...
                
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
        }
        
        $percentage = $totalPoints > 0 ? round(($score / $totalPoints) * 100) : 0;
        // Don't mark as passed if manual review is needed
        $passed = !$needsManualReview && $percentage >= 50; // Pass if at least 50% and no manual review needed
        
        // Save quiz result to database
        if ($user) {
            $existingResults = ExamResult::where('exam_id', $exam->id)
                ->where('user_id', $user->id)
                ->get();
            
            $currentAttempt = $existingResults->count() > 0 ? $existingResults->max('attempt_number') : 0;
            $nextAttempt = $currentAttempt + 1;
            
            $examResult = ExamResult::create([
                'exam_id' => $exam->id,
                'user_id' => $user->id,
                'attempt_number' => $nextAttempt,
                'score' => $score,
                'total_points' => $totalPoints,
                'percentage' => $percentage,
                'passed' => $passed,
                'answers' => $answers,
                'completed_at' => now(),
                'needs_manual_review' => $needsManualReview,
            ]);
            
            // Log activity: user completed exam
            ActivityLog::create([
                'user_id' => $user->id,
                'action' => 'completed_exam',
                'model_type' => 'Exam',
                'model_id' => $exam->id,
                'description' => "{$user->name} a finalizat testul \"{$exam->title}\" pentru cursul \"{$course->title}\" cu scorul {$score}/{$totalPoints} ({$percentage}%)",
                'new_values' => [
                    'exam_id' => $exam->id,
                    'exam_title' => $exam->title,
                    'course_id' => $course->id,
                    'course_title' => $course->title,
                    'score' => $score,
                    'total_points' => $totalPoints,
                    'percentage' => $percentage,
                    'passed' => $passed,
                    'attempt_number' => $nextAttempt,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
            
            // Update course progress if exam is passed
            // Course is completed when exam is passed (modules don't need individual completion)
            if ($passed) {
                // Calculate progress percentage (always 100% when course is completed)
                $progressPercentage = 100;
                
                // Course is completed
                $isCompleted = true;
                
                // Update course_user entry
                $existingRecord = DB::table('course_user')
                    ->where('course_id', $course->id)
                    ->where('user_id', $user->id)
                    ->first();

                if ($existingRecord) {
                    // Update existing record
                    DB::table('course_user')
                        ->where('course_id', $course->id)
                        ->where('user_id', $user->id)
                        ->update([
                            'progress_percentage' => $progressPercentage,
                            'completed_at' => $isCompleted ? now() : null,
                            'started_at' => $existingRecord->started_at ?: now(),
                            'updated_at' => now(),
                        ]);
                } else {
                    // Insert new record
                    DB::table('course_user')
                        ->insert([
                            'course_id' => $course->id,
                            'user_id' => $user->id,
                            'progress_percentage' => $progressPercentage,
                            'completed_at' => $isCompleted ? now() : null,
                            'started_at' => now(),
                            'is_mandatory' => false,
                            'enrolled' => true,
                            'enrolled_at' => now(),
                            'assigned_at' => now(),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                }
                
                // Log activity: user completed course
                ActivityLog::create([
                    'user_id' => $user->id,
                    'action' => 'completed_course',
                    'model_type' => 'Course',
                    'model_id' => $course->id,
                    'description' => "{$user->name} a finalizat cursul \"{$course->title}\"",
                    'new_values' => [
                        'course_id' => $course->id,
                        'course_title' => $course->title,
                        'progress_percentage' => 100,
                        'completed_at' => now()->toDateTimeString(),
                    ],
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                ]);
                
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

    // Removed: showCategoryQuiz and submitCategoryQuiz - categories are no longer supported
}

