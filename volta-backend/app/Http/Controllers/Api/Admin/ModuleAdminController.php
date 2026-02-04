<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Module;
use App\Models\Course;
use App\Services\CourseBuilderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class ModuleAdminController extends Controller
{
    protected CourseBuilderService $courseBuilderService;

    public function __construct(CourseBuilderService $courseBuilderService)
    {
        $this->courseBuilderService = $courseBuilderService;
    }
    public function index(Request $request)
    {
        $query = Module::with(['course', 'lessons' => function($q) {
            $q->orderBy('order');
        }]);

        if ($request->has('course_id')) {
            $query->where('course_id', $request->course_id);
        }

        $modules = $query->orderBy('order')->get();

        return response()->json($modules);
    }

    public function show($id)
    {
        $module = Module::with(['course', 'lessons' => function($q) {
            $q->orderBy('order');
        }])->findOrFail($id);

        return response()->json($module);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'content' => 'nullable|string',
            'order' => 'nullable|integer|min:0',
        ]);

        // Use CourseBuilderService to create module
        $course = Course::findOrFail($validated['course_id']);
        $module = $this->courseBuilderService->createModule($course, $validated);

        return response()->json([
            'message' => 'Modul creat cu succes',
            'module' => $module->load('course'),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $module = Module::findOrFail($id);

        $validated = $request->validate([
            'course_id' => 'sometimes|required|exists:courses,id',
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'content' => 'nullable|string',
            'order' => 'nullable|integer|min:0',
            'status' => 'nullable|string|in:draft,published',
            'is_locked' => 'nullable|boolean',
            'unlock_after_module_id' => 'nullable|integer',
            'unlock_after_lesson_id' => 'nullable|integer',
            'estimated_duration_minutes' => 'nullable|integer|min:0',
        ]);

        // Filter to only columns that exist and are fillable
        $updateData = [];
        $allowed = ['course_id', 'title', 'description', 'content', 'order', 'status', 'is_locked',
            'unlock_after_module_id', 'unlock_after_lesson_id', 'estimated_duration_minutes'];
        foreach ($allowed as $key) {
            if (!array_key_exists($key, $validated)) {
                continue;
            }
            if (Schema::hasColumn('modules', $key)) {
                $updateData[$key] = $validated[$key];
            }
        }

        if (empty($updateData)) {
            return response()->json([
                'message' => 'Modul actualizat cu succes',
                'module' => $module->load('course'),
            ]);
        }

        $module = $this->courseBuilderService->updateModule($module, $updateData);

        return response()->json([
            'message' => 'Modul actualizat cu succes',
            'module' => $module->load('course'),
        ]);
    }

    public function destroy($id)
    {
        $module = Module::findOrFail($id);
        $this->courseBuilderService->deleteModule($module);

        return response()->json([
            'message' => 'Modul șters cu succes',
        ]);
    }

    public function toggleLock($id)
    {
        $module = Module::findOrFail($id);
        $module->is_locked = !$module->is_locked;
        $module->save();

        return response()->json([
            'message' => $module->is_locked ? 'Modul blocat' : 'Modul deblocat',
            'module' => $module->load(['course', 'lessons']),
        ]);
    }
}
