<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\User;
use App\Models\Team;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CourseAdminController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 15);
        $courses = Course::with(['lessons:id,course_id,title,order', 'teacher:id,name', 'teams:id,name', 'category:id,name'])
            ->select('id', 'title', 'description', 'reward_points', 'teacher_id', 'category_id')
            ->paginate($perPage);
        
        return response()->json($courses);
    }

    public function show($id)
    {
        $course = Course::with(['lessons', 'teacher', 'teams', 'category'])->findOrFail($id);
        
        return response()->json($course);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'teacher_id' => 'nullable|exists:users,id',
            'category_id' => 'nullable|exists:categories,id',
            'reward_points' => 'nullable|integer|min:0',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        $data = [
            'title' => $validated['title'],
            'description' => $validated['description'],
            'teacher_id' => $validated['teacher_id'] ?? null,
            'category_id' => $validated['category_id'] ?? null,
            'reward_points' => $validated['reward_points'] ?? 0,
        ];

        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store('courses', 'public');
        }

        $course = Course::create($data);

        return response()->json([
            'message' => 'Curs creat cu succes',
            'course' => $course->load(['lessons', 'teacher', 'teams', 'category']),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $course = Course::findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'sometimes|required|string',
            'teacher_id' => 'nullable|exists:users,id',
            'category_id' => 'nullable|exists:categories,id',
            'reward_points' => 'nullable|integer|min:0',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        $data = [];
        if (isset($validated['title'])) $data['title'] = $validated['title'];
        if (isset($validated['description'])) $data['description'] = $validated['description'];
        if (isset($validated['teacher_id'])) $data['teacher_id'] = $validated['teacher_id'];
        if (isset($validated['category_id'])) $data['category_id'] = $validated['category_id'];
        if (isset($validated['reward_points'])) $data['reward_points'] = $validated['reward_points'];

        if ($request->hasFile('image')) {
            // Delete old image if exists
            if ($course->image) {
                Storage::disk('public')->delete($course->image);
            }
            $data['image'] = $request->file('image')->store('courses', 'public');
        }

        $course->update($data);

        return response()->json([
            'message' => 'Curs actualizat cu succes',
            'course' => $course->load(['lessons', 'teacher', 'teams', 'category']),
        ]);
    }

    public function destroy($id)
    {
        $course = Course::findOrFail($id);

        // Delete image if exists
        if ($course->image) {
            Storage::disk('public')->delete($course->image);
        }

        $course->delete();

        return response()->json([
            'message' => 'Curs șters cu succes',
        ]);
    }

    public function getTeachers()
    {
        $teachers = User::where('role', 'teacher')
            ->orWhere('role', 'admin')
            ->get(['id', 'name', 'email']);

        return response()->json($teachers);
    }

    public function attachTeams(Request $request, $id)
    {
        $course = Course::findOrFail($id);

        $validated = $request->validate([
            'team_ids' => 'required|array',
            'team_ids.*' => 'exists:teams,id',
        ]);

        $course->teams()->sync($validated['team_ids']);

        return response()->json([
            'message' => 'Echipe atașate cu succes',
            'course' => $course->load(['lessons', 'teacher', 'teams', 'category']),
        ]);
    }
}

