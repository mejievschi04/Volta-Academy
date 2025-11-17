<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CategoryController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        
        $categories = Category::with(['courses' => function($query) {
            $query->with(['lessons:id,course_id', 'teacher:id,name'])
                  ->select('id', 'title', 'description', 'reward_points', 'teacher_id', 'category_id');
        }])
        ->orderBy('order')
        ->orderBy('name')
        ->get();
        
        // Add user progress for each course if user is authenticated
        if ($user) {
            $categories->each(function($category) use ($user) {
                $category->courses->each(function($course) use ($user) {
                    $courseUser = \DB::table('course_user')
                        ->where('course_id', $course->id)
                        ->where('user_id', $user->id)
                        ->first();
                    
                    $course->progress_percentage = $courseUser ? ($courseUser->progress_percentage ?? 0) : 0;
                    $course->completed_at = $courseUser ? $courseUser->completed_at : null;
                    $course->started_at = $courseUser ? $courseUser->started_at : null;
                    $course->is_assigned = $courseUser !== null;
                    
                    // Calculate total duration (sum of all lesson durations)
                    $totalDuration = $course->lessons->sum(function($lesson) {
                        return $lesson->duration_minutes ?? 0;
                    });
                    $course->total_duration_minutes = $totalDuration;
                    $course->lessons_count = $course->lessons->count();
                });
            });
        }
        
        return response()->json($categories);
    }
}
