<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\QuestionBank;
use App\Models\Question;
use App\Models\Tag;
use App\Models\Test;
use App\Services\TestBuilderService;
use App\Services\VoltQuestionGenerationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * QuestionBankAdminController
 * 
 * Handles question bank creation and management
 * Question banks allow reusable question sets across multiple tests
 */
class QuestionBankAdminController extends Controller
{
    protected TestBuilderService $testBuilderService;
    protected VoltQuestionGenerationService $voltQuestionGeneration;

    public function __construct(
        TestBuilderService $testBuilderService,
        VoltQuestionGenerationService $voltQuestionGeneration
    ) {
        $this->testBuilderService = $testBuilderService;
        $this->voltQuestionGeneration = $voltQuestionGeneration;
    }

    /**
     * List all question banks
     */
    public function index(Request $request)
    {
        $query = QuestionBank::with(['creator', 'questions', 'tags'])
            ->withCount(['questions', 'tests', 'starredQuestions as starred_questions_count']);
        if (auth()->user()->isInstructor()) {
            $query->where('created_by', auth()->id());
        }

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

        // Filter by question metadata.language (question-level)
        if ($request->filled('language')) {
            $language = trim((string) $request->language);
            $query->whereHas('questions', function ($q) use ($language) {
                $q->where('metadata->language', $language);
            });
        }

        // Filter by question metadata.difficulty (question-level)
        if ($request->filled('difficulty')) {
            $difficulty = trim((string) $request->difficulty);
            $query->whereHas('questions', function ($q) use ($difficulty) {
                $q->where('metadata->difficulty', $difficulty);
            });
        }

        // Filter by tag presence in question metadata.tags[]
        if ($request->filled('tag')) {
            $tag = trim((string) $request->tag);
            $query->whereHas('questions', function ($q) use ($tag) {
                $q->whereJsonContains('metadata->tags', $tag);
            });
        }

        if ($request->filled('folder_tag')) {
            $folderTag = trim((string) $request->folder_tag);
            $query->whereHas('tags', function ($q) use ($folderTag) {
                $q->where('slug', Str::slug($folderTag))
                    ->orWhere('name', $folderTag);
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
        $bank = QuestionBank::with(['creator', 'questions', 'tests', 'tags'])
            ->withCount(['questions', 'tests', 'starredQuestions as starred_questions_count'])
            ->findOrFail($id);
        if (auth()->user()->isInstructor() && (int) $bank->created_by !== (int) auth()->id()) {
            abort(403, 'Acces interzis. Poți accesa doar băncile tale de întrebări.');
        }
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
            'status' => 'nullable|in:draft,published',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'questions' => 'nullable|array',
            'questions.*.type' => 'required|string|in:multiple_choice,single_choice,true_false,matching,ordering',
            'questions.*.content' => 'required|string',
            'questions.*.answers' => 'required|array',
            'questions.*.points' => 'nullable|integer|min:1',
            'questions.*.order' => 'nullable|integer|min:0',
            'questions.*.explanation' => 'nullable|string',
        ]);

        $creator = Auth::user();
        $bank = $this->testBuilderService->createQuestionBank($validated, $creator);
        $this->syncFolderTags($bank, $validated['tags'] ?? []);

        return response()->json([
            'message' => 'Question bank created successfully',
            'bank' => $bank->load(['questions', 'creator', 'tags']),
        ], 201);
    }

    /**
     * Update a question bank
     */
    public function update(Request $request, $id)
    {
        $bank = QuestionBank::findOrFail($id);
        if (auth()->user()->isInstructor() && (int) $bank->created_by !== (int) auth()->id()) {
            abort(403, 'Acces interzis.');
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|in:draft,published',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
        ]);

        $updateData = $validated;
        unset($updateData['tags']);
        $bank->update($updateData);
        if (array_key_exists('tags', $validated)) {
            $this->syncFolderTags($bank, $validated['tags'] ?? []);
        }

        return response()->json([
            'message' => 'Question bank updated successfully',
            'bank' => $bank->load(['questions', 'creator', 'tags']),
        ]);
    }

