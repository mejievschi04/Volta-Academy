<?php

use Illuminate\Http\Request;
use App\Http\Controllers\LessonController;
use App\Http\Controllers\CourseController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\QuizController;
use App\Http\Controllers\Api\Admin\CourseAdminController;
use App\Http\Controllers\Api\Admin\ExamAdminController;
use App\Http\Controllers\Api\Admin\EventAdminController;
use App\Http\Controllers\Api\Admin\DashboardAdminController;
use App\Http\Controllers\Api\Admin\TeamAdminController;
use App\Http\Controllers\Api\Admin\UserAdminController;
use App\Http\Controllers\Api\Admin\ActivityLogAdminController;

// Public routes
Route::get('/courses', [CourseController::class, 'index']);
Route::get('/courses/{id}', [CourseController::class, 'show']);
// Lessons routes for users
Route::get('/lessons/{id}', [\App\Http\Controllers\Api\LessonController::class, 'show']);
// Public event routes
Route::get('/events', [EventController::class, 'index']);
Route::get('/events/{id}', [EventController::class, 'show']);
Route::get('/courses/{courseId}/quiz', [QuizController::class, 'show']);
Route::post('/courses/{courseId}/quiz/submit', [QuizController::class, 'submit']);
Route::post('/courses/{courseId}/complete', [CourseController::class, 'complete']);

// CSRF cookie endpoint (needed for session-based auth with CORS)
Route::get('/csrf-cookie', function () {
    return response()->json(['message' => 'CSRF cookie set']);
})->middleware('web');

// Test endpoint to check if cookies are working
Route::get('/test-session', function (Request $request) {
    $sessionId = $request->session()->getId();
    $request->session()->put('test', 'value');
    
    return response()->json([
        'session_id' => $sessionId,
        'has_session' => $request->hasSession(),
        'cookies_received' => array_keys($request->cookies->all()),
        'cookie_header' => $request->header('Cookie'),
    ]);
});

// Auth routes with rate limiting (prevent brute force attacks)
Route::post('/auth/register', [\App\Http\Controllers\Api\AuthController::class, 'register'])->middleware('throttle:5,1'); // 5 attempts per minute
Route::post('/auth/login', [\App\Http\Controllers\Api\AuthController::class, 'login'])->middleware('throttle:5,1'); // 5 attempts per minute
Route::post('/auth/logout', [\App\Http\Controllers\Api\AuthController::class, 'logout'])->middleware('auth');
Route::get('/auth/me', [\App\Http\Controllers\Api\AuthController::class, 'me'])->middleware('auth');
Route::post('/auth/change-password', [\App\Http\Controllers\Api\AuthController::class, 'changePassword'])->middleware(['auth', 'throttle:3,1']); // 3 attempts per minute for password change

// Protected routes (require authentication) with rate limiting
Route::middleware(['auth', 'throttle:60,1'])->group(function () { // 60 requests per minute per user
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/profile', [ProfileController::class, 'index']);
    // Lesson completion removed - we use modules now, course completion is through quiz passing
    // Route::post('/lessons/{id}/complete', [LessonController::class, 'complete']);
    Route::get('/courses/{courseId}/progress/{userId}', [LessonController::class, 'getProgress']);
    
    // Student Dashboard
    Route::get('/student/dashboard', [\App\Http\Controllers\Api\StudentDashboardController::class, 'index']);
    
    // Course Progress
    Route::get('/courses/{courseId}/progress', [\App\Http\Controllers\Api\CourseProgressController::class, 'getCourseProgress']);
    Route::post('/lessons/{lessonId}/complete', [\App\Http\Controllers\Api\CourseProgressController::class, 'completeLesson']);
    Route::put('/lessons/{lessonId}/progress', [\App\Http\Controllers\Api\CourseProgressController::class, 'updateLessonProgress']);
    Route::get('/modules/{moduleId}/access', [\App\Http\Controllers\Api\CourseProgressController::class, 'checkModuleAccess']);
    Route::get('/lessons/{lessonId}/access', [\App\Http\Controllers\Api\CourseProgressController::class, 'checkLessonAccess']);
    Route::get('/exams/{examId}/access', [\App\Http\Controllers\Api\CourseProgressController::class, 'checkExamAccess']);
    
    // Exam endpoints
    Route::get('/exams/{examId}', [\App\Http\Controllers\Api\ExamController::class, 'show']);
    Route::post('/exams/{examId}/submit', [\App\Http\Controllers\Api\ExamController::class, 'submit']);
    
    // Exam Results
    Route::get('/exam-results', [\App\Http\Controllers\Api\ExamResultController::class, 'index']);
    Route::get('/exam-results/{id}', [\App\Http\Controllers\Api\ExamResultController::class, 'show']);
    
    // Certificates
    Route::get('/certificates', [\App\Http\Controllers\Api\CertificateController::class, 'index']);
    Route::get('/certificates/{courseId}/info', [\App\Http\Controllers\Api\CertificateController::class, 'info']);
    Route::get('/certificates/{courseId}/download', [\App\Http\Controllers\Api\CertificateController::class, 'generate']);
    
    // Achievements
    Route::get('/achievements', [\App\Http\Controllers\Api\AchievementController::class, 'index']);
    
    // User Events
    Route::get('/events/my', [EventController::class, 'myEvents']);
    Route::post('/events/{id}/register', [EventController::class, 'register']);
    Route::post('/events/{id}/cancel-registration', [EventController::class, 'cancelRegistration']);
    Route::post('/events/{id}/mark-attendance', [EventController::class, 'markAttendance']);
    Route::post('/events/{id}/mark-replay-watched', [EventController::class, 'markReplayWatched']);
});

