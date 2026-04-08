<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\LessonController;
use App\Http\Controllers\CourseController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\TelemetryController;
use App\Http\Controllers\Api\QuizController;
use App\Http\Controllers\Api\Admin\CourseAdminController;
use App\Http\Controllers\Api\Admin\CourseBuilderController;
use App\Http\Controllers\Api\Admin\QuestionAdminController;
use App\Http\Controllers\Api\Admin\ExamAdminController;
use App\Http\Controllers\Api\Admin\EventAdminController;
use App\Http\Controllers\Api\Admin\DashboardAdminController;
use App\Http\Controllers\Api\Admin\TeamAdminController;
use App\Http\Controllers\Api\Admin\UserAdminController;
use App\Http\Controllers\Api\Admin\ActivityLogAdminController;
use App\Http\Controllers\Api\Admin\MediaAdminController;
use App\Http\Controllers\Api\Admin\CourseMapAdminController;
use App\Http\Controllers\Api\Admin\StatisticsAdminController;

/*
| Fără StartSession / Sanctum stateful — util pe VPS dacă sesiunile DB lipsesc și tot API-ul dă 500.
| GET /api/health → dacă răspunde 200, PHP + rutele merg; dacă 500, verifică DB / .env în container.
*/
Route::get('/health', function () {
    try {
        DB::connection()->getPdo();
    } catch (\Throwable $e) {
        $expose = config('app.debug') || filter_var(env('VOLTA_EXPOSE_API_ERRORS', false), FILTER_VALIDATE_BOOLEAN);
        return response()->json([
            'ok' => false,
            'database' => 'error',
            'message' => $expose ? $e->getMessage() : 'Database connection failed.',
        ], 500);
    }

    return response()->json([
        'ok' => true,
        'database' => 'connected',
        'session_driver' => config('session.driver'),
        'cache_store' => config('cache.default'),
    ]);
})->withoutMiddleware([
    \Illuminate\Session\Middleware\StartSession::class,
    \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
]);

// Public routes – throttle to prevent abuse (e.g. scraping, DoS)
Route::middleware('throttle:120,1')->group(function () {
    Route::get('/courses', [CourseController::class, 'index']);
    Route::get('/courses/{id}', [CourseController::class, 'show']);
    Route::get('/lessons/{id}', [\App\Http\Controllers\Api\LessonController::class, 'show']);
    Route::get('/events', [EventController::class, 'index']);
    Route::get('/events/{id}', [EventController::class, 'show']);
    Route::get('/courses/{courseId}/quiz', [QuizController::class, 'show']);
    Route::post('/courses/{courseId}/quiz/submit', [QuizController::class, 'submit']);
    Route::post('/courses/{courseId}/complete', [CourseController::class, 'complete']);
    Route::get('/builder-media/{courseId}/{mediaId}', [CourseBuilderController::class, 'serveMediaFilePublic']);
});

// CSRF cookie endpoint (needed for session-based auth with CORS)
Route::get('/csrf-cookie', function () {
    return response()->json(['message' => 'CSRF cookie set']);
})->middleware('web');

// Debug-only: check cookies/session (disabled in production)
if (config('app.debug')) {
    Route::get('/test-session', function (Request $request) {
        $sessionId = $request->session()->getId();
        $request->session()->put('test', 'value');
        return response()->json([
            'session_id' => $sessionId,
            'has_session' => $request->hasSession(),
            'cookies_received' => array_keys($request->cookies->all()),
        ]);
    });
}

