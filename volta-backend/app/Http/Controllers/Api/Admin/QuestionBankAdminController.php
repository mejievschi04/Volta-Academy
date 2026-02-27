<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\QuestionBank;
use App\Models\Question;
use App\Models\Course;
use App\Services\TestService;
use App\Http\Controllers\AIController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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

        $banks = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json($banks);
    }

    /**
     * Show question bank details
     */
    public function show($id)
    {
        $bank = QuestionBank::with(['creator', 'questions', 'tests'])->findOrFail($id);
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
        if (auth()->user()->isInstructor() && (int) $bank->created_by !== (int) auth()->id()) {
            abort(403, 'Acces interzis.');
        }

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

    /**
     * Add a single question to bank
     */
    public function addQuestion(Request $request, $id)
    {
        $bank = QuestionBank::findOrFail($id);

        $validated = $request->validate([
            'type' => 'required|string',
            'content' => 'required|string',
            'answers' => 'required|array',
            'points' => 'nullable|integer|min:1',
            'order' => 'nullable|integer|min:0',
            'explanation' => 'nullable|string',
            'metadata' => 'nullable|array',
        ]);

        $this->testService->addQuestionsToBank($bank, [$validated]);

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
            'type' => 'sometimes|required|string',
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
        $bank = QuestionBank::findOrFail($id);
        
        $validated = $request->validate([
            'course_id' => 'required|integer|exists:courses,id',
            'numberOfQuestions' => 'nullable|integer|min:1|max:50',
            'difficulty' => 'nullable|in:easy,medium,hard',
            'questionTypes' => 'nullable|array',
        ]);

        $course = Course::with(['modules.lessons'])->findOrFail($validated['course_id']);
        
        // Extract course content
        $courseContent = $this->extractCourseContent($course);
        
        // Generate questions using AI
        try {
            $questions = $this->generateQuestionsWithAI(
                $courseContent,
                $validated['numberOfQuestions'] ?? 10,
                $validated['difficulty'] ?? 'medium'
            );
        } catch (\Exception $e) {
            // Surface helpful error messages for devs while keeping the response safe
            Log::error('Error generating questions (endpoint)', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Eroare la generarea întrebărilor: ' . ($e->getMessage() ?: 'Problema AI'),
            ], 500);
        }

        if (empty($questions)) {
            return response()->json([
                'error' => 'Nu s-au putut genera întrebări. Te rugăm să încerci din nou.',
            ], 500);
        }

        // Add questions to bank
        $this->testService->addQuestionsToBank($bank, $questions);

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
            $questions = $this->generateQuestionsWithAI(
                $validated['content'],
                $validated['numberOfQuestions'] ?? 10,
                $validated['difficulty'] ?? 'medium'
            );
        } catch (\Exception $e) {
            Log::error('Error generating questions from text', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Eroare la generarea întrebărilor: ' . ($e->getMessage() ?: 'Problema AI'),
            ], 500);
        }

        if (empty($questions)) {
            return response()->json([
                'error' => 'Nu s-au putut genera întrebări. Te rugăm să încerci din nou.',
            ], 500);
        }

        // Add questions to bank
        $this->testService->addQuestionsToBank($bank, $questions);

        return response()->json([
            'message' => 'Questions generated successfully',
            'questions_generated' => count($questions),
            'bank' => $bank->load('questions'),
        ]);
    }

    /**
     * Extract course content for AI processing
     */
    private function extractCourseContent(Course $course): string
    {
        $content = "Curs: {$course->title}\n";
        $content .= "Descriere: {$course->description}\n\n";

        foreach ($course->modules as $module) {
            $content .= "Modul: {$module->title}\n";
            if ($module->description) {
                $content .= "Descriere modul: {$module->description}\n";
            }
            $content .= "Lecții:\n";

            foreach ($module->lessons as $lesson) {
                $content .= "- {$lesson->title}\n";
                if ($lesson->content) {
                    // Strip HTML tags and get text content
                    $textContent = strip_tags($lesson->content);
                    $textContent = preg_replace('/\s+/', ' ', $textContent);
                    $textContent = trim($textContent);
                    // Limit content length to avoid token limits
                    $textContent = mb_substr($textContent, 0, 2000);
                    $content .= "  Conținut: {$textContent}\n";
                }
            }
            $content .= "\n";
        }

        return $content;
    }

    /**
     * Generate questions using AI
     */
    private function generateQuestionsWithAI(string $courseContent, int $numberOfQuestions, string $difficulty): array
    {
        try {
            $aiController = app(AIController::class);
            
            // Build prompt for AI
            $prompt = "Generează {$numberOfQuestions} întrebări de tip multiple choice pentru un test bazat pe următorul conținut de curs.\n\n";
            $prompt .= "Dificultate: {$difficulty}\n\n";
            $prompt .= "Conținut curs:\n{$courseContent}\n\n";
            $prompt .= "Răspunde DOAR în format JSON, fără text suplimentar. Format:\n";
            $prompt .= "{\n";
            $prompt .= '  "questions": [\n';
            $prompt .= '    {\n';
            $prompt .= '      "content": "Întrebarea",\n';
            $prompt .= '      "type": "multiple_choice",\n';
            $prompt .= '      "answers": [\n';
            $prompt .= '        {"text": "Răspuns 1", "is_correct": true},\n';
            $prompt .= '        {"text": "Răspuns 2", "is_correct": false},\n';
            $prompt .= '        {"text": "Răspuns 3", "is_correct": false},\n';
            $prompt .= '        {"text": "Răspuns 4", "is_correct": false}\n';
            $prompt .= '      ],\n';
            $prompt .= '      "points": 1,\n';
            $prompt .= '      "explanation": "Explicația răspunsului corect"\n';
            $prompt .= '    }\n';
            $prompt .= '  ]\n';
            $prompt .= "}\n\n";
            $prompt .= "IMPORTANT: Generează exact {$numberOfQuestions} întrebări relevante bazate pe conținutul cursului.";

            // Use AI to generate questions
            $response = $this->callAI($prompt);
            
            // Parse AI response
            $questions = $this->parseAIResponse($response);
            
            // Format questions for database
            return $this->formatQuestionsForDatabase($questions);
            
        } catch (\Exception $e) {
            Log::error('Error generating questions with AI', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            // Rethrow so the caller (endpoint) can return a meaningful HTTP error
            throw $e;
        }
    }

    /**
     * Call AI API to generate questions (with optional fallback models)
     */
    private function callAI(string $prompt): string
    {
        // Use HTTP client to call AI API
        $provider = env('AI_PROVIDER', 'groq');
        $apiKey = $provider === 'groq' ? env('GROQ_API_KEY') : env('OPENAI_API_KEY');
        $apiUrl = $provider === 'groq'
            ? env('GROQ_API_URL', 'https://api.groq.com/openai/v1')
            : env('OPENAI_API_URL', 'https://api.openai.com/v1');
        $model = $provider === 'groq'
            ? env('GROQ_MODEL', 'llama-3.1-8b-instant')
            : env('OPENAI_MODEL', 'gpt-4o-mini');

        if (!$apiKey) {
            // If Groq is configured but missing a key, try falling back to OpenAI if available
            if ($provider === 'groq' && env('OPENAI_API_KEY')) {
                Log::info('GROQ key missing in env; falling back to OpenAI provider for this request');
                $provider = 'openai';
                $apiKey = env('OPENAI_API_KEY');
                $apiUrl = env('OPENAI_API_URL', 'https://api.openai.com/v1');
                $model = env('OPENAI_MODEL', 'gpt-4o-mini');
            } else {
                throw new \Exception('AI API key not configured for provider: ' . $provider);
            }
        }

        // Allow disabling SSL verification for local/dev via AI_VERIFY_SSL env var
        $verify = filter_var(env('AI_VERIFY_SSL', true), FILTER_VALIDATE_BOOLEAN);

        // Helper to perform a request with a specific model
        $attemptRequest = function(string $modelToUse) use ($apiUrl, $apiKey, $prompt, $verify) {
            return \Illuminate\Support\Facades\Http::withHeaders([
                'Authorization' => "Bearer {$apiKey}",
                'Content-Type' => 'application/json',
            ])->withOptions([
                'verify' => $verify,
            ])->timeout(120)->post("{$apiUrl}/chat/completions", [
                'model' => $modelToUse,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'Ești un asistent AI expert în crearea de întrebări educaționale. Generează întrebări clare, relevante și bine structurate bazate pe conținutul furnizat. Răspunde ÎNTOTDEAUNA în format JSON valid.'
                    ],
                    [
                        'role' => 'user',
                        'content' => $prompt
                    ]
                ],
                'temperature' => 0.7,
                'max_tokens' => 4000,
            ]);
        };

        // First attempt with configured model
        $response = $attemptRequest($model);

        // If initial attempt failed, try fallbacks (only for model errors)
        if (!$response->successful()) {
            $body = $response->body();
            $providerMessage = null;
            $providerCode = null;

            try {
                $json = $response->json();
                if (isset($json['error']['message'])) {
                    $providerMessage = $json['error']['message'];
                } elseif (isset($json['error'])) {
                    $providerMessage = is_string($json['error']) ? $json['error'] : json_encode($json['error']);
                }

                if (isset($json['error']['code'])) {
                    $providerCode = $json['error']['code'];
                }
            } catch (\Throwable $e) {
                // ignore JSON parsing errors
            }

            // Determine if we should try fallback models (model not found / 404 / explicit error code)
            $shouldTryFallback = ($response->status() === 404) || str_contains(strtolower($providerMessage ?? ''), 'model') || $providerCode === 'model_not_found';

            if ($shouldTryFallback) {
                $fallbackEnv = $provider === 'groq' ? env('GROQ_FALLBACK_MODELS') : env('OPENAI_FALLBACK_MODELS');
                $fallbacks = array_filter(array_map('trim', explode(',', (string)$fallbackEnv)));

                foreach ($fallbacks as $fallbackModel) {
                    if (empty($fallbackModel)) continue;
                    Log::info('Trying fallback AI model', ['provider' => $provider, 'model' => $fallbackModel]);

                    $resp2 = $attemptRequest($fallbackModel);
                    if ($resp2->successful()) {
                        $response = $resp2;
                        $model = $fallbackModel;
                        break;
                    }

                    Log::warning('Fallback model attempt failed', ['model' => $fallbackModel, 'status' => $resp2->status(), 'body' => $resp2->body()]);
                }
            }

            // If still not successful, surface provider message (if any)
            if (!$response->successful()) {
                try {
                    $json = $response->json();
                    if (isset($json['error']['message'])) {
                        $providerMessage = $json['error']['message'];
                    } elseif (isset($json['error'])) {
                        $providerMessage = is_string($json['error']) ? $json['error'] : json_encode($json['error']);
                    }
                } catch (\Throwable $e) {
                    // ignore
                }

                Log::error('AI API Error', [
                    'status' => $response->status(),
                    'error' => $response->body(),
                    'provider_message' => $providerMessage
                ]);

                $message = 'AI API error: ' . $response->status();
                if ($providerMessage) {
                    $message .= ' - ' . $providerMessage;
                }

                throw new \Exception($message);
            }
        }

        $data = $response->json();

        // Log which model succeeded for easier debugging
        try {
            Log::info('AI call successful', [
                'provider' => $provider,
                'model' => $model,
                'status' => $response->status(),
            ]);
        } catch (\Throwable $e) {
            // Ignore logging errors
        }

        return $data['choices'][0]['message']['content'] ?? '';
    }

    /**
     * Parse AI response to extract questions
     */
    private function parseAIResponse(string $response): array
    {
        // Try to extract JSON from response
        $jsonPattern = '/\{[\s\S]*\}/';
        if (preg_match($jsonPattern, $response, $matches)) {
            $data = json_decode($matches[0], true);
            if (json_last_error() === JSON_ERROR_NONE && isset($data['questions'])) {
                return $data['questions'];
            }
        }

        // Try to parse as direct JSON
        $data = json_decode($response, true);
        if (json_last_error() === JSON_ERROR_NONE && isset($data['questions'])) {
            return $data['questions'];
        }

        Log::warning('Could not parse AI response', [
            'response_preview' => substr($response, 0, 500)
        ]);

        return [];
    }

    /**
     * Format questions for database storage
     */
    private function formatQuestionsForDatabase(array $questions): array
    {
        $formatted = [];
        
        foreach ($questions as $index => $question) {
            $answers = [];
            
            // Handle different answer formats
            if (isset($question['answers']) && is_array($question['answers'])) {
                foreach ($question['answers'] as $answer) {
                    if (is_array($answer)) {
                        $answers[] = [
                            'text' => $answer['text'] ?? $answer,
                            'is_correct' => $answer['is_correct'] ?? false
                        ];
                    } else {
                        $answers[] = [
                            'text' => $answer,
                            'is_correct' => false
                        ];
                    }
                }
            }

            // Ensure at least one correct answer
            if (!empty($answers)) {
                $hasCorrect = false;
                foreach ($answers as $answer) {
                    if (($answer['is_correct'] ?? false) === true) {
                        $hasCorrect = true;
                        break;
                    }
                }
                if (!$hasCorrect) {
                    $answers[0]['is_correct'] = true;
                }
            }

            $formatted[] = [
                'type' => $question['type'] ?? 'multiple_choice',
                'content' => $question['content'] ?? $question['question'] ?? 'Întrebare generată',
                'answers' => $answers,
                'points' => $question['points'] ?? 1,
                'order' => $index,
                'explanation' => $question['explanation'] ?? null,
            ];
        }

        return $formatted;
    }
}

