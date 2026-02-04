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
        $question = Question::findOrFail($id);

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
        $question = Question::findOrFail($id);
        $question->delete();

        return response()->json([
            'message' => 'Question deleted successfully',
        ]);
    }
}