// Auth routes with rate limiting (prevent brute force attacks)
Route::post('/auth/register', [\App\Http\Controllers\Api\AuthController::class, 'register'])->middleware('throttle:15,1'); // 15 attempts per minute
Route::post('/auth/login', [\App\Http\Controllers\Api\AuthController::class, 'login'])->middleware('throttle:15,1'); // 15 attempts per minute
Route::post('/auth/logout', [\App\Http\Controllers\Api\AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('/auth/me', [\App\Http\Controllers\Api\AuthController::class, 'me'])->middleware('auth:sanctum');
Route::post('/auth/change-password', [\App\Http\Controllers\Api\AuthController::class, 'changePassword'])->middleware(['auth:sanctum', 'throttle:60,1']);

// Protected routes (require authentication) with rate limiting
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () { // 60 requests per minute per user
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/profile', [ProfileController::class, 'index']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::post('/profile/avatar', [ProfileController::class, 'updateAvatar']);
    Route::delete('/profile/avatar', [ProfileController::class, 'removeAvatar']);
    // Lesson completion removed - we use modules now, course completion is through quiz passing
    // Route::post('/lessons/{id}/complete', [LessonController::class, 'complete']);
    Route::get('/courses/{courseId}/progress/{userId}', [LessonController::class, 'getProgress']);
    
    // Student Dashboard
    Route::get('/student/dashboard', [\App\Http\Controllers\Api\StudentDashboardController::class, 'index']);
    
    // Course Progress
    Route::get('/courses/{courseId}/progress', [\App\Http\Controllers\Api\CourseProgressController::class, 'getCourseProgress']);
    Route::post('/courses/{courseId}/finish', [\App\Http\Controllers\Api\CourseProgressController::class, 'finishCourse']);
    Route::post('/lessons/{lessonId}/complete', [\App\Http\Controllers\Api\CourseProgressController::class, 'completeLesson']);
    Route::put('/lessons/{lessonId}/progress', [\App\Http\Controllers\Api\CourseProgressController::class, 'updateLessonProgress']);
    Route::get('/modules/{moduleId}/access', [\App\Http\Controllers\Api\CourseProgressController::class, 'checkModuleAccess']);
    Route::get('/lessons/{lessonId}/access', [\App\Http\Controllers\Api\CourseProgressController::class, 'checkLessonAccess']);
    Route::get('/exams/{examId}/access', [\App\Http\Controllers\Api\CourseProgressController::class, 'checkExamAccess']);
    
    // Course maps (student: list and show map with published courses)
    Route::get('/course-maps', [\App\Http\Controllers\Api\CourseMapController::class, 'index']);
    Route::get('/course-maps/{id}', [\App\Http\Controllers\Api\CourseMapController::class, 'show']);
    
    // Exam endpoints (lista fără curs înainte de {examId})
    Route::get('/exams', [\App\Http\Controllers\Api\ExamController::class, 'learnerStandaloneExams']);
    Route::get('/exams/{examId}', [\App\Http\Controllers\Api\ExamController::class, 'show']);
    Route::post('/exams/{examId}/submit', [\App\Http\Controllers\Api\ExamController::class, 'submit']);
    
    // Exam Results
    Route::get('/exam-results', [\App\Http\Controllers\Api\ExamResultController::class, 'index']);
    Route::get('/exam-results/{id}', [\App\Http\Controllers\Api\ExamResultController::class, 'show']);
    Route::post('/telemetry/events', [TelemetryController::class, 'store']);
    
    // Achievements
    Route::get('/achievements', [\App\Http\Controllers\Api\AchievementController::class, 'index']);
    
    // User Events
    Route::get('/events/my', [EventController::class, 'myEvents']);
    Route::post('/events/{id}/register', [EventController::class, 'register']);
    Route::post('/events/{id}/cancel-registration', [EventController::class, 'cancelRegistration']);
    Route::post('/events/{id}/mark-attendance', [EventController::class, 'markAttendance']);
    Route::post('/events/{id}/mark-replay-watched', [EventController::class, 'markReplayWatched']);
    
    // Messages
    Route::get('/messages/conversations', [\App\Http\Controllers\Api\MessageController::class, 'getConversations']);
    Route::post('/messages/conversations', [\App\Http\Controllers\Api\MessageController::class, 'createConversation']);
    Route::get('/messages/conversations/search', [\App\Http\Controllers\Api\MessageController::class, 'searchConversations']);
    Route::patch('/messages/conversations/{id}', [\App\Http\Controllers\Api\MessageController::class, 'updateConversation']);
    Route::post('/messages/conversations/{id}/leave', [\App\Http\Controllers\Api\MessageController::class, 'leaveGroup']);
    Route::get('/messages/conversations/{id}/messages', [\App\Http\Controllers\Api\MessageController::class, 'getMessages']);
    Route::post('/messages/conversations/{id}/messages', [\App\Http\Controllers\Api\MessageController::class, 'sendMessage']);
    Route::post('/messages/conversations/{id}/read', [\App\Http\Controllers\Api\MessageController::class, 'markAsRead']);
    Route::get('/messages/conversations/{id}/participants', [\App\Http\Controllers\Api\MessageController::class, 'getParticipants']);
    Route::post('/messages/conversations/{id}/participants', [\App\Http\Controllers\Api\MessageController::class, 'addParticipants']);
    Route::patch('/messages/conversations/{id}/participants/{userId}', [\App\Http\Controllers\Api\MessageController::class, 'updateParticipantGroupRole']);
    Route::delete('/messages/conversations/{id}/participants/{userId}', [\App\Http\Controllers\Api\MessageController::class, 'removeParticipant']);
    Route::get('/messages/available-users', [\App\Http\Controllers\Api\MessageController::class, 'getAvailableUsers']);
});

// Admin routes (require admin role) with rate limiting
Route::middleware([
    'auth:sanctum',
    \App\Http\Middleware\StaffAreaAccessMiddleware::class,
    \App\Http\Middleware\AnalystReadOnlyMiddleware::class,
    \App\Http\Middleware\InstructorContentScopeMiddleware::class,
    'throttle:120,1',
])->prefix('admin')->group(function () { // admin | analyst (citire) | instructor (doar conținut)
    // Admin Dashboard
    Route::get('/dashboard', [DashboardAdminController::class, 'index']);
    
    // Courses Management
    Route::get('/courses', [CourseAdminController::class, 'index']);
    // Specific routes must come before parameterized routes
    Route::get('/courses/insights', [CourseAdminController::class, 'insights']);
    Route::get('/courses/teachers/list', [CourseAdminController::class, 'getTeachers']);
    Route::post('/courses/bulk-actions', [CourseAdminController::class, 'bulkAction']);
    // Parameterized routes
    Route::get('/courses/{id}', [CourseAdminController::class, 'show']);
    Route::post('/courses', [CourseAdminController::class, 'store']);
    // POST + FormData pentru imagine: PHP/Laravel parsează fișierele corect; PUT multipart e adesea gol
    Route::match(['put', 'post'], '/courses/{id}', [CourseAdminController::class, 'update']);
    Route::delete('/courses/{id}', [CourseAdminController::class, 'destroy']);
    Route::post('/courses/{id}/teams', [CourseAdminController::class, 'attachTeams']);
    Route::post('/courses/{id}/actions/{action}', [CourseAdminController::class, 'quickAction']);
    Route::post('/courses/{id}/modules/reorder', [CourseAdminController::class, 'reorderModules']);
    Route::get('/courses/{id}/preview', [CourseAdminController::class, 'preview']);

    // Course maps (folders to group courses)
    Route::get('/course-maps', [CourseMapAdminController::class, 'index']);
    Route::get('/course-maps/{id}', [CourseMapAdminController::class, 'show']);
    Route::post('/course-maps', [CourseMapAdminController::class, 'store']);
    Route::put('/course-maps/{id}', [CourseMapAdminController::class, 'update']);
    Route::delete('/course-maps/{id}', [CourseMapAdminController::class, 'destroy']);
    Route::post('/course-maps/{id}/courses', [CourseMapAdminController::class, 'attachCourses']);
    Route::delete('/course-maps/{id}/courses/{courseId}', [CourseMapAdminController::class, 'detachCourse']);
    Route::post('/course-maps/{id}/courses/reorder', [CourseMapAdminController::class, 'reorderCourses']);

    // Media Library (Admin)
    Route::get('/media', [MediaAdminController::class, 'index']);
    Route::delete('/media/{id}', [MediaAdminController::class, 'destroy']);

    // Course Builder (Admin) - orchestration endpoints for autosave & drag&drop
    Route::prefix('/courses/{courseId}/builder')->group(function () {
        Route::get('/structure', [CourseBuilderController::class, 'structure']);
        Route::patch('/structure', [CourseBuilderController::class, 'patchStructure']);

        Route::post('/modules', [CourseBuilderController::class, 'createModule']);
        Route::post('/lessons', [CourseBuilderController::class, 'createLesson']);
        Route::put('/lessons/{lessonId}', [CourseBuilderController::class, 'updateLesson']);

        Route::post('/lessons/{lessonId}/content-blocks', [CourseBuilderController::class, 'createContentBlock']);
        Route::patch('/lessons/{lessonId}/content-blocks/reorder', [CourseBuilderController::class, 'reorderContentBlocks']);
        Route::put('/content-blocks/{blockId}', [CourseBuilderController::class, 'updateContentBlock']);
        Route::delete('/content-blocks/{blockId}', [CourseBuilderController::class, 'deleteContentBlock']);
        Route::post('/upload', [CourseBuilderController::class, 'uploadContentFile']);
        Route::get('/media/{mediaId}/file', [CourseBuilderController::class, 'serveMediaFile']);

        Route::post('/validate', [CourseBuilderController::class, 'validateCourse']);
        Route::post('/submit-for-review', [CourseBuilderController::class, 'submitForReview']);
        Route::post('/publish', [CourseBuilderController::class, 'publish']);
        Route::post('/clone', [CourseBuilderController::class, 'clone']);

        Route::get('/versions', [CourseBuilderController::class, 'versions']);
        Route::post('/versions/{versionId}/restore', [CourseBuilderController::class, 'restoreVersion']);

        Route::get('/tests', [CourseBuilderController::class, 'tests']);
        Route::post('/tests/attach', [CourseBuilderController::class, 'attachTest']);
        Route::post('/tests/{testId}/detach', [CourseBuilderController::class, 'detachTest']);
    });
    
    // Modules Management
    Route::get('/modules', [\App\Http\Controllers\Api\Admin\ModuleAdminController::class, 'index']);
    Route::get('/modules/{id}', [\App\Http\Controllers\Api\Admin\ModuleAdminController::class, 'show']);
    Route::post('/modules', [\App\Http\Controllers\Api\Admin\ModuleAdminController::class, 'store']);
    Route::put('/modules/{id}', [\App\Http\Controllers\Api\Admin\ModuleAdminController::class, 'update']);
    Route::delete('/modules/{id}', [\App\Http\Controllers\Api\Admin\ModuleAdminController::class, 'destroy']);
    Route::post('/modules/{id}/toggle-lock', [\App\Http\Controllers\Api\Admin\ModuleAdminController::class, 'toggleLock']);
    
    // Lessons Management
    Route::get('/lessons', [\App\Http\Controllers\Api\Admin\LessonAdminController::class, 'index']);
    Route::get('/lessons/{id}', [\App\Http\Controllers\Api\Admin\LessonAdminController::class, 'show']);
    Route::post('/lessons', [\App\Http\Controllers\Api\Admin\LessonAdminController::class, 'store']);
    Route::put('/lessons/{id}', [\App\Http\Controllers\Api\Admin\LessonAdminController::class, 'update']);
    Route::delete('/lessons/{id}', [\App\Http\Controllers\Api\Admin\LessonAdminController::class, 'destroy']);
    Route::post('/modules/{moduleId}/lessons/reorder', [\App\Http\Controllers\Api\Admin\LessonAdminController::class, 'reorder']);
    
    // Exams Management (rute fixe înainte de {id})
    Route::get('/exams', [ExamAdminController::class, 'index']);
    Route::get('/exams/pending-reviews', [ExamAdminController::class, 'getPendingReviews']);
    Route::get('/exams/{id}', [ExamAdminController::class, 'show']);
    Route::get('/exams/{id}/preview', [ExamAdminController::class, 'preview']);
    Route::get('/exams/{id}/results', [ExamAdminController::class, 'results']);
    Route::get('/exams/{id}/question-analytics', [ExamAdminController::class, 'questionAnalytics']);
    Route::post('/exams', [ExamAdminController::class, 'store']);
    Route::put('/exams/{id}', [ExamAdminController::class, 'update']);
    Route::post('/exams/{id}/cover', [ExamAdminController::class, 'uploadCover']);
    Route::post('/exams/{id}/duplicate', [ExamAdminController::class, 'duplicate']);
    Route::delete('/exams/{id}', [ExamAdminController::class, 'destroy']);
    
    // Tests Management (Standalone Test Builder)
    Route::get('/tests', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'index']);
    Route::get('/tests/pending-reviews', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'getPendingReviews']);
    Route::get('/tests/{id}', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'show']);
    Route::post('/tests', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'store']);
    Route::put('/tests/{id}', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'update']);
    Route::delete('/tests/{id}', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'destroy']);
    Route::post('/tests/{id}/publish', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'publish']);
    Route::post('/tests/{id}/selection-preview', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'selectionPreview']);
    Route::get('/tests/{id}/questions', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'getQuestions']);
    Route::post('/tests/{id}/questions', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'addQuestion']);
    Route::post('/tests/{id}/questions/reorder', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'reorderQuestions']);
    Route::get('/questions', [QuestionAdminController::class, 'index']);
    Route::get('/questions/tag-suggestions', [QuestionAdminController::class, 'tagSuggestions']);
    Route::post('/questions/bulk-move', [QuestionAdminController::class, 'bulkMove']);
    Route::post('/questions/{id}/toggle-star', [QuestionAdminController::class, 'toggleStar']);
    Route::put('/questions/{id}', [QuestionAdminController::class, 'update']);
    Route::delete('/questions/{id}', [QuestionAdminController::class, 'destroy']);
    Route::post('/questions/{id}/improve', [QuestionAdminController::class, 'improveWithAi']);
    Route::post('/questions/{id}/auto-tag', [QuestionAdminController::class, 'autoTagWithAi']);
    Route::post('/tests/{id}/link-to-course', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'linkToCourse']);
    Route::post('/tests/{id}/unlink-from-course', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'unlinkFromCourse']);
    
    // Question Banks Management
    Route::get('/question-banks', [\App\Http\Controllers\Api\Admin\QuestionBankAdminController::class, 'index']);
    Route::get('/question-banks/{id}', [\App\Http\Controllers\Api\Admin\QuestionBankAdminController::class, 'show']);
    Route::post('/question-banks', [\App\Http\Controllers\Api\Admin\QuestionBankAdminController::class, 'store']);
    Route::put('/question-banks/{id}', [\App\Http\Controllers\Api\Admin\QuestionBankAdminController::class, 'update']);
    Route::delete('/question-banks/{id}', [\App\Http\Controllers\Api\Admin\QuestionBankAdminController::class, 'destroy']);
    Route::get('/question-banks/{id}/questions', [\App\Http\Controllers\Api\Admin\QuestionBankAdminController::class, 'getQuestions']);
    Route::post('/question-banks/{id}/questions', [\App\Http\Controllers\Api\Admin\QuestionBankAdminController::class, 'addQuestion']);
    Route::post('/question-banks/{id}/questions/bulk', [\App\Http\Controllers\Api\Admin\QuestionBankAdminController::class, 'addQuestions']);
    Route::put('/question-banks/{id}/questions/{questionId}', [\App\Http\Controllers\Api\Admin\QuestionBankAdminController::class, 'updateQuestion']);
    Route::delete('/question-banks/{id}/questions/{questionId}', [\App\Http\Controllers\Api\Admin\QuestionBankAdminController::class, 'removeQuestion']);
    Route::post('/question-banks/{id}/questions/reorder', [\App\Http\Controllers\Api\Admin\QuestionBankAdminController::class, 'reorderQuestions']);
    Route::post('/question-banks/{id}/ai/preview', [\App\Http\Controllers\Api\Admin\QuestionBankAdminController::class, 'previewAiQuestions']);
    Route::post('/question-banks/{id}/generate-from-course', [\App\Http\Controllers\Api\Admin\QuestionBankAdminController::class, 'generateFromCourse']);
    Route::post('/question-banks/{id}/generate-from-text', [\App\Http\Controllers\Api\Admin\QuestionBankAdminController::class, 'generateFromText']);
    
    // Progression Rules Management
    Route::get('/courses/{courseId}/progression-rules', [\App\Http\Controllers\Api\Admin\ProgressionRulesController::class, 'index']);
    Route::post('/courses/{courseId}/progression-rules', [\App\Http\Controllers\Api\Admin\ProgressionRulesController::class, 'store']);
    Route::put('/courses/{courseId}/progression-rules/{ruleId}', [\App\Http\Controllers\Api\Admin\ProgressionRulesController::class, 'update']);
    Route::delete('/courses/{courseId}/progression-rules/{ruleId}', [\App\Http\Controllers\Api\Admin\ProgressionRulesController::class, 'destroy']);
    Route::post('/courses/{courseId}/progression-rules/{ruleId}/toggle', [\App\Http\Controllers\Api\Admin\ProgressionRulesController::class, 'toggle']);
    Route::post('/courses/{courseId}/progression-rules/reorder', [\App\Http\Controllers\Api\Admin\ProgressionRulesController::class, 'reorder']);
    
    // Events Management
    Route::get('/events', [EventAdminController::class, 'index']);
    Route::get('/events/insights', [EventAdminController::class, 'insights']);
    Route::get('/events/instructors/list', [EventAdminController::class, 'getInstructors']);
    Route::post('/events/bulk-actions', [EventAdminController::class, 'bulkAction']);
    Route::get('/events/{id}', [EventAdminController::class, 'show']);
    Route::post('/events', [EventAdminController::class, 'store']);
    Route::put('/events/{id}', [EventAdminController::class, 'update']);
    Route::delete('/events/{id}', [EventAdminController::class, 'destroy']);
    Route::post('/events/{id}/actions/{action}', [EventAdminController::class, 'quickAction']);
    
    // Teams Management
    Route::get('/teams', [TeamAdminController::class, 'index']);
    Route::get('/teams/{id}', [TeamAdminController::class, 'show']);
    Route::post('/teams', [TeamAdminController::class, 'store']);
    Route::put('/teams/{id}', [TeamAdminController::class, 'update']);
    Route::delete('/teams/{id}', [TeamAdminController::class, 'destroy']);
    Route::post('/teams/{id}/users', [TeamAdminController::class, 'attachUsers']);
    Route::post('/teams/{id}/courses', [TeamAdminController::class, 'attachCourses']);
    
    // Users Management
    Route::get('/users', [UserAdminController::class, 'index']);
    Route::get('/users/{id}', [UserAdminController::class, 'show']);
    Route::post('/users', [UserAdminController::class, 'store']);
    Route::put('/users/{id}', [UserAdminController::class, 'update']);
    Route::delete('/users/{id}', [UserAdminController::class, 'destroy']);
    Route::post('/users/{id}/restore', [UserAdminController::class, 'restore']);
    Route::post('/users/{id}/approve', [UserAdminController::class, 'approve']);
    Route::post('/users/{id}/reject', [UserAdminController::class, 'reject']);
    Route::post('/users/{id}/courses', [UserAdminController::class, 'assignCourses']);
    Route::delete('/users/{id}/courses/{courseId}', [UserAdminController::class, 'removeCourse']);
    
    // Team Members Management
    Route::get('/team-members', [UserAdminController::class, 'getTeamMembers']);
    Route::put('/team-members/{id}/role-permissions', [UserAdminController::class, 'updateRoleAndPermissions']);
    Route::post('/team-members/{id}/activate', [UserAdminController::class, 'activate']);
    Route::post('/team-members/{id}/suspend', [UserAdminController::class, 'suspend']);
    Route::post('/team-members/{id}/reset-access', [UserAdminController::class, 'resetAccess']);
    Route::post('/team-members/{id}/remove-from-team', [UserAdminController::class, 'removeFromTeam']);
    
    
    // Statistici (doar admin)
    Route::get('/statistics/course-test-detail', [StatisticsAdminController::class, 'courseTestDetail']);

    // Activity Logs
    Route::get('/activity-logs', [ActivityLogAdminController::class, 'index']);
    Route::get('/activity-logs/{id}', [ActivityLogAdminController::class, 'show']);
    
    // Exam Manual Review (legacy Exam model)
    Route::post('/exam-results/{id}/manual-review', [ExamAdminController::class, 'submitManualReview']);

    // Test Manual Review (Test model - standalone tests)
    Route::post('/test-results/{id}/manual-review', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'submitManualReview']);
    
    // Admin Settings
    Route::get('/settings', [\App\Http\Controllers\Api\Admin\SettingsController::class, 'index']);
    Route::get('/settings/{key}', [\App\Http\Controllers\Api\Admin\SettingsController::class, 'show']);
    Route::put('/settings', [\App\Http\Controllers\Api\Admin\SettingsController::class, 'update']);
    
    // Admin System
    Route::get('/export', [\App\Http\Controllers\Api\Admin\SettingsController::class, 'export']);
    Route::post('/system/clear-cache', [\App\Http\Controllers\Api\Admin\SettingsController::class, 'clearCache']);
    Route::post('/import', [\App\Http\Controllers\Api\Admin\SettingsController::class, 'importBackup']);
    
    // AI Generation routes (Hugging Face)
    Route::post('/ai/generate-course', [\App\Http\Controllers\AIController::class, 'generateCourse']);
    Route::post('/ai/generate-test', [\App\Http\Controllers\AIController::class, 'generateTest']);
});
