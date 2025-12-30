<?php

namespace App\Services;

use App\Models\Test;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * TestBuilderService
 * 
 * Handles standalone test creation and management
 * Separated from course logic
 * Focus: Assessment & Questions
 */
class TestBuilderService
{
    /**
     * Create a new test
     */
    public function createTest(array $data, User $creator): Test
    {
        $test = Test::create([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'type' => $data['type'] ?? 'graded',
            'status' => $data['status'] ?? 'draft',
            'time_limit_minutes' => $data['time_limit_minutes'] ?? null,
            'max_attempts' => $data['max_attempts'] ?? null,
            'randomize_questions' => $data['randomize_questions'] ?? false,
            'randomize_answers' => $data['randomize_answers'] ?? false,
            'show_results_immediately' => $data['show_results_immediately'] ?? true,
            'show_correct_answers' => $data['show_correct_answers'] ?? false,
            'allow_review' => $data['allow_review'] ?? true,
            'question_source' => $data['question_source'] ?? 'direct',
            'question_set_id' => $data['question_set_id'] ?? null,
            'created_by' => $creator->id,
            'version' => $data['version'] ?? '1.0.0',
        ]);

        // Add questions if provided
        if (isset($data['questions']) && is_array($data['questions'])) {
            $this->addQuestionsToTest($test, $data['questions']);
        }

        return $test;
    }

    /**
     * Update a test
     */
    public function updateTest(Test $test, array $data): Test
    {
        // Prevent updating published tests that are in use
        if ($test->status === 'published') {
            $usageCount = DB::table('course_test')
                ->where('test_id', $test->id)
                ->count();

            if ($usageCount > 0 && isset($data['questions'])) {
                throw new \Exception('Cannot modify questions of a published test that is linked to courses. Create a new version instead.');
            }
        }

        // Extract questions from data if present
        $questions = $data['questions'] ?? null;
        unset($data['questions']);

        // Update test fields
        $test->update($data);
        
        // Refresh to get updated question_source if it was changed
        $test->refresh();

        // Handle questions update if provided and test uses direct questions
        if ($questions !== null && $test->question_source === 'direct') {
            // Delete existing questions
            $test->questions()->delete();
            
            // Add new questions
            if (!empty($questions)) {
                $this->addQuestionsToTest($test, $questions);
            }
        }

        return $test->fresh();
    }

    /**
     * Add questions to a test
     */
    public function addQuestionsToTest(Test $test, array $questions): void
    {
        if ($test->question_source === 'bank') {
            throw new \Exception('Cannot add direct questions to a test that uses a question bank');
        }

        foreach ($questions as $index => $questionData) {
            Question::create([
                'test_id' => $test->id,
                'question_bank_id' => null,
                'type' => $questionData['type'] ?? 'multiple_choice',
                'content' => $questionData['content'],
                'answers' => $questionData['answers'] ?? [],
                'points' => $questionData['points'] ?? 1,
                'order' => $questionData['order'] ?? $index,
                'explanation' => $questionData['explanation'] ?? null,
                'metadata' => $questionData['metadata'] ?? null,
            ]);
        }
    }

    /**
     * Update a question
     */
    public function updateQuestion(Question $question, array $data): Question
    {
        // Check if question belongs to a published test that's in use
        if ($question->test && $question->test->status === 'published') {
            $usageCount = DB::table('course_test')
                ->where('test_id', $question->test_id)
                ->count();

            if ($usageCount > 0) {
                throw new \Exception('Cannot modify questions of a published test that is linked to courses. Create a new version instead.');
            }
        }

        $question->update($data);
        return $question->fresh();
    }

    /**
     * Delete a question
     */
    public function deleteQuestion(Question $question): bool
    {
        // Check if question belongs to a published test that's in use
        if ($question->test && $question->test->status === 'published') {
            $usageCount = DB::table('course_test')
                ->where('test_id', $question->test_id)
                ->count();

            if ($usageCount > 0) {
                throw new \Exception('Cannot delete questions from a published test that is linked to courses.');
            }
        }

        return $question->delete();
    }

