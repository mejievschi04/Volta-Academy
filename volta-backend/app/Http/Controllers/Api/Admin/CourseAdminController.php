<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\User;
use App\Models\Team;
use App\Models\Module;
use App\Services\CourseProgressService;
use App\Services\CourseBuilderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

class CourseAdminController extends Controller
{
    protected CourseBuilderService $courseBuilderService;

    public function __construct(CourseBuilderService $courseBuilderService)
    {
        $this->courseBuilderService = $courseBuilderService;
    }
    public function index(Request $request)
    {
        try {
            // Check if courses table exists
            if (!Schema::hasTable('courses')) {
                return response()->json(['data' => [], 'total' => 0]);
            }
            
            $query = Course::with(['teacher:id,name,email'])
                ->withCount('modules');
        
        // Add enrollments count if course_user table exists
        if (Schema::hasTable('course_user')) {
            try {
                $query->withCount(['assignedUsers as enrollments_count' => function($q) {
                    if (Schema::hasColumn('course_user', 'enrolled')) {
                        $q->where('enrolled', true);
                    }
                }]);
            } catch (\Exception $e) {
                // If relationship fails, add default count
                $query->addSelect(DB::raw('0 as enrollments_count'));
            }
        } else {
            // If table doesn't exist, add a default count
            $query->addSelect(DB::raw('0 as enrollments_count'));
        }

        // Search
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhereHas('teacher', function($q) use ($search) {
                      $q->where('name', 'like', "%{$search}%");
                  });
            });
        }

        // Status filter (default to 'published' if status column exists, otherwise show all)
        if ($request->has('status') && $request->status !== 'all') {
            // If status column exists in database
            if (Schema::hasColumn('courses', 'status')) {
                $query->where('status', $request->status);
            } else {
                // Fallback: treat all as published for now
                // You can add status migration later
            }
        }


        // Instructor filter
        if ($request->has('instructor') && $request->instructor) {
            $query->where('teacher_id', $request->instructor);
        }

        // Level filter (if level column exists)
        if ($request->has('level') && $request->level !== 'all') {
            if (Schema::hasColumn('courses', 'level')) {
                $query->where('level', $request->level);
            }
        }

        // Sort
        $sortBy = $request->get('sort_by', 'updated_at');
        $sortDirection = $request->get('sort_direction', 'desc');

        switch ($sortBy) {
            case 'enrollments':
                $query->orderBy('enrollments_count', $sortDirection);
                break;
            case 'revenue':
                // TODO: Add revenue calculation
                $query->orderBy('updated_at', $sortDirection);
                break;
            case 'completion_rate':
                // TODO: Add completion rate calculation
                $query->orderBy('updated_at', $sortDirection);
                break;
            case 'rating':
                // TODO: Add rating calculation
                $query->orderBy('updated_at', $sortDirection);
                break;
            default:
                $query->orderBy($sortBy, $sortDirection);
        }

            $perPage = $request->get('per_page', 50);
            $courses = $query->paginate($perPage);

            // Add metrics to each course
            $courses->getCollection()->transform(function($course) {
                return $this->addCourseMetrics($course);
            });

            return response()->json($courses);
        } catch (\Exception $e) {
            \Log::error('Error fetching courses', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => 'Failed to fetch courses',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    private function addCourseMetrics($course)
    {
        try {
            // Get enrollments count
            $enrollmentsCount = 0;
            if (Schema::hasTable('course_user')) {
                $enrollmentsCount = DB::table('course_user')
                    ->where('course_id', $course->id)
                    ->where(function($q) {
                        if (Schema::hasColumn('course_user', 'enrolled')) {
                            $q->where('enrolled', true);
                        } else {
                            // If enrolled column doesn't exist, count all records
                            $q->whereNotNull('course_id');
                        }
                    })
                    ->count();
            }

            // Get completed count
            $completedCount = 0;
            if (Schema::hasTable('course_user') && Schema::hasColumn('course_user', 'completed_at')) {
                $completedCount = DB::table('course_user')
                    ->where('course_id', $course->id)
                    ->whereNotNull('completed_at')
                    ->count();
            }

            // Calculate completion rate
            $completionRate = $enrollmentsCount > 0 
                ? round(($completedCount / $enrollmentsCount) * 100, 1)
                : 0;

            // Revenue - use from course if available, otherwise 0
            $revenue = 0;
            if (Schema::hasColumn('courses', 'total_revenue')) {
                $revenue = $course->total_revenue ?? 0;
            }

            // Rating - use from course if available
            $rating = null;
            $ratingCount = 0;
            if (Schema::hasColumn('courses', 'average_rating')) {
                $rating = $course->average_rating;
                $ratingCount = $course->rating_count ?? 0;
            }

            // Check for alerts
            $hasAlerts = false;
            if ($completionRate < 30 && $enrollmentsCount > 5) {
                $hasAlerts = true;
            }

            // Status (default to published if no status column)
            $status = 'published';
            if (Schema::hasColumn('courses', 'status')) {
                $status = $course->status ?? 'draft';
            }

            // Add metrics to course
            $course->enrollments_count = $enrollmentsCount;
            $course->completion_rate = $completionRate;
            $course->revenue = $revenue;
            $course->rating = $rating;
            $course->rating_count = $ratingCount;
            $course->status = $status;
            $course->has_alerts = $hasAlerts;

            return $course;
        } catch (\Exception $e) {
            \Log::error("Error adding course metrics for course {$course->id}: " . $e->getMessage());
            // Return course with default metrics on error
            $course->enrollments_count = 0;
            $course->completion_rate = 0;
            $course->revenue = 0;
            $course->rating = null;
            $course->rating_count = 0;
            $course->status = $course->status ?? 'published';
            $course->has_alerts = false;
            return $course;
        }
    }

    public function show($id)
    {
        try {
            // Load course with all relationships
            $course = Course::with([
                'modules' => function($query) {
                    $query->orderBy('order')->with([
                        'lessons' => function($q) {
                            $q->orderBy('order');
                        },
                        'courseTests.test'
                    ]);
                },
                'teacher',
                'teams',
                'courseTests.test' => function($query) {
                    $query->with('questions');
                }
            ])->findOrFail($id);
            
            // Add counts
            $course->modules_count = $course->modules->count();
            $course->lessons_count = $course->modules->sum(function($module) {
                return $module->lessons->count();
            });
            
            // Load all course-test links for this course
            $courseTests = \App\Models\CourseTest::where('course_id', $course->id)
                ->with('test')
                ->orderBy('order')
                ->get();
            
            // Add course-level tests
            $courseLevelTests = $courseTests->where('scope', 'course')->values();
            $course->tests = $courseLevelTests->map(function($ct) {
                $test = $ct->test;
                if ($test) {
                    $test->pivot = [
                        'scope' => $ct->scope,
                        'scope_id' => $ct->scope_id,
                        'required' => $ct->required,
                        'passing_score' => $ct->passing_score,
                        'order' => $ct->order,
                        'unlock_after_previous' => $ct->unlock_after_previous,
                        'unlock_after_test_id' => $ct->unlock_after_test_id,
                    ];
                }
                return $test;
            })->filter();
            
            // Add tests to modules
            foreach ($course->modules as $module) {
                // Get tests for this module from course_test
                $moduleCourseTests = $courseTests->where('scope', 'module')
                    ->where('scope_id', $module->id);
                
                $module->tests = $moduleCourseTests->map(function($ct) {
                    $test = $ct->test;
                    if ($test) {
                        $test->pivot = [
                            'scope' => $ct->scope,
                            'scope_id' => $ct->scope_id,
                            'required' => $ct->required,
                            'passing_score' => $ct->passing_score,
                            'order' => $ct->order,
                        ];
                    }
                    return $test;
                })->filter();
                $module->tests_count = $module->tests->count();
            }
            
            // Add tests to lessons
            foreach ($course->modules as $module) {
                foreach ($module->lessons as $lesson) {
                    // Get tests for this lesson from course_test
                    $lessonCourseTests = $courseTests->where('scope', 'lesson')
                        ->where('scope_id', $lesson->id);
                    
                    $lesson->tests = $lessonCourseTests->map(function($ct) {
                        $test = $ct->test;
                        if ($test) {
                            $test->pivot = [
                                'scope' => $ct->scope,
                                'scope_id' => $ct->scope_id,
                                'required' => $ct->required,
                                'passing_score' => $ct->passing_score,
                                'order' => $ct->order,
                            ];
                        }
                        return $test;
                    })->filter();
                    $lesson->tests_count = $lesson->tests->count();
                }
            }
            
            // Set counts
            $course->exams_count = $courseTests->count();
            $course->tests_count = $courseTests->count();
            
            $course = $this->addCourseMetrics($course);
            
            return response()->json($course);
        } catch (\Exception $e) {
            \Log::error('Error fetching course', [
                'course_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => 'Failed to fetch course',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'short_description' => 'nullable|string|max:200',
            'teacher_id' => 'nullable|exists:users,id',
            'reward_points' => 'nullable|integer|min:0',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
            'status' => 'nullable|in:draft,published,archived',
            'access_type' => 'nullable|in:free,paid,subscription',
            'price' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|size:3',
            'level' => 'nullable|in:beginner,intermediate,advanced',
            'objectives' => 'nullable|array',
            'requirements' => 'nullable|array',
            'estimated_duration_hours' => 'nullable|integer|min:1',
            'sequential_unlock' => 'nullable|boolean',
            'min_completion_percentage' => 'nullable|integer|min:0|max:100',
            // SEO & Marketing
            'meta_title' => 'nullable|string|max:60',
            'meta_description' => 'nullable|string|max:160',
            'meta_keywords' => 'nullable|array',
            'marketing_tags' => 'nullable|array',
            // Certificate
            'has_certificate' => 'nullable|boolean',
            'min_test_score' => 'nullable|integer|min:0|max:100',
            'min_exam_score' => 'nullable|integer|min:0|max:100', // Legacy support
            'allow_retake' => 'nullable|boolean',
            'max_retakes' => 'nullable|integer|min:1|max:10',
            // Advanced
            'drip_content' => 'nullable|boolean',
            'drip_schedule' => 'nullable|in:daily,weekly,custom',
            'comments_enabled' => 'nullable|boolean',
            'visibility' => 'nullable|in:public,private,hidden',
            'permissions' => 'nullable|array',
        ]);

        $data = [
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'short_description' => $validated['short_description'] ?? null,
            'teacher_id' => $validated['teacher_id'] ?? null,
            'reward_points' => $validated['reward_points'] ?? 50,
            'status' => $validated['status'] ?? 'draft',
            'access_type' => $validated['access_type'] ?? 'free',
            'price' => $validated['price'] ?? null,
            'currency' => $validated['currency'] ?? 'RON',
            'level' => $validated['level'] ?? null,
            'objectives' => $validated['objectives'] ?? [],
            'requirements' => $validated['requirements'] ?? [],
            'estimated_duration_hours' => $validated['estimated_duration_hours'] ?? null,
            'sequential_unlock' => $validated['sequential_unlock'] ?? true,
            'min_completion_percentage' => $validated['min_completion_percentage'] ?? 0,
            // SEO & Marketing
            'meta_title' => $validated['meta_title'] ?? null,
            'meta_description' => $validated['meta_description'] ?? null,
            'meta_keywords' => $validated['meta_keywords'] ?? [],
            'marketing_tags' => $validated['marketing_tags'] ?? [],
            // Certificate
            'has_certificate' => $validated['has_certificate'] ?? false,
            'min_test_score' => $validated['min_test_score'] ?? $validated['min_exam_score'] ?? 70, // Support both old and new field names
            'allow_retake' => $validated['allow_retake'] ?? true,
            'max_retakes' => $validated['max_retakes'] ?? 3,
            // Advanced
            'drip_content' => $validated['drip_content'] ?? false,
            'drip_schedule' => $validated['drip_schedule'] ?? null,
            'comments_enabled' => $validated['comments_enabled'] ?? true,
            'visibility' => $validated['visibility'] ?? 'public',
            'permissions' => $validated['permissions'] ?? null,
        ];

        // Use CourseBuilderService to create course
        $teacher = isset($validated['teacher_id']) ? User::find($validated['teacher_id']) : null;
        
        // Handle image upload
        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image');
        }

        $course = $this->courseBuilderService->createCourse($data, $teacher);

        return response()->json([
            'message' => 'Curs creat cu succes',
            'course' => $this->addCourseMetrics($course->load(['modules', 'teacher', 'teams'])),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $course = Course::findOrFail($id);

        $rules = [
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'short_description' => 'nullable|string|max:200',
            'teacher_id' => 'nullable|exists:users,id',
            'reward_points' => 'nullable|integer|min:0',
            'status' => 'nullable|in:draft,published,archived,disabled',
            'access_type' => 'nullable|in:free,paid,subscription',
            'price' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|size:3',
            'level' => 'nullable|in:beginner,intermediate,advanced',
            'objectives' => 'nullable|array',
            'requirements' => 'nullable|array',
            'estimated_duration_hours' => 'nullable|integer|min:1',
            'sequential_unlock' => 'nullable|boolean',
            'min_completion_percentage' => 'nullable|integer|min:0|max:100',
            // SEO & Marketing
            'meta_title' => 'nullable|string|max:60',
            'meta_description' => 'nullable|string|max:160',
            'meta_keywords' => 'nullable|array',
            'marketing_tags' => 'nullable|array',
            // Certificate
            'has_certificate' => 'nullable|boolean',
            'min_test_score' => 'nullable|integer|min:0|max:100',
            'min_exam_score' => 'nullable|integer|min:0|max:100', // Legacy support
            'allow_retake' => 'nullable|boolean',
            'max_retakes' => 'nullable|integer|min:1|max:10',
            // Advanced
            'drip_content' => 'nullable|boolean',
            'drip_schedule' => 'nullable|in:daily,weekly,custom',
            'comments_enabled' => 'nullable|boolean',
            'visibility' => 'nullable|in:public,private,hidden',
            'permissions' => 'nullable|array',
        ];

        if ($request->hasFile('image')) {
            $rules['image'] = 'image|mimes:jpeg,png,jpg,gif|max:2048';
        }

        $validated = $request->validate($rules);

        $data = [];
        $fields = [
            'title', 'description', 'short_description', 'teacher_id', 'reward_points',
            'status', 'access_type', 'price', 'currency', 'level',
            'objectives', 'requirements', 'estimated_duration_hours',
            'sequential_unlock', 'min_completion_percentage',
            // SEO & Marketing
            'meta_title', 'meta_description', 'meta_keywords', 'marketing_tags',
            // Certificate
            'has_certificate', 'min_test_score', 'min_exam_score', 'allow_retake', 'max_retakes', // min_exam_score for legacy support
            // Advanced
            'drip_content', 'drip_schedule', 'comments_enabled', 'visibility', 'permissions'
        ];
        
        foreach ($fields as $field) {
            if (isset($validated[$field])) {
                $data[$field] = $validated[$field];
            }
        }
        
        // Handle min_test_score (new) or min_exam_score (legacy)
        if (isset($validated['min_test_score'])) {
            $data['min_test_score'] = $validated['min_test_score'];
        } elseif (isset($validated['min_exam_score'])) {
            // Legacy support: map min_exam_score to min_test_score
            $data['min_test_score'] = $validated['min_exam_score'];
        }

        // Use CourseBuilderService to update course
        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image');
        }

        $course = $this->courseBuilderService->updateCourse($course, $data);

        return response()->json([
            'message' => 'Curs actualizat cu succes',
            'course' => $this->addCourseMetrics($course->load(['modules', 'teacher', 'teams'])),
        ]);
    }

    public function destroy($id)
    {
        $course = Course::findOrFail($id);
        $this->courseBuilderService->deleteCourse($course);

        return response()->json([
            'message' => 'Curs șters cu succes',
        ]);
    }

    public function getTeachers()
    {
        try {
            // Check if users table exists
            if (!Schema::hasTable('users')) {
                return response()->json([]);
            }
            
            $teachers = User::where('role', 'teacher')
                ->orWhere('role', 'admin')
                ->get(['id', 'name', 'email']);

            return response()->json($teachers);
        } catch (\Exception $e) {
            \Log::error('Error fetching teachers', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => 'Failed to fetch teachers',
                'message' => $e->getMessage()
            ], 500);
        }
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
            'course' => $course->load(['modules', 'teacher', 'teams']),
        ]);
    }

    // Quick Actions
    public function quickAction(Request $request, $id, $action)
    {
        $course = Course::findOrFail($id);

        switch ($action) {
            case 'publish':
                if (Schema::hasColumn('courses', 'status')) {
                    $course->update(['status' => 'published']);
                }
                break;
            case 'unpublish':
                if (Schema::hasColumn('courses', 'status')) {
                    $course->update(['status' => 'draft']);
                }
                break;
            case 'archive':
                if (Schema::hasColumn('courses', 'status')) {
                    $course->update(['status' => 'archived']);
                }
                break;
            case 'unarchive':
                if (Schema::hasColumn('courses', 'status')) {
                    $course->update(['status' => 'draft']);
                }
                break;
            case 'disable':
                if (Schema::hasColumn('courses', 'status')) {
                    $course->update(['status' => 'disabled']);
                }
                break;
            case 'duplicate':
                $newCourse = $course->replicate();
                $newCourse->title = $course->title . ' (Copy)';
                $newCourse->status = 'draft';
                $newCourse->save();
                // Duplicate modules if needed
                break;
            default:
                return response()->json(['message' => 'Acțiune invalidă'], 400);
        }

        return response()->json([
            'message' => 'Acțiune efectuată cu succes',
            'course' => $this->addCourseMetrics($course->fresh()),
        ]);
    }

    // Bulk Actions
    public function bulkAction(Request $request)
    {
        try {
            $validated = $request->validate([
                'course_ids' => 'required|array|min:1',
                'course_ids.*' => 'exists:courses,id',
                'action' => 'required|in:publish,archive,disable,delete,unpublish',
            ]);

            $courses = Course::whereIn('id', $validated['course_ids'])->get();

            if ($courses->isEmpty()) {
                return response()->json([
                    'message' => 'Nu s-au găsit cursuri',
                ], 404);
            }

            $updated = 0;
            $deleted = 0;
            $errors = [];

            foreach ($courses as $course) {
                try {
                    switch ($validated['action']) {
                        case 'publish':
                            if (Schema::hasColumn('courses', 'status')) {
                                $course->update(['status' => 'published']);
                                $updated++;
                            }
                            break;
                        case 'unpublish':
                            if (Schema::hasColumn('courses', 'status')) {
                                $course->update(['status' => 'draft']);
                                $updated++;
                            }
                            break;
                        case 'archive':
                            if (Schema::hasColumn('courses', 'status')) {
                                $course->update(['status' => 'archived']);
                                $updated++;
                            }
                            break;
                        case 'disable':
                            if (Schema::hasColumn('courses', 'status')) {
                                // Use 'archived' instead of 'disabled' as it's not in the enum
                                $course->update(['status' => 'archived']);
                                $updated++;
                            }
                            break;
                        case 'delete':
                            if ($course->image) {
                                try {
                                    Storage::disk('public')->delete($course->image);
                                } catch (\Exception $e) {
                                    // Continue even if image deletion fails
                                }
                            }
                            $course->delete();
                            $deleted++;
                            break;
                    }
                } catch (\Exception $e) {
                    $errors[] = "Eroare la cursul {$course->id}: " . $e->getMessage();
                    \Log::error("Bulk action error for course {$course->id}: " . $e->getMessage());
                }
            }

            $message = $validated['action'] === 'delete' 
                ? "Șters {$deleted} cursuri"
                : "Actualizat {$updated} cursuri";

            $response = [
                'message' => $message,
                'updated' => $updated,
                'deleted' => $deleted,
            ];

            if (!empty($errors)) {
                $response['errors'] = $errors;
            }

            return response()->json($response);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Date invalide',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            \Log::error("Bulk action error: " . $e->getMessage());
            return response()->json([
                'message' => 'Eroare la procesarea acțiunii: ' . $e->getMessage(),
            ], 500);
        }
    }

    // Reorder Modules
    public function reorderModules(Request $request, $id)
    {
        $course = Course::findOrFail($id);

        $validated = $request->validate([
            'module_ids' => 'required|array',
            'module_ids.*' => 'exists:modules,id',
        ]);

        // Verify all modules belong to this course
        $modules = Module::whereIn('id', $validated['module_ids'])
            ->where('course_id', $id)
            ->get();

        if ($modules->count() !== count($validated['module_ids'])) {
            return response()->json([
                'message' => 'Unele module nu aparțin acestui curs',
            ], 400);
        }

        // Use CourseBuilderService to reorder modules
        $this->courseBuilderService->reorderModules($course, $validated['module_ids']);

        // Recalculate course progress after structure change
        $progressService = app(CourseProgressService::class);
        $progressService->recalculateCourseProgress($course);

        return response()->json([
            'message' => 'Module reordonate cu succes',
            'modules' => Module::where('course_id', $id)->orderBy('order')->get(),
        ]);
    }

    // Preview course (for admin)
    public function preview($id)
    {
        $course = Course::with([
            'modules' => function($query) {
                $query->orderBy('order')->with(['lessons' => function($q) {
                    $q->orderBy('order');
                }]);
            },
            'tests' => function($query) {
                $query->withPivot('scope', 'scope_id', 'required', 'passing_score', 'order');
            },
            'teacher'
        ])->findOrFail($id);
        
        // Return course data for preview
        return response()->json([
            'course' => $course,
            'preview_mode' => true,
        ]);
    }

    // Insights
    public function insights()
    {
        try {
            $insights = [];
            $thresholdCompletion = 30; // 30% completion threshold
            $thresholdDaysOutdated = 90; // 90 days outdated threshold

            $courses = Course::with('teacher')->get();

            foreach ($courses as $course) {
                $enrollments = 0;
                if (Schema::hasTable('course_user')) {
                    $enrollments = DB::table('course_user')
                        ->where('course_id', $course->id)
                        ->where(function($q) {
                            if (Schema::hasColumn('course_user', 'enrolled')) {
                                $q->where('enrolled', true);
                            } else {
                                $q->whereNotNull('course_id');
                            }
                        })
                        ->count();
                }

                if ($enrollments === 0) continue;

                $completed = 0;
                if (Schema::hasTable('course_user') && Schema::hasColumn('course_user', 'completed_at')) {
                    $completed = DB::table('course_user')
                        ->where('course_id', $course->id)
                        ->whereNotNull('completed_at')
                        ->count();
                }

                $completionRate = $enrollments > 0 ? ($completed / $enrollments) * 100 : 0;

                // Low completion
                if ($completionRate < $thresholdCompletion && $enrollments > 5) {
                    $insights[] = [
                        'id' => 'low_completion_' . $course->id,
                        'type' => 'low_completion',
                        'course_id' => $course->id,
                        'course_title' => $course->title,
                        'message' => "Rată de finalizare " . round($completionRate, 1) . "% (sub {$thresholdCompletion}%)",
                        'severity' => 'warning',
                    ];
                }

                // Outdated course
                if ($course->updated_at) {
                    $daysSinceUpdate = Carbon::parse($course->updated_at)->diffInDays(Carbon::now());
                    if ($daysSinceUpdate > $thresholdDaysOutdated) {
                        $insights[] = [
                            'id' => 'outdated_' . $course->id,
                            'type' => 'outdated',
                            'course_id' => $course->id,
                            'course_title' => $course->title,
                            'message' => "Neactualizat de {$daysSinceUpdate} zile",
                            'severity' => 'info',
                        ];
                    }
                }
            }

            return response()->json($insights);
        } catch (\Exception $e) {
            \Log::error("Error fetching insights: " . $e->getMessage());
            return response()->json([
                'error' => 'Error fetching insights: ' . $e->getMessage()
            ], 500);
        }
    }
}
