<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\QuestionBank;
use App\Models\Question;
use App\Services\TestService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * QuestionBankAdminController
 * 
 * Handles question bank creation and management
 * Question banks allow reusable question sets across multiple tests
 */
class QuestionBankAdminController extends Controller
{
    protected TestService $testService;

    public function __construct(TestService $testService)
    {
        $this->testService = $testService;
    }

    /**
     * List all question banks
     */
    public function index(Request $request)
    {
        $query = QuestionBank::with(['creator', 'questions']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
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

        $banks = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json($banks);
    }

    /**
     * Show question bank details
     */
    public function show($id)
    {
        $bank = QuestionBank::with(['creator', 'questions', 'tests'])->findOrFail($id);
        return response()->json($bank);
    }

    /**
     * Create a new question bank
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|in:draft,published,archived',
            'questions' => 'nullable|array',
            'questions.*.type' => 'required|string',
            'questions.*.content' => 'required|string',
            'questions.*.answers' => 'required|array',
            'questions.*.points' => 'nullable|integer|min:1',
            'questions.*.order' => 'nullable|integer|min:0',
            'questions.*.explanation' => 'nullable|string',
        ]);

        $creator = Auth::user();
        $bank = $this->testService->createQuestionBank($validated, $creator);

        return response()->json([
            'message' => 'Question bank created successfully',
            'bank' => $bank->load(['questions', 'creator']),
        ], 201);
    }

    /**
     * Update a question bank
     */
    public function update(Request $request, $id)
    {
        $bank = QuestionBank::findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|in:draft,published,archived',
        ]);

        $bank->update($validated);

        return response()->json([
            'message' => 'Question bank updated successfully',
            'bank' => $bank->load(['questions', 'creator']),
        ]);
    }

    /**
     * Delete a question bank
     */
    public function destroy($id)
    {
        $bank = QuestionBank::findOrFail($id);

        // Check if bank is used in any tests
        if ($bank->tests()->count() > 0) {
            return response()->json([
                'error' => 'Cannot delete question bank that is used in tests',
            ], 422);
        }

        $bank->delete();

        return response()->json([
            'message' => 'Question bank deleted successfully',
        ]);
    }

    /**
     * Add questions to bank
     */
    public function addQuestions(Request $request, $id)
    {
        $bank = QuestionBank::findOrFail($id);

        $validated = $request->validate([
            'questions' => 'required|array',
            'questions.*.type' => 'required|string',
            'questions.*.content' => 'required|string',
            'questions.*.answers' => 'required|array',
            'questions.*.points' => 'nullable|integer|min:1',
            'questions.*.order' => 'nullable|integer|min:0',
            'questions.*.explanation' => 'nullable|string',
        ]);

        $this->testService->addQuestionsToBank($bank, $validated['questions']);

        return response()->json([
            'message' => 'Questions added successfully',
            'bank' => $bank->load('questions'),
        ]);
    }
}

