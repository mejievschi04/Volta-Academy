<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CourseController extends Controller
{
    public function index(Request $request)
    {
        // Get only necessary fields for listing (no full content)
        $courses = Course::with(['modules:id,course_id,title,order', 'teacher:id,name'])
            ->select('id', 'title', 'description', 'image', 'reward_points', 'teacher_id')
            ->get()
            ->map(function($course) {
                return [
                    'id' => $course->id,
                    'title' => $course->title,
                    'description' => $course->description,
                    'image' => $course->image,
                    'image_url' => $course->image_url,
                    'reward_points' => $course->reward_points,
                    'modules_count' => $course->modules->count(),
                    'modules' => $course->modules->map(function($module) {
                        return [
                            'id' => $module->id,
                            'title' => $module->title,
                            'order' => $module->order,
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

    public function show(Request $request, $id)
    {
        // For single course, include full content with modules, lessons, and exams
        $course = Course::with([
            'modules' => function($q) {
                $q->orderBy('order');
            },
            'modules.lessons' => function($q) {
                $q->orderBy('order');
            },
            'modules.exams' => function($q) {
                $q->orderBy('id');
            },
            'teacher:id,name'
        ])->findOrFail($id);
        
        // Get exam for this course (legacy support - single exam at course level)
        $exam = \App\Models\Exam::where('course_id', $course->id)
            ->whereNull('module_id')
            ->first();
        if ($exam) {
            $course->exam = $exam;
        }
        
        // Add user progress if user is authenticated
        $user = $request->user();
        if ($user) {
            $courseUser = DB::table('course_user')
                ->where('course_id', $course->id)
                ->where('user_id', $user->id)
                ->first();
            
            $course->progress_percentage = $courseUser ? ($courseUser->progress_percentage ?? 0) : 0;
            $course->completed_at = $courseUser ? $courseUser->completed_at : null;
            $course->started_at = $courseUser ? $courseUser->started_at : null;
            $course->is_assigned = $courseUser !== null;
        }
        
        // Debug: Log exams in modules before returning
        \Log::info('CourseController::show - Course data before JSON', [
            'course_id' => $course->id,
            'modules_count' => $course->modules->count(),
            'modules' => $course->modules->map(function($module) {
                return [
                    'id' => $module->id,
                    'title' => $module->title,
                    'exams_loaded' => isset($module->exams),
                    'exams_count' => $module->exams ? $module->exams->count() : 0,
                    'exams' => $module->exams ? $module->exams->map(function($exam) {
                        return [
                            'id' => $exam->id,
                            'title' => $exam->title,
                            'course_id' => $exam->course_id,
                            'module_id' => $exam->module_id,
                        ];
                    })->toArray() : [],
                ];
            })->toArray(),
        ]);
        
        return response()->json($course);
    }

    public function complete(Request $request, $id)
    {
        $course = Course::with('modules')->findOrFail($id);
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Utilizator neautentificat'], 401);
        }

        // Check if test is passed
        $exam = \App\Models\Exam::where('course_id', $course->id)->first();
        if (!$exam) {
            return response()->json(['error' => 'Nu există test pentru acest curs'], 404);
        }

        $latestResult = \App\Models\ExamResult::where('exam_id', $exam->id)
            ->where('user_id', $user->id)
            ->orderBy('attempt_number', 'desc')
            ->first();

        if (!$latestResult || !$latestResult->passed) {
            return response()->json(['error' => 'Testul nu a fost trecut'], 400);
        }

        // Course is completed when test is passed (modules don't need individual completion tracking)

        // Mark course as completed
        $existingRecord = DB::table('course_user')
            ->where('course_id', $course->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existingRecord) {
            // Update existing record
            DB::table('course_user')
                ->where('course_id', $course->id)
                ->where('user_id', $user->id)
                ->update([
                    'progress_percentage' => 100,
                    'completed_at' => now(),
                    'started_at' => $existingRecord->started_at ?: now(),
                    'updated_at' => now(),
                ]);
        } else {
            // Insert new record
            DB::table('course_user')
                ->insert([
                    'course_id' => $course->id,
                    'user_id' => $user->id,
                    'progress_percentage' => 100,
                    'completed_at' => now(),
                    'started_at' => now(),
                    'is_mandatory' => false,
                    'enrolled' => true,
                    'enrolled_at' => now(),
                    'assigned_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
        }

        // Log activity: user completed course
        ActivityLog::create([
            'user_id' => $user->id,
            'action' => 'completed_course',
            'model_type' => 'Course',
            'model_id' => $course->id,
            'description' => "{$user->name} a finalizat cursul \"{$course->title}\"",
            'new_values' => [
                'course_id' => $course->id,
                'course_title' => $course->title,
                'progress_percentage' => 100,
                'completed_at' => now()->toDateTimeString(),
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        // Invalidate cache
        \Illuminate\Support\Facades\Cache::forget("dashboard_user_{$user->id}_stats");
        \Illuminate\Support\Facades\Cache::forget("profile_user_{$user->id}");

        return response()->json([
            'message' => 'Cursul a fost marcat ca finalizat cu succes',
            'completed_at' => now()->toDateTimeString(),
        ]);
    }
}

