<?php

use Illuminate\Http\Request;
use App\Http\Controllers\LessonController;
use App\Http\Controllers\CourseController;
use App\Http\Controllers\RewardController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\QuizController;
use App\Http\Controllers\Api\Admin\CourseAdminController;
use App\Http\Controllers\Api\Admin\LessonAdminController;
use App\Http\Controllers\Api\Admin\ExamAdminController;
use App\Http\Controllers\Api\Admin\RewardAdminController;
use App\Http\Controllers\Api\Admin\EventAdminController;
use App\Http\Controllers\Api\Admin\DashboardAdminController;
use App\Http\Controllers\Api\Admin\TeamAdminController;
use App\Http\Controllers\Api\Admin\UserAdminController;
use App\Http\Controllers\Api\Admin\CategoryAdminController;

// Public routes
Route::get('/categories', [\App\Http\Controllers\Api\CategoryController::class, 'index']);
Route::get('/courses', [CourseController::class, 'index']);
Route::get('/courses/{id}', [CourseController::class, 'show']);
Route::get('/lessons', [LessonController::class, 'index']);
Route::get('/lessons/{id}', [LessonController::class, 'show']);
Route::get('/rewards', [RewardController::class, 'index']);
Route::get('/rewards/{id}', [RewardController::class, 'show']);
Route::get('/events', [EventController::class, 'index']);
Route::get('/courses/{courseId}/quiz', [QuizController::class, 'show']);
Route::post('/courses/{courseId}/quiz/submit', [QuizController::class, 'submit']);

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
    Route::post('/lessons/{id}/complete', [LessonController::class, 'complete']);
    Route::get('/courses/{courseId}/progress/{userId}', [LessonController::class, 'getProgress']);
});

// Admin routes (require admin role) with rate limiting
Route::middleware(['auth', \App\Http\Middleware\AdminMiddleware::class, 'throttle:120,1'])->prefix('admin')->group(function () { // 120 requests per minute for admin
    // Admin Dashboard
    Route::get('/dashboard', [DashboardAdminController::class, 'index']);
    
    // Courses Management
    Route::get('/courses', [CourseAdminController::class, 'index']);
    Route::get('/courses/{id}', [CourseAdminController::class, 'show']);
    Route::post('/courses', [CourseAdminController::class, 'store']);
    Route::put('/courses/{id}', [CourseAdminController::class, 'update']);
    Route::delete('/courses/{id}', [CourseAdminController::class, 'destroy']);
    Route::get('/courses/teachers/list', [CourseAdminController::class, 'getTeachers']);
    Route::post('/courses/{id}/teams', [CourseAdminController::class, 'attachTeams']);
    
    // Lessons Management
    Route::get('/lessons', [LessonAdminController::class, 'index']);
    Route::get('/lessons/{id}', [LessonAdminController::class, 'show']);
    Route::post('/lessons', [LessonAdminController::class, 'store']);
    Route::put('/lessons/{id}', [LessonAdminController::class, 'update']);
    Route::delete('/lessons/{id}', [LessonAdminController::class, 'destroy']);
    
    // Exams Management
    Route::get('/exams', [ExamAdminController::class, 'index']);
    Route::get('/exams/{id}', [ExamAdminController::class, 'show']);
    Route::post('/exams', [ExamAdminController::class, 'store']);
    Route::put('/exams/{id}', [ExamAdminController::class, 'update']);
    Route::delete('/exams/{id}', [ExamAdminController::class, 'destroy']);
    
    // Rewards Management
    Route::get('/rewards', [RewardAdminController::class, 'index']);
    Route::get('/rewards/{id}', [RewardAdminController::class, 'show']);
    Route::post('/rewards', [RewardAdminController::class, 'store']);
    Route::put('/rewards/{id}', [RewardAdminController::class, 'update']);
    Route::delete('/rewards/{id}', [RewardAdminController::class, 'destroy']);
    
    // Events Management
    Route::get('/events', [EventAdminController::class, 'index']);
    Route::get('/events/{id}', [EventAdminController::class, 'show']);
    Route::post('/events', [EventAdminController::class, 'store']);
    Route::put('/events/{id}', [EventAdminController::class, 'update']);
    Route::delete('/events/{id}', [EventAdminController::class, 'destroy']);
    
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
    
    // Categories Management
    Route::get('/categories', [CategoryAdminController::class, 'index']);
    Route::get('/categories/{id}', [CategoryAdminController::class, 'show']);
    Route::post('/categories', [CategoryAdminController::class, 'store']);
    Route::put('/categories/{id}', [CategoryAdminController::class, 'update']);
    Route::delete('/categories/{id}', [CategoryAdminController::class, 'destroy']);
});
