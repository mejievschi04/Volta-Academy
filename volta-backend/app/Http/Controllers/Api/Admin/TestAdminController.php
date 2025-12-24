<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Test;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Services\TestBuilderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * TestAdminController
 * 
 * Handles standalone test creation and management
 * Tests are created independently and can be linked to courses later
 */
class TestAdminController extends Controller
{
    protected TestBuilderService $testBuilderService;

    public function __construct(TestBuilderService $testBuilderService)
    {
        $this->testBuilderService = $testBuilderService;
    }

    /**
     * List all tests
     */
    public function index(Request $request)
    {
        $query = Test::with(['creator', 'questionBank']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by type
        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        // Filter by creator
        if ($request->has('created_by')) {
            $query->where('created_by', $request->created_by);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $tests = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json($tests);
    }

    /**
     * Show test details
     */
    public function show($id)
    {
        $test = Test::with([
            'creator',
            'questions',
            'questionBank',
            'courses' => function($query) {
                $query->withPivot('scope', 'scope_id', 'required', 'passing_score');
            }
        ])->findOrFail($id);

        return response()->json($test);
    }

    /**
     * Create a new test
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'type' => 'nullable|in:practice,graded,final',
            'status' => 'nullable|in:draft,published,archived',
            'time_limit_minutes' => 'nullable|integer|min:1',
            'max_attempts' => 'nullable|integer|min:1',
            'randomize_questions' => 'nullable|boolean',
            'randomize_answers' => 'nullable|boolean',
            'show_results_immediately' => 'nullable|boolean',
            'show_correct_answers' => 'nullable|boolean',
            'allow_review' => 'nullable|boolean',
            'question_source' => 'nullable|in:direct,bank',
            'question_set_id' => 'nullable|exists:question_banks,id',
            'questions' => 'nullable|array',
            'questions.*.type' => 'required|string',
            'questions.*.content' => 'required|string',
            'questions.*.answers' => 'required|array',
            'questions.*.points' => 'nullable|integer|min:1',
            'questions.*.order' => 'nullable|integer|min:0',
            'questions.*.explanation' => 'nullable|string',
        ]);

        $creator = Auth::user();
        $test = $this->testBuilderService->createTest($validated, $creator);

        return response()->json([
            'message' => 'Test created successfully',
            'test' => $test->load(['questions', 'creator']),
        ], 201);
    }

    /**
     * Update a test
     */
    public function update(Request $request, $id)
    {
        $test = Test::findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'type' => 'nullable|in:practice,graded,final',
            'status' => 'nullable|in:draft,published,archived',
            'time_limit_minutes' => 'nullable|integer|min:1',
            'max_attempts' => 'nullable|integer|min:1',
            'randomize_questions' => 'nullable|boolean',
            'randomize_answers' => 'nullable|boolean',
            'show_results_immediately' => 'nullable|boolean',
            'show_correct_answers' => 'nullable|boolean',
            'allow_review' => 'nullable|boolean',
            'question_source' => 'nullable|in:direct,bank',
            'question_set_id' => 'nullable|exists:question_banks,id',
        ]);

        $test = $this->testBuilderService->updateTest($test, $validated);

        return response()->json([
            'message' => 'Test updated successfully',
            'test' => $test->load(['questions', 'creator']),
        ]);
    }

    /**
     * Delete a test
     */
    public function destroy($id)
    {
        $test = Test::findOrFail($id);

        try {
            $this->testBuilderService->deleteTest($test);
            return response()->json([
                'message' => 'Test deleted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Publish a test
     */
    public function publish($id)
    {
        $test = Test::findOrFail($id);

        try {
            $test = $this->testBuilderService->publishTest($test);
            return response()->json([
                'message' => 'Test published successfully',
                'test' => $test,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Link test to course
     */
    public function linkToCourse(Request $request, $id)
    {
        $test = Test::findOrFail($id);

        $validated = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'scope' => 'required|in:lesson,module,course',
            'scope_id' => 'nullable|integer',
            'required' => 'nullable|boolean',
            'passing_score' => 'nullable|integer|min:0|max:100',
            'order' => 'nullable|integer|min:0',
            'unlock_after_previous' => 'nullable|boolean',
            'unlock_after_test_id' => 'nullable|exists:tests,id',
        ]);

        // Use CourseBuilderService to attach test
        $course = \App\Models\Course::findOrFail($validated['course_id']);
        app(\App\Services\CourseBuilderService::class)
            ->attachTest($course, $test, $validated);

        return response()->json([
            'message' => 'Test linked to course successfully',
        ]);
    }

    /**
     * Unlink test from course
     */
    public function unlinkFromCourse(Request $request, $id)
    {
        $test = Test::findOrFail($id);

        $validated = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'scope' => 'nullable|in:lesson,module,course',
            'scope_id' => 'nullable|integer',
        ]);

        // Use CourseBuilderService to detach test
        app(\App\Services\CourseBuilderService::class)
            ->detachTest(
                \App\Models\Course::findOrFail($validated['course_id']),
                $test,
                $validated['scope'] ?? null,
                $validated['scope_id'] ?? null
            );

        return response()->json([
            'message' => 'Test unlinked from course successfully',
        ]);
    }
}

