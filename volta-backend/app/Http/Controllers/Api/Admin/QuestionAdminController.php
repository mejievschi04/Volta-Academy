<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Question;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
        if ($question->test_id) {
            $this->autoDistributePointsIfNoManual((int) $question->test_id);
        }

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
        $testId = $question->test_id ? (int) $question->test_id : null;
        $question->delete();
        if ($testId) {
            $this->autoDistributePointsIfNoManual($testId);
        }

        return response()->json([
            'message' => 'Question deleted successfully',
        ]);
    }

    /**
     * Dacă niciuna dintre întrebările testului nu are punctaj manual, distribuie 100 puncte egal.
     */
    protected function autoDistributePointsIfNoManual(int $testId): void
    {
        $questions = Question::where('test_id', $testId)->orderBy('order')->get(['id', 'points']);
        $count = $questions->count();
        if ($count === 0) {
            return;
        }

        $hasManualPoints = $questions->contains(function ($q) {
            return $q->points !== null && $q->points !== '';
        });

        if ($hasManualPoints) {
            return;
        }

        DB::transaction(function () use ($questions, $count) {
            if ($count > 100) {
                foreach ($questions as $q) {
                    Question::where('id', $q->id)->update(['points' => 1]);
                }
                return;
            }

            $base = intdiv(100, $count);
            $remainder = 100 - ($base * $count);
            foreach ($questions->values() as $idx => $q) {
                $points = $base + ($idx < $remainder ? 1 : 0);
                Question::where('id', $q->id)->update(['points' => $points]);
            }
        });
    }
}

