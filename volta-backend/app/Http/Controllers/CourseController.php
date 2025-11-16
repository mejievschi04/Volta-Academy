<?php

namespace App\Http\Controllers;

use App\Models\Course;
use Illuminate\Http\Request;

class CourseController extends Controller
{
    public function index(Request $request)
    {
        // Get only necessary fields for listing (no full content)
        $courses = Course::with(['lessons:id,course_id,title,order', 'teacher:id,name'])
            ->select('id', 'title', 'description', 'reward_points', 'teacher_id', 'category_id')
            ->get()
            ->map(function($course) {
                return [
                    'id' => $course->id,
                    'title' => $course->title,
                    'description' => $course->description,
                    'reward_points' => $course->reward_points,
                    'lessons_count' => $course->lessons->count(),
                    'lessons' => $course->lessons->map(function($lesson) {
                        return [
                            'id' => $lesson->id,
                            'title' => $lesson->title,
                            'order' => $lesson->order,
                        ];
                    }),
                    'teacher' => $course->teacher ? [
                        'id' => $course->teacher->id,
                        'name' => $course->teacher->name,
                    ] : null,
                ];
            });
        
        return response()->json($courses);
    }

    public function show($id)
    {
        // For single course, include full content
        $course = Course::with(['lessons', 'teacher:id,name'])->findOrFail($id);
        
        return response()->json($course);
    }
}

