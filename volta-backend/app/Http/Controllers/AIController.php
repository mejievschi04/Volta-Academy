<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Course;
use App\Models\Module;
use App\Models\Lesson;
use App\Models\User;
use App\Services\CourseBuilderService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class AIController extends Controller
{
    private $apiKey;
    private $apiUrl;
    private $model;
    private $provider; // 'openai' sau 'huggingface'
    private $courseBuilderService;
    
    // Lista de modele Groq în ordinea preferinței (fallback chain)
    // Modele disponibile la Groq (verificate 2024)
    private $groqModelFallbackChain = [
        'llama-3.1-8b-instant',        // Rapid și eficient
        'llama-3.1-70b-versatile',      // Puternic (dacă disponibil)
        'mixtral-8x7b-32768',          // Alternativă bună
        'gemma-7b-it',                 // Model Google
        'llama-3.3-70b-versatile'      // Cel mai nou (dacă disponibil)
    ];
    private $currentModelIndex = 0;

    public function __construct(CourseBuilderService $courseBuilderService)
    {
        $this->courseBuilderService = $courseBuilderService;
        
        // Verifică ce provider este configurat
        $this->provider = env('AI_PROVIDER', 'groq'); // Default: Groq (gratuit pentru test)
        
        $this->initializeProvider($this->provider);
    }
    
    /**
     * Initializează un provider specific
     */
    private function initializeProvider($provider)
    {
        $this->provider = $provider;
        
        if ($provider === 'openai') {
            $this->apiKey = env('OPENAI_API_KEY');
            $this->apiUrl = env('OPENAI_API_URL', 'https://api.openai.com/v1');
            $this->model = env('OPENAI_MODEL', 'gpt-4o-mini');
        } elseif ($provider === 'groq') {
            // Groq - gratuit, rapid, perfect pentru test
            $this->apiKey = env('GROQ_API_KEY');
            $this->apiUrl = env('GROQ_API_URL', 'https://api.groq.com/openai/v1');
            
            // Verifică dacă utilizatorul a setat un model specific în .env
            $envModel = env('GROQ_MODEL');
            if ($envModel) {
                $this->model = $envModel;
                // Găsește index-ul modelului în fallback chain
                $this->currentModelIndex = array_search($envModel, $this->groqModelFallbackChain);
                if ($this->currentModelIndex === false) {
                    // Modelul nu e în listă, îl adăugăm la început
                    array_unshift($this->groqModelFallbackChain, $envModel);
                    $this->currentModelIndex = 0;
                }
            } else {
                // Folosește primul model din fallback chain
                $this->model = $this->groqModelFallbackChain[0];
                $this->currentModelIndex = 0;
            }
        } else {
            // Hugging Face (pentru compatibilitate)
            $this->apiKey = env('HUGGINGFACE_API_KEY');
            $this->apiUrl = env('HUGGINGFACE_API_URL', 'https://router.huggingface.co');
            $this->model = env('HUGGINGFACE_MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct');
        }
        
        if (!$this->apiKey) {
            Log::warning("AI API key not configured for provider: {$provider}");
        }
    }
    
    
    /**
     * Obține următorul model Groq disponibil din fallback chain
     */
    private function getNextGroqModel()
    {
        $this->currentModelIndex++;
        
        if ($this->currentModelIndex >= count($this->groqModelFallbackChain)) {
            return null; // Nu mai sunt modele disponibile
        }
        
        return $this->groqModelFallbackChain[$this->currentModelIndex];
    }
    
    /**
     * Verifică dacă eroarea este de tip rate limit/quota exceeded
     */
    private function isRateLimitError($httpCode, $errorMessage)
    {
        if ($httpCode === 429) {
            return true;
        }
        
        $errorLower = strtolower($errorMessage);
        $rateLimitKeywords = ['rate limit', 'quota', 'exceeded', 'too many requests', 'limit reached'];
        
        foreach ($rateLimitKeywords as $keyword) {
            if (strpos($errorLower, $keyword) !== false) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Generate course using Hugging Face API
     */
    public function generateCourse(Request $request)
    {
        return $this->streamResponse($request, 'course');
    }

    /**
     * Generate test using Hugging Face API
     */
    public function generateTest(Request $request)
    {
        return $this->streamResponse($request, 'test');
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
        
        Log::info('AI Generation Request', [
            'type' => $type,
            'prompt' => substr($prompt, 0, 100),
            'has_messages' => count($messages) > 0,
            'is_clarification' => $isClarification,
            'teacher_id' => $teacherId
        ]);

        // Verifică dacă este o cerere de clarificare
        $isClarification = $this->isClarificationRequest($prompt, $messages);
        $teacherId = $request->input('teacher_id') ?? Auth::id();

        // Construiește prompt-ul pentru generare (fără parametrul isClarification - AI decide singur)
        $systemPrompt = $this->getSystemPrompt($type, $courseId);
        
        // Formatează mesajele pentru Hugging Face
        $formattedMessages = $this->formatMessages($systemPrompt, $messages, $prompt);

        // Configurează response pentru streaming
        return response()->stream(function () use ($formattedMessages, $type, $teacherId, $isClarification, $courseId) {
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
            
            // Apelează API-ul AI (OpenAI, Groq sau Hugging Face)
            if ($this->provider === 'openai' || $this->provider === 'groq') {
                // Groq folosește același format ca OpenAI
                $this->streamOpenAIResponse($formattedMessages, $type, $teacherId, $courseId, $fullResponse);
                
                // După streaming, verifică dacă trebuie să creezi cursul
                if ($type === 'course' && !empty($fullResponse)) {
                    // Verifică dacă este răspuns fallback
                    $isFallback = strpos($fullResponse, 'Curs generat prin AI') !== false ||
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
                        // AI-ul a generat un curs valid - creează-l sau actualizează-l automat
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
                                if (ob_get_level() > 0) {
                                    ob_flush();
                                }
                                flush();
                            }
                        } catch (\Exception $e) {
                            Log::error('Error creating/updating course from AI response', [
                                'error' => $e->getMessage(),
                                'trace' => $e->getTraceAsString(),
                                'course_id' => $courseId
                            ]);
                            echo "data: " . json_encode([
                                'content' => "\n\n❌ Eroare la " . ($courseId ? 'actualizarea' : 'crearea') . " cursului: " . $e->getMessage() . "\n\nTe rugăm să încerci din nou sau să reformulezi cererea."
                            ]) . "\n\n";
                            if (ob_get_level() > 0) {
                                ob_flush();
                            }
                            flush();
                        }
                    }
                    // Dacă nu are JSON valid, înseamnă că AI-ul a întrebat ceva - nu creăm/modificăm cursul
                }
            } else {
                $this->streamHuggingFaceResponse($formattedMessages, $type, $teacherId, $courseId, $fullResponse);
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
                
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    private function getSystemPrompt($type, $courseId = null, $isClarification = false)
    {
        if ($type === 'course') {
            // OpenAI și Groq suportă JSON mode
            $jsonMode = ($this->provider === 'openai' || $this->provider === 'groq') ? 'IMPORTANT: Răspunde ÎNTOTDEAUNA în format JSON valid. ' : '';
            
            return "Ești un asistent AI expert în crearea de cursuri educaționale în limba română. 
Creează cursuri structurate, clare și educative.

{$jsonMode}IMPORTANT: 
- Dacă cererea utilizatorului este clară și completă, răspunde DIRECT în format JSON valid cu structura de mai jos și creează cursul automat.
- Dacă ceva nu este clar sau lipsesc detalii importante (ex: nivel dificultate, durată, obiective specifice), ÎNTREABĂ utilizatorul înainte de a genera cursul.
- Dacă utilizatorul cere modificări sau clarificări, răspunde la întrebări și oferă sugestii.

REGLI OBLIGATORII pentru generarea cursului:
- Creează EXACT 2 module pentru fiecare curs (OBLIGATORIU)
- Fiecare modul trebuie să aibă EXACT 2 lecții (OBLIGATORIU)
- Fiecare lecție trebuie să aibă conținut DETALIAT echivalent cu MINIM 1 PAGINĂ A4 (minim 500-600 cuvinte, ideal 800-1000 cuvinte)
- Conținutul lecției trebuie să fie educativ, structurat și complet - trebuie să poată fi tipărit pe o pagină A4 completă
- Modulele trebuie să fie progresive (de la baze la concepte avansate)
- IMPORTANT: Verifică că ai creat EXACT 2 module și EXACT 2 lecții per modul înainte de a răspunde
- IMPORTANT: Fiecare lecție TREBUIE să aibă conținut suficient pentru o pagină A4 completă (500-600 cuvinte minim) - aceasta este OBLIGATORIE, nu opțională
- IMPORTANT: Nu trimite lecții cu conținut scurt - fiecare lecție trebuie să aibă minim 500-600 cuvinte de conținut educativ complet

FORMATARE ȘI ELEMENTE INTERACTIVE pentru conținutul lecțiilor:
- Folosește HTML pentru formatare (h2, h3, p, ul, ol, strong, em, code, pre, blockquote)
- Include elemente interactive și vizuale:
  * Code blocks cu exemple practice (folosește pre și code tags)
  * Exerciții practice cu soluții
  * Diagrame/explicații pas cu pas
  * Callout boxes pentru informații importante (folosește div cu class info-box)
  * Listuri cu checkpoints sau obiective
  * Exemple reale și cazuri practice
  * Sfaturi și best practices (folosește div cu class tip-box)
  * Avertizări pentru greșeli comune (folosește div cu class warning-box)
- Structurază conținutul cu secțiuni clare (Introducere, Concepte cheie, Exemple practice, Exerciții, Rezumat)
- Folosește formatare pentru a evidenția concepte importante (bold, italic, code inline)
- Include link-uri către resurse externe când este relevant

Când ai suficiente informații, răspunde ÎNTOTDEAUNA în format JSON valid (fără text înainte sau după JSON).

IMPORTANT: Exemplul de mai jos arată STRUCTURA, dar tu trebuie să creezi EXACT 2 module cu EXACT 2 lecții fiecare.

Exemplu de structură (trebuie să ai EXACT 2 module cu EXACT 2 lecții fiecare):
{
    \"title\": \"Titlul cursului\",
    \"description\": \"Descrierea detaliată a cursului (minim 200 cuvinte)\",
    \"short_description\": \"Descriere scurtă (max 150 caractere)\",
    \"modules\": [
        {
            \"title\": \"Titlul modulului 1\",
            \"description\": \"Descrierea modulului\",
            \"lessons\": [
                {
                    \"title\": \"Titlul lecției 1\",
                    \"content\": \"<h2>Introducere</h2><p>Paragraf introductiv detaliat despre subiect (minim 100-150 cuvinte)...</p><h3>Concepte cheie</h3><p>Explicație detaliată a conceptelor (minim 150-200 cuvinte)...</p><ul><li>Conceptul 1 cu explicație detaliată</li><li>Conceptul 2 cu explicație detaliată</li><li>Conceptul 3 cu explicație detaliată</li></ul><div class=\\\"info-box\\\"><strong>💡 Informație importantă:</strong> Text explicativ detaliat (minim 50-100 cuvinte)...</div><h3>Exemplu practic</h3><p>Explicație detaliată a exemplului (minim 100-150 cuvinte)...</p><pre><code>// Exemplu de cod sau structură completă</code></pre><p>Explicație a codului (minim 50-100 cuvinte)...</p><div class=\\\"tip-box\\\"><strong>💡 Sfat:</strong> Best practice sau recomandare detaliată (minim 50-100 cuvinte)...</div><h3>Exercițiu</h3><p>Descriere detaliată a exercițiului cu instrucțiuni clare (minim 100-150 cuvinte)...</p><h3>Rezumat</h3><p>Rezumat detaliat al lecției (minim 50-100 cuvinte)...</p>\"
                },
                {
                    \"title\": \"Titlul lecției 2\",
                    \"content\": \"<h2>Introducere</h2><p>Paragraf introductiv detaliat (minim 100-150 cuvinte)...</p><h3>Exemplu practic</h3><p>Explicație detaliată (minim 100-150 cuvinte)...</p><pre><code>// Cod exemplu complet</code></pre><p>Explicație a codului (minim 50-100 cuvinte)...</p><div class=\\\"warning-box\\\"><strong>⚠️ Atenție:</strong> Greșeală comună de evitat cu explicație detaliată (minim 50-100 cuvinte)...</div><h3>Exercițiu practic</h3><p>Descriere detaliată a exercițiului cu soluție completă (minim 100-150 cuvinte)...</p><h3>Rezumat</h3><p>Rezumat detaliat (minim 50-100 cuvinte)...</p>\"
                },
                }
            ]
        },
        {
            \"title\": \"Titlul modulului 2\",
            \"description\": \"Descrierea modulului\",
            \"lessons\": [
                {
                    \"title\": \"Titlul lecției 1\",
                    \"content\": \"<h2>Introducere</h2><p>Paragraf introductiv detaliat despre subiect (minim 100-150 cuvinte)...</p><h3>Concepte cheie</h3><p>Explicație detaliată a conceptelor (minim 150-200 cuvinte)...</p><ul><li>Conceptul 1 cu explicație detaliată</li><li>Conceptul 2 cu explicație detaliată</li><li>Conceptul 3 cu explicație detaliată</li></ul><div class=\\\"info-box\\\"><strong>💡 Informație importantă:</strong> Text explicativ detaliat (minim 50-100 cuvinte)...</div><h3>Exemplu practic</h3><p>Explicație detaliată a exemplului (minim 100-150 cuvinte)...</p><pre><code>// Exemplu de cod sau structură completă</code></pre><p>Explicație a codului (minim 50-100 cuvinte)...</p><div class=\\\"tip-box\\\"><strong>💡 Sfat:</strong> Best practice sau recomandare detaliată (minim 50-100 cuvinte)...</div><h3>Exercițiu</h3><p>Descriere detaliată a exercițiului cu instrucțiuni clare (minim 100-150 cuvinte)...</p><h3>Rezumat</h3><p>Rezumat detaliat al lecției (minim 50-100 cuvinte)...</p>\"
                },
                {
                    \"title\": \"Titlul lecției 2\",
                    \"content\": \"<h2>Introducere</h2><p>Paragraf introductiv detaliat (minim 100-150 cuvinte)...</p><h3>Exemplu practic</h3><p>Explicație detaliată (minim 100-150 cuvinte)...</p><pre><code>// Cod exemplu complet</code></pre><p>Explicație a codului (minim 50-100 cuvinte)...</p><div class=\\\"warning-box\\\"><strong>⚠️ Atenție:</strong> Greșeală comună de evitat cu explicație detaliată (minim 50-100 cuvinte)...</div><h3>Exercițiu practic</h3><p>Descriere detaliată a exercițiului cu soluție completă (minim 100-150 cuvinte)...</p><h3>Rezumat</h3><p>Rezumat detaliat (minim 50-100 cuvinte)...</p>\"
                }
            ]
        }
    ]
}

Dacă nu ai suficiente informații, răspunde în text normal cu întrebări pentru a clarifica.";
        } else {
            return "Ești un asistent AI expert în crearea de teste educaționale în limba română. 
Creează teste cu întrebări clare și răspunsuri corecte. 
Răspunde întotdeauna în format JSON valid cu următoarea structură:
{
    \"title\": \"Titlul testului\",
    \"description\": \"Descrierea testului\",
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

        // Adaugă istoricul mesajelor (ultimele 5 pentru a nu depăși limitele)
        $recentMessages = array_slice($messages, -5);
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
    private function streamOpenAIResponse($messages, $type, $teacherId = null, $courseId = null, &$fullResponse = null)
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

            // Prepare request payload
            $payload = [
                'model' => $this->model,
                'messages' => $messages,
                'stream' => true,
                'temperature' => 0.7,
                'max_tokens' => 4000,
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
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $this->apiKey,
                'Content-Type: application/json',
            ]);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, env('APP_ENV') === 'production');
            curl_setopt($ch, CURLOPT_TIMEOUT, 180);
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
                                if (ob_get_level() > 0) {
                                    ob_flush();
                                }
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
                        if (ob_get_level() > 0) {
                            ob_flush();
                        }
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
                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
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
                        ob_flush();
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
                $isFallback = strpos($fullResponse, 'Curs generat prin AI') !== false && 
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
                    // AI-ul a generat un curs valid - creează-l sau actualizează-l automat
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
                            if (ob_get_level() > 0) {
                                ob_flush();
                            }
                            flush();
                        }
                    } catch (\Exception $e) {
                        Log::error('Error creating/updating course from AI response', [
                            'error' => $e->getMessage(),
                            'trace' => $e->getTraceAsString(),
                            'course_id' => $courseId
                        ]);
                        echo "data: " . json_encode([
                            'content' => "\n\n❌ Eroare la " . ($courseId ? 'actualizarea' : 'crearea') . " cursului: " . $e->getMessage() . "\n\nTe rugăm să încerci din nou sau să reformulezi cererea."
                        ]) . "\n\n";
                        if (ob_get_level() > 0) {
                            ob_flush();
                        }
                        flush();
                    }
                }
                // Dacă nu are JSON valid, înseamnă că AI-ul a întrebat ceva - nu creăm/modificăm cursul
            }

            echo "data: [DONE]\n\n";
            if (ob_get_level() > 0) {
                ob_flush();
            }
            flush();
        } catch (\Exception $e) {
            Log::error('Hugging Face API Exception', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            echo "data: " . json_encode([
                'error' => 'Eroare la generarea răspunsului: ' . $e->getMessage()
            ]) . "\n\n";
            ob_flush();
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
            if (ob_get_level() > 0) {
                ob_flush();
            }
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
                'title' => 'Curs generat prin AI',
                'description' => 'Acesta este un curs generat automat. Te rugăm să completezi detaliile manual.',
                'short_description' => 'Curs generat prin AI',
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
                'title' => 'Test generat prin AI',
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
     * Create or update course, modules and lessons from AI response
     */
    private function createOrUpdateCourseFromResponse($responseText, $teacherId = null, $existingCourseId = null)
    {
        try {
            // Parse JSON from response
            $courseData = $this->parseCourseData($responseText);
            
            if (!$courseData) {
                Log::warning('Could not parse course data from AI response');
                return null;
            }

            Log::info('Creating/updating course from AI response', [
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
                    'title' => $courseData['title'] ?? 'Curs generat prin AI',
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
                throw new \Exception('Nu s-au găsit module în răspunsul AI. Te rugăm să reformulezi cererea.');
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
                        
                        $lessonContent = $lessonData['content'] ?? '';
                        // Check if content is at least 1 A4 page (500-600 words = ~3000-4000 characters)
                        $contentTextLength = strlen(trim(strip_tags($lessonContent)));
                        $minContentLength = 3000; // Minimum for 1 A4 page
                        
                        if (empty($lessonContent)) {
                            Log::warning('Lesson content is empty', [
                                'module_id' => $module->id,
                                'lesson_title' => $lessonData['title']
                            ]);
                            // Use title as fallback content only if completely empty
                            $lessonContent = $lessonData['title'] . "\n\nConținutul acestei lecții va fi completat ulterior.";
                        } elseif ($contentTextLength < $minContentLength) {
                            // Content exists but is too short - save it anyway but log warning
                            Log::warning('Lesson content is too short for 1 A4 page, but saving it anyway', [
                                'module_id' => $module->id,
                                'lesson_title' => $lessonData['title'],
                                'content_length' => $contentTextLength,
                                'required_min' => $minContentLength
                            ]);
                            // Keep the original content - don't replace it with fallback
                        }
                        
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
            Log::error('Error creating course from AI response', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Parse course data from AI response
     */
    private function parseCourseData($responseText)
    {
        // Try multiple methods to extract JSON
        
        // Method 1: Try to find JSON block (between ```json and ``` or just ```)
        $jsonBlockPattern = '/```(?:json)?\s*(\{[\s\S]*?\})\s*```/';
        if (preg_match($jsonBlockPattern, $responseText, $matches)) {
            try {
                $data = json_decode($matches[1], true);
                if (json_last_error() === JSON_ERROR_NONE && isset($data['title'])) {
                    Log::info('Parsed JSON from code block', ['modules_count' => count($data['modules'] ?? [])]);
                    return $this->validateAndNormalizeCourseData($data);
                }
            } catch (\Exception $e) {
                Log::warning('Failed to parse JSON from code block', ['error' => $e->getMessage()]);
            }
        }
        
        // Method 2: Try to extract JSON object (greedy match for complete JSON)
        $jsonPattern = '/\{[\s\S]*\}/';
        if (preg_match($jsonPattern, $responseText, $matches)) {
            try {
                $data = json_decode($matches[0], true);
                if (json_last_error() === JSON_ERROR_NONE && isset($data['title'])) {
                    Log::info('Parsed JSON from text', ['modules_count' => count($data['modules'] ?? [])]);
                    return $this->validateAndNormalizeCourseData($data);
                }
            } catch (\Exception $e) {
                Log::warning('Failed to parse JSON from text', ['error' => $e->getMessage()]);
            }
        }
        
        // Method 3: Try to find JSON starting from first {
        $startPos = strpos($responseText, '{');
        if ($startPos !== false) {
            $jsonCandidate = substr($responseText, $startPos);
            // Try to find the matching closing brace
            $braceCount = 0;
            $endPos = -1;
            for ($i = 0; $i < strlen($jsonCandidate); $i++) {
                if ($jsonCandidate[$i] === '{') $braceCount++;
                if ($jsonCandidate[$i] === '}') $braceCount--;
                if ($braceCount === 0) {
                    $endPos = $i + 1;
                    break;
                }
            }
            if ($endPos > 0) {
                $jsonStr = substr($jsonCandidate, 0, $endPos);
                try {
                    $data = json_decode($jsonStr, true);
                    if (json_last_error() === JSON_ERROR_NONE && isset($data['title'])) {
                        Log::info('Parsed JSON by brace matching', ['modules_count' => count($data['modules'] ?? [])]);
                        return $this->validateAndNormalizeCourseData($data);
                    }
                } catch (\Exception $e) {
                    Log::warning('Failed to parse JSON by brace matching', ['error' => $e->getMessage()]);
                }
            }
        }

        // Fallback: try to extract structured data from text
        $titleMatch = preg_match('/Titlu[:\s]+(.+?)(?:\n|$)/i', $responseText, $titleMatches) ||
                     preg_match('/Title[:\s]+(.+?)(?:\n|$)/i', $responseText, $titleMatches);
        
        $descMatch = preg_match('/Descriere[:\s]+(.+?)(?:\n|$)/i', $responseText, $descMatches) ||
                    preg_match('/Description[:\s]+(.+?)(?:\n|$)/i', $responseText, $descMatches);

        if ($titleMatch || $descMatch) {
            return [
                'title' => $titleMatch ? trim($titleMatches[1]) : 'Curs generat prin AI',
                'description' => $descMatch ? trim($descMatches[1]) : $responseText,
                'short_description' => $descMatch ? substr(trim($descMatches[1]), 0, 150) : substr($responseText, 0, 150),
                'modules' => [
                    [
                        'title' => 'Modulul 1',
                        'description' => 'Modul generat automat',
                        'lessons' => [
                            [
                                'title' => 'Lecția 1',
                                'content' => $responseText
                            ]
                        ]
                    ]
                ]
            ];
        }

        return null;
    }

    /**
     * Validate and normalize course data
     */
    private function validateAndNormalizeCourseData($data)
    {
        // Ensure modules array exists and has content
        if (!isset($data['modules']) || !is_array($data['modules']) || empty($data['modules'])) {
            Log::warning('No modules found in parsed data');
            return null;
        }
        
        // Validate minimum requirements: 2 modules, 2 lessons per module
        $modulesCount = count($data['modules']);
        if ($modulesCount < 2) {
            Log::warning('Insufficient modules', [
                'required' => 2,
                'found' => $modulesCount
            ]);
            // Don't return null - let it continue but log warning
        }

        // Validate and normalize each module
        $normalizedModules = [];
        foreach ($data['modules'] as $moduleIndex => $module) {
            if (!isset($module['title']) || empty($module['title'])) {
                continue; // Skip invalid modules
            }

            $normalizedModule = [
                'title' => $module['title'],
                'description' => $module['description'] ?? null,
                'lessons' => []
            ];

            // Validate and normalize lessons
            if (isset($module['lessons']) && is_array($module['lessons'])) {
                foreach ($module['lessons'] as $lessonIndex => $lesson) {
                    if (!isset($lesson['title']) || empty($lesson['title'])) {
                        continue; // Skip invalid lessons
                    }

                    $lessonContent = $lesson['content'] ?? '';
                    // If content is empty or too short, try to use description or title
                    if (empty($lessonContent) || strlen(trim($lessonContent)) < 50) {
                        $lessonContent = $lesson['description'] ?? $lesson['title'] ?? '';
                    }

                    $normalizedModule['lessons'][] = [
                        'title' => $lesson['title'],
                        'content' => $lessonContent
                    ];
                }
            }
            
            // Validate minimum lessons per module (2 lessons required)
            $lessonsCount = count($normalizedModule['lessons']);
            if ($lessonsCount < 2) {
                Log::warning('Module has insufficient lessons', [
                    'module_title' => $normalizedModule['title'],
                    'required' => 2,
                    'found' => $lessonsCount
                ]);
                // Don't skip - let it continue but log warning
            }

            // Only add module if it has at least one lesson
            if (!empty($normalizedModule['lessons'])) {
                $normalizedModules[] = $normalizedModule;
            }
        }

        if (empty($normalizedModules)) {
            Log::warning('No valid modules with lessons found after normalization');
            return null;
        }
        
        // Final validation: ensure we have at least 2 modules
        if (count($normalizedModules) < 2) {
            Log::warning('Final validation failed: insufficient modules', [
                'required' => 2,
                'found' => count($normalizedModules)
            ]);
            // Continue anyway but log the issue - AI should follow instructions
        }
        
        // Validate each module has at least 2 lessons
        foreach ($normalizedModules as $moduleIndex => $module) {
            $lessonsCount = count($module['lessons'] ?? []);
            if ($lessonsCount < 2) {
                Log::warning('Final validation failed: module has insufficient lessons', [
                    'module_index' => $moduleIndex,
                    'module_title' => $module['title'] ?? 'N/A',
                    'required' => 2,
                    'found' => $lessonsCount
                ]);
                // Continue anyway but log the issue - AI should follow instructions
            }
        }

        return [
            'title' => $data['title'] ?? 'Curs generat prin AI',
            'description' => $data['description'] ?? '',
            'short_description' => $data['short_description'] ?? substr($data['description'] ?? '', 0, 150),
            'modules' => $normalizedModules
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

