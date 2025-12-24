<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamQuestion;
use App\Models\ExamAnswer;
use App\Models\ExamResult;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class ExamAdminController extends Controller
{
    public function index(Request $request)
    {
        $query = Exam::with(['course']);

        if ($request->has('course_id')) {
            $query->where('course_id', $request->course_id);
        }


        $exams = $query->get()->map(function($exam) {
            return [
                'id' => $exam->id,
                'course_id' => $exam->course_id,
                'title' => $exam->title,
                'max_score' => $exam->max_score,
                'max_attempts' => $exam->max_attempts,
                'course_title' => $exam->course ? $exam->course->title : null,
                'created_at' => $exam->created_at,
                'updated_at' => $exam->updated_at,
            ];
        });

        return response()->json($exams);
    }

    public function show($id)
    {
        $exam = Exam::with(['course', 'questions.answers'])->findOrFail($id);
        return response()->json($exam);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'course_id' => 'nullable|integer|exists:courses,id',
            'module_id' => 'nullable|integer|exists:modules,id',
            'title' => 'required|string|max:255',
            'max_score' => 'nullable|integer|min:1',
            'max_attempts' => 'nullable|integer|min:1',
            'passing_score' => 'nullable|integer|min:0|max:100',
            'is_required' => 'nullable|boolean',
            'questions' => 'nullable|array',
            'questions.*.question_text' => 'required|string',
            'questions.*.question_type' => 'nullable|string|in:multiple_choice,open_text',
            'questions.*.points' => 'nullable|integer|min:1',
            'questions.*.order' => 'nullable|integer|min:0',
            'questions.*.answers' => 'nullable|array',
            'questions.*.answers.*.answer_text' => 'required|string',
            'questions.*.answers.*.is_correct' => 'nullable|boolean',
            'questions.*.answers.*.order' => 'nullable|integer|min:0',
        ]);

        // Get course_id - either from validated data or from module_id
        $courseId = null;
        if (isset($validated['course_id']) && $validated['course_id'] !== null && $validated['course_id'] !== '') {
            $courseId = (int)$validated['course_id'];
        } elseif (isset($validated['module_id']) && $validated['module_id'] !== null && $validated['module_id'] !== '') {
            // If module_id is provided but course_id is not, get course_id from module
            $module = \App\Models\Module::find($validated['module_id']);
            if ($module) {
                if ($module->course_id) {
                    $courseId = (int)$module->course_id;
                } else {
                    \Log::error('Module found but has no course_id', [
                        'module_id' => $validated['module_id'],
                        'module' => $module->toArray()
                    ]);
                }
            } else {
                \Log::error('Module not found', [
                    'module_id' => $validated['module_id']
                ]);
            }
        }

        // Ensure course_id is available
        if (!$courseId) {
            \Log::error('No course_id available for exam', [
                'validated' => $validated,
                'has_course_id' => isset($validated['course_id']),
                'has_module_id' => isset($validated['module_id']),
            ]);
            return response()->json([
                'error' => 'Trebuie să specifici un curs sau un modul'
            ], 422);
        }
        
        \Log::info('Creating exam with associations', [
            'course_id' => $courseId,
            'module_id' => $validated['module_id'] ?? null,
        ]);

        $validated['max_score'] = $validated['max_score'] ?? 100;

        // Ensure course_id is properly set
        $examData = [
            'course_id' => $courseId,
            'title' => $validated['title'],
            'max_score' => $validated['max_score'],
            'max_attempts' => $validated['max_attempts'] ?? null,
        ];
        
        // If module_id is provided, also set it (for linking exams to modules)
        if (isset($validated['module_id']) && $validated['module_id']) {
            $examData['module_id'] = (int)$validated['module_id'];
        }
        
        // Add optional fields if provided
        if (isset($validated['passing_score'])) {
            $examData['passing_score'] = (int)$validated['passing_score'];
        }
        if (isset($validated['is_required'])) {
            $examData['is_required'] = (bool)$validated['is_required'];
        }

        \Log::info('Creating exam with examData', [
            'examData' => $examData,
            'has_course_id' => isset($examData['course_id']),
            'has_module_id' => isset($examData['module_id']),
        ]);
        
        $exam = Exam::create($examData);
        
        // Refresh to get the actual saved values
        $exam->refresh();
        
        \Log::info('Exam created successfully', [
            'exam_id' => $exam->id,
            'course_id' => $exam->course_id,
            'module_id' => $exam->module_id,
        ]);

        // Create questions and answers if provided
        if (isset($validated['questions'])) {
            foreach ($validated['questions'] as $questionData) {
                $question = ExamQuestion::create([
                    'exam_id' => $exam->id,
                    'question_text' => $questionData['question_text'],
                    'question_type' => $questionData['question_type'] ?? 'multiple_choice',
                    'points' => $questionData['points'] ?? 1,
                    'order' => $questionData['order'] ?? 0,
                ]);

                if (isset($questionData['answers'])) {
                    foreach ($questionData['answers'] as $answerData) {
                        ExamAnswer::create([
                            'exam_question_id' => $question->id,
                            'answer_text' => $answerData['answer_text'],
                            'is_correct' => $answerData['is_correct'] ?? false,
                            'order' => $answerData['order'] ?? 0,
                        ]);
                    }
                }
            }
        }

        // Reload exam with relationships to ensure we have the latest data
        $exam->refresh();
        $exam->load(['course', 'module', 'questions.answers']);
        
        \Log::info('Returning exam response', [
            'exam_id' => $exam->id,
            'course_id' => $exam->course_id,
            'module_id' => $exam->module_id,
            'has_course' => $exam->course !== null,
            'has_module' => $exam->module !== null,
        ]);
        
        return response()->json([
            'message' => 'Test creat cu succes',
            'exam' => $exam,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $exam = Exam::findOrFail($id);

        $validated = $request->validate([
            'course_id' => 'nullable|integer|exists:courses,id',
            'module_id' => 'nullable|integer|exists:modules,id',
            'title' => 'sometimes|required|string|max:255',
            'max_score' => 'nullable|integer|min:1',
            'max_attempts' => 'nullable|integer|min:1',
            'passing_score' => 'nullable|integer|min:0|max:100',
            'is_required' => 'nullable|boolean',
            'questions' => 'nullable|array',
            'questions.*.id' => 'nullable|exists:exam_questions,id',
            'questions.*.question_text' => 'required|string',
            'questions.*.question_type' => 'nullable|string|in:multiple_choice,open_text',
            'questions.*.points' => 'nullable|integer|min:1',
            'questions.*.order' => 'nullable|integer|min:0',
            'questions.*.answers' => 'nullable|array',
            'questions.*.answers.*.id' => 'nullable|exists:exam_answers,id',
            'questions.*.answers.*.answer_text' => 'required|string',
            'questions.*.answers.*.is_correct' => 'nullable|boolean',
            'questions.*.answers.*.order' => 'nullable|integer|min:0',
        ]);

        // Get course_id - either from validated data, from module_id, or keep existing
        $newCourseId = null;
        if (isset($validated['course_id']) && $validated['course_id'] !== null && $validated['course_id'] !== '') {
            $newCourseId = (int)$validated['course_id'];
        } elseif (isset($validated['module_id']) && $validated['module_id'] !== null && $validated['module_id'] !== '') {
            // If module_id is provided but course_id is not, get course_id from module
            $module = \App\Models\Module::find($validated['module_id']);
            if ($module && $module->course_id) {
                $newCourseId = (int)$module->course_id;
            }
        } else {
            // Keep existing course_id
            $newCourseId = $exam->course_id;
        }
        
        // Check if course_id is valid
        if (!$newCourseId || $newCourseId === 0) {
            return response()->json([
                'error' => 'Trebuie să specifici un curs sau un modul'
            ], 422);
        }

        // Update exam basic info
        $updateData = [
            'course_id' => $newCourseId,
            'title' => $validated['title'] ?? $exam->title,
            'max_score' => $validated['max_score'] ?? $exam->max_score,
            'max_attempts' => $validated['max_attempts'] ?? $exam->max_attempts,
        ];
        
        // If module_id is provided, also update it
        if (isset($validated['module_id']) && $validated['module_id']) {
            $updateData['module_id'] = (int)$validated['module_id'];
        }
        
        // Add optional fields if provided
        if (isset($validated['passing_score'])) {
            $updateData['passing_score'] = (int)$validated['passing_score'];
        }
        if (isset($validated['is_required'])) {
            $updateData['is_required'] = (bool)$validated['is_required'];
        }
        
        $exam->update($updateData);

        // Update questions and answers if provided
        if (isset($validated['questions'])) {
            $existingQuestionIds = [];
            
            foreach ($validated['questions'] as $questionData) {
                if (isset($questionData['id'])) {
                    // Update existing question
                    $question = ExamQuestion::findOrFail($questionData['id']);
                    $question->update([
                        'question_text' => $questionData['question_text'],
                        'question_type' => $questionData['question_type'] ?? $question->question_type ?? 'multiple_choice',
                        'points' => $questionData['points'] ?? $question->points,
                        'order' => $questionData['order'] ?? $question->order,
                    ]);
                    $existingQuestionIds[] = $question->id;
                } else {
                    // Create new question
                    $question = ExamQuestion::create([
                        'exam_id' => $exam->id,
                        'question_text' => $questionData['question_text'],
                        'question_type' => $questionData['question_type'] ?? 'multiple_choice',
                        'points' => $questionData['points'] ?? 1,
                        'order' => $questionData['order'] ?? 0,
                    ]);
                    $existingQuestionIds[] = $question->id;
                }

                // Handle answers
                if (isset($questionData['answers'])) {
                    $existingAnswerIds = [];
                    
                    foreach ($questionData['answers'] as $answerData) {
                        if (isset($answerData['id'])) {
                            // Update existing answer
                            $answer = ExamAnswer::findOrFail($answerData['id']);
                            $answer->update([
                                'answer_text' => $answerData['answer_text'],
                                'is_correct' => $answerData['is_correct'] ?? false,
                                'order' => $answerData['order'] ?? $answer->order,
                            ]);
                            $existingAnswerIds[] = $answer->id;
                        } else {
                            // Create new answer
                            $answer = ExamAnswer::create([
                                'exam_question_id' => $question->id,
                                'answer_text' => $answerData['answer_text'],
                                'is_correct' => $answerData['is_correct'] ?? false,
                                'order' => $answerData['order'] ?? 0,
                            ]);
                            $existingAnswerIds[] = $answer->id;
                        }
                    }
                    
                    // Delete answers that were removed
                    ExamAnswer::where('exam_question_id', $question->id)
                        ->whereNotIn('id', $existingAnswerIds)
                        ->delete();
                }
            }
            
            // Delete questions that were removed
            ExamQuestion::where('exam_id', $exam->id)
                ->whereNotIn('id', $existingQuestionIds)
                ->delete();
        }

        return response()->json([
            'message' => 'Test actualizat cu succes',
            'exam' => $exam->load(['course', 'questions.answers']),
        ]);
    }

    public function destroy($id)
    {
        $exam = DB::table('exams')->where('id', $id)->first();

        if (!$exam) {
            return response()->json(['error' => 'Test negăsit'], 404);
        }

        DB::table('exams')->where('id', $id)->delete();

        return response()->json([
            'message' => 'Test șters cu succes',
        ]);
    }

    public function getPendingReviews(Request $request)
    {
        $results = ExamResult::with(['exam.course', 'exam.questions', 'user:id,name,email'])
            ->where('needs_manual_review', true)
            ->whereNull('reviewed_at')
            ->orderBy('completed_at', 'desc')
            ->get();

        return response()->json($results);
    }

    public function submitManualReview(Request $request, $resultId)
    {
        $validated = $request->validate([
            'manual_review_scores' => 'required|array',
            'manual_review_scores.*.question_id' => 'required|exists:exam_questions,id',
            'manual_review_scores.*.score' => 'required|numeric|min:0',
        ]);

        $result = ExamResult::with('exam.questions')->findOrFail($resultId);
        
        // Calculate new total score
        $autoScore = $result->score; // Score from multiple choice questions
        $manualScore = 0;
        $manualScores = [];

        foreach ($validated['manual_review_scores'] as $reviewScore) {
            $question = $result->exam->questions->find($reviewScore['question_id']);
            if ($question && $question->question_type === 'open_text') {
                $maxPoints = $question->points ?? 1;
                $givenScore = min($reviewScore['score'], $maxPoints); // Don't exceed max points
                $manualScore += $givenScore;
                $manualScores[$reviewScore['question_id']] = $givenScore;
            }
        }

        $newTotalScore = $autoScore + $manualScore;
        $newPercentage = $result->total_points > 0 ? round(($newTotalScore / $result->total_points) * 100) : 0;
        $newPassed = $newPercentage >= 50;

        $result->update([
            'score' => $newTotalScore,
            'percentage' => $newPercentage,
            'passed' => $newPassed,
            'needs_manual_review' => false,
            'manual_review_scores' => $manualScores,
            'reviewed_at' => now(),
            'reviewed_by' => Auth::id(),
        ]);

        // Invalidate cache for user profile and dashboard
        $userId = $result->user_id;
        \Illuminate\Support\Facades\Cache::forget("profile_user_{$userId}");
        \Illuminate\Support\Facades\Cache::forget("dashboard_user_{$userId}_stats");

        return response()->json([
            'message' => 'Verificare manuală salvată cu succes',
            'result' => $result->load(['exam.course', 'user:id,name,email']),
        ]);
    }
}

