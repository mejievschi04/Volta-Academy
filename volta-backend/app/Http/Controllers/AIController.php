<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Course;
use App\Models\ContentBlock;
use App\Models\Module;
use App\Models\Lesson;
use App\Models\User;
use App\Services\AIKnowledgeService;
use App\Services\CourseBuilderService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Http\UploadedFile;

class AIController extends Controller
{
    private const MIN_LESSON_LINES = 20;

    private $apiKey;
    private $apiUrl;
    private $hfApiKey;
    private $hfApiUrl;
    private $model;
    private $provider; // 'openai', 'groq', 'huggingface'
    private $courseBuilderService;
    private AIKnowledgeService $knowledgeService;
    
    // Lista de modele Groq în ordinea preferinței (fallback chain)
    private $groqModelFallbackChain = [
        'llama-3.1-8b-instant',         // Rapid și eficient
        'llama-3.3-70b-versatile',      // Înlocuitorul recomandat pentru modelele 70B vechi
    ];
    private $currentModelIndex = 0;

    public function __construct(CourseBuilderService $courseBuilderService, AIKnowledgeService $knowledgeService)
    {
        $this->courseBuilderService = $courseBuilderService;
        $this->knowledgeService = $knowledgeService;
        
        // Verifică ce provider este configurat
        $this->provider = env('AI_PROVIDER', 'groq'); // Default: Groq
        
        $this->initializeProvider($this->provider);
    }

    private function initializeProvider(string $provider): void
    {
        $normalizedProvider = strtolower(trim($provider));
        if (!in_array($normalizedProvider, ['groq', 'openai', 'huggingface'], true)) {
            $normalizedProvider = 'groq';
        }

        $this->provider = $normalizedProvider;
        $this->currentModelIndex = 0;

        switch ($normalizedProvider) {
            case 'openai':
                $this->apiKey = (string) env('OPENAI_API_KEY', '');
                $this->apiUrl = rtrim((string) env('OPENAI_API_URL', 'https://api.openai.com/v1'), '/');
                $this->model = (string) env('OPENAI_MODEL', 'gpt-4o-mini');
                $this->hfApiKey = null;
                $this->hfApiUrl = null;
                break;

            case 'huggingface':
                $this->hfApiKey = (string) env('HUGGINGFACE_API_KEY', '');
                $this->hfApiUrl = rtrim((string) env('HUGGINGFACE_API_URL', 'https://router.huggingface.co'), '/');
                $this->model = (string) env('HUGGINGFACE_MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct');
                $this->apiKey = null;
                $this->apiUrl = null;
                break;

            case 'groq':
            default:
                $this->apiKey = (string) env('GROQ_API_KEY', '');
                $this->apiUrl = rtrim((string) env('GROQ_API_URL', 'https://api.groq.com/openai/v1'), '/');
                $this->model = (string) env('GROQ_CREATOR_MODEL', env('GROQ_MODEL', 'llama-3.1-8b-instant'));
                $this->hfApiKey = null;
                $this->hfApiUrl = null;
                break;
        }
    }
    
    /**
     * Extract text from an uploaded document so Volt can use it as course source.
     */
    public function extractDocumentContext(Request $request)
    {
        if (!$this->canUseTutor()) {
            abort(403, 'Doar administratorii pot folosi Volt pentru documente.');
        }

        $validated = $request->validate([
            'file' => 'required|file|max:20480',
        ]);

        /** @var UploadedFile $file */
        $file = $validated['file'];
        $mime = (string) ($file->getMimeType() ?? '');
        $name = (string) $file->getClientOriginalName();
        $type = $this->detectDocumentType($file, $mime);
        $text = $this->extractDocumentText($file, $type, $mime);

        return response()->json([
            'file_name' => $name,
            'mime_type' => $mime ?: null,
            'type' => $type,
            'text' => $text,
            'preview' => Str::limit(trim(strip_tags($text)), 2500, ''),
        ]);
    }

    public function generateCourse(Request $request)
    {
        return $this->streamResponse($request, 'course');
    }

    public function generateTest(Request $request)
    {
        return $this->streamResponse($request, 'test');
    }

