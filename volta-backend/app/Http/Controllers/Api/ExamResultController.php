<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExamResult;
use App\Models\Test;
use App\Models\TestResult;
use App\Services\TestQuestionSelectionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class ExamResultController extends Controller
{
    protected TestQuestionSelectionService $questionSelectionService;

    public function __construct(TestQuestionSelectionService $questionSelectionService)
    {
        $this->questionSelectionService = $questionSelectionService;
    }

    protected function normalizeAnswerIndex($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_int($value)) {
            return $value;
        }
        if (is_numeric($value)) {
            return (int) $value;
        }
        return null;
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

    protected function answerText($answer): string
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

    protected function buildSelectionSeedBase(Test $test, int $userId, int $attemptNumber): string
    {
        $selection = is_array($test->question_selection) ? $test->question_selection : [];
        $seed = trim((string)($selection['seed'] ?? ''));
        $variantPoolSize = max(1, min(26, (int)($selection['variant_pool_size'] ?? 1)));
        $variantLabel = 'A';
        if ($variantPoolSize > 1) {
            $variantIndex = abs(crc32("{$test->id}:{$userId}")) % $variantPoolSize;
            $variantLabel = chr(65 + $variantIndex);
        }

        return "{$test->id}:{$userId}:{$attemptNumber}:seed:{$seed}:variant:{$variantLabel}";
    }

    protected function resolveAnswersOrderForTestAttempt(Test $test, $question, int $userId, int $attemptNumber): array
    {
        $answers = $question->answers ?? [];
        if (!is_array($answers)) {
            $answers = [];
        }

        if (!in_array($question->type ?? '', ['multiple_choice', 'single_choice', 'true_false'], true)) {
            return ['answers' => $answers, 'correct_index' => null];
        }

        if ($test->randomize_answers && count($answers) > 1) {
            $seedBase = $this->buildSelectionSeedBase($test, $userId, $attemptNumber) . ":q{$question->id}";
            $indexed = [];
            foreach ($answers as $idx => $ans) {
                $key = hash('sha1', $seedBase . ":a{$idx}:" . $this->answerText($ans));
                $indexed[] = ['key' => $key, 'ans' => $ans];
            }
            usort($indexed, fn ($a, $b) => $a['key'] <=> $b['key']);
            $answers = array_values(array_map(fn ($x) => $x['ans'], $indexed));
        }

        $correctAnswerIndex = null;
        foreach ($answers as $idx => $answer) {
            if ($this->isAnswerCorrectFlag($answer)) {
                $correctAnswerIndex = $idx;
                break;
            }
        }

        return ['answers' => $answers, 'correct_index' => $correctAnswerIndex];
    }

    protected function selectQuestionsForTestAttempt(Test $test, int $userId, int $attemptNumber)
    {
        return $this->questionSelectionService->selectForAttempt($test, $userId, $attemptNumber);
    }

    /**
     * Get all exam results for the authenticated user
     * Includes both legacy ExamResult and new TestResult
     */
    public function index(Request $request)
    {
        try {
            $user = Auth::user();
            
            // Get legacy exam results (only if exam_results table exists)
            $examResults = collect();
            if (Schema::hasTable('exam_results')) {
                try {
                    $examResults = ExamResult::with([
                        'exam.course:id,title',
                        'exam.questions' => function($query) {
                            $query->orderBy('order');
                        },
                        'exam.questions.answers' => function($query) {
                            $query->orderBy('order');
                        }
                    ])
                    ->where('user_id', $user->id)
                    ->get()
                    ->map(function($result) {
                        return [
                            'id' => $result->id,
                            'type' => 'exam', // Legacy type
                            'exam_id' => $result->exam_id,
                            'test_id' => null,
                            'user_id' => $result->user_id,
                            'attempt_number' => $result->attempt_number,
                            'score' => $result->score,
                            'max_score' => $result->total_points ?? $result->score,
                            'total_points' => $result->total_points ?? $result->score,
                            'percentage' => $result->percentage,
                            'passed' => $result->passed,
                            'answers' => $result->answers,
                            'completed_at' => $result->completed_at,
                            'needs_manual_review' => $result->needs_manual_review ?? false,
                            'reviewed_at' => $result->reviewed_at,
                            'exam' => $result->exam ? [
                                'id' => $result->exam->id,
                                'title' => $result->exam->title,
                                'course' => $result->exam->course ? [
                                    'id' => $result->exam->course->id,
                                    'title' => $result->exam->course->title,
                                ] : null,
                            ] : null,
                        ];
                    });
                } catch (\Exception $e) {
                    Log::warning('Error fetching legacy exam results', [
                        'error' => $e->getMessage(),
                    ]);
                    // Continue with empty collection
                }
            }
            
            // Get new test results
            $testResults = TestResult::with([
                'test:id,title,description,type,status',
                'test.courses:id,title', // Get courses via pivot
            ])
            ->where('user_id', $user->id)
            ->get()
            ->map(function($result) {
                // Get the first course associated with this test (or null if none)
                $course = null;
                if ($result->test && $result->test->courses) {
                    $firstCourse = $result->test->courses->first();
                    if ($firstCourse) {
                        $course = [
                            'id' => $firstCourse->id,
                            'title' => $firstCourse->title,
                        ];
                    }
                }
                
                return [
                    'id' => $result->id,
                    'type' => 'test', // New type
                    'exam_id' => null,
                    'test_id' => $result->test_id,
                    'user_id' => $result->user_id,
                    'attempt_number' => $result->attempt_number,
                    'score' => $result->score,
                    'max_score' => $result->max_score ?? $result->score,
                    'total_points' => $result->max_score ?? $result->score,
                    'percentage' => $result->percentage,
                    'passed' => $result->passed,
                    'answers' => $result->answers,
                    'completed_at' => $result->completed_at,
                    'needs_manual_review' => $result->status === 'pending_review',
                    'reviewed_at' => $result->reviewed_at,
                    'status' => $result->status,
                    'exam' => $result->test ? [
                        'id' => $result->test->id,
                        'title' => $result->test->title,
                        'course' => $course,
                    ] : null,
                ];
            });
            
            // Combine, keep only latest attempt per exam/test, then sort by completed_at descending
            $allResults = $examResults->concat($testResults)
                ->groupBy(function ($result) {
                    if (($result['type'] ?? null) === 'test') {
                        return 'test:' . ($result['test_id'] ?? 'none');
                    }
                    return 'exam:' . ($result['exam_id'] ?? 'none');
                })
                ->map(function ($group) {
                    return $group->sort(function ($a, $b) {
                        $dateA = isset($a['completed_at']) ? strtotime((string) $a['completed_at']) : 0;
                        $dateB = isset($b['completed_at']) ? strtotime((string) $b['completed_at']) : 0;
                        if ($dateA === $dateB) {
                            return ($b['attempt_number'] ?? 0) <=> ($a['attempt_number'] ?? 0);
                        }
                        return $dateB <=> $dateA;
                    })->first();
                })
                ->filter()
                ->sortByDesc(function ($result) {
                    return $result['completed_at'] ? strtotime((string) $result['completed_at']) : 0;
                })
                ->values();
            
            return response()->json($allResults);
        } catch (\Exception $e) {
            \Log::error('Error fetching exam results', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'error' => 'Nu s-au putut încărca rezultatele',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get a specific exam result with full details
     * Supports both legacy ExamResult and new TestResult
     */
    public function show($id)
    {
        try {
            $user = Auth::user();
            
            // Try to find as TestResult first (new system)
            $testResult = TestResult::with([
                'test:id,title,description,type,status,question_source,question_set_id',
                'test.questions' => function($query) {
                    $query->orderBy('order');
                },
                'test.questionBank' => function($query) {
                    $query->select('id', 'title', 'description');
                },
                'test.questionBank.questions' => function($query) {
                    $query->orderBy('order');
                },
                'test.courses:id,title',
            ])
            ->where('user_id', $user->id)
            ->find($id);
            
            if ($testResult) {
                // Check if test exists
                if (!$testResult->test) {
                    return response()->json([
                        'error' => 'Testul asociat acestui rezultat nu a fost găsit',
                    ], 404);
                }
                
                // Get the first course associated with this test
                $course = null;
                try {
                    if ($testResult->test->courses && $testResult->test->courses->isNotEmpty()) {
                        $firstCourse = $testResult->test->courses->first();
                        if ($firstCourse) {
                            $course = [
                                'id' => $firstCourse->id,
                                'title' => $firstCourse->title,
                            ];
                        }
                    }
                } catch (\Exception $e) {
                    Log::warning('Error loading course for test result', [
                        'test_result_id' => $testResult->id,
                        'error' => $e->getMessage(),
                    ]);
                }
                
                // Rebuild exact question set for this attempt (same deterministic selection as exam submit/show)
                $questions = collect();
                try {
                    if (!$testResult->test->relationLoaded('questionBank')) {
                        $testResult->test->load('questionBank');
                    }
                    $questions = $this->selectQuestionsForTestAttempt(
                        $testResult->test,
                        (int) $testResult->user_id,
                        (int) ($testResult->attempt_number ?? 1)
                    );
                } catch (\Exception $e) {
                    Log::warning('Error rebuilding attempt questions for test result', [
                        'test_result_id' => $testResult->id,
                        'error' => $e->getMessage(),
                    ]);
                }
                
                // Get user answers
                $userAnswers = $testResult->answers ?? [];
                if (!is_array($userAnswers)) {
                    $userAnswers = [];
                }
                
                return response()->json([
                    'id' => $testResult->id,
                    'type' => 'test',
                    'exam_id' => null,
                    'test_id' => $testResult->test_id,
                    'user_id' => $testResult->user_id,
                    'attempt_number' => $testResult->attempt_number,
                    'score' => $testResult->score,
                    'max_score' => $testResult->max_score ?? $testResult->score,
                    'total_points' => $testResult->max_score ?? $testResult->score,
                    'percentage' => $testResult->percentage,
                    'passed' => $testResult->passed,
                    'answers' => $userAnswers,
                    'completed_at' => $testResult->completed_at,
                    'needs_manual_review' => $testResult->status === 'pending_review',
                    'reviewed_at' => $testResult->reviewed_at,
                    'status' => $testResult->status,
                    'exam' => $testResult->test ? [
                        'id' => $testResult->test->id,
                        'title' => $testResult->test->title,
                        'description' => $testResult->test->description,
                        'type' => $testResult->test->type,
                        'status' => $testResult->test->status,
                        'course' => $course,
                        'questions' => $questions->map(function($question) use ($userAnswers, $testResult) {
                            if (!$question) {
                                return null;
                            }
                            
                            // Get user answer for this question (try both string and int keys)
                            $userAnswer = $userAnswers[$question->id] ?? $userAnswers[(string)$question->id] ?? $userAnswers[(int)$question->id] ?? null;
                            
                            $normalizedUserAnswer = $this->normalizeAnswerIndex($userAnswer);

                            // Build answer list in the same deterministic order as attempt payload
                            $resolved = $this->resolveAnswersOrderForTestAttempt(
                                $testResult->test,
                                $question,
                                (int) $testResult->user_id,
                                (int) ($testResult->attempt_number ?? 1)
                            );
                            $orderedAnswers = $resolved['answers'];
                            $correctAnswerIndex = $resolved['correct_index'];

                            // Process answers array to include correct answer indicators
                            $processedAnswers = [];
                            if (is_array($orderedAnswers)) {
                                foreach ($orderedAnswers as $index => $answer) {
                                    $answerData = is_array($answer) ? $answer : ['text' => $answer];
                                    $isCorrect = $this->isAnswerCorrectFlag($answerData);
                                    
                                    $processedAnswers[] = [
                                        'id' => $index,
                                        'text' => $this->answerText($answerData),
                                        'answer_text' => $this->answerText($answerData), // For compatibility
                                        'content' => $this->answerText($answerData),
                                        'is_correct' => $isCorrect,
                                        'is_selected' => ($normalizedUserAnswer !== null && $normalizedUserAnswer === $index),
                                        'order' => $answerData['order'] ?? $index,
                                    ];
                                }
                            }
                            
                            // Determine if user's answer is correct
                            $isUserAnswerCorrect = false;
                            if ($normalizedUserAnswer !== null && $question->type !== 'short_answer') {
                                $isUserAnswerCorrect = ($normalizedUserAnswer === $correctAnswerIndex);
                            }
                            
                            return [
                                'id' => $question->id,
                                'type' => $question->type ?? 'multiple_choice',
                                'question_type' => $question->type ?? 'multiple_choice', // For compatibility
                                'content' => $question->content ?? '',
                                'question_text' => $question->content ?? '', // For compatibility
                                'metadata' => is_array($question->metadata ?? null) ? $question->metadata : null,
                                'points' => $question->points ?? 1,
                                'order' => $question->order ?? 0,
                                'explanation' => $question->explanation ?? null,
                                'answers' => $processedAnswers,
                                'user_answer' => $userAnswer,
                                'user_answer_index' => $normalizedUserAnswer,
                                'is_correct' => $isUserAnswerCorrect,
                                'correct_answer_index' => $correctAnswerIndex,
                            ];
                        })->filter(function($q) {
                            return $q !== null;
                        }),
                    ] : null,
                ]);
            }
            
            // Fallback to legacy ExamResult (only if exam_results table exists)
            if (!Schema::hasTable('exam_results')) {
                return response()->json([
                    'error' => 'Rezultatul nu a fost găsit',
                ], 404);
            }
            
            $examResult = ExamResult::with([
                'exam.course:id,title',
                'exam.questions' => function($query) {
                    $query->orderBy('order');
                },
                'exam.questions.answers' => function($query) {
                    $query->orderBy('order');
                }
            ])
            ->where('user_id', $user->id)
            ->findOrFail($id);
            
            // Get user answers
            $userAnswers = $examResult->answers ?? [];
            
            return response()->json([
                'id' => $examResult->id,
                'type' => 'exam',
                'exam_id' => $examResult->exam_id,
                'test_id' => null,
                'user_id' => $examResult->user_id,
                'attempt_number' => $examResult->attempt_number,
                'score' => $examResult->score,
                'max_score' => $examResult->total_points ?? $examResult->score,
                'total_points' => $examResult->total_points ?? $examResult->score,
                'percentage' => $examResult->percentage,
                'passed' => $examResult->passed,
                'answers' => $userAnswers,
                'completed_at' => $examResult->completed_at,
                'needs_manual_review' => $examResult->needs_manual_review ?? false,
                'reviewed_at' => $examResult->reviewed_at,
                'exam' => $examResult->exam ? [
                    'id' => $examResult->exam->id,
                    'title' => $examResult->exam->title,
                    'course' => $examResult->exam->course ? [
                        'id' => $examResult->exam->course->id,
                        'title' => $examResult->exam->course->title,
                    ] : null,
                    'questions' => $examResult->exam->questions->map(function($question) use ($userAnswers) {
                        // Get user answer for this question (try both string and int keys)
                        $userAnswer = $userAnswers[$question->id] ?? $userAnswers[(string)$question->id] ?? $userAnswers[(int)$question->id] ?? null;
                        
                        $normalizedUserAnswer = $this->normalizeAnswerIndex($userAnswer);

                        // Process answers
                        $processedAnswers = [];
                        foreach ($question->answers as $index => $answer) {
                            $processedAnswers[] = [
                                'id' => $answer->id,
                                'text' => $answer->answer_text ?? $answer->content ?? '',
                                'answer_text' => $answer->answer_text ?? $answer->content ?? '',
                                'content' => $answer->answer_text ?? $answer->content ?? '',
                                'is_correct' => $answer->is_correct ?? false,
                                'is_selected' => ($normalizedUserAnswer !== null && $normalizedUserAnswer === $index),
                                'order' => $answer->order ?? $index,
                            ];
                        }
                        
                        // Determine if user's answer is correct
                        $isUserAnswerCorrect = false;
                        $correctAnswerIndex = null;
                        if ($normalizedUserAnswer !== null) {
                            foreach ($processedAnswers as $idx => $ans) {
                                if ($ans['is_correct']) {
                                    $correctAnswerIndex = $idx;
                                    break;
                                }
                            }
                            $isUserAnswerCorrect = ($normalizedUserAnswer === $correctAnswerIndex);
                        }
                        
                        return [
                            'id' => $question->id,
                            'type' => $question->question_type ?? $question->type ?? 'multiple_choice',
                            'question_type' => $question->question_type ?? $question->type ?? 'multiple_choice',
                            'content' => $question->question_text ?? $question->content ?? '',
                            'question_text' => $question->question_text ?? $question->content ?? '',
                            'metadata' => is_array($question->metadata ?? null) ? $question->metadata : null,
                            'points' => $question->points ?? 1,
                            'order' => $question->order ?? 0,
                            'explanation' => $question->explanation ?? null,
                            'answers' => $processedAnswers,
                            'user_answer' => $userAnswer,
                            'user_answer_index' => $normalizedUserAnswer,
                            'is_correct' => $isUserAnswerCorrect,
                            'correct_answer_index' => $correctAnswerIndex,
                        ];
                    }),
                ] : null,
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching exam result', [
                'result_id' => $id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'error' => 'Nu s-a putut încărca rezultatul',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}