    /**
     * Publish a test
     */
    public function publishTest(Test $test): Test
    {
        // Validate test has questions
        if ($test->question_source === 'direct' && $test->questions()->count() === 0) {
            throw new \Exception('Cannot publish test without questions');
        }

        if ($test->question_source === 'bank' && !$test->questionBank) {
            throw new \Exception('Cannot publish test without question bank');
        }

        if ($test->question_source === 'bank' && $test->questionBank->questions()->count() === 0) {
            throw new \Exception('Cannot publish test with empty question bank');
        }

        $test->update(['status' => 'published']);
        return $test->fresh();
    }

    /**
     * Unpublish a test
     */
    public function unpublishTest(Test $test): Test
    {
        // Check if test is linked to courses
        $usageCount = DB::table('course_test')
            ->where('test_id', $test->id)
            ->count();

        if ($usageCount > 0) {
            throw new \Exception('Cannot unpublish test that is linked to courses. Unlink it first.');
        }

        $test->update(['status' => 'draft']);
        return $test->fresh();
    }

    /**
     * Delete a test (soft delete)
     */
    public function deleteTest(Test $test): bool
    {
        // Check if test is used in any courses
        $usageCount = DB::table('course_test')
            ->where('test_id', $test->id)
            ->count();

        if ($usageCount > 0) {
            throw new \Exception('Cannot delete test that is linked to courses. Unlink it first.');
        }

        return $test->delete();
    }

    /**
     * Create a question bank
     */
    public function createQuestionBank(array $data, User $creator): QuestionBank
    {
        $bank = QuestionBank::create([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'status' => $data['status'] ?? 'draft',
            'created_by' => $creator->id,
        ]);

        // Add questions if provided
        if (isset($data['questions']) && is_array($data['questions'])) {
            $this->addQuestionsToBank($bank, $data['questions']);
        }

        return $bank;
    }

    /**
     * Add questions to a question bank
     */
    public function addQuestionsToBank(QuestionBank $bank, array $questions): void
    {
        foreach ($questions as $index => $questionData) {
            Question::create([
                'test_id' => null,
                'question_bank_id' => $bank->id,
                'type' => $questionData['type'] ?? 'multiple_choice',
                'content' => $questionData['content'],
                'answers' => $questionData['answers'] ?? [],
                'points' => $questionData['points'] ?? 1,
                'order' => $questionData['order'] ?? $index,
                'explanation' => $questionData['explanation'] ?? null,
                'metadata' => $questionData['metadata'] ?? null,
            ]);
        }
    }

    /**
     * Create a new version of a test
     */
    public function createTestVersion(Test $test, User $creator): Test
    {
        $newTest = $test->replicate();
        $newTest->title = $test->title . ' (v' . $test->version . ')';
        $newTest->status = 'draft';
        $newTest->version = $this->incrementVersion($test->version);
        $newTest->created_by = $creator->id;
        $newTest->save();

        // Copy questions if direct
        if ($test->question_source === 'direct') {
            foreach ($test->questions as $question) {
                $newQuestion = $question->replicate();
                $newQuestion->test_id = $newTest->id;
                $newQuestion->question_bank_id = null;
                $newQuestion->save();
            }
        } else {
            // Link to same question bank
            $newTest->question_set_id = $test->question_set_id;
            $newTest->save();
        }

        return $newTest;
    }

    /**
     * Increment version string (e.g., "1.0.0" -> "1.0.1")
     */
    protected function incrementVersion(string $version): string
    {
        $parts = explode('.', $version);
        $lastIndex = count($parts) - 1;
        $parts[$lastIndex] = (int)$parts[$lastIndex] + 1;
        return implode('.', $parts);
    }
}

