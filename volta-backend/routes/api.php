<?php

use App\Http\Controllers\LessonController;

Route::get('/lessons', [LessonController::class, 'index']);
