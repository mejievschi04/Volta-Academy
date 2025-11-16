<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Lesson;
use App\Models\Course;
use Illuminate\Http\Request;

class LessonAdminController extends Controller
{
    public function index(Request $request)
    {
        $query = Lesson::with('course');

        if ($request->has('course_id')) {
            $query->where('course_id', $request->course_id);
        }

        $lessons = $query->orderBy('order')->get();

        return response()->json($lessons);
    }

    public function show($id)
    {
        $lesson = Lesson::with('course')->findOrFail($id);

        return response()->json($lesson);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'order' => 'nullable|integer|min:0',
        ]);

        // If order not provided, set it to the next available order
        if (!isset($validated['order'])) {
            $maxOrder = Lesson::where('course_id', $validated['course_id'])->max('order') ?? -1;
            $validated['order'] = $maxOrder + 1;
        }

        $lesson = Lesson::create($validated);

        return response()->json([
            'message' => 'Lecție creată cu succes',
            'lesson' => $lesson->load('course'),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $lesson = Lesson::findOrFail($id);

        $validated = $request->validate([
            'course_id' => 'sometimes|required|exists:courses,id',
            'title' => 'sometimes|required|string|max:255',
            'content' => 'sometimes|required|string',
            'order' => 'nullable|integer|min:0',
        ]);

        $lesson->update($validated);

        return response()->json([
            'message' => 'Lecție actualizată cu succes',
            'lesson' => $lesson->load('course'),
        ]);
    }

    public function destroy($id)
    {
        $lesson = Lesson::findOrFail($id);
        $lesson->delete();

        return response()->json([
            'message' => 'Lecție ștearsă cu succes',
        ]);
    }
}

