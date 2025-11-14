<?php
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LessonController;


Route::get('/login', [AuthController::class, 'showLoginForm'])->name('login');
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

Route::get('/register', [AuthController::class, 'showRegisterForm'])->name('register');
Route::post('/register', [AuthController::class, 'register']);


Route::middleware('auth')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/courses/{id}', [DashboardController::class, 'showCourse']);
});

Route::middleware('auth')->group(function () {
    Route::post('/lessons/{id}/complete', [LessonController::class, 'complete']);
});

Route::get('/lessons/{id}/complete', [LessonController::class, 'complete']);
Route::middleware('auth:sanctum')->post('/lessons/{id}/complete', [LessonController::class, 'complete']);
Route::middleware('auth')->get('/courses/{courseId}/progress/{userId}', [LessonController::class, 'getProgress']);