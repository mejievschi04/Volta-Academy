<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExamResult;
use App\Models\TestResult;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class ExamResultController extends Controller
{
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
            
            // Combine and sort by completed_at descending
            $allResults = $examResults->concat($testResults)
                ->sortByDesc(function($result) {
                    return $result['completed_at'] ? strtotime($result['completed_at']) : 0;
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
                
                // Get questions (from test or question bank)
                $questions = collect();
                try {
                    if ($testResult->test->question_source === 'bank') {
                        // Load question bank if not already loaded
                        if (!$testResult->test->relationLoaded('questionBank')) {
                            $testResult->test->load('questionBank');
                        }
                        if ($testResult->test->questionBank) {
                            // Load questions from question bank if not already loaded
                            if (!$testResult->test->questionBank->relationLoaded('questions')) {
                                $testResult->test->questionBank->load(['questions' => function($query) {
                                    $query->orderBy('order');
                                }]);
                            }
                            $questions = $testResult->test->questionBank->questions ?? collect();
                        }
                    } else {
                        // Load questions directly from test if not already loaded
                        if (!$testResult->test->relationLoaded('questions')) {
                            $testResult->test->load(['questions' => function($query) {
                                $query->orderBy('order');
                            }]);
                        }
                        $questions = $testResult->test->questions ?? collect();
                    }
                } catch (\Exception $e) {
                    Log::warning('Error loading questions for test result', [
                        'test_result_id' => $testResult->id,
                        'error' => $e->getMessage(),
                    ]);
                    $questions = collect();
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
                        'questions' => $questions->map(function($question) use ($userAnswers) {
                            if (!$question) {
                                return null;
                            }
                            
                            // Get user answer for this question (try both string and int keys)
                            $userAnswer = $userAnswers[$question->id] ?? $userAnswers[(string)$question->id] ?? $userAnswers[(int)$question->id] ?? null;
                            
                            // Process answers array to include correct answer indicators
                            $processedAnswers = [];
                            if ($question->answers && is_array($question->answers)) {
                                foreach ($question->answers as $index => $answer) {
                                    $answerData = is_array($answer) ? $answer : ['text' => $answer];
                                    $isCorrect = $answerData['is_correct'] ?? false;
                                    
                                    $processedAnswers[] = [
                                        'id' => $index,
                                        'text' => $answerData['text'] ?? $answerData['content'] ?? '',
                                        'answer_text' => $answerData['text'] ?? $answerData['content'] ?? '', // For compatibility
                                        'content' => $answerData['text'] ?? $answerData['content'] ?? '',
                                        'is_correct' => $isCorrect,
                                        'order' => $answerData['order'] ?? $index,
                                    ];
                                }
                            }
                            
                            // Determine if user's answer is correct
                            $isUserAnswerCorrect = false;
                            $correctAnswerIndex = null;
                            if ($userAnswer !== null && $question->type !== 'short_answer') {
                                // For multiple choice/true_false, check if user answer index matches correct answer
                                foreach ($processedAnswers as $idx => $ans) {
                                    if ($ans['is_correct']) {
                                        $correctAnswerIndex = $idx;
                                        break;
                                    }
                                }
                                $isUserAnswerCorrect = ($userAnswer == $correctAnswerIndex);
                            }
                            
                            return [
                                'id' => $question->id,
                                'type' => $question->type ?? 'multiple_choice',
                                'question_type' => $question->type ?? 'multiple_choice', // For compatibility
                                'content' => $question->content ?? '',
                                'question_text' => $question->content ?? '', // For compatibility
                                'points' => $question->points ?? 1,
                                'order' => $question->order ?? 0,
                                'explanation' => $question->explanation ?? null,
                                'answers' => $processedAnswers,
                                'user_answer' => $userAnswer,
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
                        
                        // Process answers
                        $processedAnswers = [];
                        foreach ($question->answers as $index => $answer) {
                            $processedAnswers[] = [
                                'id' => $answer->id,
                                'text' => $answer->answer_text ?? $answer->content ?? '',
                                'answer_text' => $answer->answer_text ?? $answer->content ?? '',
                                'content' => $answer->answer_text ?? $answer->content ?? '',
                                'is_correct' => $answer->is_correct ?? false,
                                'order' => $answer->order ?? $index,
                            ];
                        }
                        
                        // Determine if user's answer is correct
                        $isUserAnswerCorrect = false;
                        $correctAnswerIndex = null;
                        if ($userAnswer !== null) {
                            foreach ($processedAnswers as $idx => $ans) {
                                if ($ans['is_correct']) {
                                    $correctAnswerIndex = $idx;
                                    break;
                                }
                            }
                            $isUserAnswerCorrect = ($userAnswer == $correctAnswerIndex);
                        }
                        
                        return [
                            'id' => $question->id,
                            'type' => $question->question_type ?? $question->type ?? 'multiple_choice',
                            'question_type' => $question->question_type ?? $question->type ?? 'multiple_choice',
                            'content' => $question->question_text ?? $question->content ?? '',
                            'question_text' => $question->question_text ?? $question->content ?? '',
                            'points' => $question->points ?? 1,
                            'order' => $question->order ?? 0,
                            'explanation' => $question->explanation ?? null,
                            'answers' => $processedAnswers,
                            'user_answer' => $userAnswer,
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