// Admin routes (require admin role) with rate limiting
Route::middleware(['auth', \App\Http\Middleware\AdminMiddleware::class, 'throttle:120,1'])->prefix('admin')->group(function () { // 120 requests per minute for admin
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
    Route::put('/courses/{id}', [CourseAdminController::class, 'update']);
    Route::delete('/courses/{id}', [CourseAdminController::class, 'destroy']);
    Route::post('/courses/{id}/teams', [CourseAdminController::class, 'attachTeams']);
    Route::post('/courses/{id}/actions/{action}', [CourseAdminController::class, 'quickAction']);
    Route::post('/courses/{id}/modules/reorder', [CourseAdminController::class, 'reorderModules']);
    Route::get('/courses/{id}/preview', [CourseAdminController::class, 'preview']);
    
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
    
    // Exams Management
    Route::get('/exams', [ExamAdminController::class, 'index']);
    Route::get('/exams/{id}', [ExamAdminController::class, 'show']);
    Route::post('/exams', [ExamAdminController::class, 'store']);
    Route::put('/exams/{id}', [ExamAdminController::class, 'update']);
    Route::delete('/exams/{id}', [ExamAdminController::class, 'destroy']);
    
    // Tests Management (Standalone Test Builder)
    Route::get('/tests', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'index']);
    Route::get('/tests/{id}', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'show']);
    Route::post('/tests', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'store']);
    Route::put('/tests/{id}', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'update']);
    Route::delete('/tests/{id}', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'destroy']);
    Route::post('/tests/{id}/publish', [\App\Http\Controllers\Api\Admin\TestAdminController::class, 'publish']);
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
    Route::delete('/question-banks/{id}/questions/{questionId}', [\App\Http\Controllers\Api\Admin\QuestionBankAdminController::class, 'removeQuestion']);
    
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
    Route::post('/users/{id}/courses', [UserAdminController::class, 'assignCourses']);
    Route::delete('/users/{id}/courses/{courseId}', [UserAdminController::class, 'removeCourse']);
    
    // Team Members Management
    Route::get('/team-members', [UserAdminController::class, 'getTeamMembers']);
    Route::put('/team-members/{id}/role-permissions', [UserAdminController::class, 'updateRoleAndPermissions']);
    Route::post('/team-members/{id}/activate', [UserAdminController::class, 'activate']);
    Route::post('/team-members/{id}/suspend', [UserAdminController::class, 'suspend']);
    Route::post('/team-members/{id}/reset-access', [UserAdminController::class, 'resetAccess']);
    Route::post('/team-members/{id}/remove-from-team', [UserAdminController::class, 'removeFromTeam']);
    
    
    // Activity Logs
    Route::get('/activity-logs', [ActivityLogAdminController::class, 'index']);
    Route::get('/activity-logs/{id}', [ActivityLogAdminController::class, 'show']);
    
    // Exam Manual Review
    Route::get('/exams/pending-reviews', [ExamAdminController::class, 'getPendingReviews']);
    Route::post('/exam-results/{id}/manual-review', [ExamAdminController::class, 'submitManualReview']);
    
    // Admin Settings
    Route::get('/settings', [\App\Http\Controllers\Api\Admin\SettingsController::class, 'index']);
    Route::get('/settings/{key}', [\App\Http\Controllers\Api\Admin\SettingsController::class, 'show']);
    Route::put('/settings', [\App\Http\Controllers\Api\Admin\SettingsController::class, 'update']);
    
    // Admin System
    Route::get('/export', [\App\Http\Controllers\Api\Admin\SettingsController::class, 'export']);
    Route::post('/system/clear-cache', [\App\Http\Controllers\Api\Admin\SettingsController::class, 'clearCache']);
    Route::post('/import', [\App\Http\Controllers\Api\Admin\SettingsController::class, 'importBackup']);
});