    /**
     * Delete a question bank
     */
    public function destroy($id)
    {
        $bank = QuestionBank::findOrFail($id);
        if (auth()->user()->isInstructor() && (int) $bank->created_by !== (int) auth()->id()) {
            abort(403, 'Acces interzis.');
        }

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
        if (auth()->user()->isInstructor() && (int) $bank->created_by !== (int) auth()->id()) {
            abort(403, 'Acces interzis.');
        }

        $validated = $request->validate([
            'questions' => 'required|array',
            'questions.*.type' => 'required|string|in:multiple_choice,single_choice,true_false,matching,ordering',
            'questions.*.content' => 'required|string',
            'questions.*.answers' => 'required|array',
            'questions.*.points' => 'nullable|integer|min:1',
            'questions.*.order' => 'nullable|integer|min:0',
            'questions.*.explanation' => 'nullable|string',
        ]);

        $this->testBuilderService->addQuestionsToBank($bank, $validated['questions']);

        return response()->json([
            'message' => 'Questions added successfully',
            'bank' => $bank->load('questions'),
        ]);
    }

    /**
     * Get questions from a question bank
     */
    public function getQuestions($id)
    {
        $bank = QuestionBank::with('questions')->findOrFail($id);
        if (auth()->user()->isInstructor() && (int) $bank->created_by !== (int) auth()->id()) {
            abort(403, 'Acces interzis.');
        }
        return response()->json($bank->questions);
    }

    protected function syncFolderTags(QuestionBank $bank, array $tags): void
    {
        $normalized = collect($tags)
            ->map(fn ($t) => trim((string) $t))
            ->filter()
            ->unique()
            ->values();

        $tagIds = $normalized->map(function (string $name) {
            $slug = Str::slug($name);
            $tag = Tag::firstOrCreate(
                ['slug' => $slug],
                ['name' => $name]
            );
            return $tag->id;
        })->all();

        $bank->tags()->sync($tagIds);
    }

    /**
     * Add a single question to bank
     */
    public function addQuestion(Request $request, $id)
    {
        $bank = QuestionBank::findOrFail($id);

        $validated = $request->validate([
            'type' => 'required|string|in:multiple_choice,single_choice,true_false,matching,ordering',
            'content' => 'required|string',
            'answers' => 'required|array',
            'points' => 'nullable|integer|min:1',
            'order' => 'nullable|integer|min:0',
            'explanation' => 'nullable|string',
            'metadata' => 'nullable|array',
        ]);

        $this->testBuilderService->addQuestionsToBank($bank, [$validated]);

        return response()->json([
            'message' => 'Question added successfully',
            'bank' => $bank->load('questions'),
        ]);
    }

    /**
     * Update a question in bank
     */
    public function updateQuestion(Request $request, $id, $questionId)
    {
        $bank = QuestionBank::findOrFail($id);
        $question = Question::where('question_bank_id', $bank->id)
            ->findOrFail($questionId);

        $validated = $request->validate([
            'type' => 'sometimes|required|string|in:multiple_choice,single_choice,true_false,matching,ordering',
            'content' => 'sometimes|required|string',
            'answers' => 'sometimes|required|array',
            'points' => 'nullable|integer|min:1',
            'order' => 'nullable|integer|min:0',
            'explanation' => 'nullable|string',
            'metadata' => 'nullable|array',
        ]);

        $question->update($validated);

        return response()->json([
            'message' => 'Question updated successfully',
            'question' => $question->fresh(),
        ]);
    }

    /**
     * Remove a question from bank
     */
    public function removeQuestion($id, $questionId)
    {
        $bank = QuestionBank::findOrFail($id);
        $question = Question::where('question_bank_id', $bank->id)
            ->findOrFail($questionId);

        $usageCount = Test::query()
            ->where('question_source', 'bank')
            ->where('question_set_id', (int) $bank->id)
            ->count();
        if ($usageCount > 0) {
            return response()->json([
                'error' => 'Întrebarea nu poate fi ștearsă deoarece această bancă este folosită în teste active.',
                'usage_count' => $usageCount,
            ], 422);
        }

        $question->delete();

        return response()->json([
            'message' => 'Question removed successfully',
        ]);
    }

