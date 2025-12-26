<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\Exam;
use App\Services\CourseProgressService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CourseProgressController extends Controller
{
    protected $progressService;

    public function __construct(CourseProgressService $progressService)
    {
        $this->progressService = $progressService;
    }

    /**
     * Get user's progress for a course
     */
    public function getCourseProgress($courseId)
    {
        try {
            $user = Auth::user();
            if (!$user) {
                return response()->json([
                    'message' => 'Utilizator neautentificat',
                ], 401);
            }

            $course = Course::findOrFail($courseId);

            // Check if user is enrolled
            $enrollment = \DB::table('course_user')
                ->where('user_id', $user->id)
                ->where('course_id', $courseId)
                ->where('enrolled', true)
                ->first();

            // If not enrolled, check if course is free and auto-enroll
            if (!$enrollment) {
                // Get access type from course settings or legacy field
                $accessType = $course->access_type ?? ($course->settings['access']['type'] ?? 'free');
                
                // For free courses, auto-enroll the user
                if ($accessType === 'free') {
                    \DB::table('course_user')->updateOrInsert(
                        [
                            'user_id' => $user->id,
                            'course_id' => $courseId,
                        ],
                        [
                            'enrolled' => true,
                            'enrolled_at' => now(),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]
                    );
                } else {
                    // For paid courses, return 403
                    return response()->json([
                        'message' => 'Nu ești înscris la acest curs',
                    ], 403);
                }
            }

            // Recalculate progress in real-time
            try {
                $this->progressService->calculateCourseProgress($user, $course);
            } catch (\Exception $e) {
                \Log::warning('Error calculating course progress', [
                    'course_id' => $courseId,
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }

            // Get access status (includes progress)
            try {
                $accessStatus = $this->progressService->getUserAccessStatus($user, $course);
            } catch (\Exception $e) {
                \Log::error('Error getting user access status', [
                    'course_id' => $courseId,
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
                // Return minimal access status if service fails
                $accessStatus = [
                    'enrolled' => true,
                    'progress_percentage' => 0,
                    'can_progress' => false,
                    'course_complete' => false,
                ];
            }

            // Get next incomplete lesson (for resume functionality)
            try {
                $nextLesson = $this->progressService->getNextIncompleteLesson($user, $course);
                $accessStatus['next_lesson'] = $nextLesson ? [
                    'id' => $nextLesson->id,
                    'title' => $nextLesson->title ?? '',
                    'module_id' => $nextLesson->module_id ?? null,
                ] : null;
            } catch (\Exception $e) {
                \Log::warning('Error getting next lesson', [
                    'course_id' => $courseId,
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
                $accessStatus['next_lesson'] = null;
            }

            // Get next incomplete test (using getNextIncompleteTest instead of getNextIncompleteExam)
            try {
                $nextTest = $this->progressService->getNextIncompleteTest($user, $course);
                $accessStatus['next_exam'] = $nextTest ? [
                    'id' => $nextTest->id,
                    'title' => $nextTest->title ?? '',
                    'module_id' => null, // Tests are linked via CourseTest, not directly to modules
                ] : null;
            } catch (\Exception $e) {
                \Log::warning('Error getting next test', [
                    'course_id' => $courseId,
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
                $accessStatus['next_exam'] = null;
            }

            // Check if user can progress (all required exams passed)
            try {
                $accessStatus['can_progress'] = $this->progressService->canUserProgress($user, $course);
            } catch (\Exception $e) {
                \Log::warning('Error checking if user can progress', [
                    'course_id' => $courseId,
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
                $accessStatus['can_progress'] = false;
            }

            // Check if course is complete
            try {
                $accessStatus['course_complete'] = $this->progressService->isCourseComplete($user, $course);
            } catch (\Exception $e) {
                \Log::warning('Error checking if course is complete', [
                    'course_id' => $courseId,
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
                $accessStatus['course_complete'] = false;
            }

            return response()->json($accessStatus);
        } catch (\Exception $e) {
            \Log::error('Error in CourseProgressController::getCourseProgress', [
                'course_id' => $courseId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            return response()->json([
                'error' => 'Nu s-a putut încărca progresul cursului',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Mark lesson as completed
     */
    public function completeLesson(Request $request, $lessonId)
    {
        $user = Auth::user();
        $lesson = Lesson::findOrFail($lessonId);

        // Check if lesson is unlocked
        $module = $lesson->module;
        if (!$module) {
            return response()->json([
                'message' => 'Lecția nu aparține unui modul',
            ], 400);
        }

        $course = $module->course;
        if (!$course) {
            return response()->json([
                'message' => 'Modulul nu aparține unui curs',
            ], 400);
        }

        // Check enrollment
        $enrollment = \DB::table('course_user')
            ->where('user_id', $user->id)
            ->where('course_id', $course->id)
            ->where('enrolled', true)
            ->first();

        // If not enrolled, check if course is free and auto-enroll
        if (!$enrollment) {
            // For free courses, auto-enroll the user
            if ($course->access_type === 'free') {
                \DB::table('course_user')->updateOrInsert(
                    [
                        'user_id' => $user->id,
                        'course_id' => $course->id,
                    ],
                    [
                        'enrolled' => true,
                        'enrolled_at' => now(),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            } else {
                // For paid courses, return 403
                return response()->json([
                    'message' => 'Nu ești înscris la acest curs',
                ], 403);
            }
        }

        // Check if lesson is unlocked
        $isUnlocked = $this->progressService->isLessonUnlocked($user, $lesson, $module, $course);
        if (!$isUnlocked) {
            return response()->json([
                'message' => 'Lecția este blocată. Completează lecțiile anterioare.',
            ], 403);
        }

        // Mark as completed
        $this->progressService->completeLesson($user, $lesson);

        // Get updated progress
        $accessStatus = $this->progressService->getUserAccessStatus($user, $course);

        return response()->json([
            'message' => 'Lecție finalizată cu succes',
            'progress' => $accessStatus,
        ]);
    }

    /**
     * Check access to a module
     */
    public function checkModuleAccess($moduleId)
    {
        $user = Auth::user();
        $module = Module::with('course')->findOrFail($moduleId);

        $isUnlocked = $this->progressService->isModuleUnlocked($user, $module, $module->course);
        $progress = $this->progressService->calculateModuleProgress($user, $module);

        return response()->json([
            'unlocked' => $isUnlocked,
            'progress' => $progress,
        ]);
    }

    /**
     * Check access to a lesson
     */
    public function checkLessonAccess($lessonId)
    {
        $user = Auth::user();
        $lesson = Lesson::with(['module', 'module.course'])->findOrFail($lessonId);

        if (!$lesson->module) {
            return response()->json([
                'message' => 'Lecția nu aparține unui modul',
            ], 400);
        }

        $isUnlocked = $this->progressService->isLessonUnlocked(
            $user,
            $lesson,
            $lesson->module,
            $lesson->module->course
        );

        $isCompleted = \DB::table('lesson_progress')
            ->where('user_id', $user->id)
            ->where('lesson_id', $lessonId)
            ->where('completed', true)
            ->exists();

        return response()->json([
            'unlocked' => $isUnlocked,
            'completed' => $isCompleted,
            'is_preview' => $lesson->is_preview,
        ]);
    }

    /**
     * Check access to an exam
     */
    public function checkExamAccess($examId)
    {
        $user = Auth::user();
        $exam = Exam::with(['module', 'lesson'])->findOrFail($examId);

        $module = $exam->module;
        $lesson = $exam->lesson;

        $isUnlocked = $this->progressService->isExamUnlocked($user, $exam, $module, $lesson);

        return response()->json([
            'unlocked' => $isUnlocked,
            'is_required' => $exam->is_required ?? false,
        ]);
    }

    /**
     * Update lesson progress (without marking as completed)
     */
    public function updateLessonProgress(Request $request, $lessonId)
    {
        $user = Auth::user();
        $lesson = Lesson::findOrFail($lessonId);

        $validated = $request->validate([
            'progress_percentage' => 'nullable|numeric|min:0|max:100',
            'time_spent_seconds' => 'nullable|integer|min:0',
        ]);

        // Update or create lesson progress
        \DB::table('lesson_progress')->updateOrInsert(
            [
                'user_id' => $user->id,
                'lesson_id' => $lessonId,
            ],
            [
                'progress_percentage' => $validated['progress_percentage'] ?? 0,
                'time_spent_seconds' => $validated['time_spent_seconds'] ?? 0,
                'started_at' => now(),
                'updated_at' => now(),
            ]
        );

        return response()->json([
            'message' => 'Progres actualizat',
        ]);
    }
}

