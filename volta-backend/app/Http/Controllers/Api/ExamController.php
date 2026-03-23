<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\Test;
use App\Models\ExamResult;
use App\Models\TestResult;
use App\Services\CourseProgressService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ExamController extends Controller
{
    protected $progressService;

    public function __construct(CourseProgressService $progressService)
    {
        $this->progressService = $progressService;
    }

    protected function isAnswerCorrectFlag($answer): bool
    {
        if (!is_array($answer)) {
            return false;
        }

        $value = $answer['is_correct'] ?? $answer['isCorrect'] ?? $answer['correct'] ?? false;
        if (is_bool($value)) {
            return $value;
        }
        if (is_int($value) || is_float($value)) {
            return (int) $value === 1;
        }
        if (is_string($value)) {
            $normalized = strtolower(trim($value));
            return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
        }
        return false;
    }

    protected function answerTextForShuffleKey($answer): string
    {
        if (!is_array($answer)) {
            return (string) $answer;
        }

        return (string) (
            $answer['text']
            ?? $answer['answer_text']
            ?? $answer['content']
            ?? $answer['label']
            ?? ''
        );
    }

    /**
     * Order answers as the student sees them for this attempt (deterministic shuffle when randomize_answers).
     * Must use the same attempt number as selectQuestionsForTestAttempt / exam payload (existing results count + 1).
     *
     * @return array{answers: array, correct_index: int|null}
     */
    protected function resolveAnswersOrderForTestAttempt(Test $test, $question, $user, int $attemptNumber): array
    {
        $answers = $question->answers ?? [];
        if (!is_array($answers)) {
            $answers = [];
        }

        $correctAnswerIndex = null;
        $type = $question->type ?? '';

        if ($type === 'multiple_choice' || $type === 'true_false') {
            foreach ($answers as $idx => $answer) {
                if ($this->isAnswerCorrectFlag($answer)) {
                    $correctAnswerIndex = $idx;
                    break;
                }
            }
        }

        if (($type === 'multiple_choice' || $type === 'true_false')
            && $test->randomize_answers
            && count($answers) > 1
        ) {
            $seedBase = "{$test->id}:{$user->id}:{$attemptNumber}:q{$question->id}";
            $indexed = [];
            foreach ($answers as $idx => $ans) {
                $text = $this->answerTextForShuffleKey($ans);
                $key = hash('sha1', $seedBase . ":a{$idx}:" . $text);
                $indexed[] = ['key' => $key, 'idx' => $idx, 'ans' => $ans];
            }
            usort($indexed, fn ($a, $b) => $a['key'] <=> $b['key']);
            $answers = array_values(array_map(fn ($x) => $x['ans'], $indexed));

            $correctAnswerIndex = null;
            foreach ($answers as $idx => $answer) {
                if ($this->isAnswerCorrectFlag($answer)) {
                    $correctAnswerIndex = $idx;
                    break;
                }
            }
        }

        return [
            'answers' => $answers,
            'correct_index' => $correctAnswerIndex,
        ];
    }

    /**
     * Get exam/test details with access check
     * Supports both legacy Exam model and new Test model
     * For Test model: pass course_id as query param to resolve correct CourseTest (test can be in multiple courses)
     */
    public function show(Request $request, $examId)
    {
        $user = Auth::user();
        $courseId = $request->query('course_id') ? (int) $request->query('course_id') : null;

        // Try to find as Test first (new system)
        $test = Test::with([
            'questions' => function($query) {
                $query->orderBy('order');
            },
            'questionBank.questions' => function($query) {
                $query->orderBy('order');
            }
        ])->find($examId);

        if ($test) {
            // Handle Test model
            return $this->handleTest($test, $user, $courseId);
        }
        
        // Fallback to legacy Exam model
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
        
        return $this->handleExam($exam, $user);
    }
    
    /**
     * Handle Test model (new system)
     * @param int|null $courseId When provided, resolves CourseTest for this course (test can be in multiple courses)
     */
    protected function handleTest(Test $test, $user, ?int $courseId = null)
    {
        // Get user's attempts
        $userAttempts = TestResult::where('test_id', $test->id)
            ->where('user_id', $user->id)
            ->orderBy('attempt_number', 'desc')
            ->get();

        $currentAttempt = $userAttempts->count();
        $latestResult = $userAttempts->first();
        $remainingAttempts = $test->max_attempts
            ? max(0, $test->max_attempts - $currentAttempt)
            : null;
        $canRetake = $test->max_attempts
            ? ($remainingAttempts > 0)
            : true;

        // Use a deterministic "attempt seed" so the same attempt sees the same sampled questions.
        $attemptNumberForSeed = $currentAttempt + 1;

        // Get questions (supports bank + optional rule-based selection)
        $questions = $this->selectQuestionsForTestAttempt($test, $user, $attemptNumberForSeed);
        
        // Transform questions (optionally randomize answers deterministically)
        $transformedQuestions = $questions->map(function($question) use ($test, $user, $attemptNumberForSeed) {
            $resolved = $this->resolveAnswersOrderForTestAttempt($test, $question, $user, $attemptNumberForSeed);
            $answers = $resolved['answers'];
            $correctAnswerIndex = $resolved['correct_index'];

            return [
                'id' => $question->id,
                'text' => $question->content,
                'type' => $question->type ?? 'multiple_choice',
                'options' => ($question->type === 'multiple_choice' || $question->type === 'true_false')
                    ? array_map(function($ans) {
                        if (!is_array($ans)) {
                            return $ans;
                        }
                        return $ans['text'] ?? $ans['answer_text'] ?? $ans['content'] ?? '';
                    }, $answers)
                    : [],
                'answerIndex' => $correctAnswerIndex,
                'points' => $question->points ?? 1,
                'explanation' => $question->explanation ?? null,
            ];
        });
        
        // Check if user has passed (assuming 70% is passing)
        $passingScore = 70; // Default, could be from CourseTest pivot
        $hasPassed = $latestResult && $latestResult->percentage >= $passingScore;

        // Resolve CourseTest: use course_id when provided (test can be attached to multiple courses)
        $courseTestQuery = \App\Models\CourseTest::where('test_id', $test->id);
        if ($courseId) {
            $courseTestQuery->where('course_id', $courseId);
        }
        $courseTest = $courseTestQuery->first();
        $resolvedCourseId = $courseTest ? $courseTest->course_id : $courseId;
        $moduleId = ($courseTest && $courseTest->scope === 'module') ? $courseTest->scope_id : null;
        
        return response()->json([
            'id' => $test->id,
            'title' => $test->title,
            'description' => $test->description,
            'type' => $test->type ?? 'graded',
            'course_id' => $resolvedCourseId,
            'module_id' => $moduleId,
            'lesson_id' => null,
            'passing_score' => $courseTest->passing_score ?? $passingScore,
            'time_limit_minutes' => $test->time_limit_minutes,
            'max_attempts' => $test->max_attempts,
            'is_required' => $courseTest->required ?? false,
            'questions' => $transformedQuestions,
            'current_attempt' => $currentAttempt,
            'remaining_attempts' => $remainingAttempts,
            'can_retake' => $canRetake,
            'has_passed' => $hasPassed,
            'latest_result' => $latestResult ? [
                'score' => $latestResult->score ?? 0,
                'total_points' => $latestResult->max_score ?? $latestResult->total_points ?? 0,
                'percentage' => $latestResult->percentage ?? 0,
                'passed' => $hasPassed,
                'completed_at' => $latestResult->completed_at,
                'attempt_number' => $latestResult->attempt_number ?? 1,
            ] : null,
        ]);
    }

    /**
     * Select questions for a test attempt.
     * Supports question banks + rule-based selection via tests.question_selection (JSON).
     *
     * For determinism we sort by a hash of (test,user,attempt,question_id) when using random selection.
     */
    protected function selectQuestionsForTestAttempt(Test $test, $user, int $attemptNumber)
    {
        $base = collect();

        if ($test->question_source === 'bank' && $test->questionBank) {
            $base = $test->questionBank->questions()->orderBy('order')->get();
        } else {
            $base = $test->questions()->orderBy('order')->get();
        }

        if ($base->isEmpty()) {
            return $base;
        }

        if ($test->question_source !== 'bank') {
            // For direct questions we can still honor randomize_questions deterministically
            if ($test->randomize_questions) {
                $seedBase = "{$test->id}:{$user->id}:{$attemptNumber}";
                $base = $base->sortBy(fn ($q) => hash('sha1', $seedBase . ":q" . $q->id))->values();
            }
            return $base;
        }

        $sel = $test->question_selection;
        if (!is_array($sel) || empty($sel)) {
            // If no explicit selection rules, we can still randomize question order deterministically
            if ($test->randomize_questions) {
                $seedBase = "{$test->id}:{$user->id}:{$attemptNumber}";
                $base = $base->sortBy(fn ($q) => hash('sha1', $seedBase . ":q" . $q->id))->values();
            }
            return $base;
        }

        $mode = (string)($sel['mode'] ?? '');
        $count = (int)($sel['count'] ?? 0);
        $difficulty = $sel['difficulty'] ?? null;
        $tags = $sel['tags'] ?? null;

        $difficultyList = [];
        if (is_string($difficulty) && $difficulty !== '') $difficultyList = [$difficulty];
        if (is_array($difficulty)) $difficultyList = array_values(array_filter(array_map('strval', $difficulty)));

        $tagList = [];
        if (is_string($tags) && $tags !== '') $tagList = [$tags];
        if (is_array($tags)) $tagList = array_values(array_filter(array_map('strval', $tags)));
        $tagList = array_values(array_unique(array_map(fn ($t) => mb_strtolower(trim($t)), $tagList)));

        $filtered = $base->filter(function ($q) use ($difficultyList, $tagList) {
            $meta = is_array($q->metadata) ? $q->metadata : [];
            $qDifficulty = isset($meta['difficulty']) ? (string)$meta['difficulty'] : '';
            $qTags = $meta['tags'] ?? [];
            if (is_string($qTags)) $qTags = array_map('trim', explode(',', $qTags));
            if (!is_array($qTags)) $qTags = [];
            $qTags = array_values(array_filter(array_map(fn ($t) => mb_strtolower(trim((string)$t)), $qTags)));

            if (!empty($difficultyList) && !in_array($qDifficulty, $difficultyList, true)) {
                return false;
            }

            if (!empty($tagList)) {
                $hasAny = false;
                foreach ($tagList as $t) {
                    if (in_array($t, $qTags, true)) {
                        $hasAny = true;
                        break;
                    }
                }
                if (!$hasAny) return false;
            }

            return true;
        })->values();

        if ($filtered->isEmpty()) {
            $filtered = $base->values(); // fallback to all
        }

        $useRandom = ($mode === 'random') || $test->randomize_questions;
        if ($useRandom) {
            $seedBase = "{$test->id}:{$user->id}:{$attemptNumber}";
            $filtered = $filtered->sortBy(fn ($q) => hash('sha1', $seedBase . ":q" . $q->id))->values();
        }

        if ($count > 0) {
            $filtered = $filtered->take($count)->values();
        }

        return $filtered;
    }
    
    /**
     * Handle legacy Exam model
     */
    protected function handleExam(Exam $exam, $user)
    {

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
        $userAttempts = ExamResult::where('exam_id', $exam->id)
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
     * Submit exam/test answers
     * Supports both legacy Exam model and new Test model
     */
    public function submit(Request $request, $examId)
    {
        $user = Auth::user();
        
        // Try to find as Test first (new system)
        $test = Test::with([
            'questions',
            'questionBank.questions'
        ])->find($examId);
        
        if ($test) {
            // Handle Test model
            return $this->submitTest($request, $test, $user);
        }
        
        // Fallback to legacy Exam model
        $exam = Exam::with([
            'course',
            'module',
            'questions.answers'
        ])->findOrFail($examId);
        
        return $this->submitExam($request, $exam, $user);
    }
    
    /**
     * Submit Test (new system)
     */
    protected function submitTest(Request $request, Test $test, $user)
    {
        try {
            // Check attempt limits
            $userAttempts = TestResult::where('test_id', $test->id)
                ->where('user_id', $user->id)
                ->get();
            
            $currentAttempt = $userAttempts->count();
            $nextAttempt = $currentAttempt + 1;
            
            if ($test->max_attempts && $nextAttempt > $test->max_attempts) {
                return response()->json([
                    'message' => "Ai atins limita de {$test->max_attempts} încercări pentru acest test.",
                    'max_attempts_reached' => true,
                ], 403);
            }
            
            // Get questions for this attempt (deterministic selection)
            $questions = $this->selectQuestionsForTestAttempt($test, $user, $nextAttempt);

            if ($questions->isEmpty()) {
                return response()->json([
                    'message' => 'Testul nu are întrebări disponibile.',
                ], 400);
            }

            $answers = $request->input('answers', []);
            
            // Calculate score and count correct answers (for statistics: X din Y întrebări)
            $score = 0;
            $totalPoints = 0;
            $correctAnswersCount = 0;
            $needsManualReview = false;
            $totalQuestions = $questions->count();

            foreach ($questions as $question) {
                $points = $question->points ?? 1;
                $totalPoints += $points;

                if (in_array($question->type ?? '', ['short_answer', 'essay'], true)) {
                    $needsManualReview = true;
                } else {
                    // Multiple choice / true_false: same answer order as exam payload (incl. randomize_answers)
                    $resolved = $this->resolveAnswersOrderForTestAttempt($test, $question, $user, $nextAttempt);
                    $correctAnswerIndex = $resolved['correct_index'];

                    if (isset($answers[$question->id]) && $answers[$question->id] == $correctAnswerIndex) {
                        $score += $points;
                        $correctAnswersCount++;
                    }
                }
            }
            
            $percentage = $totalPoints > 0 ? round(($score / $totalPoints) * 100, 2) : 0;

            // Resolve CourseTest: use course_id from request when provided (test can be in multiple courses)
            $courseId = $request->input('course_id') ? (int) $request->input('course_id') : null;
            $courseTestQuery = \App\Models\CourseTest::where('test_id', $test->id);
            if ($courseId) {
                $courseTestQuery->where('course_id', $courseId);
            }
            $courseTest = $courseTestQuery->first();
            $passingScore = $courseTest ? ($courseTest->passing_score ?? 70) : 70;
            $passed = !$needsManualReview && $percentage >= $passingScore;
            
            // Create test result
            // Use only fields that are in the fillable array of TestResult model
            $testResult = TestResult::create([
                'test_id' => $test->id,
                'user_id' => $user->id,
                'attempt_number' => $nextAttempt,
                'score' => $score,
                'max_score' => $totalPoints,
                'correct_answers_count' => $correctAnswersCount,
                'total_questions' => $totalQuestions,
                'percentage' => $percentage,
                'passed' => $passed,
                'answers' => $answers,
                'completed_at' => now(),
                'status' => $needsManualReview ? 'pending_review' : 'completed',
                'needs_manual_review' => $needsManualReview,
            ]);
        
            // Get course from CourseTest relationship
            if ($courseTest) {
                try {
                    $course = \App\Models\Course::find($courseTest->course_id);
                    $module = ($courseTest->scope === 'module') ? \App\Models\Module::find($courseTest->scope_id) : null;
                    
                    // If test is required and passed, recalculate progress
                    if (($courseTest->required ?? false) && $passed) {
                        if ($module) {
                            try {
                                // Recalculate module progress
                                $this->progressService->calculateModuleProgress($user, $module);
                                
                                // Check if module is now complete
                                if ($this->progressService->isModuleComplete($user, $module)) {
                                    // Recalculate course progress
                                    if ($course) {
                                        $this->progressService->calculateCourseProgress($user, $course);
                                        
                                        // Check if course is now complete
                                        if ($this->progressService->isCourseComplete($user, $course)) {
                                            // Mark course as completed
                                            DB::table('course_user')
                                                ->where('user_id', $user->id)
                                                ->where('course_id', $course->id)
                                                ->update([
                                                    'completed_at' => now(),
                                                    'updated_at' => now(),
                                                ]);
                                            app(\App\Services\NotificationService::class)->notifyCourseCompleted($user, $course);
                                        }
                                    }
                                }
                            } catch (\Exception $e) {
                                \Log::warning('Error recalculating module progress', [
                                    'module_id' => $module->id ?? null,
                                    'error' => $e->getMessage(),
                                ]);
                            }
                        } elseif ($course) {
                            try {
                                // Course-level test, recalculate course progress
                                $this->progressService->calculateCourseProgress($user, $course);
                                
                                // Check if course is now complete
                                if ($this->progressService->isCourseComplete($user, $course)) {
                                    // Mark course as completed
                                    DB::table('course_user')
                                        ->where('user_id', $user->id)
                                        ->where('course_id', $course->id)
                                        ->update([
                                            'completed_at' => now(),
                                            'updated_at' => now(),
                                        ]);
                                    app(\App\Services\NotificationService::class)->notifyCourseCompleted($user, $course);
                                }
                            } catch (\Exception $e) {
                                \Log::warning('Error recalculating course progress', [
                                    'course_id' => $course->id ?? null,
                                    'error' => $e->getMessage(),
                                ]);
                            }
                        }
                    }
                } catch (\Exception $e) {
                    \Log::warning('Error processing course/module for test result', [
                        'course_test_id' => $courseTest->id ?? null,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
            
            return response()->json([
                'message' => 'Test trimis cu succes',
                'result' => [
                    'id' => $testResult->id,
                    'score' => $score,
                    'total_points' => $totalPoints,
                    'max_score' => $totalPoints,
                    'percentage' => $percentage,
                    'passed' => $passed,
                    'passing_score' => $passingScore,
                    'attempt_number' => $nextAttempt,
                    'remaining_attempts' => $test->max_attempts 
                        ? max(0, $test->max_attempts - $nextAttempt)
                        : null,
                    'needs_manual_review' => $needsManualReview,
                    'status' => $testResult->status,
                    'completed_at' => $testResult->completed_at,
                ],
            ]);
        } catch (\Exception $e) {
            \Log::error('Error submitting test', [
                'test_id' => $test->id ?? null,
                'user_id' => $user->id ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            return response()->json([
                'error' => 'Eroare la trimiterea testului',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    
    /**
     * Submit legacy Exam
     */
    protected function submitExam(Request $request, Exam $exam, $user)
    {

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
        $userAttempts = ExamResult::where('exam_id', $exam->id)
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