    /**
     * Reorder questions inside a question bank.
     */
    public function reorderQuestions(Request $request, $id)
    {
        $bank = QuestionBank::findOrFail($id);

        $validated = $request->validate([
            'question_ids' => 'required|array|min:1',
            'question_ids.*' => 'integer',
        ]);

        $ids = array_values(array_unique($validated['question_ids']));
        $count = Question::where('question_bank_id', $bank->id)->whereIn('id', $ids)->count();
        if ($count !== count($ids)) {
            return response()->json([
                'error' => 'Invalid question_ids: some questions do not belong to this question bank.',
            ], 422);
        }

        DB::transaction(function () use ($bank, $ids) {
            foreach ($ids as $index => $qid) {
                Question::where('question_bank_id', $bank->id)->where('id', $qid)->update(['order' => $index]);
            }
        });

        return response()->json([
            'message' => 'Questions reordered successfully',
            'questions' => Question::where('question_bank_id', $bank->id)->orderBy('order')->get(),
        ]);
    }

    /**
     * Generate questions from course content using AI
     */
    public function generateFromCourse(Request $request, $id)
    {
        @set_time_limit(0);

        $bank = QuestionBank::findOrFail($id);
        
        $validated = $request->validate([
            'course_id' => 'required|integer|exists:courses,id',
            'numberOfQuestions' => 'nullable|integer|min:1|max:50',
            'difficulty' => 'nullable|in:easy,medium,hard',
            'questionTypes' => 'nullable|array',
        ]);

        $course = $this->voltQuestionGeneration->loadCourseWithContentForAi((int) $validated['course_id']);
        $courseContent = $this->voltQuestionGeneration->extractCourseContent($course);

        if (!$this->voltQuestionGeneration->courseHasExtractableContent($course)) {
            return response()->json([
                'error' => 'Cursul selectat nu are conținut textual suficient pentru generarea întrebărilor.',
            ], 422);
        }
        
        // Generate questions using AI
        try {
            $questions = $this->voltQuestionGeneration->generateQuestionsFromContent(
                $courseContent,
                $validated['numberOfQuestions'] ?? 10,
                $validated['difficulty'] ?? 'medium',
                is_array($validated['questionTypes'] ?? null) ? $validated['questionTypes'] : ['multiple_choice']
            );
        } catch (\Exception $e) {
            // Surface helpful error messages for devs while keeping the response safe
            Log::error('Error generating questions (endpoint)', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Eroare la generarea întrebărilor: ' . ($e->getMessage() ?: 'Problema Volt'),
            ], 500);
        }

        if (empty($questions)) {
            return response()->json([
                'error' => 'Nu s-au putut genera întrebări. Te rugăm să încerci din nou.',
            ], 500);
        }

        // Add questions to bank
        $this->testBuilderService->addQuestionsToBank($bank, $questions);

