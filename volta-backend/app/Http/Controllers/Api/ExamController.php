<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamResult;
use App\Services\CourseProgressService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ExamController extends Controller
{
    protected $progressService;

    public function __construct(CourseProgressService $progressService)
    {
        $this->progressService = $progressService;
    }

    /**
     * Get exam details with access check
     */
    public function show($examId)
    {
        $user = Auth::user();
        $exam = Exam::with([
            'course:id,title',
            'module:id,title,course_id',
            'lesson:id,title,module_id',
            'questions' => function($query) {
                $query->orderBy('order');
            },
            'questions.answers' => function($query) {
                $query->orderBy('order');
            }
        ])->findOrFail($examId);

        // Check access
        $accessCheck = $this->progressService->isExamUnlocked(
            $user,
            $exam,
            $exam->module,
            $exam->lesson
        );

        if (!$accessCheck) {
            return response()->json([
                'message' => 'Testul nu este disponibil. Completează lecțiile/modulele anterioare.',
                'unlocked' => false,
            ], 403);
        }

        // Get user's attempts
        $userAttempts = ExamResult::where('exam_id', $examId)
            ->where('user_id', $user->id)
            ->orderBy('attempt_number', 'desc')
            ->get();

        $currentAttempt = $userAttempts->count();
        $latestResult = $userAttempts->first();
        $remainingAttempts = $exam->max_attempts 
            ? max(0, $exam->max_attempts - $currentAttempt)
            : null;
        $canRetake = $exam->max_attempts 
            ? ($remainingAttempts > 0)
            : true;

        // Check if user has passed
        $hasPassed = $latestResult && $latestResult->passed;

        // Transform questions
        $questions = $exam->questions->map(function($question) {
            $answers = $question->answers;
            $correctAnswerIndex = null;

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
                'options' => $question->question_type === 'multiple_choice' 
                    ? $answers->pluck('answer_text')->toArray() 
                    : [],
                'answerIndex' => $correctAnswerIndex,
                'points' => $question->points ?? 1,
                'explanation' => $question->explanation ?? null,
            ];
        });

        return response()->json([
            'id' => $exam->id,
            'title' => $exam->title,
            'description' => $exam->description,
            'course_id' => $exam->course_id,
            'module_id' => $exam->module_id,
            'lesson_id' => $exam->lesson_id,
            'passing_score' => $exam->passing_score ?? 70,
            'time_limit_minutes' => $exam->time_limit_minutes,
            'max_attempts' => $exam->max_attempts,
            'is_required' => $exam->is_required ?? false,
            'questions' => $questions,
            'current_attempt' => $currentAttempt,
            'remaining_attempts' => $remainingAttempts,
            'can_retake' => $canRetake,
            'has_passed' => $hasPassed,
            'latest_result' => $latestResult ? [
                'score' => $latestResult->score,
                'total_points' => $latestResult->total_points,
                'percentage' => $latestResult->percentage,
                'passed' => $latestResult->passed,
                'completed_at' => $latestResult->completed_at,
                'attempt_number' => $latestResult->attempt_number,
            ] : null,
        ]);
    }

    /**
     * Submit exam answers
     */
    public function submit(Request $request, $examId)
    {
        $user = Auth::user();
        $exam = Exam::with([
            'course',
            'module',
            'questions.answers'
        ])->findOrFail($examId);

        // Check access
        $accessCheck = $this->progressService->isExamUnlocked(
            $user,
            $exam,
            $exam->module,
            $exam->lesson
        );

        if (!$accessCheck) {
            return response()->json([
                'message' => 'Testul nu este disponibil.',
            ], 403);
        }

        // Check attempt limits
        $userAttempts = ExamResult::where('exam_id', $examId)
            ->where('user_id', $user->id)
            ->get();

        $currentAttempt = $userAttempts->count();
        $nextAttempt = $currentAttempt + 1;

        if ($exam->max_attempts && $nextAttempt > $exam->max_attempts) {
            return response()->json([
                'message' => "Ai atins limita de {$exam->max_attempts} încercări pentru acest test.",
                'max_attempts_reached' => true,
            ], 403);
        }

        $answers = $request->input('answers', []);

        // Calculate score
        $score = 0;
        $totalPoints = 0;
        $needsManualReview = false;

        foreach ($exam->questions as $question) {
            $totalPoints += $question->points ?? 1;

            if ($question->question_type === 'open_text') {
                $needsManualReview = true;
            } else {
                // Multiple choice
                $questionAnswers = $question->answers->values();
                $correctAnswerIndex = null;

                foreach ($questionAnswers as $idx => $answer) {
                    if ($answer->is_correct) {
                        $correctAnswerIndex = $idx;
                        break;
                    }
                }

                if (isset($answers[$question->id]) && $answers[$question->id] == $correctAnswerIndex) {
                    $score += $question->points ?? 1;
                }
            }
        }

        $percentage = $totalPoints > 0 ? round(($score / $totalPoints) * 100, 2) : 0;
        $passingScore = $exam->passing_score ?? 70;
        $passed = !$needsManualReview && $percentage >= $passingScore;

        // Create exam result
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

        // If exam is required and passed, recalculate progress
        if ($exam->is_required && $passed) {
            if ($exam->module) {
                // Recalculate module progress
                $this->progressService->calculateModuleProgress($user, $exam->module);
                
                // Check if module is now complete
                if ($this->progressService->isModuleComplete($user, $exam->module)) {
                    // Recalculate course progress
                    if ($exam->course) {
                        $this->progressService->calculateCourseProgress($user, $exam->course);
                        
                        // Check if course is now complete
                        if ($this->progressService->isCourseComplete($user, $exam->course)) {
                            // Mark course as completed
                            \DB::table('course_user')
                                ->where('user_id', $user->id)
                                ->where('course_id', $exam->course->id)
                                ->update([
                                    'completed_at' => now(),
                                    'updated_at' => now(),
                                ]);
                        }
                    }
                }
            } elseif ($exam->course) {
                // Course-level exam, recalculate course progress
                $this->progressService->calculateCourseProgress($user, $exam->course);
                
                // Check if course is now complete
                if ($this->progressService->isCourseComplete($user, $exam->course)) {
                    // Mark course as completed
                    \DB::table('course_user')
                        ->where('user_id', $user->id)
                        ->where('course_id', $exam->course->id)
                        ->update([
                            'completed_at' => now(),
                            'updated_at' => now(),
                        ]);
                }
            }
        }

        return response()->json([
            'message' => 'Test trimis cu succes',
            'result' => [
                'id' => $examResult->id,
                'score' => $score,
                'total_points' => $totalPoints,
                'percentage' => $percentage,
                'passed' => $passed,
                'passing_score' => $passingScore,
                'attempt_number' => $nextAttempt,
                'remaining_attempts' => $exam->max_attempts 
                    ? max(0, $exam->max_attempts - $nextAttempt)
                    : null,
                'needs_manual_review' => $needsManualReview,
                'completed_at' => $examResult->completed_at,
            ],
        ]);
    }
}

