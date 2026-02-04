<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lesson;
use Illuminate\Http\Request;

class LessonController extends Controller
{
    public function show($id)
    {
        $lesson = Lesson::with([
            'course',
            'module',
            'contentBlocks' => function ($q) {
                $q->orderBy('order')
                    ->where(function ($q) {
                        $q->where('visible', true)->orWhereNull('visible');
                    });
            },
        ])->findOrFail($id);

        return response()->json($lesson);
    }
}

