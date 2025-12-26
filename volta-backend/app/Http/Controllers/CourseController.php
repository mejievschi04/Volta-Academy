<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\ActivityLog;
use App\Models\CourseTest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CourseController extends Controller
{
    public function index(Request $request)
    {
        try {
            // Get only necessary fields for listing (no full content)
            // Note: Don't use select() with eager loading as it can cause issues
            $courses = Course::with([
                'modules' => function($query) {
                    $query->select('id', 'course_id', 'title', 'order');
                },
                'teacher' => function($query) {
                    $query->select('id', 'name');
                }
            ])
                ->get()
                ->map(function($course) {
                    try {
                        return [
                            'id' => $course->id,
                            'title' => $course->title ?? '',
                            'description' => $course->description ?? null,
                            'image' => $course->image ?? null,
                            'image_url' => $course->image_url ?? null,
                            'reward_points' => $course->reward_points ?? 0,
                            'modules_count' => $course->modules ? $course->modules->count() : 0,
                            'modules' => $course->modules ? $course->modules->map(function($module) {
                                return [
                                    'id' => $module->id ?? null,
                                    'title' => $module->title ?? '',
                                    'order' => $module->order ?? 0,
                                ];
                            })->toArray() : [],
                            'teacher' => $course->teacher ? [
                                'id' => $course->teacher->id ?? null,
                                'name' => $course->teacher->name ?? '',
                            ] : null,
                        ];
                    } catch (\Exception $e) {
                        \Log::error('Error mapping course in CourseController::index', [
                            'course_id' => $course->id ?? null,
                            'error' => $e->getMessage(),
                            'trace' => $e->getTraceAsString(),
                        ]);
                        // Return minimal course data if mapping fails
                        return [
                            'id' => $course->id ?? null,
                            'title' => $course->title ?? 'Unknown Course',
                            'description' => null,
                            'image' => null,
                            'image_url' => null,
                            'reward_points' => 0,
                            'modules_count' => 0,
                            'modules' => [],
                            'teacher' => null,
                        ];
                    }
                });
            
            return response()->json($courses);
        } catch (\Exception $e) {
            \Log::error('Error in CourseController::index', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            return response()->json([
                'error' => 'Nu s-au putut încărca cursurile',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function show(Request $request, $id)
    {
        try {
            // For single course, include full content with modules, lessons, and tests
            // Note: exams relationship doesn't exist on Module, use courseTests instead
            $course = Course::with([
                'modules' => function($q) {
                    $q->orderBy('order');
                },
                'modules.lessons' => function($q) {
                    $q->orderBy('order');
                },
                'modules.courseTests' => function($q) {
                    $q->orderBy('order');
                },
                'modules.courseTests.test' => function($q) {
                    $q->select('id', 'title', 'description', 'type', 'status');
                },
                'teacher' => function($q) {
                    $q->select('id', 'name');
                }
            ])->findOrFail($id);
            
            // Transform courseTests to exams format for frontend compatibility
            // Add exams array to each module
            foreach ($course->modules as $module) {
                $module->exams = $module->courseTests->map(function($courseTest) {
                    if ($courseTest->test) {
                        return [
                            'id' => $courseTest->test->id,
                            'title' => $courseTest->test->title,
                            'description' => $courseTest->test->description,
                            'type' => $courseTest->test->type,
                            'status' => $courseTest->test->status,
                            'module_id' => $courseTest->scope_id,
                            'course_id' => $course->id,
                            'required' => $courseTest->required ?? false,
                            'passing_score' => $courseTest->passing_score ?? null,
                            'order' => $courseTest->order ?? 0,
                        ];
                    }
                    return null;
                })->filter()->values()->toArray();
            }
            
            // Collect all exams from all modules for course.exams
            $allExams = [];
            foreach ($course->modules as $module) {
                if (isset($module->exams) && is_array($module->exams)) {
                    $allExams = array_merge($allExams, $module->exams);
                }
            }
            
            // Also get course-level tests
            try {
                $courseLevelTests = CourseTest::where('course_id', $course->id)
                    ->where('scope', 'course')
                    ->with('test')
                    ->get();
                
                foreach ($courseLevelTests as $courseTest) {
                    if ($courseTest->test) {
                        $allExams[] = [
                            'id' => $courseTest->test->id,
                            'title' => $courseTest->test->title,
                            'description' => $courseTest->test->description,
                            'type' => $courseTest->test->type,
                            'status' => $courseTest->test->status,
                            'module_id' => null,
                            'course_id' => $course->id,
                            'required' => $courseTest->required ?? false,
                            'passing_score' => $courseTest->passing_score ?? null,
                            'order' => $courseTest->order ?? 0,
                        ];
                    }
                }
            } catch (\Exception $e) {
                \Log::warning('Error loading course-level tests', [
                    'course_id' => $course->id,
                    'error' => $e->getMessage(),
                ]);
            }
            
            // Set course.exams array
            $course->exams = $allExams;
            
            // Get exam for this course (legacy support - single exam at course level)
            try {
                $exam = \App\Models\Exam::where('course_id', $course->id)
                    ->whereNull('module_id')
                    ->first();
                if ($exam) {
                    $course->exam = $exam;
                }
            } catch (\Exception $e) {
                \Log::warning('Error loading exam for course', [
                    'course_id' => $course->id,
                    'error' => $e->getMessage(),
                ]);
            }
            
            // Add user progress if user is authenticated
            $user = $request->user();
            if ($user) {
                try {
                    $courseUser = DB::table('course_user')
                        ->where('course_id', $course->id)
                        ->where('user_id', $user->id)
                        ->first();
                    
                    $course->progress_percentage = $courseUser ? ($courseUser->progress_percentage ?? 0) : 0;
                    $course->completed_at = $courseUser ? $courseUser->completed_at : null;
                    $course->started_at = $courseUser ? $courseUser->started_at : null;
                    $course->is_assigned = $courseUser !== null;
                } catch (\Exception $e) {
                    \Log::warning('Error loading user progress for course', [
                        'course_id' => $course->id,
                        'user_id' => $user->id,
                        'error' => $e->getMessage(),
                    ]);
                    // Set defaults if progress loading fails
                    $course->progress_percentage = 0;
                    $course->completed_at = null;
                    $course->started_at = null;
                    $course->is_assigned = false;
                }
            }
            
            return response()->json($course);
        } catch (\Exception $e) {
            \Log::error('Error in CourseController::show', [
                'course_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            return response()->json([
                'error' => 'Nu s-a putut încărca cursul',
                'message' => $e->getMessage(),
            ], 500);
        }
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

