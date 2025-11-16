<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamQuestion;
use App\Models\ExamAnswer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExamAdminController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table('exams')
            ->join('courses', 'exams.course_id', '=', 'courses.id')
            ->select('exams.*', 'courses.title as course_title');

        if ($request->has('course_id')) {
            $query->where('exams.course_id', $request->course_id);
        }

        $exams = $query->get();

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
            'course_id' => 'required|exists:courses,id',
            'title' => 'required|string|max:255',
            'max_score' => 'nullable|integer|min:1',
            'questions' => 'nullable|array',
            'questions.*.question_text' => 'required|string',
            'questions.*.points' => 'nullable|integer|min:1',
            'questions.*.order' => 'nullable|integer|min:0',
            'questions.*.answers' => 'nullable|array',
            'questions.*.answers.*.answer_text' => 'required|string',
            'questions.*.answers.*.is_correct' => 'nullable|boolean',
            'questions.*.answers.*.order' => 'nullable|integer|min:0',
        ]);

        $validated['max_score'] = $validated['max_score'] ?? 100;

        $exam = Exam::create([
            'course_id' => $validated['course_id'],
            'title' => $validated['title'],
            'max_score' => $validated['max_score'],
        ]);

        // Create questions and answers if provided
        if (isset($validated['questions'])) {
            foreach ($validated['questions'] as $questionData) {
                $question = ExamQuestion::create([
                    'exam_id' => $exam->id,
                    'question_text' => $questionData['question_text'],
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

        return response()->json([
            'message' => 'Test creat cu succes',
            'exam' => $exam->load(['course', 'questions.answers']),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $exam = Exam::findOrFail($id);

        $validated = $request->validate([
            'course_id' => 'sometimes|required|exists:courses,id',
            'title' => 'sometimes|required|string|max:255',
            'max_score' => 'nullable|integer|min:1',
            'questions' => 'nullable|array',
            'questions.*.id' => 'nullable|exists:exam_questions,id',
            'questions.*.question_text' => 'required|string',
            'questions.*.points' => 'nullable|integer|min:1',
            'questions.*.order' => 'nullable|integer|min:0',
            'questions.*.answers' => 'nullable|array',
            'questions.*.answers.*.id' => 'nullable|exists:exam_answers,id',
            'questions.*.answers.*.answer_text' => 'required|string',
            'questions.*.answers.*.is_correct' => 'nullable|boolean',
            'questions.*.answers.*.order' => 'nullable|integer|min:0',
        ]);

        // Update exam basic info
        $exam->update([
            'course_id' => $validated['course_id'] ?? $exam->course_id,
            'title' => $validated['title'] ?? $exam->title,
            'max_score' => $validated['max_score'] ?? $exam->max_score,
        ]);

        // Update questions and answers if provided
        if (isset($validated['questions'])) {
            $existingQuestionIds = [];
            
            foreach ($validated['questions'] as $questionData) {
                if (isset($questionData['id'])) {
                    // Update existing question
                    $question = ExamQuestion::findOrFail($questionData['id']);
                    $question->update([
                        'question_text' => $questionData['question_text'],
                        'points' => $questionData['points'] ?? $question->points,
                        'order' => $questionData['order'] ?? $question->order,
                    ]);
                    $existingQuestionIds[] = $question->id;
                } else {
                    // Create new question
                    $question = ExamQuestion::create([
                        'exam_id' => $exam->id,
                        'question_text' => $questionData['question_text'],
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
}

