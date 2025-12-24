<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\Course;
use App\Services\CourseBuilderService;
use Illuminate\Http\Request;

class LessonAdminController extends Controller
{
    protected CourseBuilderService $courseBuilderService;

    public function __construct(CourseBuilderService $courseBuilderService)
    {
        $this->courseBuilderService = $courseBuilderService;
    }
    public function index(Request $request)
    {
        $query = Lesson::with(['course', 'module']);

        if ($request->has('course_id')) {
            $query->where('course_id', $request->course_id);
        }

        if ($request->has('module_id')) {
            $query->where('module_id', $request->module_id);
        }

        $lessons = $query->orderBy('order')->get();

        return response()->json($lessons);
    }

    public function show($id)
    {
        $lesson = Lesson::with(['course', 'module'])->findOrFail($id);

        return response()->json($lesson);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'module_id' => 'nullable|exists:modules,id',
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'order' => 'nullable|integer|min:0',
        ]);

        // Use CourseBuilderService to create lesson
        if (!isset($validated['module_id'])) {
            return response()->json([
                'error' => 'Module ID is required to create a lesson',
            ], 422);
        }

        $module = Module::findOrFail($validated['module_id']);
        $lesson = $this->courseBuilderService->createLesson($module, $validated);

        return response()->json([
            'message' => 'Lecție creată cu succes',
            'lesson' => $lesson->load(['course', 'module']),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $lesson = Lesson::findOrFail($id);

        $validated = $request->validate([
            'course_id' => 'sometimes|required|exists:courses,id',
            'module_id' => 'nullable|exists:modules,id',
            'title' => 'sometimes|required|string|max:255',
            'content' => 'sometimes|required|string',
            'order' => 'nullable|integer|min:0',
        ]);

        // Use CourseBuilderService to update lesson
        $lesson = $this->courseBuilderService->updateLesson($lesson, $validated);

        return response()->json([
            'message' => 'Lecție actualizată cu succes',
            'lesson' => $lesson->load(['course', 'module']),
        ]);
    }

    public function destroy($id)
    {
        $lesson = Lesson::findOrFail($id);
        $this->courseBuilderService->deleteLesson($lesson);

        return response()->json([
            'message' => 'Lecție ștearsă cu succes',
        ]);
    }

    /**
     * Reorder lessons in a module
     */
    public function reorder(Request $request, $moduleId)
    {
        $module = Module::findOrFail($moduleId);

        $validated = $request->validate([
            'lesson_ids' => 'required|array',
            'lesson_ids.*' => 'exists:lessons,id',
        ]);

        // Verify all lessons belong to this module
        $lessons = Lesson::whereIn('id', $validated['lesson_ids'])
            ->where('module_id', $moduleId)
            ->get();

        if ($lessons->count() !== count($validated['lesson_ids'])) {
            return response()->json([
                'message' => 'Unele lecții nu aparțin acestui modul',
            ], 400);
        }

        // Use CourseBuilderService to reorder lessons
        $this->courseBuilderService->reorderLessons($module, $validated['lesson_ids']);

        return response()->json([
            'message' => 'Lecții reordonate cu succes',
            'lessons' => Lesson::where('module_id', $moduleId)->orderBy('order')->get(),
        ]);
    }
}