    /**
     * Build the exact message payload used by the tutor job.
     */
    private function buildTutorJobPayload(Request $request, string $prompt): array
    {
        $messages = $request->input('messages', []);
        $courseId = $request->input('courseId');
        $lessonId = $request->input('lessonId');
        $mode = (string) $request->input('mode', 'admin_tutor');
        $intent = $this->determineTutorIntent($prompt);

        $tutorContext = $this->buildTutorContext($request, $prompt);
        if ($this->shouldUseUltraShortTutorMode($prompt, $tutorContext)) {
            $mode .= ':ultra_short';
        }

        if ($intent !== 'answer') {
            $mode .= ':' . $intent;
        }

        $systemPrompt = $this->getSystemPrompt('tutor', $courseId, false, $mode);
        if ($tutorContext) {
            $systemPrompt .= "\n\nContext din baza de date (folosește-l ca sursă principală și nu spune că nu ai acces la date dacă există context):\n"
                . json_encode($tutorContext, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        $attachments = $request->input('attachments', []);
        if (is_array($attachments) && !empty($attachments)) {
            $systemPrompt .= "\n\nDocumente atașate de administrator (folosește-le ca sursă adițională pentru răspuns):\n"
                . $this->formatAttachmentContext($attachments);
        }

        return [
            'mode' => $mode,
            'messages' => $this->formatMessages($systemPrompt, $messages, $prompt),
            'context_chunks' => $tutorContext['context_chunks'] ?? [],
            'intent' => $intent,
        ];
    }

    private function canUseTutor(): bool
    {
        return auth()->check() && auth()->user()->isAdmin();
    }

    private function determineTutorIntent(string $prompt): string
    {
        $normalizedPrompt = $this->normalizeTutorText($prompt);

        $quizKeywords = ['genereaza', 'generează', 'quiz', 'test', 'intrebari', 'întrebări', 'question'];
        foreach ($quizKeywords as $keyword) {
            if (str_contains($normalizedPrompt, $this->normalizeTutorText($keyword))) {
                return 'quiz';
            }
        }

        $evaluationKeywords = ['evalueaza', 'evaluează', 'corecteaza', 'corectează', 'verifica', 'verifică', 'evaluate'];
        foreach ($evaluationKeywords as $keyword) {
            if (str_contains($normalizedPrompt, $this->normalizeTutorText($keyword))) {
                return 'evaluation';
            }
        }

        return 'answer';
    }

    private function extractLatestUserMessage(array $messages): string
    {
        for ($i = count($messages) - 1; $i >= 0; $i--) {
            $entry = $messages[$i] ?? null;
            if (!is_array($entry)) {
                continue;
            }
            if (($entry['role'] ?? null) !== 'user') {
                continue;
            }
            $content = trim((string) ($entry['content'] ?? ''));
            if ($content !== '') {
                return $content;
            }
        }

        return '';
    }

    private function shouldUseHighQualityCreatorModel(array $messages, string $mode): bool
    {
        if (!str_contains((string) $mode, 'guided_creation')) {
            return false;
        }

        $latestUserPrompt = $this->normalizeTutorText($this->extractLatestUserMessage($messages));
        if ($latestUserPrompt === '') {
            return false;
        }

        $qualityTriggers = [
            'calitate maxima',
            'calitate ridicata',
            'high quality',
            'maximum quality',
            'best quality',
            'quality first',
        ];

        foreach ($qualityTriggers as $trigger) {
            if (str_contains($latestUserPrompt, $this->normalizeTutorText($trigger))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Return the next Groq fallback model, or null if none remain.
     */
    private function getNextGroqModel(): ?string
    {
        if (empty($this->groqModelFallbackChain)) {
            return null;
        }

        if (!is_int($this->currentModelIndex) || $this->currentModelIndex < 0) {
            $this->currentModelIndex = 0;
        }

        $nextIndex = $this->currentModelIndex + 1;
        if (!array_key_exists($nextIndex, $this->groqModelFallbackChain)) {
            return null;
        }

        $this->currentModelIndex = $nextIndex;
        return $this->groqModelFallbackChain[$nextIndex];
    }

    /**
     * Detect provider throttling / quota errors so we can retry or fall back.
     */
    private function isRateLimitError(int $statusCode, string $errorBody): bool
    {
        if (in_array($statusCode, [429, 503, 529], true)) {
            return true;
        }

        $normalized = strtolower($errorBody);
        foreach (['rate limit', 'too many requests', 'quota', 'temporarily unavailable', 'slow down'] as $needle) {
            if (str_contains($normalized, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Generate guided course creation without streaming, so we can validate the final JSON before saving.
     */
    private function generateGuidedCourseCreationJson(array $messages, ?int $teacherId = null, ?int $courseId = null, string $mode = ''): array
    {
        $providerName = $this->provider === 'groq' ? 'Groq' : 'OpenAI';
        $useHighQualityCreatorModel = $this->shouldUseHighQualityCreatorModel($messages, $mode);
        $defaultTimeout = max(30, (int) env('AI_REQUEST_TIMEOUT', 180));
        $guidedTimeoutRaw = (int) env('AI_GUIDED_CREATION_TIMEOUT', 0);
        $timeout = $guidedTimeoutRaw <= 0 ? $defaultTimeout : max($defaultTimeout, $guidedTimeoutRaw);
        $connectTimeout = max(5, (int) env('AI_CONNECT_TIMEOUT', 15));
        $maxTokens = max(700, (int) env('AI_GUIDED_MAX_TOKENS', 1200));

        $effectiveModel = $this->model;
        if ($this->provider === 'groq') {
            $effectiveModel = env('GROQ_CREATOR_MODEL', $effectiveModel);
            if ($useHighQualityCreatorModel) {
                $effectiveModel = env('GROQ_CREATOR_QUALITY_MODEL', $effectiveModel);
            }
        } elseif ($this->provider === 'openai') {
            $effectiveModel = env('OPENAI_CREATOR_MODEL', $effectiveModel);
            if ($useHighQualityCreatorModel) {
                $effectiveModel = env('OPENAI_CREATOR_QUALITY_MODEL', $effectiveModel);
            }
        }

        $attemptModels = [$effectiveModel];
        if ($this->provider === 'groq') {
            while (($nextModel = $this->getNextGroqModel()) !== null) {
                if (!in_array($nextModel, $attemptModels, true)) {
                    $attemptModels[] = $nextModel;
                }
            }
        }

        $lastError = null;
        foreach ($attemptModels as $attemptIndex => $modelToUse) {
            $payload = [
                'model' => $modelToUse,
                'messages' => $messages,
                'stream' => false,
                'temperature' => 0.2,
                'max_tokens' => $maxTokens,
                'top_p' => 1,
            ];

            if ($this->provider === 'openai') {
                $payload['response_format'] = ['type' => 'json_object'];
            }

            try {
                Log::info("{$providerName} guided course JSON request", [
                    'model' => $modelToUse,
                    'attempt' => $attemptIndex + 1,
                    'messages_count' => count($messages),
                ]);

                $request = Http::withHeaders([
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer ' . $this->apiKey,
                ])
                    ->timeout($timeout)
                    ->connectTimeout($connectTimeout)
                    ->withOptions([
                        'verify' => filter_var(env('AI_VERIFY_SSL', true), FILTER_VALIDATE_BOOLEAN),
                    ])
                    ->post("{$this->apiUrl}/chat/completions", $payload);

                if (!$request->successful()) {
                    $errorBody = $request->body();
                    $statusCode = $request->status();
                    $isModelNotFound = ($statusCode === 404 && (
                        str_contains(strtolower($errorBody), 'model') &&
                        (str_contains(strtolower($errorBody), 'not found') || str_contains(strtolower($errorBody), 'does not exist') || str_contains(strtolower($errorBody), 'no access'))
                    ));
                    $isRateLimit = $this->isRateLimitError($statusCode, $errorBody);

                    if ($this->provider === 'groq' && ($isModelNotFound || $isRateLimit) && $attemptIndex < count($attemptModels) - 1) {
                        Log::warning("{$providerName} guided request retrying with fallback model", [
                            'status' => $statusCode,
                            'model' => $modelToUse,
                            'error' => substr($errorBody, 0, 300),
                        ]);
                        continue;
                    }

                    throw new \Exception("{$providerName} API error: HTTP {$statusCode}. " . substr($errorBody, 0, 200));
                }

                $content = data_get($request->json(), 'choices.0.message.content', '');
                if (!is_string($content) || trim($content) === '') {
                    throw new \Exception("{$providerName} API returned empty course content");
                }

                $courseData = $this->extractFirstJsonObjectFromText($content);
                if (!$courseData) {
                    $fallbackText = trim($content);
                    $clarificationQuestion = $fallbackText !== ''
                        ? Str::limit($fallbackText, 300, '')
                        : 'Am nevoie de o singură clarificare ca să continui cu cursul.';

                    Log::warning("{$providerName} guided course response was not JSON; returning clarification fallback", [
                        'model' => $modelToUse,
                        'response_preview' => substr($fallbackText, 0, 500),
                    ]);

                    return [
                        'response_type' => 'clarification',
                        'clarification_question' => $clarificationQuestion,
                        'content' => $clarificationQuestion,
                    ];
                }

                $responseType = strtolower(trim((string) ($courseData['response_type'] ?? $courseData['type'] ?? '')));
                if ($responseType === 'clarification') {
                    $clarificationQuestion = trim((string) ($courseData['clarification_question'] ?? $courseData['question'] ?? $courseData['message'] ?? ''));
                    if ($clarificationQuestion === '') {
                        $clarificationQuestion = 'Am nevoie de o singură clarificare ca să continui cu cursul.';
                    }

                    return [
                        'response_type' => 'clarification',
                        'clarification_question' => $clarificationQuestion,
                        'content' => $clarificationQuestion,
                    ];
                }

                if ($responseType !== 'course') {
                    $clarificationQuestion = trim((string) ($courseData['clarification_question'] ?? $courseData['question'] ?? $courseData['message'] ?? ''));
                    if ($clarificationQuestion === '') {
                        $clarificationQuestion = 'Am nevoie de o singură clarificare ca să continui cu cursul.';
                    }

                    return [
                        'response_type' => 'clarification',
                        'clarification_question' => $clarificationQuestion,
                        'content' => $clarificationQuestion,
                    ];
                }

                $validated = $this->validateAndNormalizeCourseData($courseData);
                if (!$validated) {
                    throw new \Exception('Volt course JSON did not pass validation');
                }

                $validated['response_type'] = 'course';
                $validatedJson = json_encode($validated, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $createdCourse = $this->createOrUpdateCourseFromResponse($validatedJson, $teacherId, $courseId);
                if (!$createdCourse) {
                    throw new \Exception('Course could not be created from Volt response');
                }

                $isUpdate = $courseId !== null;
                return [
                    'response_type' => 'course',
                    'content' => "\n\n✅ Cursul a fost " . ($isUpdate ? 'actualizat' : 'creat') . " automat în background!\n\n📚 ID: {$createdCourse->id}\n📝 Titlu: {$createdCourse->title}\n📦 Module: " . $createdCourse->modules()->count() . "\n📄 Lecții: " . $createdCourse->lessons()->count() . "\n\nPoți continua conversația sau să îmi spui dacă vrei să modific ceva.",
                    'course_id' => $createdCourse->id,
                    'course_created' => !$isUpdate,
                    'course_updated' => $isUpdate,
                ];
            } catch (\Throwable $e) {
                $lastError = $e;
                Log::warning("{$providerName} guided course JSON attempt failed", [
                    'attempt' => $attemptIndex + 1,
                    'model' => $modelToUse,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        throw $lastError ?: new \Exception('Volt course generation failed');
    }

    private function shouldUseUltraShortTutorMode(string $prompt, array $tutorContext): bool
    {
        $normalizedPrompt = $this->normalizeTutorText($prompt);
        $wordCount = count(array_filter(preg_split('/\s+/u', $normalizedPrompt) ?: []));

        if (($tutorContext['query_type'] ?? '') === 'catalog') {
            return true;
        }

        if ($wordCount <= 8) {
            return true;
        }

        if ($wordCount <= 12 && empty($tutorContext['matched_lesson']) && empty($tutorContext['matched_course'])) {
            return true;
        }

        return false;
    }

    private function detectDocumentType(UploadedFile $file, string $mime): string
    {
        $name = strtolower((string) $file->getClientOriginalName());

        if (str_ends_with($name, '.docx') || str_contains($mime, 'officedocument.wordprocessingml')) {
            return 'docx';
        }

        if (str_ends_with($name, '.doc') || str_contains($mime, 'msword')) {
            return 'doc';
        }

        if (str_ends_with($name, '.pdf') || $mime === 'application/pdf') {
            return 'pdf';
        }

        if (str_ends_with($name, '.txt') || str_starts_with($mime, 'text/')) {
            return 'txt';
        }

        return 'file';
    }

    private function extractDocumentText(UploadedFile $file, string $type, string $mime): string
    {
        return match ($type) {
            'txt' => (string) @file_get_contents($file->getRealPath()) ?: '',
            'docx' => $this->extractDocxText($file->getRealPath()),
            'pdf' => $this->extractPdfTextBestEffort($file->getRealPath()),
            default => '',
        };
    }

    private function extractDocxText(string $path): string
    {
        if (!class_exists(\ZipArchive::class) || !is_file($path)) {
            return '';
        }

        $zip = new \ZipArchive();
        if ($zip->open($path) !== true) {
            return '';
        }

        $xml = $zip->getFromName('word/document.xml');
        $zip->close();
        if (!$xml) {
            return '';
        }

        $xml = str_replace(['</w:p>', '</w:tr>', '<w:br/>', '<w:br />', '<w:tab/>'], ["\n", "\n", "\n", "\n", "\t"], $xml);
        $text = strip_tags($xml);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_XML1, 'UTF-8');

        return trim(preg_replace("/\n{3,}/", "\n\n", $text) ?? '');
    }

    private function extractPdfTextBestEffort(string $path): string
    {
        if (!is_file($path)) {
            return '';
        }

        $escaped = escapeshellarg($path);
        $tmpOutput = tempnam(sys_get_temp_dir(), 'volt_pdf_');
        if ($tmpOutput === false) {
            return '';
        }

        $command = sprintf('pdftotext -layout %s %s 2>&1', $escaped, escapeshellarg($tmpOutput));
        $result = @shell_exec($command);
        $text = '';
        if (is_string($result) && trim($result) === '') {
            $text = (string) @file_get_contents($tmpOutput);
        }

        @unlink($tmpOutput);

        if (trim($text) !== '') {
            return trim($text);
        }

        $raw = (string) @file_get_contents($path);
        if ($raw === '') {
            return '';
        }

        $fallback = preg_replace('/[^\P{C}\n\t]+/u', ' ', $raw) ?? '';
        $fallback = preg_replace('/\s{2,}/u', ' ', $fallback) ?? '';

        return trim($fallback);
    }

    private function formatAttachmentContext(array $attachments): string
    {
        $blocks = [];
        foreach (array_slice($attachments, 0, 5) as $index => $attachment) {
            if (!is_array($attachment)) {
                continue;
            }

            $name = (string) ($attachment['file_name'] ?? $attachment['name'] ?? ('Document ' . ($index + 1)));
            $type = (string) ($attachment['type'] ?? $attachment['mime_type'] ?? 'document');
            $preview = (string) ($attachment['preview'] ?? $attachment['text'] ?? '');
            if ($preview === '') {
                continue;
            }

            $cleanPreview = trim(strip_tags($preview));
            $cleanPreview = Str::limit($cleanPreview, 6000, '');
            if ($cleanPreview === '') {
                continue;
            }

            $blocks[] = "Fișier: {$name}\nTip: {$type}\nConținut:\n{$cleanPreview}";
        }

        return $blocks ? implode("\n\n---\n\n", $blocks) : '(fără conținut text extras)';
    }

    /**
     * Build database-backed context for the admin tutor.
     */
    private function buildTutorContext(Request $request, string $prompt): array
    {
        $user = $request->user();
        $canSeeDrafts = $user && in_array($user->role ?? '', ['admin', 'instructor'], true);
        $catalog = $this->getTutorCourseCatalog($canSeeDrafts);
        $isCatalogQuestion = $this->isCatalogQuestion($prompt);
        $matchedCourse = null;
        $matchedLesson = null;
        $lessonIndex = [];

        $courseId = $request->input('courseId') ?: $request->input('course_id');
        $lessonId = $request->input('lessonId') ?: $request->input('lesson_id');

        if ($courseId) {
            $matchedCourse = collect($catalog['courses'])->firstWhere('id', (int) $courseId);
        }

        if (!$matchedCourse) {
            $matchedCourse = $this->findCourseFromPrompt($prompt, $catalog['courses']);
        }

        if ($lessonId) {
            $matchedLesson = $this->getTutorLessonSummaryById((int) $lessonId, $canSeeDrafts);
        }

        $knowledgeChunks = [];
        if (!$isCatalogQuestion) {
            try {
                $knowledgeChunks = $this->knowledgeService->getRankedChunksForTutor(
                    $prompt,
                    $matchedCourse['id'] ?? null,
                    $matchedLesson['lesson_id'] ?? ($matchedLesson['id'] ?? null),
                    $canSeeDrafts,
                    5
                );
            } catch (\Throwable $e) {
                Log::warning('Tutor knowledge lookup failed, falling back to legacy context', [
                    'error' => $e->getMessage(),
                ]);
                $knowledgeChunks = [];
            }
        }

        if (empty($knowledgeChunks) && (!$matchedCourse || !$matchedLesson)) {
            $lessonIndex = $this->getTutorLessonIndex($canSeeDrafts);

            if (!$matchedCourse || !$matchedLesson) {
                $contentMatch = $this->findCourseAndLessonFromContent($prompt, $lessonIndex);

                if (!$matchedCourse && !empty($contentMatch['course_id'])) {
                    $matchedCourse = collect($catalog['courses'])->firstWhere('id', (int) $contentMatch['course_id']);
                }

                if (!$matchedLesson && !empty($contentMatch['lesson_id'])) {
                    $matchedLesson = $this->findLessonIndexById($lessonIndex, (int) $contentMatch['lesson_id']);
                }
            }
            if (!$matchedLesson && $matchedCourse) {
                $matchedLesson = $this->findLessonFromCourseContent($matchedCourse, $prompt, $lessonIndex);
            }
        }

        $relevantCourses = $this->getRelevantTutorCourses(
            $prompt,
            $catalog['courses'],
            $isCatalogQuestion ? 12 : 5
        );

        $contextChunks = $isCatalogQuestion
            ? $this->buildTutorContextChunks($catalog['courses'], $lessonIndex, $matchedCourse, $matchedLesson, $isCatalogQuestion, $prompt)
            : (!empty($knowledgeChunks)
                ? $knowledgeChunks
                : $this->buildTutorContextChunks($catalog['courses'], $lessonIndex, $matchedCourse, $matchedLesson, $isCatalogQuestion, $prompt));

        // Keep tutor context compact so model answers faster and stays focused.
        $contextChunks = array_values(array_map(function (array $chunk) {
            if (isset($chunk['text'])) {
                $chunk['text'] = mb_substr((string) $chunk['text'], 0, 480);
            }
            return $chunk;
        }, array_slice($contextChunks, 0, 5)));

        $context = [
            'catalog_summary' => $catalog['summary'],
            'query_type' => $isCatalogQuestion ? 'catalog' : 'specific',
            'relevant_courses' => $relevantCourses,
            'matched_course' => $matchedCourse,
            'matched_lesson' => $matchedLesson,
            'context_chunks' => $contextChunks,
        ];

        if ($isCatalogQuestion) {
            $context['catalog_titles'] = collect($catalog['courses'])
                ->map(function (array $course) {
                    return [
                        'id' => $course['id'],
                        'title' => $course['title'],
                        'level' => $course['level'] ?? null,
                        'status' => $course['status'] ?? null,
                    ];
                })
                ->values()
                ->all();
        }

        return $context;
    }

    private function getTutorCourseCatalog(bool $canSeeDrafts): array
    {
        $cacheKey = 'tutor_course_catalog:' . ($canSeeDrafts ? 'all' : 'published');

        return Cache::remember($cacheKey, 600, function () use ($canSeeDrafts) {
            $query = Course::query()
                ->select('id', 'title', 'description', 'level', 'status')
                ->withCount(['modules', 'lessons'])
                ->orderBy('title');

            if (!$canSeeDrafts && Schema::hasColumn('courses', 'status')) {
                $query->where('status', 'published');
            }

            $courses = $query->get();

            return [
                'summary' => [
                    'total_courses' => $courses->count(),
                    'published_courses' => $courses->where('status', 'published')->count(),
                ],
                'courses' => $courses->map(function ($course) {
                    return $this->formatTutorCatalogCourse($course);
                })->values()->all(),
            ];
        });
    }

    private function formatTutorCatalogCourse(Course $course): array
    {
        return [
            'id' => $course->id,
            'title' => $course->title,
            'level' => $course->level,
            'status' => $course->status,
            'description' => mb_substr((string) ($course->description ?? ''), 0, 220),
            'module_count' => (int) ($course->modules_count ?? 0),
            'lesson_count' => (int) ($course->lessons_count ?? 0),
            'module_titles' => [],
            'lesson_titles' => [],
            'standalone_lesson_titles' => [],
        ];
    }

    private function getTutorLessonIndex(bool $canSeeDrafts): array
    {
        $cacheKey = 'tutor_lesson_index:' . ($canSeeDrafts ? 'all' : 'published');

        return Cache::remember($cacheKey, 600, function () use ($canSeeDrafts) {
            $query = Lesson::query()
                ->select('id', 'course_id', 'module_id', 'title', 'content', 'order')
                ->with([
                    'course' => function ($q) {
                        $q->select('id', 'title', 'description', 'level', 'status');
                    },
                    'module' => function ($q) {
                        $q->select('id', 'course_id', 'title', 'order');
                    },
                    'contentBlocks' => function ($q) {
                        $q->select('id', 'lesson_id', 'type', 'source', 'payload', 'order', 'visible')
                            ->orderBy('order');
                    },
                ]);

            if (!$canSeeDrafts && Schema::hasColumn('courses', 'status')) {
                $query->whereHas('course', function ($q) {
                    $q->where('status', 'published');
                });
            }

            $lessons = $query->get();

            return $lessons->map(function (Lesson $lesson) {
                return [
                    'lesson_id' => $lesson->id,
                    'course_id' => $lesson->course_id,
                    'module_id' => $lesson->module_id,
                    'course_title' => (string) ($lesson->course->title ?? ''),
                    'course_description' => mb_substr((string) ($lesson->course->description ?? ''), 0, 220),
                    'course_level' => $lesson->course->level ?? null,
                    'course_status' => $lesson->course->status ?? null,
                    'module_title' => (string) ($lesson->module->title ?? ''),
                    'lesson_title' => (string) ($lesson->title ?? ''),
                    'lesson_order' => $lesson->order,
                    'lesson_updated_at' => $lesson->updated_at?->toIso8601String(),
                    'lesson_content' => mb_substr((string) ($lesson->content ?? ''), 0, 1400),
                    'lesson_blocks' => $this->extractTutorLessonBlockText($lesson->contentBlocks ?? collect()),
                ];
            })->values()->all();
        });
    }

    private function getTutorLessonSummaryById(int $lessonId, bool $canSeeDrafts): ?array
    {
        $query = Lesson::query()
            ->select('id', 'course_id', 'module_id', 'title', 'content', 'order')
            ->with([
                'course' => function ($q) {
                    $q->select('id', 'title', 'description', 'level', 'status');
                },
                'module' => function ($q) {
                    $q->select('id', 'course_id', 'title', 'order');
                },
                'contentBlocks' => function ($q) {
                    $q->select('id', 'lesson_id', 'type', 'source', 'payload', 'order', 'visible')
                        ->orderBy('order');
                },
            ]);

        if (!$canSeeDrafts && Schema::hasColumn('courses', 'status')) {
            $query->whereHas('course', function ($courseQuery) {
                $courseQuery->where('status', 'published');
            });
        }

        $lesson = $query->find($lessonId);
        if (!$lesson) {
            return null;
        }

        return [
            'lesson_id' => $lesson->id,
            'course_id' => $lesson->course_id,
            'module_id' => $lesson->module_id,
            'course_title' => (string) ($lesson->course->title ?? ''),
            'course_description' => mb_substr((string) ($lesson->course->description ?? ''), 0, 220),
            'course_level' => $lesson->course->level ?? null,
            'course_status' => $lesson->course->status ?? null,
            'module_title' => (string) ($lesson->module->title ?? ''),
            'lesson_title' => (string) ($lesson->title ?? ''),
            'lesson_order' => $lesson->order,
            'lesson_updated_at' => $lesson->updated_at?->toIso8601String(),
            'lesson_content' => mb_substr((string) ($lesson->content ?? ''), 0, 1400),
            'lesson_blocks' => $this->extractTutorLessonBlockText($lesson->contentBlocks ?? collect()),
        ];
    }

    private function buildTutorContextChunks(array $catalogCourses, array $lessonIndex, ?array $matchedCourse, ?array $matchedLesson, bool $isCatalogQuestion, string $prompt): array
    {
        $courseFilter = $matchedCourse ? (int) ($matchedCourse['id'] ?? 0) : null;
        $lessonFilter = $matchedLesson ? (int) ($matchedLesson['id'] ?? 0) : null;
        $candidateChunks = [];

        if ($isCatalogQuestion) {
            foreach ($catalogCourses as $course) {
                $text = trim(implode(' ', array_filter([
                    (string) ($course['title'] ?? ''),
                    (string) ($course['description'] ?? ''),
                    'Level: ' . (string) ($course['level'] ?? ''),
                    'Lessons: ' . (string) ($course['lesson_count'] ?? 0),
                    'Modules: ' . (string) ($course['module_count'] ?? 0),
                ])));

                if ($text === '') {
                    continue;
                }

                $candidateChunks[] = [
                    'id' => 'catalog:' . ($course['id'] ?? 0),
                    'text' => $text,
                    'lesson_id' => null,
                    'course_id' => (int) ($course['id'] ?? 0),
                    'module_id' => null,
                    'score' => 0.9,
                    'source' => 'catalog',
                ];
            }

            return array_slice($this->deduplicateTutorChunks($candidateChunks), 0, 8);
        }

        $lessonsPool = $this->shortlistTutorLessonsForPrompt(
            $lessonIndex,
            $prompt,
            $courseFilter,
            $courseFilter ? 90 : 40
        );

        foreach ($lessonsPool as $lesson) {
            if ($courseFilter && (int) ($lesson['course_id'] ?? 0) !== $courseFilter) {
                continue;
            }

            $lessonChunks = $this->splitTutorTextIntoChunks(
                $this->buildTutorLessonChunkText($lesson),
                700,
                80
            );

            foreach ($lessonChunks as $index => $chunkText) {
                $chunkText = trim($chunkText);
                if (mb_strlen($chunkText) < 100) {
                    continue;
                }

                $similarity = $this->scoreTutorChunkSimilarity($prompt, $chunkText);
                $recency = $this->scoreTutorChunkRecency((string) ($lesson['lesson_updated_at'] ?? null));
                $lessonMatch = 0.0;

                if ($lessonFilter && (int) ($lesson['lesson_id'] ?? 0) === $lessonFilter) {
                    $lessonMatch = 1.0;
                } elseif ($courseFilter && (int) ($lesson['course_id'] ?? 0) === $courseFilter) {
                    $lessonMatch = 0.7;
                }

                $finalScore = round(($similarity * 0.7) + ($recency * 0.1) + ($lessonMatch * 0.2), 4);
                if ($finalScore < 0.15) {
                    continue;
                }

                $candidateChunks[] = [
                    'id' => (int) ($lesson['lesson_id'] ?? 0) . ':' . $index,
                    'text' => $chunkText,
                    'lesson_id' => (int) ($lesson['lesson_id'] ?? 0),
                    'course_id' => (int) ($lesson['course_id'] ?? 0),
                    'module_id' => (int) ($lesson['module_id'] ?? 0),
                    'score' => $finalScore,
                    'source' => 'lesson_chunk',
                ];
            }
        }

        $candidateChunks = $this->deduplicateTutorChunks($candidateChunks);

        usort($candidateChunks, function (array $left, array $right) {
            return $right['score'] <=> $left['score'];
        });

        return array_slice($candidateChunks, 0, 5);
    }

    private function shortlistTutorLessonsForPrompt(array $lessonIndex, string $prompt, ?int $courseFilter, int $limit = 40): array
    {
        if (empty($lessonIndex)) {
            return [];
        }

        if ($courseFilter) {
            return array_slice(array_values(array_filter($lessonIndex, function (array $lesson) use ($courseFilter) {
                return (int) ($lesson['course_id'] ?? 0) === (int) $courseFilter;
            })), 0, max(10, $limit));
        }

        $normalizedPrompt = $this->normalizeTutorText($prompt);
        if ($normalizedPrompt === '') {
            return array_slice($lessonIndex, 0, max(10, $limit));
        }

        $scored = [];
        foreach ($lessonIndex as $lesson) {
            $title = $this->normalizeTutorText((string) ($lesson['lesson_title'] ?? ''));
            $module = $this->normalizeTutorText((string) ($lesson['module_title'] ?? ''));
            $course = $this->normalizeTutorText((string) ($lesson['course_title'] ?? ''));
            $score = 0;

            if ($title !== '' && str_contains($normalizedPrompt, $title)) {
                $score += 9;
            }
            if ($module !== '' && str_contains($normalizedPrompt, $module)) {
                $score += 5;
            }
            if ($course !== '' && str_contains($normalizedPrompt, $course)) {
                $score += 6;
            }

            $scored[] = [
                'score' => $score,
                'lesson' => $lesson,
            ];
        }

        usort($scored, fn (array $a, array $b) => $b['score'] <=> $a['score']);
        $shortlisted = array_slice($scored, 0, max(10, $limit));

        return array_values(array_map(fn (array $entry) => $entry['lesson'], $shortlisted));
    }

    private function buildTutorLessonChunkText(array $lesson): string
    {
        $parts = array_filter([
            'Course: ' . (string) ($lesson['course_title'] ?? ''),
            'Module: ' . (string) ($lesson['module_title'] ?? ''),
            'Lesson: ' . (string) ($lesson['lesson_title'] ?? ''),
            (string) ($lesson['course_description'] ?? ''),
            (string) ($lesson['lesson_content'] ?? ''),
            (string) ($lesson['lesson_blocks'] ?? ''),
        ]);

        return trim(implode("\n", $parts));
    }

    private function splitTutorTextIntoChunks(string $text, int $chunkSize = 700, int $overlap = 80): array
    {
        $text = trim(preg_replace('/\s+/u', ' ', strip_tags($text)) ?? $text);
        if ($text === '') {
            return [];
        }

        $length = mb_strlen($text);
        if ($length <= $chunkSize) {
            return [$text];
        }

        $chunks = [];
        $step = max(1, $chunkSize - $overlap);
        for ($i = 0; $i < $length; $i += $step) {
            $chunk = trim(mb_substr($text, $i, $chunkSize));
            if ($chunk !== '') {
                $chunks[] = $chunk;
            }
            if ($i + $chunkSize >= $length) {
                break;
            }
        }

        return $chunks;
    }

    private function scoreTutorChunkSimilarity(string $prompt, string $chunkText): float
    {
        $promptTokens = $this->extractTutorSearchTokens($prompt);
        $chunkTokens = $this->extractTutorSearchTokens($chunkText);

        if (empty($promptTokens) || empty($chunkTokens)) {
            return 0.0;
        }

        $promptSet = array_flip($promptTokens);
        $matches = 0;
        foreach ($chunkTokens as $token) {
            if (isset($promptSet[$token])) {
                $matches++;
            }
        }

        $denominator = max(1, min(count($promptTokens), count($chunkTokens)));
        return min(1.0, $matches / $denominator);
    }

    private function scoreTutorChunkRecency(?string $updatedAt): float
    {
        if (!$updatedAt) {
            return 0.5;
        }

        try {
            $timestamp = strtotime($updatedAt);
            if ($timestamp === false) {
                return 0.5;
            }

            $days = max(0, (time() - $timestamp) / 86400);
            return max(0.0, 1.0 - min(1.0, $days / 365));
        } catch (\Throwable $e) {
            return 0.5;
        }
    }

    private function deduplicateTutorChunks(array $chunks): array
    {
        $seen = [];
        $deduped = [];

        foreach ($chunks as $chunk) {
            $hash = md5($chunk['text'] ?? '');
            if (isset($seen[$hash])) {
                continue;
            }

            $seen[$hash] = true;
            $deduped[] = $chunk;
        }

        return $deduped;
    }

    public function validateTutorAnswerAgainstChunks(string $aiAnswer, array $chunks): bool
    {
        $answer = $this->normalizeTutorText($aiAnswer);
        if ($answer === '') {
            return false;
        }

        if (empty($chunks)) {
            return false;
        }

        foreach ($chunks as $chunk) {
            $chunkText = $this->normalizeTutorText((string) ($chunk['text'] ?? ''));
            if ($chunkText === '') {
                continue;
            }

            $snippet = mb_substr($chunkText, 0, 50);
            if ($snippet !== '' && str_contains($answer, $snippet)) {
                return true;
            }

            $chunkTokens = array_values(array_filter(preg_split('/\s+/u', $chunkText) ?: []));
            $matches = 0;
            foreach (array_slice($chunkTokens, 0, 10) as $token) {
                if (mb_strlen($token) < 4) {
                    continue;
                }
                if (str_contains($answer, $token)) {
                    $matches++;
                }
            }

            if ($matches >= 3) {
                return true;
            }
        }

        return false;
    }

    private function findCourseFromPrompt(string $prompt, $availableCourses): ?array
    {
        $normalizedPrompt = $this->normalizeTutorText($prompt);
        $bestCourseId = null;
        $bestScore = 0;

        foreach ($availableCourses as $course) {
            $title = $this->normalizeTutorText((string) ($course['title'] ?? ''));
            if ($title === '') {
                continue;
            }

            if (str_contains($normalizedPrompt, $title)) {
                return $course;
            }

            $score = $this->scoreTutorCourseMatch($normalizedPrompt, $course);

            if ($score > $bestScore && $score >= 3) {
                $bestScore = $score;
                $bestCourseId = (int) $course['id'];
            }
        }

        if (!$bestCourseId) {
            return null;
        }

        return collect($availableCourses)->firstWhere('id', $bestCourseId);
    }

    private function findLessonIndexById(array $lessonIndex, int $lessonId): ?array
    {
        foreach ($lessonIndex as $lesson) {
            if ((int) ($lesson['lesson_id'] ?? 0) === $lessonId) {
                return $lesson;
            }
        }

        return null;
    }

    private function normalizeTutorText(string $value): string
    {
        $value = mb_strtolower(trim($value));
        $value = Str::ascii($value);
        $value = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $value) ?? $value;
        return trim(preg_replace('/\s+/u', ' ', $value) ?? $value);
    }

    private function scoreTutorCourseMatch(string $prompt, array $course): int
    {
        $score = 0;
        $fields = [
            'title' => 6,
            'description' => 3,
            'module_titles' => 2,
            'lesson_titles' => 2,
            'standalone_lesson_titles' => 2,
        ];

        foreach ($fields as $field => $weight) {
            $value = $course[$field] ?? '';
            $values = is_array($value) ? $value : [$value];
            foreach ($values as $entry) {
                $normalized = $this->normalizeTutorText((string) $entry);
                if ($normalized === '') {
                    continue;
                }

                if (str_contains($prompt, $normalized)) {
                    $score += $weight * 2;
                    continue;
                }

                $tokens = array_values(array_filter(preg_split('/\s+/u', $normalized) ?: []));
                $matches = 0;
                foreach ($tokens as $token) {
                    if (mb_strlen($token) < 3) {
                        continue;
                    }
                    if (str_contains($prompt, $token)) {
                        $matches++;
                    }
                }

                if ($matches > 0) {
                    $score += min($weight * 2, $matches * $weight);
                }
            }
        }

        $title = $this->normalizeTutorText((string) ($course['title'] ?? ''));
        $description = $this->normalizeTutorText((string) ($course['description'] ?? ''));
        if ($title !== '' && str_contains($prompt, $title)) {
            $score += 8;
        }
        if ($description !== '') {
            foreach (array_slice(array_filter(preg_split('/\s+/u', $description) ?: []), 0, 12) as $token) {
                if (mb_strlen($token) >= 4 && str_contains($prompt, $token)) {
                    $score += 1;
                }
            }
        }

        return $score;
    }

    private function getRelevantTutorCourses(string $prompt, array $courses, int $limit = 5): array
    {
        $scoredCourses = [];
        foreach ($courses as $course) {
            $score = $this->scoreTutorCourseMatch($prompt, $course);
            if ($score <= 0) {
                continue;
            }

            $scoredCourses[] = [
                'score' => $score,
                'course' => $course,
            ];
        }

        usort($scoredCourses, function (array $left, array $right) {
            return $right['score'] <=> $left['score'];
        });

        return array_values(array_map(
            fn (array $entry) => $entry['course'],
            array_slice($scoredCourses, 0, max(1, $limit))
        ));
    }

    private function findCourseAndLessonFromContent(string $prompt, array $lessonIndex): array
    {
        $tokens = $this->extractTutorSearchTokens($prompt);
        if (empty($tokens)) {
            return ['course_id' => null, 'lesson_id' => null];
        }

        $bestLesson = null;
        $bestScore = 0;

        foreach ($lessonIndex as $lesson) {
            $score = $this->scoreTutorLessonMatch($prompt, [
                'title' => (string) ($lesson['lesson_title'] ?? ''),
                'content' => (string) ($lesson['lesson_content'] ?? ''),
                'blocks' => (string) ($lesson['lesson_blocks'] ?? ''),
                'module_title' => (string) ($lesson['module_title'] ?? ''),
                'course_title' => (string) ($lesson['course_title'] ?? ''),
            ]);

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestLesson = $lesson;
            }
        }

        if (!$bestLesson) {
            return ['course_id' => null, 'lesson_id' => null];
        }

        return [
            'course_id' => (int) ($bestLesson['course_id'] ?? 0),
            'lesson_id' => (int) ($bestLesson['lesson_id'] ?? 0),
        ];
    }

    private function findLessonFromCourseContent(array $course, string $prompt, array $lessonIndex): ?array
    {
        $normalizedPrompt = $this->normalizeTutorText($prompt);
        $bestLesson = null;
        $bestScore = 0;

        foreach ($lessonIndex as $lesson) {
            if ((int) ($lesson['course_id'] ?? 0) !== (int) ($course['id'] ?? 0)) {
                continue;
            }

            $score = $this->scoreTutorLessonMatch($normalizedPrompt, [
                'title' => (string) ($lesson['lesson_title'] ?? ''),
                'content' => (string) ($lesson['lesson_content'] ?? ''),
                'blocks' => (string) ($lesson['lesson_blocks'] ?? ''),
                'module_title' => (string) ($lesson['module_title'] ?? ''),
                'course_title' => (string) ($lesson['course_title'] ?? ''),
            ]);

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestLesson = $lesson;
            }
        }

        return $bestLesson;
    }

    private function isCatalogQuestion(string $prompt): bool
    {
        $prompt = $this->normalizeTutorText($prompt);

        $keywords = [
            'ce cursuri',
            'care cursuri',
            'cursuri disponibile',
            'lista cursuri',
            'catalog cursuri',
            'ce exista',
            'ce ai',
            'ce pot studia',
            'ce se poate studia',
            'what courses',
            'available courses',
            'course catalog',
        ];

        foreach ($keywords as $keyword) {
            if (str_contains($prompt, $this->normalizeTutorText($keyword))) {
                return true;
            }
        }

        return false;
    }

    private function scoreTutorLessonMatch(string $prompt, array $lesson): int
    {
        $score = 0;
        $fields = [
            'title' => 6,
            'module_title' => 3,
            'course_title' => 3,
            'content' => 5,
            'blocks' => 4,
        ];

        foreach ($fields as $field => $weight) {
            $value = $lesson[$field] ?? '';
            $normalized = $this->normalizeTutorText(strip_tags((string) $value));
            if ($normalized === '') {
                continue;
            }

            if (str_contains($prompt, $normalized)) {
                $score += $weight * 2;
                continue;
            }

            $tokens = array_values(array_filter(preg_split('/\s+/u', $normalized) ?: []));
            $matches = 0;
            foreach ($tokens as $token) {
                if (mb_strlen($token) < 4) {
                    continue;
                }
                if (str_contains($prompt, $token)) {
                    $matches++;
                }
            }

            if ($matches > 0) {
                $score += min($weight * 2, $matches * $weight);
            }
        }

        return $score;
    }

    private function extractTutorSearchTokens(string $prompt): array
    {
        $normalized = $this->normalizeTutorText($prompt);
        $parts = array_values(array_filter(preg_split('/\s+/u', $normalized) ?: []));
        $stopWords = [
            'si', 'sau', 'dar', 'despre', 'care', 'este', 'sunt', 'cum', 'unde', 'cand',
            'what', 'which', 'the', 'and', 'for', 'with', 'course', 'curs', 'cursuri',
            'lecția', 'lectia', 'lecții', 'lectii', 'platforma', 'platformei'
        ];

        $tokens = [];
        foreach ($parts as $part) {
            if (mb_strlen($part) < 4) {
                continue;
            }

            if (in_array($part, $stopWords, true)) {
                continue;
            }

            $tokens[] = $part;
        }

        return array_values(array_unique(array_slice($tokens, 0, 8)));
    }

    private function extractTutorLessonBlockText($blocks): string
    {
        if (empty($blocks)) {
            return '';
        }

        $parts = [];
        foreach ($blocks as $block) {
            if (!$block instanceof ContentBlock) {
                continue;
            }

            if (!$block->visible && $block->visible !== null) {
                continue;
            }

            $parts[] = (string) ($block->source ?? '');

            $payload = $block->payload;
            if (is_array($payload) || is_object($payload)) {
                $parts[] = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';
            } elseif (is_string($payload)) {
                $parts[] = $payload;
            }
        }

        $text = trim(implode(' ', array_filter($parts)));
        return mb_substr($text, 0, 1800);
    }

    private function escapeTutorLike(string $value): string
    {
        return addcslashes($value, '%_\\');
    }

    private function formatTutorCourse(Course $course): array
    {
        return [
            'id' => $course->id,
            'title' => $course->title,
            'description' => $course->description,
            'level' => $course->level,
            'status' => $course->status,
            'teacher' => $course->teacher ? [
                'id' => $course->teacher->id ?? null,
                'name' => $course->teacher->name ?? null,
            ] : null,
            'module_count' => count($course->modules ?? []),
            'lesson_count' => count($course->lessons ?? []),
        ];
    }

    private function formatTutorLesson(Lesson $lesson): array
    {
        return [
            'id' => $lesson->id,
            'title' => $lesson->title,
            'type' => $lesson->type,
            'order' => $lesson->order,
            'course_id' => $lesson->course_id,
            'module_id' => $lesson->module_id,
            'updated_at' => $lesson->updated_at?->toIso8601String(),
        ];
    }

    private function streamResponse(Request $request, $type)
    {
        if (!$this->apiKey) {
            $providerName = ucfirst($this->provider);
            if ($this->provider === 'groq') {
                $providerName = 'Groq';
            }
            return response()->json([
                'error' => $providerName . ' API key not configured'
            ], 500);
        }

        $prompt = $request->input('prompt');
        $messages = $request->input('messages', []);
        $courseId = $request->input('courseId');
        $teacherId = $request->input('teacher_id') ?? Auth::id();

        if (!$prompt) {
            return response()->json([
                'error' => 'Prompt is required'
            ], 400);
        }

        // Verifică dacă utilizatorul vrea să clarifice ceva sau să modifice
        $isClarification = $this->isClarificationRequest($prompt, $messages);
        
        Log::info('Volt generation request', [
            'type' => $type,
            'prompt' => substr($prompt, 0, 100),
            'has_messages' => count($messages) > 0,
            'is_clarification' => $isClarification,
            'teacher_id' => $teacherId
        ]);

        // Verifică dacă este o cerere de clarificare
        $isClarification = $this->isClarificationRequest($prompt, $messages);
        $teacherId = $request->input('teacher_id') ?? Auth::id();

        $mode = (string) $request->input('mode', $type === 'tutor' ? 'admin_tutor' : '');
        $tutorContext = null;
        if ($type === 'tutor' || str_starts_with($mode, 'admin_tutor') || str_starts_with($mode, 'student_tutor')) {
            $tutorContext = $this->buildTutorContext($request, $prompt);
            if ($type === 'tutor') {
                if ($this->shouldUseUltraShortTutorMode($prompt, $tutorContext) && !str_contains($mode, ':ultra_short')) {
                    $mode .= ':ultra_short';
                }

                $intent = $this->determineTutorIntent($prompt);
                if ($intent !== 'answer' && !str_contains($mode, ':' . $intent)) {
                    $mode .= ':' . $intent;
                }
            }
        }

        // Construiește prompt-ul pentru generare (fără parametrul isClarification - modelul decide singur)
        $systemPrompt = $this->getSystemPrompt($type, $courseId, $isClarification, $mode);
        if ($tutorContext) {
            $systemPrompt .= "\n\nContext din baza de date (folosește-l ca sursă principală și nu spune că nu ai acces la date dacă există context):\n"
                . json_encode($tutorContext, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        $attachments = $request->input('attachments', []);
        if (is_array($attachments) && !empty($attachments)) {
            $systemPrompt .= "\n\nDocumente atașate de administrator (folosește-le ca sursă adițională pentru răspuns):\n"
                . $this->formatAttachmentContext($attachments);
        }
        
        // Formatează mesajele pentru Hugging Face
        $formattedMessages = $this->formatMessages($systemPrompt, $messages, $prompt);

        $isGuidedCourseCreation = $type === 'course' && str_contains((string) $mode, 'guided_creation') && ($this->provider === 'openai' || $this->provider === 'groq');
        if ($isGuidedCourseCreation) {
            try {
                $guidedResult = $this->generateGuidedCourseCreationJson($formattedMessages, $teacherId, $courseId, $mode);
                return response()->json($guidedResult);
            } catch (\Throwable $e) {
                Log::error('Guided course creation failed', [
                    'message' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'course_id' => $courseId,
                    'teacher_id' => $teacherId,
                ]);

                return response()->json([
                    'error' => $e->getMessage(),
                ], 500);
            }
        }

        // Configurează response pentru streaming
        return response()->stream(function () use ($formattedMessages, $type, $teacherId, $isClarification, $courseId, $mode) {
            try {
                // Dezactivează output buffering pentru streaming
                if (ob_get_level() > 0) {
                    ob_end_clean();
                }
                
                // Setează headers pentru SSE
                header('Content-Type: text/event-stream');
                header('Cache-Control: no-cache');
                header('Connection: keep-alive');
                header('X-Accel-Buffering: no');
                
            $fullResponse = '';
            $builderDiffMode = str_contains((string) $mode, ':builder_diff');
            // Reset model index pentru fiecare request nou (doar pentru Groq)
            if ($this->provider === 'groq') {
                $envModel = env('GROQ_MODEL');
                if ($envModel) {
                    $this->currentModelIndex = array_search($envModel, $this->groqModelFallbackChain);
                    if ($this->currentModelIndex === false) {
                        $this->currentModelIndex = 0;
                    }
                } else {
                    $this->currentModelIndex = 0;
                }
            }
            
            // Apelează API-ul modelului (OpenAI-compatible sau Hugging Face)
            if ($this->provider === 'openai' || $this->provider === 'groq') {
                // OpenAI și Groq folosesc același format de chat completions
                $this->streamOpenAIResponse($formattedMessages, $type, $teacherId, $courseId, $fullResponse, $mode);

                if ($builderDiffMode && !empty($fullResponse)) {
                    $builderPlan = $this->extractFirstJsonObjectFromText($fullResponse);
                    if (is_array($builderPlan)) {
                        $builderValidation = $this->validateBuilderDiffPlanData($builderPlan);
                        if (!empty($builderValidation['clarification'])) {
                            echo "data: " . json_encode([
                                'response_type' => 'clarification',
                                'clarification_question' => $builderValidation['clarification_question'] ?? 'Am nevoie de o clarificare ca să continui.',
                            ]) . "\n\n";
                            @ob_flush();
                            flush();
                        } elseif (empty($builderValidation['valid'])) {
                            echo "data: " . json_encode([
                                'response_type' => 'clarification',
                                'clarification_question' => $builderValidation['message'] ?? 'Planul Volt este incomplet și necesită clarificări.',
                            ]) . "\n\n";
                            @ob_flush();
                            flush();
                        } else {
                            echo "data: " . json_encode([
                                'response_type' => 'course',
                            ]) . "\n\n";
                            @ob_flush();
                            flush();
                        }
                    }
                }
                
                // După streaming, verifică dacă trebuie să creezi cursul
                if ($type === 'course' && $mode !== 'admin_tutor' && !empty($fullResponse)) {
                    // Verifică dacă este răspuns fallback
                    $isFallback = strpos($fullResponse, 'Curs generat prin Volt') !== false ||
                                 strpos($fullResponse, 'Acesta este un curs generat automat') !== false;
                    
                    if ($isFallback) {
                        Log::warning('Fallback response detected - skipping course creation', [
                            'response_preview' => substr($fullResponse, 0, 200)
                        ]);
                        return;
                    }
                    
                    // Verifică dacă răspunsul conține JSON valid (cursul poate fi creat/modificat)
                    $hasValidJson = $this->hasValidCourseJson($fullResponse);
                    
                    Log::info('Checking if response has valid JSON', [
                        'has_valid_json' => $hasValidJson,
                        'response_length' => strlen($fullResponse),
                        'response_preview' => substr($fullResponse, 0, 500),
                        'is_fallback' => $isFallback
                    ]);
                    
                    if ($hasValidJson) {
                        // Volt a generat un curs valid - creează-l sau actualizează-l automat
                        try {
                            $createdCourse = $this->createOrUpdateCourseFromResponse($fullResponse, $teacherId, $courseId);
                            if ($createdCourse) {
                                $isUpdate = $courseId !== null;
                                // Trimite notificare că cursul a fost creat/actualizat (fără redirect)
                                echo "data: " . json_encode([
                                    'content' => "\n\n✅ Cursul a fost " . ($isUpdate ? 'actualizat' : 'creat') . " automat în background!\n\n📚 ID: {$createdCourse->id}\n📝 Titlu: {$createdCourse->title}\n📦 Module: " . $createdCourse->modules()->count() . "\n📄 Lecții: " . $createdCourse->lessons()->count() . "\n\nPoți continua conversația sau să îmi spui dacă vrei să modific ceva."
                                ]) . "\n\n";
                                echo "data: " . json_encode([
                                    'course_id' => $createdCourse->id,
                                    'course_created' => !$isUpdate,
                                    'course_updated' => $isUpdate
                                ]) . "\n\n";
                                @ob_flush();
                                flush();
                            }
                        } catch (\Exception $e) {
                            Log::error('Error creating/updating course from Volt response', [
                                'error' => $e->getMessage(),
                                'trace' => $e->getTraceAsString(),
                                'course_id' => $courseId
                            ]);
                            echo "data: " . json_encode([
                                'content' => "\n\n❌ Eroare la " . ($courseId ? 'actualizarea' : 'crearea') . " cursului: " . $e->getMessage() . "\n\nTe rugăm să încerci din nou sau să reformulezi cererea."
                            ]) . "\n\n";
                            @ob_flush();
                            flush();
                        }
                    }
                    // Dacă nu are JSON valid, înseamnă că Volt a întrebat ceva - nu creăm/modificăm cursul
                }
            } elseif ($this->provider === 'huggingface') {
                $this->streamHuggingFaceResponse($formattedMessages, $type, $teacherId, $courseId, $fullResponse);
            } else {
                throw new \Exception("Unsupported provider: {$this->provider}");
            }
            } catch (\Exception $e) {
                // Trimite eroarea către frontend prin SSE
                Log::error('Error in stream response', [
                    'message' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
                
                echo "data: " . json_encode([
                    'error' => $e->getMessage()
                ]) . "\n\n";
                
                @ob_flush();
                flush();
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    private function buildGuidedCourseCreationPrompt(): string
    {
        return <<<PROMPT
Ești Volt Course Creator. Generezi cursuri complete în limba română.

Reguli esențiale:
- Dacă cererea este clară, livrezi direct cursul complet.
- Dacă lipsește o singură informație esențială, răspunzi cu `response_type: clarification` și pui o singură întrebare scurtă.
- Nu faci preview, outline sau draft intermediar.
- Nu pui mai multe întrebări în același mesaj.
- Folosești documentele atașate ca sursă principală.
- Nu inventezi lecții goale; fiecare lecție trebuie să aibă conținut real.
- Dacă utilizatorul cere să alegi tu, faci presupuneri explicite și le notezi în `assumptions`.
- Când răspunzi cu structura finală, întotdeauna returnezi json valid, fără text extra.
- Lecțiile trebuie să includă introducere, explicație, exemplu, exercițiu/aplicație și recapitulare.

Schema de răspuns:
- `response_type`: `clarification` sau `course`
- pentru `clarification`: `clarification_question` + `assumptions`
- pentru `course`: `title`, `description`, `short_description`, `style`, `lesson_size`, `assumptions`, `modules`

Exemplu de clarificare:
{
  "response_type": "clarification",
  "clarification_question": "Ce nivel vrei pentru curs: începător, mediu sau avansat?"
}

Exemplu de curs complet:
{
  "response_type": "course",
  "title": "Introducere în React",
  "description": "Curs practic despre componente, props, state și flux de date.",
  "short_description": "Bazele React explicate practic.",
  "style": "practic",
  "lesson_size": "mediu",
  "assumptions": ["nivel: începător", "module: 3", "lecții per modul: 2"],
  "modules": [
    {
      "title": "Fundamente React",
      "description": "Ce este React și cum funcționează.",
      "lessons": [
        {
          "title": "Ce este React",
          "content": "<p>...</p>"
        }
      ]
    }
  ]
}

Setări implicite dacă lipsesc detalii:
- nivel: începător
- module: 3
- lecții per modul: 2
- stil: practic
- durată lecții: medie
- evaluare: quiz
- status: draft
- vizibilitate: public
PROMPT;
    }

    private function buildBuilderDiffPrompt(): string
    {
        return <<<PROMPT
Ești Volt, asistent Volt pentru builder-ul de curs.

Reguli:
- răspunde strict cu JSON valid
- propune doar modificările minime necesare
- dacă lipsesc detalii esențiale, pune o singură întrebare scurtă de clarificare
- nu rescrie tot cursul dacă este nevoie doar de o schimbare locală
- pentru lecții, include întotdeauna conținut real, nu doar titlu sau rezumat
- dacă utilizatorul cere să dezvolți, să completezi sau să scrii lecția, folosește operații `create_lesson` sau `update_lesson` cu `content`
- dacă un modul este creat sau schimbat și cererea este educațională, include și lecțiile lui
- nu returna module fără lecții atunci când cererea cere conținut de învățare
- dacă nu poți produce conținut bun pentru lecții, cere clarificare

Schema:
{
  "summary": "...",
  "needs_confirmation": false,
  "clarification_question": "",
  "course_updates": {
    "title": "...",
    "description": "...",
    "short_description": "..."
  },
  "operations": [
    {
      "op": "update_module",
      "module_id": 123,
      "title": "...",
      "description": "..."
    },
    {
      "op": "create_lesson",
      "module_id": 123,
      "title": "...",
      "content": "<p>...</p>"
    }
  ]
}

Preferințe:
- update în loc de create, dacă există deja un modul sau o lecție potrivită
- 1-3 operații relevante sunt de obicei suficiente
- fără text în afara JSON-ului
PROMPT;
    }

    private function getSystemPrompt($type, $courseId = null, $isClarification = false, $mode = '')
    {
        if ($type === 'course' && str_contains($mode, 'guided_creation')) {
            return $this->buildGuidedCourseCreationPrompt();
        }

        if (str_contains($mode, ':builder_diff')) {
            return $this->buildBuilderDiffPrompt();
        }

        if (str_starts_with($mode, 'admin_tutor') || $type === 'tutor') {
            $ultraShort = str_contains($mode, ':ultra_short');
            $quizMode = str_contains($mode, ':quiz');
            $evaluationMode = str_contains($mode, ':evaluation');
            $builderDiffMode = str_contains($mode, ':builder_diff');
            return "Ești Volt, tutor Volt pentru administrator.

Scopul tău:
- ajuți administratorul să înțeleagă cursurile, lecțiile, exercițiile și progresul lor
- folosești doar contextul primit: catalogul de cursuri, cursul/lecția potrivită, progresul și greșelile recente
- răspunzi repede, clar și practic
- păstrezi răspunsurile scurte implicit; intri în detaliu doar dacă utilizatorul cere explicit sau dacă întrebarea chiar o cere

Reguli de bază:
- nu inventa informații și nu folosi web sau surse externe
- nu spune „nu am acces la baza de date” dacă ai deja context relevant
- dacă există context suficient, răspunde direct, fără să ceri confirmare
- dacă lipsește ceva important, pune o singură întrebare scurtă și specifică
- dacă lipsesc mai multe detalii, pui DOAR 1 întrebare per răspuns și aștepți răspunsul utilizatorului înainte de următoarea
- nu trimite listă de întrebări de clarificare într-un singur mesaj
- dacă nu găsești potrivirea perfectă, spune cea mai apropiată opțiune și ce lipsește ca să fii exact
- dacă poți răspunde în 1-2 propoziții, nu extinde inutil
- dacă utilizatorul cere „mai mult”, „detaliat”, „explică”, atunci extinzi cu pași și exemple

Cum alegi răspunsul:
- dacă întrebarea este despre un curs sau o lecție, numește explicit cursul/lecția găsită
- dacă există mai multe potriviri, arată maximum 3 opțiuni și spune pe scurt diferența dintre ele
- dacă întrebarea e despre cursuri disponibile, listează doar cursurile relevante: titlu, nivel, 1 idee scurtă despre conținut
- dacă întrebarea cere explicații, oferă 2-4 pași sau idei clare, nu un eseu lung
- dacă utilizatorul cere ajutor practic, oferă și un exemplu concret sau un pas următor
- dacă întrebarea este simplă, răspunde direct fără bullets
- dacă ai deja un răspuns clar din context, nu repeta contextul în formă lungă

Stil:
- concis, clar, prietenos, orientat spre ajutor
- ton calm și încurajator
- evită formulările vagi, repetitive sau defensive
- folosește exemple scurte când explici concepte
- preferă propoziții scurte și concrete
- evită paragrafe lungi atunci când nu sunt necesare
- folosește română corectă, cu diacritice și structură logică

Format strict de răspuns:
1. `Răspuns` - 1 paragraf scurt cu concluzia directă
2. `Din curs` - 0 până la 2 bullets cu informații din contextul relevant, doar dacă aduc valoare
3. `Următorul pas` - 0 sau 1 bullet cu ce poate face administratorul mai departe, doar dacă e util
4. `Clarificare` - doar dacă este absolut necesar, o singură întrebare scurtă

Dacă întrebarea trebuie tratată foarte rapid, folosește și regula următoare:
" . ($ultraShort ? "- răspunde în maximum 2-3 propoziții\n- folosește maximum 1 bullet dacă e absolut necesar\n- nu adăuga exemple multiple, liste lungi sau explicații extinse\n- pentru cursuri, dă doar numele și ideea principală\n- dacă trebuie clarificat ceva, pune o singură întrebare foarte scurtă\n" : '') . "

" . ($quizMode ? "Mod QUIZ:
- generează doar întrebări bazate strict pe contextul primit
- evită dublurile și întrebările ambigue
- răspunde în JSON valid
- folosește câmpurile question, options, correct și source_chunk_id
" : '') . "

" . ($evaluationMode ? "Mod EVALUATION:
- compară răspunsul doar cu contextul primit
- returnează JSON valid cu score, correct, missing_points și explanation
- nu inventa puncte lipsă și nu folosi cunoștințe externe
" : '') . "

" . ($builderDiffMode ? "Mod BUILDER_DIFF:
- răspunde strict cu JSON valid, fără text înainte sau după JSON
- propune doar diferențele minime necesare, nu rescrie tot cursul
- dacă există mai multe variante bune sau lipsesc detalii pentru pasul următor, pune o singură întrebare scurtă de clarificare înainte de a continua
- nu aplica implicit schimbări mari fără să expui mai întâi planul
- pentru lecții, creează sau actualizează nu doar structura, ci și conținutul complet al lecției: explicații, exemple, pași și recapitulare
- dacă utilizatorul cere o lecție nouă, livrează direct conținutul ei complet, nu doar un titlu sau un rezumat
- dacă cererea de editare implică „dezvoltă”, „completează”, „scrie lecția”, „adauga conținut” sau „explică”, atunci trebuie să propui operații de tip `create_lesson` sau `update_lesson` cu `content`, nu doar `update_module`
- dacă un modul este creat sau modificat și utilizatorul vrea conținut educațional, include și lecțiile lui, chiar dacă trebuie să le generezi de la zero
- nu returna doar module fără lecții atunci când cererea vizibil cere conținut de învățare
- `content` pentru lecții este obligatoriu și trebuie să fie nenul, explicit și suficient de detaliat; dacă nu poți scrie conținut bun încă, cere clarificare în loc să trimiți lecții goale
- nu folosi câmpuri alternative în loc de `content`; dacă ai doar rezumat, transformă-l într-o lecție completă înainte de a răspunde
- pentru lecții, poți genera conținut bogat în HTML și poți folosi cunoștințe publice / resurse web relevante atunci când utilizatorul cere conținut din web sau când este nevoie pentru o lecție mai bună
- dacă folosești resurse web, include în JSON un câmp `sources` la nivel de operație sau lecție, cu maximum 3 linkuri relevante și scurte
- folosește structura:
{
  \"summary\": \"...\",
  \"needs_confirmation\": true,
  \"clarification_question\": \"...\",
  \"course_updates\": {
    \"title\": \"...\",
    \"description\": \"...\",
    \"short_description\": \"...\"
  },
  \"operations\": [
    {
      \"op\": \"update_module\",
      \"module_id\": 123,
      \"title\": \"...\",
      \"description\": \"...\"
    },
    {
      \"op\": \"create_lesson\",
      \"module_id\": 123,
      \"title\": \"...\",
      \"content\": \"...\",
      \"sources\": [\"https://...\"]
    },
    {
      \"op\": \"reorderModules\",
      \"module_ids\": [123, 456]
    }
  ]
}
- op-urile suportate sunt: create_module, update_module, delete_module, create_lesson, update_lesson, delete_lesson, reorderModules, reorderLessons, moveLesson
- dacă există un modul sau o lecție potrivită în context, preferă update în loc de create
- dacă schimbarea este mică, livrează doar 1-3 operații relevante
- dacă lipsesc ID-urile, cere clarificare scurtă în loc să inventezi
" : '') . "

Dacă întrebarea este ambiguă, alege cea mai probabilă interpretare și spune explicit presupunerea făcută.";
        }

        if ($type === 'course' && str_contains($mode, 'guided_creation')) {
            $outlineMode = str_contains($mode, ':outline');
            $jsonMode = ($this->provider === 'openai' || $this->provider === 'groq') ? 'Răspunde doar JSON valid când ai toate datele.' : '';
            if ($outlineMode) {
                return "Ești Volt Course Creator, consultant Volt pentru planificarea rapidă a unui curs.

Obiectiv:
- creezi mai întâi un outline scurt și stabil, nu un curs complet
- prioritatea este să obții structura corectă înainte de conținutul detaliat
- dacă tema este clară, nu ceri confirmări inutile
- dacă lipsesc detalii, folosești presupuneri simple și le notezi în `assumptions`
- pui o singură întrebare scurtă doar când chiar lipsește o informație esențială
- scrii în română corectă, clară și concisă

Ce generezi în această etapă:
- response_type: outline
- titlu
- descriere scurtă
- stil
- assumptions
- 2-4 module
- 2-3 lecții per modul, doar cu titluri și descrieri foarte scurte

Exemplu de clarificare:
{
  \"response_type\": \"clarification\",
  \"clarification_question\": \"Ce nivel vrei pentru curs: începător, mediu sau avansat?\"
}

Exemplu de outline bun:
{
  \"response_type\": \"outline\",
  \"title\": \"Introducere în React\",
  \"description\": \"Curs practic pentru a înțelege bazele React și construirea de componente.\",
  \"short_description\": \"Bazele React explicate practic.\",
  \"style\": \"practic\",
  \"lesson_size\": \"mediu\",
  \"assumptions\": [\"nivel: începător\", \"module: 3\", \"lecții per modul: 2\"],
  \"modules\": [
    {
      \"title\": \"Fundamente React\",
      \"description\": \"Ce este React și cum funcționează.\",
      \"lessons\": [
        {\"title\": \"Ce este React\", \"description\": \"Context și scop\"},
        {\"title\": \"Primul component\", \"description\": \"Un exemplu simplu\"}
      ]
    }
  ]
}

Reguli:
- nu include conținutul complet al lecțiilor în această etapă
- nu scrie texte lungi
- nu inventa detalii inutile
- dacă ai suficiente date, răspunde direct cu JSON valid

{$jsonMode}
Când generezi, răspunzi strict JSON (fără markdown / fără text extra), în schema:
{
  \"response_type\": \"outline\",
  \"title\": \"...\",
  \"description\": \"...\",
  \"short_description\": \"...\",
  \"style\": \"...\",
  \"lesson_size\": \"scurt|mediu|detaliat\",
  \"assumptions\": [\"...\"],
  \"modules\": [
    {
      \"title\": \"...\",
      \"description\": \"...\",
      \"lessons\": [
        { \"title\": \"...\", \"description\": \"...\" }
      ]
    }
  ]
}";
            }
            return "Ești Volt Course Creator, consultant Volt pentru design de curs.

Obiectiv:
- NU folosi șabloane fixe.
- Colectezi cerințele reale și abia apoi generezi structura cursului.
- Ai acces complet să generezi module, lecții și conținutul lor.
- Dacă tema cursului este clară, mergi direct la generare și nu mai cere confirmări inutile.
- Dacă tema este clară, generează direct un draft complet, nu doar un schelet.
- Ținta este un curs livrabil: module, lecții și conținutul lor, nu doar titluri și descrieri.
- Nu produce preview, outline sau draft intermediar dacă ai suficiente informații.
- Folosește presupuneri inteligente pentru ce lipsește: nivel, număr de module, număr de lecții, stil, durată, tip de evaluare.
- Nu cere toate detaliile înainte să începi; tema singură este suficientă ca să produci un draft bun.
- Scrii în limba română corectă, coerentă, cu diacritice.
- Evită propoziții rupte, exprimări vagi și repetiții.

Regulă de lucru:
- dacă lipsesc date esențiale, pui o singură întrebare scurtă și clară per mesaj; poți întreba din nou în mesajele următoare, dacă mai lipsesc detalii;
- dacă utilizatorul cere „alege tu”, poți continua cu presupuneri explicite;
- dacă ai suficiente date, treci direct la generare și returnezi strict JSON valid;
- nu transforma clarificarea într-un interviu lung;
- pentru cursuri, preferi să generezi lecțiile complete și conținutul lor, nu doar un schelet.
- răspunsul trebuie să includă explicit `response_type`:
  - `clarification` când lipsește o informație esențială și ai nevoie de o singură întrebare
  - `course` când poți livra cursul complet

Exemplu de clarificare:
{
  \"response_type\": \"clarification\",
  \"clarification_question\": \"Ce nivel vrei pentru curs: începător, mediu sau avansat?\"
}

Exemplu de curs complet:
{
  \"response_type\": \"course\",
  \"title\": \"Introducere în React\",
  \"description\": \"Curs practic despre componente, props, state și flux de date.\",
  \"short_description\": \"Bazele React explicate practic.\",
  \"style\": \"practic\",
  \"lesson_size\": \"mediu\",
  \"assumptions\": [\"nivel: începător\", \"module: 3\", \"lecții per modul: 2\"],
  \"modules\": [
    {
      \"title\": \"Fundamente React\",
      \"description\": \"Ce este React și cum funcționează.\",
      \"lessons\": [
        {
          \"title\": \"Ce este React\",
          \"content\": \"<p>...</p>\"
        }
      ]
    }
  ]
}

Date minime necesare înainte de JSON:
- tema/subiectul cursului;
- audiența și nivelul (începător/mediu/avansat);
- număr module;
- număr lecții per modul;
- stilul cursului (practic/teoretic/workshop/etc.);
- dimensiunea dorită a lecțiilor (scurt/mediu/detaliat);
- tipul de evaluare (quiz/proiect/fără evaluare);
- fiecare lecție trebuie să fie completă și utilizabilă direct, cu introducere, explicație, exemplu, exercițiu și recapitulare.
- presupuneri implicite recomandate dacă lipsesc detalii:
  - nivel: începător
  - module: 3
  - lecții per modul: 2
  - stil: practic
  - durată lecții: medie
  - evaluare: quiz
  - status: draft
  - vizibilitate: public

Documente atașate:
- tratează documentele ca referință principală;
- extrage doar informația utilă pentru cerere;
- ține cont de dimensiune (document mare => poți sintetiza mai mult context, document mic => răspuns concentrat).

Dacă utilizatorul spune \"alege tu\", poți propune valori implicite, dar le marchezi în `assumptions`.
- În etapa de clarificare, pune exact o singură întrebare pe răspuns.

{$jsonMode}
Când generezi, răspunzi strict JSON (fără markdown / fără text extra), în schema:
{
  \"response_type\": \"course\",
  \"title\": \"...\",
  \"description\": \"...\",
  \"short_description\": \"...\",
  \"style\": \"...\",
  \"lesson_size\": \"scurt|mediu|detaliat\",
  \"assumptions\": [\"...\"],
  \"modules\": [
    {
      \"title\": \"...\",
      \"description\": \"...\",
      \"lessons\": [
        { \"title\": \"...\", \"content\": \"...\" }
      ]
    }
  ]
}";
        }

        if ($type === 'course') {
            // OpenAI și Groq suportă JSON mode
            $jsonMode = ($this->provider === 'openai' || $this->provider === 'groq') ? 'IMPORTANT: Răspunde ÎNTOTDEAUNA în format JSON valid. ' : '';
            
            return "Ești un asistent Volt expert în crearea de cursuri educaționale în limba română. 
Creează cursuri structurate, clare și educative.

{$jsonMode}IMPORTANT: 
- Nu folosi șabloane fixe cu număr obligatoriu de module/lecții.
- Înainte de generare, colectezi cerințele lipsă printr-o singură întrebare scurtă și specifică.
- Întreabă doar ce lipsește cu adevărat; nu lista mai multe întrebări în același mesaj.
- Dacă tema este clară, generează direct cursul complet cu lecții și conținut, fără să ceri confirmări inutile.
- Dacă lipsesc detalii, folosește presupuneri implicite și marchează-le în `assumptions`.
- Dacă există documente atașate, folosește-le ca referință principală și extrage doar informația utilă; ia în calcul și dimensiunea documentului (fișier mare => poți include mai mult context, fișier mic => răspuns mai concentrat).
- Dacă informațiile sunt insuficiente, NU genera JSON de curs. Pune o singură întrebare relevantă în text simplu; poți continua ulterior cu alte întrebări, una câte una.
- Dacă utilizatorul cere explicit să propui tu valori lipsă, ai voie să faci presupuneri, dar marchezi clar ce ai presupus.
- Fiecare lecție generată trebuie să fie completă și utilă direct: introducere, explicație clară, exemplu concret, exercițiu sau aplicație și recapitulare scurtă.

Când ai suficiente informații, răspunde ÎNTOTDEAUNA în JSON valid (fără text înainte sau după JSON) în structura:
{
  \"title\": \"Titlul cursului\",
  \"description\": \"Descriere detaliată\",
  \"short_description\": \"Descriere scurtă (max 150 caractere)\",
  \"style\": \"stilul cursului (ex: practic, academic, workshop)\",
  \"lesson_size\": \"scurt|mediu|detaliat\",
  \"assumptions\": [\"presupunere 1\", \"presupunere 2\"],
  \"modules\": [
    {
      \"title\": \"Titlul modulului\",
      \"description\": \"Descriere modul\",
      \"lessons\": [
        {
          \"title\": \"Titlul lecției\",
          \"content\": \"Conținut HTML util și structurat\"
        }
      ]
    }
  ]
}

Reguli de calitate:
- modulele și lecțiile trebuie să urmeze cerința utilizatorului, nu un număr hardcod-at.
- conținutul trebuie să fie practic și clar, cu structură pedagogică progresivă.
- păstrează consistență între nivel, stil și dimensiunea lecțiilor.
- dacă documentele de referință contrazic cererea, prioritatea este cererea utilizatorului, apoi documentele.
- fiecare lecție trebuie să fie completă și utilizabilă direct: introducere, explicație clară, exemplu concret, exercițiu sau aplicație și recapitulare scurtă.";
        } else {
            return "Ești un asistent Volt expert în crearea de teste educaționale în limba română. 
Creează teste cu întrebări clare și răspunsuri corecte. 
Folosește DOAR contextul/informațiile primite în cerere (storage intern). NU folosi web sau cunoștințe externe.
Dacă informația este insuficientă pentru întrebări valide, răspunde cu JSON valid și include un câmp `needs_more_context` cu motivul.
Răspunde întotdeauna în format JSON valid cu următoarea structură:
{
    \"title\": \"Titlul testului\",
    \"description\": \"Descrierea testului\",
    \"needs_more_context\": false,
    \"questions\": [
        {
            \"question\": \"Întrebarea\",
            \"type\": \"multiple_choice\",
            \"options\": [\"Opțiunea 1\", \"Opțiunea 2\", \"Opțiunea 3\", \"Opțiunea 4\"],
            \"correct_answer\": 0,
            \"explanation\": \"Explicația răspunsului corect\"
        }
    ]
}
Asigură-te că JSON-ul este valid și complet.";
        }
    }

    private function formatMessages($systemPrompt, $messages, $userPrompt)
    {
        $formatted = [
            [
                'role' => 'system',
                'content' => $systemPrompt
            ]
        ];

        // Adaugă istoricul mesajelor recente (mai mult context pentru tutor => răspunsuri mai coerente)
        $isTutorPrompt = str_contains((string) $systemPrompt, 'Ești Volt, tutor Volt');
        $recentMessages = array_slice($messages, $isTutorPrompt ? -4 : -5);
        foreach ($recentMessages as $msg) {
            if (isset($msg['role']) && isset($msg['content']) && $msg['role'] !== 'system') {
                $formatted[] = [
                    'role' => $msg['role'],
                    'content' => $msg['content']
                ];
            }
        }

        // Adaugă prompt-ul curent
        $formatted[] = [
            'role' => 'user',
            'content' => $userPrompt
        ];

        return $formatted;
    }

    /**
     * Stream response from OpenAI/Groq API
     */
    public function streamOpenAIResponse($messages, $type, $teacherId = null, $courseId = null, &$fullResponse = null, $mode = '')
    {
        if ($fullResponse === null) {
            $fullResponse = '';
        }
        
        try {
            $url = "{$this->apiUrl}/chat/completions";
            
            $providerName = $this->provider === 'groq' ? 'Groq' : 'OpenAI';
            Log::info("{$providerName} API Request", [
                'url' => $url,
                'model' => $this->model,
                'messages_count' => count($messages)
            ]);

            $isGuidedCreation = str_contains((string) $mode, 'guided_creation');
            $isTutorMode = str_starts_with((string) $mode, 'admin_tutor') || str_starts_with((string) $mode, 'student_tutor') || $type === 'tutor';
            $useHighQualityCreatorModel = $this->shouldUseHighQualityCreatorModel($messages, (string) $mode);
            $defaultTimeout = max(30, (int) env('AI_REQUEST_TIMEOUT', 180));
            $guidedTimeoutRaw = (int) env('AI_GUIDED_CREATION_TIMEOUT', 0);
            // 0 => no timeout for guided course creation (can run longer on local Ollama).
            $guidedTimeout = $guidedTimeoutRaw <= 0 ? 0 : max($defaultTimeout, $guidedTimeoutRaw);
            $tutorTimeout = max(30, (int) env('AI_TUTOR_TIMEOUT', 120));
            $connectTimeout = max(5, (int) env('AI_CONNECT_TIMEOUT', 15));
            $effectiveTimeout = $isGuidedCreation ? $guidedTimeout : ($isTutorMode ? $tutorTimeout : $defaultTimeout);
            $guidedMaxTokens = max(500, (int) env('AI_GUIDED_MAX_TOKENS', 1100));
            $effectiveModel = $this->model;
            if ($isGuidedCreation) {
                if ($this->provider === 'groq') {
                    $effectiveModel = env('GROQ_CREATOR_MODEL', $effectiveModel);
                    if ($useHighQualityCreatorModel) {
                        $effectiveModel = env('GROQ_CREATOR_QUALITY_MODEL', $effectiveModel);
                    }
                } elseif ($this->provider === 'openai') {
                    $effectiveModel = env('OPENAI_CREATOR_MODEL', $effectiveModel);
                    if ($useHighQualityCreatorModel) {
                        $effectiveModel = env('OPENAI_CREATOR_QUALITY_MODEL', $effectiveModel);
                    }
                }
            } elseif ($isTutorMode) {
                if ($this->provider === 'groq') {
                    $effectiveModel = env('GROQ_CREATOR_MODEL', $effectiveModel);
                } elseif ($this->provider === 'openai') {
                    $effectiveModel = env('OPENAI_CREATOR_MODEL', $effectiveModel);
                }
            }

            // Prepare request payload
            $payload = [
                'model' => $effectiveModel,
                'messages' => $messages,
                'stream' => true,
                'temperature' => $isGuidedCreation
                    ? 0.2
                    : ($isTutorMode ? (str_contains((string) $mode, ':ultra_short') ? 0.1 : 0.2) : 0.7),
                'max_tokens' => $isGuidedCreation
                    ? $guidedMaxTokens
                    : ($isTutorMode ? (str_contains((string) $mode, ':ultra_short') ? 120 : 280) : 4000),
                'top_p' => $isTutorMode ? 0.8 : 1,
            ];
            
            // Only add response_format for OpenAI (Groq doesn't support it for all models)
            if ($this->provider === 'openai') {
                $payload['response_format'] = ['type' => 'json_object'];
            }
            
            // Use cURL for proper streaming support
            $ch = curl_init($url);
            $buffer = '';
            $errorResponse = '';
            $headers = '';
            $responseBody = '';
            
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
            $requestHeaders = [
                'Content-Type: application/json',
            ];
            if (!empty($this->apiKey)) {
                $requestHeaders[] = 'Authorization: Bearer ' . $this->apiKey;
            }
            curl_setopt($ch, CURLOPT_HTTPHEADER, $requestHeaders);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            $verify = filter_var(env('AI_VERIFY_SSL', true), FILTER_VALIDATE_BOOLEAN);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, $verify);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $connectTimeout);
            curl_setopt($ch, CURLOPT_TIMEOUT, $effectiveTimeout);
            curl_setopt($ch, CURLOPT_HEADERFUNCTION, function($ch, $header) use (&$headers) {
                $headers .= $header;
                return strlen($header);
            });
            
            // Write function to handle streaming chunks
            curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $data) use (&$fullResponse, &$buffer, &$errorResponse, &$responseBody) {
                $responseBody .= $data;
                
                // Check if this is an error response (JSON error, not streaming)
                if (strpos($data, '"error"') !== false && strpos($data, 'data:') === false) {
                    $errorResponse .= $data;
                    // Try to parse error
                    try {
                        $errorData = json_decode($data, true);
                        if (isset($errorData['error'])) {
                            $errorMsg = is_array($errorData['error']) ? ($errorData['error']['message'] ?? json_encode($errorData['error'])) : $errorData['error'];
                            $errorResponse = $errorMsg;
                        }
                    } catch (\Exception $e) {
                        // Keep raw error
                    }
                }
                
                // Process streaming data
                $buffer .= $data;
                $lines = explode("\n", $buffer);
                
                // Keep incomplete line in buffer
                $buffer = array_pop($lines);
                
                foreach ($lines as $line) {
                    $line = trim($line);
                    if (empty($line)) {
                        continue;
                    }
                    
                    // Check if it's SSE format
                    if (str_starts_with($line, 'data: ')) {
                        $jsonData = substr($line, 6);
                        if ($jsonData === '[DONE]') {
                            return strlen($data);
                        }
                        
                        try {
                            $chunk = json_decode($jsonData, true);
                            if (isset($chunk['choices'][0]['delta']['content'])) {
                                $content = $chunk['choices'][0]['delta']['content'];
                                $fullResponse .= $content;
                                
                                // Stream chunk to client
                                echo "data: " . json_encode(['content' => $content]) . "\n\n";
                                @ob_flush();
                                flush();
                            }
                        } catch (\Exception $e) {
                            // Skip invalid JSON chunks
                            continue;
                        }
                    }
                }
                
                return strlen($data);
            });
            
            $execResult = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);
            
            if ($curlError) {
                Log::error("{$providerName} API CURL Error", ['error' => $curlError]);
                throw new \Exception("{$providerName} API CURL error: {$curlError}");
            }
            
            if ($httpCode !== 200) {
                // Try to get error details from response
                $errorDetails = $errorResponse ?: (substr($responseBody, 0, 500) ?: 'No error details available');
                
                // Check if it's a model not found error (404)
                $isModelNotFound = ($httpCode === 404 && (
                    strpos(strtolower($errorDetails), 'model') !== false && 
                    (strpos(strtolower($errorDetails), 'does not exist') !== false || 
                     strpos(strtolower($errorDetails), 'not found') !== false ||
                     strpos(strtolower($errorDetails), 'no access') !== false)
                ));
                
                // Check if it's a rate limit/quota error
                $isRateLimit = $this->isRateLimitError($httpCode, $errorDetails);
                
                // Dacă modelul nu există sau e rate limit, încercăm următorul model (doar pentru Groq)
                if (($isModelNotFound || $isRateLimit) && $this->provider === 'groq') {
                    $errorType = $isModelNotFound ? 'Model Not Found' : 'Rate Limit/Quota Exceeded';
                    Log::warning("{$providerName} API {$errorType}", [
                        'status' => $httpCode,
                        'error' => substr($errorDetails, 0, 500),
                        'current_provider' => $this->provider,
                        'current_model' => $this->model
                    ]);
                    
                    $nextModel = $this->getNextGroqModel();
                    
                    if ($nextModel) {
                        Log::info("Switching to fallback Groq model", [
                            'from' => $this->model,
                            'to' => $nextModel,
                            'reason' => $isModelNotFound ? 'model_not_found' : 'rate_limit'
                        ]);
                        
                        // Send message to client about model switch
                        $message = $isModelNotFound 
                            ? "\n\n⏳ Modelul {$this->model} nu este disponibil. Trec la modelul alternativ ({$nextModel})...\n\n"
                            : "\n\n⏳ Limita pentru modelul {$this->model} a fost atinsă. Trec la modelul alternativ ({$nextModel})...\n\n";
                        
                        echo "data: " . json_encode([
                            'content' => $message
                        ]) . "\n\n";
                                @ob_flush();
                                flush();
                        
                        // Switch to next model
                        $this->model = $nextModel;
                        
                        // Retry with new model
                        return $this->streamOpenAIResponse($messages, $type, $teacherId, $courseId, $fullResponse);
                    }
                    
                    // No more models available or not using Groq - wait and retry
                    Log::warning("No more fallback models available, waiting before retry", [
                        'provider' => $this->provider,
                        'model' => $this->model
                    ]);
                    
                    // Send rate limit message to client
                    echo "data: " . json_encode([
                        'content' => "\n\n⏳ Am atins limita de request-uri per minut. Aștept 60 de secunde înainte de a continua...\n\n"
                    ]) . "\n\n";
                @ob_flush();
                flush();
                    
                    // Wait 60 seconds before retrying
                    sleep(60);
                    
                    // Retry the request
                    Log::info("Retrying {$providerName} API request after rate limit wait");
                    return $this->streamOpenAIResponse($messages, $type, $teacherId, $courseId, $fullResponse);
                }
                
                Log::error("{$providerName} API Error", [
                    'status' => $httpCode,
                    'error_response' => substr($errorDetails, 0, 500),
                    'full_response' => substr($responseBody, 0, 1000),
                    'headers' => substr($headers, 0, 500),
                    'payload' => json_encode($payload)
                ]);
                throw new \Exception("{$providerName} API error: HTTP {$httpCode}. " . substr($errorDetails, 0, 200));
            }
            
            Log::info("{$providerName} API Success", [
                'response_length' => strlen($fullResponse),
                'preview' => substr($fullResponse, 0, 300),
                'has_json' => preg_match('/\{[\s\S]*\}/', $fullResponse) ? 'yes' : 'no'
            ]);
        } catch (\Exception $e) {
            $providerName = $this->provider === 'groq' ? 'Groq' : 'OpenAI';
            Log::error("{$providerName} API Exception", [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    private function streamHuggingFaceResponse($messages, $type, $teacherId = null, $courseId = null, &$fullResponse = null)
    {
        if ($fullResponse === null) {
            $fullResponse = '';
        }
        try {
            // Încearcă să folosească Hugging Face Inference API pentru chat completions
            // Dacă nu funcționează, folosește text generation
            $useChatCompletions = false; // Hugging Face nu are chat completions standard ca OpenAI
            
            if ($useChatCompletions) {
                // Tentativă cu chat completions (dacă modelul suportă)
                $url = "{$this->hfApiUrl}/v1/chat/completions";
                
                $response = Http::withOptions([
                    'verify' => env('APP_ENV') === 'production', // Verify SSL only in production
                ])->withHeaders([
                    'Authorization' => "Bearer {$this->hfApiKey}",
                    'Content-Type' => 'application/json',
                ])->timeout(120)->stream(function ($chunk) {
                    $data = json_decode($chunk, true);
                    if (isset($data['choices'][0]['delta']['content'])) {
                        $content = $data['choices'][0]['delta']['content'];
                        echo "data: " . json_encode(['content' => $content]) . "\n\n";
                        @ob_flush();
                        flush();
                    }
                }, 'POST', $url, [
                    'model' => $this->model,
                    'messages' => $messages,
                    'stream' => true,
                    'temperature' => 0.7,
                    'max_tokens' => 2000,
                ]);
            } else {
                // Folosește text generation API (metoda standard Hugging Face)
                $prompt = $this->messagesToPrompt($messages);
                
                // Încearcă cu modelul configurat
                $url = "{$this->hfApiUrl}/models/{$this->model}";
                
                Log::info('Hugging Face API Request', [
                    'url' => $url,
                    'model' => $this->model,
                    'prompt_length' => strlen($prompt),
                    'prompt_preview' => substr($prompt, 0, 300) . '...'
                ]);

                $response = Http::withOptions([
                    'verify' => env('APP_ENV') === 'production', // Verify SSL only in production
                ])->withHeaders([
                    'Authorization' => "Bearer {$this->hfApiKey}",
                    'Content-Type' => 'application/json',
                ])->timeout(180)->post($url, [
                    'inputs' => $prompt,
                    'parameters' => [
                        'max_new_tokens' => 4000, // Mărit pentru cursuri complete
                        'temperature' => 0.7,
                        'return_full_text' => false,
                        'do_sample' => true,
                        'top_p' => 0.9,
                        'top_k' => 50,
                        'repetition_penalty' => 1.1,
                    ],
                    'options' => [
                        'wait_for_model' => true,
                    ],
                ]);

                if ($response->successful()) {
                    $result = $response->json();
                    
                    Log::info('Hugging Face API Success', [
                        'response_keys' => array_keys($result),
                        'has_array' => isset($result[0]),
                        'response_preview' => is_string($result) ? substr($result, 0, 200) : (isset($result[0]) ? json_encode($result[0]) : json_encode($result))
                    ]);
                    
                    $text = null;
                    
                    if (isset($result[0]['generated_text'])) {
                        $text = $result[0]['generated_text'];
                        Log::info('Found generated_text in array', [
                            'length' => strlen($text),
                            'preview' => substr($text, 0, 200)
                        ]);
                    } elseif (isset($result['generated_text'])) {
                        $text = $result['generated_text'];
                        Log::info('Found generated_text in object', [
                            'length' => strlen($text),
                            'preview' => substr($text, 0, 200)
                        ]);
                    } elseif (is_string($result)) {
                        $text = $result;
                        Log::info('Response is string', [
                            'length' => strlen($text),
                            'preview' => substr($text, 0, 200)
                        ]);
                    }
                    
                    if ($text) {
                        // Elimină prompt-ul din răspuns (dacă este inclus)
                        if (strpos($text, $prompt) === 0) {
                            $text = substr($text, strlen($prompt));
                        }
                        
                        // Elimină tag-urile Llama dacă există
                        $text = preg_replace('/<\|[^|]+\|>/', '', $text);
                        $text = trim($text);
                        
                        Log::info('Processed response text', [
                            'final_length' => strlen($text),
                            'preview' => substr($text, 0, 500),
                            'has_json' => preg_match('/\{[\s\S]*\}/', $text) ? 'yes' : 'no'
                        ]);
                        
                        $fullResponse = $text;
                        // Simulează streaming pentru o experiență mai bună
                        $this->streamText($text);
                    } else {
                        // Încearcă cu un model alternativ sau fallback
                        Log::warning('Unexpected Hugging Face response format - using fallback', [
                            'response' => is_array($result) ? json_encode($result) : (is_string($result) ? substr($result, 0, 500) : gettype($result)),
                            'response_type' => gettype($result),
                            'response_keys' => is_array($result) ? array_keys($result) : 'N/A'
                        ]);
                        $fallbackText = $this->getFallbackResponse($type);
                        $fullResponse = $fallbackText;
                        $this->streamText($fallbackText);
                    }
                } else {
                    $statusCode = $response->status();
                    $errorBody = $response->body();
                    
                    Log::error('Hugging Face API Error', [
                        'status' => $statusCode,
                        'error' => $errorBody,
                        'headers' => $response->headers()
                    ]);

                    // Dacă modelul nu e gata, așteaptă și reîncearcă
                    if ($statusCode === 503) {
                        $errorData = $response->json();
                        $estimatedTime = $errorData['estimated_time'] ?? 10;
                        $errorMessage = "Modelul este încărcare. Timp estimat: {$estimatedTime} secunde. Te rugăm să aștepți și să încerci din nou.";
                        $fullResponse = $errorMessage;
                        $this->streamText($errorMessage);
                    } else {
                        // Fallback: răspuns generat local
                        Log::info('Using fallback response');
                        $fallbackText = $this->getFallbackResponse($type);
                        $fullResponse = $fallbackText;
                        $this->streamText($fallbackText);
                    }
                }
            }

            // După ce streaming-ul este terminat, verifică dacă răspunsul conține JSON valid
            // Dacă da, creează sau actualizează cursul automat în background
            if ($type === 'course' && !empty($fullResponse)) {
                // Verifică dacă este fallback response (nu crea curs dacă este fallback)
                $isFallback = strpos($fullResponse, 'Curs generat prin Volt') !== false && 
                             strpos($fullResponse, 'Acesta este un curs generat automat') !== false;
                
                if ($isFallback) {
                    Log::warning('Fallback response detected - skipping course creation', [
                        'response_preview' => substr($fullResponse, 0, 200)
                    ]);
                    // Nu crea cursul dacă este fallback
                    return;
                }
                
                // Verifică dacă răspunsul conține JSON valid (cursul poate fi creat/modificat)
                $hasValidJson = $this->hasValidCourseJson($fullResponse);
                
                Log::info('Checking if response has valid JSON', [
                    'has_valid_json' => $hasValidJson,
                    'response_length' => strlen($fullResponse),
                    'response_preview' => substr($fullResponse, 0, 500),
                    'is_fallback' => $isFallback
                ]);
                
                if ($hasValidJson) {
                    // Volt a generat un curs valid - creează-l sau actualizează-l automat
                    try {
                        $createdCourse = $this->createOrUpdateCourseFromResponse($fullResponse, $teacherId, $courseId);
                        if ($createdCourse) {
                            $isUpdate = $courseId !== null;
                            // Trimite notificare că cursul a fost creat/actualizat (fără redirect)
                            echo "data: " . json_encode([
                                'content' => "\n\n✅ Cursul a fost " . ($isUpdate ? 'actualizat' : 'creat') . " automat în background!\n\n📚 ID: {$createdCourse->id}\n📝 Titlu: {$createdCourse->title}\n📦 Module: " . $createdCourse->modules()->count() . "\n📄 Lecții: " . $createdCourse->lessons()->count() . "\n\nPoți continua conversația sau să îmi spui dacă vrei să modific ceva."
                            ]) . "\n\n";
                            echo "data: " . json_encode([
                                'course_id' => $createdCourse->id,
                                'course_created' => !$isUpdate,
                                'course_updated' => $isUpdate
                            ]) . "\n\n";
                            @ob_flush();
                            flush();
                        }
                    } catch (\Exception $e) {
                        Log::error('Error creating/updating course from Volt response', [
                            'error' => $e->getMessage(),
                            'trace' => $e->getTraceAsString(),
                            'course_id' => $courseId
                        ]);
                        echo "data: " . json_encode([
                            'content' => "\n\n❌ Eroare la " . ($courseId ? 'actualizarea' : 'crearea') . " cursului: " . $e->getMessage() . "\n\nTe rugăm să încerci din nou sau să reformulezi cererea."
                        ]) . "\n\n";
                        @ob_flush();
                        flush();
                    }
                }
                // Dacă nu are JSON valid, înseamnă că Volt a întrebat ceva - nu creăm/modificăm cursul
            }

            $responseMetadata = $this->extractAIResponseMetadataFromText($fullResponse);
            if (!empty($responseMetadata)) {
                echo "data: " . json_encode($responseMetadata) . "\n\n";
                @ob_flush();
                flush();
            }

            echo "data: [DONE]\n\n";
            @ob_flush();
            flush();
        } catch (\Exception $e) {
            Log::error('Hugging Face API Exception', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            echo "data: " . json_encode([
                'error' => 'Eroare la generarea răspunsului: ' . $e->getMessage()
            ]) . "\n\n";
            @ob_flush();
            flush();
        }
    }

    private function streamText($text)
    {
        if (empty($text)) {
            Log::warning('Empty text to stream');
            return;
        }
        
        // Simulează streaming pentru o experiență mai bună
        $chunks = $this->splitIntoChunks($text, 20); // 20 caractere per chunk
        
        Log::info('Streaming text', ['total_chunks' => count($chunks), 'text_length' => strlen($text)]);
        
        foreach ($chunks as $index => $chunk) {
            $data = json_encode(['content' => $chunk]);
            echo "data: {$data}\n\n";
            
            // Forțează flush
            @ob_flush();
            flush();
            
            // Delay mai mic pentru a fi mai rapid
            if ($index < count($chunks) - 1) {
                usleep(20000); // 20ms delay
            }
        }
    }

    private function splitIntoChunks($text, $chunkSize)
    {
        $chunks = [];
        $length = mb_strlen($text, 'UTF-8');
        
        for ($i = 0; $i < $length; $i += $chunkSize) {
            $chunks[] = mb_substr($text, $i, $chunkSize, 'UTF-8');
        }
        
        return $chunks;
    }

    private function messagesToPrompt($messages)
    {
        // Format pentru Llama 3.1 Instruct
        $prompt = '<|begin_of_text|><|start_header_id|>system<|end_header_id|>' . "\n\n";
        
        // Extrage system prompt
        $systemPrompt = '';
        $otherMessages = [];
        foreach ($messages as $msg) {
            $role = $msg['role'] ?? 'user';
            $content = $msg['content'] ?? '';
            
            if ($role === 'system') {
                $systemPrompt = $content;
            } else {
                $otherMessages[] = $msg;
            }
        }
        
        // Adaugă system prompt
        $prompt .= $systemPrompt . '<|eot_id|>' . "\n";
        
        // Adaugă conversația
        foreach ($otherMessages as $msg) {
            $role = $msg['role'] ?? 'user';
            $content = $msg['content'] ?? '';
            
            if ($role === 'user') {
                $prompt .= '<|start_header_id|>user<|end_header_id|>' . "\n\n";
                $prompt .= $content . '<|eot_id|>' . "\n";
            } elseif ($role === 'assistant') {
                $prompt .= '<|start_header_id|>assistant<|end_header_id|>' . "\n\n";
                $prompt .= $content . '<|eot_id|>' . "\n";
            }
        }
        
        // Adaugă tag-ul pentru răspunsul assistant-ului
        $prompt .= '<|start_header_id|>assistant<|end_header_id|>' . "\n\n";
        
        Log::info('Formatted prompt for Llama', [
            'prompt_length' => strlen($prompt),
            'messages_count' => count($messages),
            'system_prompt_length' => strlen($systemPrompt)
        ]);
        
        return $prompt;
    }

    private function getFallbackResponse($type)
    {
        if ($type === 'course') {
            return json_encode([
                'title' => 'Curs generat prin Volt',
                'description' => 'Acesta este un curs generat automat. Te rugăm să completezi detaliile manual.',
                'short_description' => 'Curs generat prin Volt',
                'modules' => [
                    [
                        'title' => 'Modulul 1',
                        'description' => 'Descriere modul',
                        'lessons' => [
                            [
                                'title' => 'Lecția 1',
                                'content' => 'Conținutul lecției va fi adăugat aici.'
                            ]
                        ]
                    ]
                ]
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        } else {
            return json_encode([
                'title' => 'Test generat prin Volt',
                'description' => 'Acesta este un test generat automat. Te rugăm să completezi întrebările manual.',
                'questions' => [
                    [
                        'question' => 'Exemplu de întrebare?',
                        'type' => 'multiple_choice',
                        'options' => ['Opțiunea A', 'Opțiunea B', 'Opțiunea C', 'Opțiunea D'],
                        'correct_answer' => 0,
                        'explanation' => 'Explicația răspunsului corect'
                    ]
                ]
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * Create or update course, modules and lessons from Volt response
     */
    private function createOrUpdateCourseFromResponse($responseText, $teacherId = null, $existingCourseId = null)
    {
        try {
            // Parse JSON from response
            $courseData = $this->parseCourseData($responseText);
            
            if (!$courseData) {
                Log::warning('Could not parse course data from Volt response');
                return null;
            }

            $responseType = strtolower(trim((string) ($courseData['response_type'] ?? 'course')));
            if ($responseType !== 'course') {
                Log::warning('Volt response type does not allow course creation', [
                    'response_type' => $responseType,
                    'title' => $courseData['title'] ?? 'N/A',
                ]);
                return null;
            }

            Log::info('Creating/updating course from Volt response', [
                'title' => $courseData['title'] ?? 'N/A',
                'modules_count' => count($courseData['modules'] ?? []),
                'existing_course_id' => $existingCourseId
            ]);

            // Get teacher
            $teacher = null;
            if ($teacherId) {
                $teacher = User::find($teacherId);
            }
            if (!$teacher) {
                $teacher = Auth::user();
            }

            // Check if we should update existing course or create new one
            $course = null;
            if ($existingCourseId) {
                $course = Course::find($existingCourseId);
                if ($course && $course->teacher_id === $teacher->id) {
                    // Update existing course
                    $course->update([
                        'title' => $courseData['title'] ?? $course->title,
                        'description' => $courseData['description'] ?? $course->description,
                        'short_description' => $courseData['short_description'] ?? $course->short_description,
                    ]);
                    Log::info('Course updated', ['course_id' => $course->id]);
                    
                    // Delete existing modules and lessons to recreate them
                    $course->modules()->each(function($module) {
                        $module->lessons()->delete();
                    });
                    $course->modules()->delete();
                } else {
                    $course = null; // Course not found or not owned by teacher
                }
            }

            // Create new course if not updating
            if (!$course) {
                $course = $this->courseBuilderService->createCourse([
                    'title' => $courseData['title'] ?? 'Curs generat prin Volt',
                    'description' => $courseData['description'] ?? '',
                    'short_description' => $courseData['short_description'] ?? substr($courseData['description'] ?? '', 0, 150),
                    'status' => 'draft',
                    'teacher_id' => $teacher?->id,
                ], $teacher);
                Log::info('Course created', ['course_id' => $course->id]);
            }

            // Create modules and lessons
            $modules = $courseData['modules'] ?? [];
            Log::info('Creating modules', [
                'count' => count($modules),
                'modules_data' => array_map(function($m) {
                    return [
                        'title' => $m['title'] ?? 'N/A',
                        'lessons_count' => count($m['lessons'] ?? [])
                    ];
                }, $modules)
            ]);
            
            if (empty($modules)) {
                Log::error('No modules to create!', [
                    'course_data_keys' => array_keys($courseData),
                    'course_data_modules' => $courseData['modules'] ?? 'NOT SET'
                ]);
                throw new \Exception('Nu s-au găsit module în răspunsul Volt. Te rugăm să reformulezi cererea.');
            }
            
            foreach ($modules as $moduleIndex => $moduleData) {
                if (empty($moduleData['title'])) {
                    Log::warning('Skipping module without title', ['index' => $moduleIndex]);
                    continue;
                }
                
                try {
                    $module = $this->courseBuilderService->createModule($course, [
                        'title' => $moduleData['title'],
                        'description' => $moduleData['description'] ?? null,
                        'order' => $moduleIndex,
                        'status' => 'published',
                    ]);

                    Log::info('Module created', [
                        'module_id' => $module->id, 
                        'course_id' => $course->id,
                        'title' => $module->title
                    ]);

                    // Create lessons for this module
                    $lessons = $moduleData['lessons'] ?? [];
                    Log::info('Creating lessons for module', [
                        'module_id' => $module->id,
                        'lessons_count' => count($lessons),
                        'lessons_data' => array_map(function($l) {
                            return [
                                'title' => $l['title'] ?? 'N/A',
                                'has_content' => !empty($l['content'] ?? ''),
                                'content_length' => strlen($l['content'] ?? '')
                            ];
                        }, $lessons)
                    ]);
                    
                    if (empty($lessons)) {
                        Log::warning('Module has no lessons!', [
                            'module_id' => $module->id,
                            'module_title' => $module->title
                        ]);
                    }
                    
                    foreach ($lessons as $lessonIndex => $lessonData) {
                        if (empty($lessonData['title'])) {
                            Log::warning('Skipping lesson without title', [
                                'module_id' => $module->id,
                                'index' => $lessonIndex
                            ]);
                            continue;
                        }
                        
                        $lessonContent = (string) ($lessonData['content'] ?? '');
                        $lessonLines = $this->countLessonContentLines($lessonContent);
                        
                        if (empty($lessonContent)) {
                            Log::warning('Lesson content is empty', [
                                'module_id' => $module->id,
                                'lesson_title' => $lessonData['title']
                            ]);
                            throw new \Exception('Lecția "' . ($lessonData['title'] ?? 'fără titlu') . '" nu are conținut.');
                        } elseif ($lessonLines < self::MIN_LESSON_LINES) {
                            Log::warning('Lesson content is too short by lines rule', [
                                'module_id' => $module->id,
                                'lesson_title' => $lessonData['title'],
                                'content_lines' => $lessonLines,
                                'required_min_lines' => self::MIN_LESSON_LINES
                            ]);
                            throw new \Exception('Lecția "' . ($lessonData['title'] ?? 'fără titlu') . '" trebuie să aibă minimum ' . self::MIN_LESSON_LINES . ' de rânduri.');
                        }

                        $this->ensureLessonHasMinimumLines((string) ($lessonData['title'] ?? ''), $lessonContent);
                        
                        try {
                            $lesson = $this->courseBuilderService->createLesson($module, [
                                'title' => $lessonData['title'],
                                'content' => $lessonContent,
                                'order' => $lessonIndex,
                                'status' => 'published',
                                'type' => 'text',
                            ]);

                            Log::info('Lesson created', [
                                'lesson_id' => $lesson->id,
                                'module_id' => $module->id,
                                'course_id' => $course->id,
                                'title' => $lesson->title,
                                'content_length' => strlen($lesson->content)
                            ]);
                        } catch (\Exception $e) {
                            Log::error('Error creating lesson', [
                                'error' => $e->getMessage(),
                                'module_id' => $module->id,
                                'lesson_data' => $lessonData
                            ]);
                            throw $e;
                        }
                    }
                } catch (\Exception $e) {
                    Log::error('Error creating module', [
                        'error' => $e->getMessage(),
                        'module_data' => $moduleData
                    ]);
                    throw $e;
                }
            }
            
            // Refresh course to get updated counts
            $course->refresh();

            Log::info('Course creation completed', [
                'course_id' => $course->id,
                'modules_count' => $course->modules()->count(),
                'lessons_count' => $course->lessons()->count()
            ]);

            return $course;
        } catch (\Exception $e) {
            Log::error('Error creating course from Volt response', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Parse course data from Volt response
     */
    private function parseCourseData($responseText)
    {
        $data = $this->extractFirstJsonObjectFromText($responseText);
        if (!$data || !isset($data['title'])) {
            return null;
        }

        Log::info('Parsed course JSON candidate', ['modules_count' => count($data['modules'] ?? [])]);
        return $this->validateAndNormalizeCourseData($data);
    }

    /**
     * Extract the first JSON object from a text response without validating its course structure.
     */
    private function extractFirstJsonObjectFromText(string $responseText): ?array
    {
        $patterns = [
            '/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i',
            '/\{[\s\S]*\}/',
        ];

        foreach ($patterns as $pattern) {
            if (!preg_match($pattern, $responseText, $matches)) {
                continue;
            }

            $candidate = $matches[1] ?? $matches[0] ?? '';
            if ($candidate === '') {
                continue;
            }

            try {
                $data = json_decode($candidate, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($data)) {
                    return $data;
                }
            } catch (\Throwable $e) {
                Log::warning('Failed to decode JSON candidate', ['error' => $e->getMessage()]);
            }
        }

        $startPos = strpos($responseText, '{');
        if ($startPos === false) {
            return null;
        }

        $jsonCandidate = substr($responseText, $startPos);
        $braceCount = 0;
        $endPos = -1;
        $length = strlen($jsonCandidate);
        for ($i = 0; $i < $length; $i++) {
            if ($jsonCandidate[$i] === '{') {
                $braceCount++;
            }
            if ($jsonCandidate[$i] === '}') {
                $braceCount--;
            }
            if ($braceCount === 0) {
                $endPos = $i + 1;
                break;
            }
        }

        if ($endPos <= 0) {
            return null;
        }

        $jsonStr = substr($jsonCandidate, 0, $endPos);
        try {
            $data = json_decode($jsonStr, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($data)) {
                return $data;
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to decode JSON by brace matching', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Extract lightweight metadata about the Volt response for the frontend.
     */
    private function extractAIResponseMetadataFromText(string $responseText): array
    {
        $data = $this->extractFirstJsonObjectFromText($responseText);
        if (!$data) {
            return [];
        }

        $metadata = [];
        $responseType = strtolower(trim((string) ($data['response_type'] ?? $data['type'] ?? '')));
        if ($responseType !== '') {
            $metadata['response_type'] = $responseType;
        }

        $clarificationQuestion = trim((string) (
            $data['clarification_question'] ??
            $data['question'] ??
            $data['message'] ??
            ''
        ));
        if ($clarificationQuestion !== '') {
            $metadata['clarification_question'] = $clarificationQuestion;
        }

        return $metadata;
    }

    /**
     * Validate builder diff plans before the frontend tries to apply them.
     */
    private function validateBuilderDiffPlanData(array $plan): array
    {
        $responseType = strtolower(trim((string) ($plan['response_type'] ?? $plan['type'] ?? '')));
        if ($responseType !== '' && !in_array($responseType, ['plan', 'builder_diff', 'clarification'], true)) {
            return [
                'valid' => false,
                'message' => 'Planul Volt are un tip de răspuns invalid.',
            ];
        }

        $operations = isset($plan['operations']) && is_array($plan['operations']) ? $plan['operations'] : [];
        $courseUpdates = isset($plan['course_updates']) && is_array($plan['course_updates']) ? $plan['course_updates'] : null;
        $summary = trim((string) ($plan['summary'] ?? ''));
        $clarificationQuestion = trim((string) ($plan['clarification_question'] ?? ''));

        if ($clarificationQuestion !== '') {
            return [
                'valid' => true,
                'clarification' => true,
                'clarification_question' => $clarificationQuestion,
                'operations' => $operations,
                'course_updates' => $courseUpdates,
            ];
        }

        if ($courseUpdates === null && empty($operations)) {
            return [
                'valid' => false,
                'message' => 'Planul Volt nu conține schimbări aplicabile.',
            ];
        }

        $lessonOperations = [];
        $moduleOperations = [];
        foreach ($operations as $op) {
            if (!is_array($op)) {
                return [
                    'valid' => false,
                    'message' => 'Planul Volt conține o operație invalidă.',
                ];
            }

            $opType = strtolower(trim((string) ($op['op'] ?? '')));
            if (in_array($opType, ['create_lesson', 'createlesson', 'update_lesson', 'updatelesson'], true)) {
                $lessonOperations[] = $op;
                $lessonContent = trim((string) ($op['content'] ?? $op['body'] ?? $op['html'] ?? ''));
                if ($opType === 'create_lesson' || $opType === 'createlesson') {
                    if ($lessonContent === '' || $this->countLessonContentLines($lessonContent) < 4) {
                        return [
                            'valid' => false,
                            'message' => 'Planul Volt conține o lecție fără conținut suficient.',
                        ];
                    }
                } elseif ($lessonContent !== '' && $this->countLessonContentLines($lessonContent) < 4) {
                    return [
                        'valid' => false,
                        'message' => 'Planul Volt conține o lecție actualizată cu conținut prea scurt.',
                    ];
                }
            }

            if (in_array($opType, ['create_module', 'createmodule', 'update_module', 'updatemodule'], true)) {
                $moduleOperations[] = $op;
                $nestedLessons = isset($op['lessons']) && is_array($op['lessons']) ? $op['lessons'] : [];
                if (($opType === 'create_module' || $opType === 'createmodule') && empty($nestedLessons)) {
                    return [
                        'valid' => false,
                        'message' => 'Planul Volt modifică module, dar nu include lecții.',
                    ];
                }
                foreach ($nestedLessons as $nestedLesson) {
                    if (!is_array($nestedLesson)) {
                        return [
                            'valid' => false,
                            'message' => 'Planul Volt conține o lecție invalidă în modul.',
                        ];
                    }
                    $nestedContent = trim((string) ($nestedLesson['content'] ?? $nestedLesson['body'] ?? $nestedLesson['html'] ?? ''));
                    if ($nestedContent === '' || $this->countLessonContentLines($nestedContent) < 4) {
                        return [
                            'valid' => false,
                            'message' => 'Planul Volt conține o lecție de modul fără conținut suficient.',
                        ];
                    }
                }
            }
        }

        if (!empty($moduleOperations) && empty($lessonOperations)) {
            return [
                'valid' => false,
                'message' => 'Planul Volt modifică module, dar nu conține lecții.',
            ];
        }

        return [
            'valid' => true,
            'summary' => $summary,
            'course_updates' => $courseUpdates,
            'operations' => $operations,
        ];
    }

    private function countLessonContentLines(string $content): int
    {
        if (trim($content) === '') {
            return 0;
        }

        $normalized = preg_replace('/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/i', "\n", $content) ?? $content;
        $plain = html_entity_decode(strip_tags($normalized), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $plain = str_replace("\r\n", "\n", $plain);
        $plain = str_replace("\r", "\n", $plain);

        $lines = preg_split('/\n+/', $plain) ?: [];
        $nonEmptyLines = array_filter($lines, static function ($line) {
            return trim((string) $line) !== '';
        });

        return count($nonEmptyLines);
    }

    private function ensureLessonHasMinimumLines(string $lessonTitle, string $lessonContent): void
    {
        $lineCount = $this->countLessonContentLines($lessonContent);
        if ($lineCount < self::MIN_LESSON_LINES) {
            throw new \RuntimeException(
                'Lecția "' . ($lessonTitle !== '' ? $lessonTitle : 'fără titlu') . '" trebuie să aibă minimum ' . self::MIN_LESSON_LINES . ' rânduri de conținut util.'
            );
        }
    }

    /**
     * Validate and normalize course data
     */
    private function validateAndNormalizeCourseData($data)
    {
        if (!is_array($data)) {
            Log::warning('Course data is not an array');
            return null;
        }

        $responseType = strtolower(trim((string) ($data['response_type'] ?? 'course')));
        if ($responseType !== 'course') {
            Log::warning('Course schema rejected due to response type', [
                'response_type' => $responseType,
            ]);
            return null;
        }

        $title = trim((string) ($data['title'] ?? ''));
        $description = trim((string) ($data['description'] ?? ''));
        $shortDescription = trim((string) ($data['short_description'] ?? ''));

        if ($title === '' || $description === '') {
            Log::warning('Course schema rejected due to missing title or description', [
                'has_title' => $title !== '',
                'has_description' => $description !== '',
            ]);
            return null;
        }

        if (!isset($data['modules']) || !is_array($data['modules']) || empty($data['modules'])) {
            Log::warning('No modules found in parsed data');
            return null;
        }

        $modulesCount = count($data['modules']);
        if ($modulesCount < 2) {
            Log::warning('Insufficient modules', [
                'required' => 2,
                'found' => $modulesCount
            ]);
            return null;
        }

        $normalizedModules = [];
        foreach ($data['modules'] as $moduleIndex => $module) {
            if (!is_array($module)) {
                Log::warning('Invalid module shape', [
                    'module_index' => $moduleIndex,
                ]);
                return null;
            }

            $moduleTitle = trim((string) ($module['title'] ?? ''));
            if ($moduleTitle === '') {
                Log::warning('Invalid module title', [
                    'module_index' => $moduleIndex,
                ]);
                return null;
            }

            $normalizedModule = [
                'title' => $moduleTitle,
                'description' => isset($module['description']) ? trim((string) $module['description']) : null,
                'lessons' => [],
            ];

            if (!isset($module['lessons']) || !is_array($module['lessons']) || empty($module['lessons'])) {
                Log::warning('Module is missing lessons array', [
                    'module_title' => $moduleTitle,
                    'module_index' => $moduleIndex,
                ]);
                return null;
            }

            foreach ($module['lessons'] as $lessonIndex => $lesson) {
                if (!is_array($lesson)) {
                    Log::warning('Invalid lesson shape', [
                        'module_title' => $moduleTitle,
                        'module_index' => $moduleIndex,
                        'lesson_index' => $lessonIndex,
                    ]);
                    return null;
                }

                $lessonTitle = trim((string) ($lesson['title'] ?? ''));
                if ($lessonTitle === '') {
                    Log::warning('Invalid lesson title', [
                        'module_title' => $moduleTitle,
                        'module_index' => $moduleIndex,
                        'lesson_index' => $lessonIndex,
                    ]);
                    return null;
                }

                $lessonContent = trim((string) ($lesson['content'] ?? ''));
                if ($lessonContent === '') {
                    Log::warning('Invalid lesson content: empty', [
                        'module_title' => $moduleTitle,
                        'lesson_title' => $lessonTitle,
                        'lesson_index' => $lessonIndex,
                    ]);
                    return null;
                }

                $lineCount = $this->countLessonContentLines($lessonContent);
                if ($lineCount < self::MIN_LESSON_LINES) {
                    Log::warning('Invalid lesson content: too few lines', [
                        'module_title' => $moduleTitle,
                        'lesson_title' => $lessonTitle,
                        'required_min_lines' => self::MIN_LESSON_LINES,
                        'found_lines' => $lineCount,
                    ]);
                    throw new \RuntimeException(
                        'Lec?ia "' . $lessonTitle . '" are doar ' . $lineCount . ' randuri. Minimul este ' . self::MIN_LESSON_LINES . '.'
                    );
                }

                $normalizedModule['lessons'][] = [
                    'title' => $lessonTitle,
                    'content' => $lessonContent,
                ];
            }

            $lessonsCount = count($normalizedModule['lessons']);
            if ($lessonsCount < 2) {
                Log::warning('Module has insufficient lessons', [
                    'module_title' => $moduleTitle,
                    'required' => 2,
                    'found' => $lessonsCount
                ]);
                return null;
            }

            $normalizedModules[] = $normalizedModule;
        }

        if (empty($normalizedModules)) {
            Log::warning('No valid modules with lessons found after normalization');
            return null;
        }

        if (count($normalizedModules) < 2) {
            Log::warning('Final validation failed: insufficient modules', [
                'required' => 2,
                'found' => count($normalizedModules)
            ]);
            return null;
        }

        return [
            'response_type' => $responseType,
            'title' => $title,
            'description' => $description,
            'short_description' => $shortDescription !== '' ? $shortDescription : substr($description, 0, 150),
            'modules' => $normalizedModules,
        ];
    }

    /**
     * Check if the request is a clarification or modification request
     */
    private function isClarificationRequest($prompt, $messages)
    {
        $promptLower = strtolower(trim($prompt));
        
        // Cuvinte cheie care indică clarificare/modificare
        $clarificationKeywords = [
            'modifică', 'modifica', 'schimbă', 'schimba', 'change', 'modify',
            'nu vreau', "don't want", 'nu e bine', 'nu e corect',
            'corectează', 'corecteaza', 'correct', 'fix',
            'întrebare', 'intrebare', 'question', 'clarifică', 'clarifica', 'clarify',
            'ce înseamnă', 'ce inseamna', 'what does', 'explică', 'explain',
            'mai multe', 'more', 'detalii', 'details',
            'altfel', 'diferit', 'different', 'alt', 'other'
        ];
        
        foreach ($clarificationKeywords as $keyword) {
            if (strpos($promptLower, $keyword) !== false) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Check if response contains valid course JSON
     */
    private function hasValidCourseJson($responseText)
    {
        // Try to extract JSON from response
        $jsonMatch = preg_match('/\{[\s\S]*\}/', $responseText, $matches);
        if ($jsonMatch && isset($matches[0])) {
            try {
                $data = json_decode($matches[0], true);
                if (json_last_error() === JSON_ERROR_NONE && isset($data['title'])) {
                    return true;
                }
            } catch (\Exception $e) {
                return false;
            }
        }
        return false;
    }
}


