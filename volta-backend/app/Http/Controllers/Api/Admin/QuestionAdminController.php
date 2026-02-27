<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Question;
use Illuminate\Http\Request;

class QuestionAdminController extends Controller
{
    /**
     * Update a question (test question or question bank question).
     */
    public function update(Request $request, int $id)
    {
        $question = Question::with(['test', 'questionBank'])->findOrFail($id);
        if (auth()->user()->isInstructor()) {
            $ok = ($question->test_id && $question->test && (int) $question->test->created_by === (int) auth()->id())
                || ($question->question_bank_id && $question->questionBank && (int) $question->questionBank->created_by === (int) auth()->id());
            if (!$ok) {
                abort(403, 'Acces interzis.');
            }
        }

        $validated = $request->validate([
            'type' => 'sometimes|required|string',
            'content' => 'sometimes|required|string',
            'answers' => 'sometimes|required|array',
            'points' => 'nullable|integer|min:0',
            'order' => 'nullable|integer|min:0',
            'explanation' => 'nullable|string',
            'metadata' => 'nullable|array',
        ]);

        $question->update($validated);

        return response()->json($question->fresh());
    }

    /**
     * Delete a question.
     */
    public function destroy(int $id)
    {
        $question = Question::with(['test', 'questionBank'])->findOrFail($id);
        if (auth()->user()->isInstructor()) {
            $ok = ($question->test_id && $question->test && (int) $question->test->created_by === (int) auth()->id())
                || ($question->question_bank_id && $question->questionBank && (int) $question->questionBank->created_by === (int) auth()->id());
            if (!$ok) {
                abort(403, 'Acces interzis.');
            }
        }
        $question->delete();

        return response()->json([
            'message' => 'Question deleted successfully',
        ]);
    }
}