        return response()->json([
            'message' => 'Questions generated successfully',
            'questions_generated' => count($questions),
            'bank' => $bank->load('questions'),
        ]);
    }

    /**
     * Generate questions from custom text content
     */
    public function generateFromText(Request $request, $id)
    {
        $bank = QuestionBank::findOrFail($id);
        
        $validated = $request->validate([
            'content' => 'required|string|min:10|max:10000',
            'numberOfQuestions' => 'nullable|integer|min:1|max:50',
            'difficulty' => 'nullable|in:easy,medium,hard',
            'questionTypes' => 'nullable|array',
        ]);

        // Generate questions using AI with custom content
        try {
            $questions = $this->voltQuestionGeneration->generateQuestionsFromContent(
                $validated['content'],
                $validated['numberOfQuestions'] ?? 10,
                $validated['difficulty'] ?? 'medium',
                is_array($validated['questionTypes'] ?? null) ? $validated['questionTypes'] : ['multiple_choice']
            );
        } catch (\Exception $e) {
            Log::error('Error generating questions from text', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Eroare la generarea întrebărilor: ' . ($e->getMessage() ?: 'Problema Volt'),
            ], 500);
        }

        if (empty($questions)) {
            return response()->json([
                'error' => 'Nu s-au putut genera întrebări. Te rugăm să încerci din nou.',
            ], 500);
        }

        // Add questions to bank
        $this->testBuilderService->addQuestionsToBank($bank, $questions);

        return response()->json([
            'message' => 'Questions generated successfully',
            'questions_generated' => count($questions),
            'bank' => $bank->load('questions'),
        ]);
    }

    /**
     * Generate AI questions in preview mode (no DB write).
     */
    public function previewAiQuestions(Request $request, $id)
    {
        @set_time_limit(0);

        $bank = QuestionBank::findOrFail($id);
        if (auth()->user()->isInstructor() && (int) $bank->created_by !== (int) auth()->id()) {
            abort(403, 'Acces interzis.');
        }

        $validated = $request->validate([
            'topic' => 'nullable|string|min:2|max:300',
            'content' => 'nullable|string|min:10|max:10000',
            'course_id' => 'nullable|integer|exists:courses,id',
            'numberOfQuestions' => 'nullable|integer|min:1|max:50',
            'difficulty' => 'nullable|in:easy,medium,hard',
            'questionTypes' => 'nullable|array',
            'instructions' => 'nullable|string|max:4000',
            'approvedQuestions' => 'nullable|array',
            'approvedQuestions.*' => 'string',
            'blockedQuestions' => 'nullable|array',
            'blockedQuestions.*' => 'string',
        ]);

        $topic = trim((string) ($validated['topic'] ?? ''));
        $content = trim((string) ($validated['content'] ?? ''));
        $courseId = isset($validated['course_id']) ? (int) $validated['course_id'] : null;
        if ($topic === '' && $content === '' && !$courseId) {
            return response()->json([
                'error' => 'Topic, content sau course_id este obligatoriu.',
            ], 422);
        }

        $seedContent = $content !== '' ? $content : "Topic: {$topic}";
        if ($courseId) {
            $course = $this->voltQuestionGeneration->loadCourseWithContentForAi($courseId);
            if (!$this->voltQuestionGeneration->courseHasExtractableContent($course)) {
                return response()->json([
                    'error' => 'Cursul selectat nu are conținut textual suficient pentru generarea întrebărilor.',
                ], 422);
            }
            $seedContent = $this->voltQuestionGeneration->extractCourseContent($course);
        }

        $instructions = trim((string) ($validated['instructions'] ?? ''));
        $approvedQuestions = array_values(array_filter(array_map('strval', (array) ($validated['approvedQuestions'] ?? []))));
        $blockedQuestions = array_values(array_filter(array_map('strval', (array) ($validated['blockedQuestions'] ?? []))));
        $autoGenerate = filter_var($request->input('autoGenerate', false), FILTER_VALIDATE_BOOLEAN);
        try {
            if ($autoGenerate) {
                $questions = $this->voltQuestionGeneration->generateQuestionsFromContent(
                    $seedContent,
                    max(1, (int) ($validated['numberOfQuestions'] ?? 1)),
                    $validated['difficulty'] ?? 'medium',
                    is_array($validated['questionTypes'] ?? null) ? $validated['questionTypes'] : ['multiple_choice']
                );
            } else {
                $questions = $this->voltQuestionGeneration->generateReviewDraftQuestion(
                    $seedContent,
                    $validated['difficulty'] ?? 'medium',
                    is_array($validated['questionTypes'] ?? null) ? $validated['questionTypes'] : ['multiple_choice'],
                    $instructions,
                    $approvedQuestions,
                    $blockedQuestions
                );
            }
        } catch (\Exception $e) {
            Log::error('Error generating AI preview questions', [
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'error' => 'Eroare la generarea draftului Volt: ' . ($e->getMessage() ?: 'Problema Volt'),
            ], 500);
        }

        return response()->json([
            'message' => 'Draft generated successfully',
            'draft' => $questions,
        ]);
    }
}
