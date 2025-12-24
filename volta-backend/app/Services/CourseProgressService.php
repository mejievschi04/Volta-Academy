<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Module;
use App\Models\Lesson;
use App\Models\Test;
use App\Models\User;
use App\Models\CourseTest;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class CourseProgressService
{
    protected ProgressionEngine $progressionEngine;

    public function __construct(ProgressionEngine $progressionEngine)
    {
        $this->progressionEngine = $progressionEngine;
    }
    /**
     * Calculate course progress for a user
     */
    public function calculateCourseProgress(User $user, Course $course): float
    {
        $modules = $course->modules()->where('status', 'published')->get();
        
        if ($modules->isEmpty()) {
            return 0;
        }

        $totalLessons = 0;
        $completedLessons = 0;

        foreach ($modules as $module) {
            $moduleLessons = $module->lessons()->where('status', 'published')->get();
            $totalLessons += $moduleLessons->count();

            foreach ($moduleLessons as $lesson) {
                $isCompleted = DB::table('lesson_progress')
                    ->where('user_id', $user->id)
                    ->where('lesson_id', $lesson->id)
                    ->where('completed', true)
                    ->exists();

                if ($isCompleted) {
                    $completedLessons++;
                }
            }
        }

        if ($totalLessons === 0) {
            return 0;
        }

        $progress = ($completedLessons / $totalLessons) * 100;
        
        // Update course_user progress
        DB::table('course_user')
            ->where('user_id', $user->id)
            ->where('course_id', $course->id)
            ->update([
                'progress_percentage' => round($progress, 2),
                'updated_at' => Carbon::now(),
            ]);

        return round($progress, 2);
    }

    /**
     * Calculate module progress for a user
     */
    public function calculateModuleProgress(User $user, Module $module): float
    {
        $lessons = $module->lessons()->where('status', 'published')->get();
        
        if ($lessons->isEmpty()) {
            return 0;
        }

        $completed = 0;
        foreach ($lessons as $lesson) {
            $isCompleted = DB::table('lesson_progress')
                ->where('user_id', $user->id)
                ->where('lesson_id', $lesson->id)
                ->where('completed', true)
                ->exists();

            if ($isCompleted) {
                $completed++;
            }
        }

        $progress = ($completed / $lessons->count()) * 100;
        
        // Update module calculated_progress if column exists
        if (DB::getSchemaBuilder()->hasColumn('modules', 'calculated_progress')) {
            // This is aggregate progress for all users, calculate separately if needed
        }

        return round($progress, 2);
    }

    /**
     * Check if a module is unlocked for a user
     * Uses ProgressionEngine for rule-based evaluation
     */
    public function isModuleUnlocked(User $user, Module $module, Course $course): bool
    {
        return $this->progressionEngine->isModuleUnlocked($user, $module, $course);
    }

    /**
     * Check if a lesson is unlocked for a user
     * Uses ProgressionEngine for rule-based evaluation
     */
    public function isLessonUnlocked(User $user, Lesson $lesson, Module $module, Course $course): bool
    {
        return $this->progressionEngine->isLessonUnlocked($user, $lesson, $course);
    }

    /**
     * Check if a test is unlocked for a user
     * Uses ProgressionEngine for rule-based evaluation
     */
    public function isTestUnlocked(User $user, Test $test, Course $course): bool
    {
        return $this->progressionEngine->isTestUnlocked($user, $test, $course);
    }

    /**
     * Mark lesson as completed
     */
    public function completeLesson(User $user, Lesson $lesson): bool
    {
        // Check if already completed
        $existing = DB::table('lesson_progress')
            ->where('user_id', $user->id)
            ->where('lesson_id', $lesson->id)
            ->first();

        if ($existing && $existing->completed) {
            return true;
        }

        // Insert or update
        DB::table('lesson_progress')->updateOrInsert(
            [
                'user_id' => $user->id,
                'lesson_id' => $lesson->id,
            ],
            [
                'completed' => true,
                'completed_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
                'created_at' => $existing ? $existing->created_at : Carbon::now(),
            ]
        );

        // Update lesson completion count
        $lesson->increment('completions_count');

        // Recalculate module progress (real-time)
        if ($lesson->module) {
            $moduleProgress = $this->calculateModuleProgress($user, $lesson->module);
            
            // Check if module is now complete
            $isModuleComplete = $this->isModuleComplete($user, $lesson->module);
            
            if ($isModuleComplete) {
                // Module is complete, update course progress
                if ($lesson->module->course) {
                    $this->calculateCourseProgress($user, $lesson->module->course);
                    
                    // Check if course is now complete
                    $isCourseComplete = $this->isCourseComplete($user, $lesson->module->course);
                    
                    if ($isCourseComplete) {
                        // Mark course as completed
                        DB::table('course_user')
                            ->where('user_id', $user->id)
                            ->where('course_id', $lesson->module->course->id)
                            ->update([
                                'completed_at' => Carbon::now(),
                                'updated_at' => Carbon::now(),
                            ]);
                    }
                }
            } else {
                // Module not complete yet, but still update course progress
                if ($lesson->module->course) {
                    $this->calculateCourseProgress($user, $lesson->module->course);
                }
            }
        }

        return true;
    }

    /**
     * Check if a module is complete (all lessons + required exams passed)
     */
    public function isModuleComplete(User $user, Module $module): bool
    {
        // Get all published lessons
        $lessons = $module->lessons()->where('status', 'published')->get();
        
        if ($lessons->isEmpty()) {
            return false;
        }

        // Check if all lessons are completed
        foreach ($lessons as $lesson) {
            $isCompleted = DB::table('lesson_progress')
                ->where('user_id', $user->id)
                ->where('lesson_id', $lesson->id)
                ->where('completed', true)
                ->exists();

            if (!$isCompleted) {
                return false;
            }
        }

        // Check if all required tests are passed
        $requiredTests = CourseTest::where('course_id', $module->course_id)
            ->where('scope', 'module')
            ->where('scope_id', $module->id)
            ->where('required', true)
            ->get();

        foreach ($requiredTests as $courseTest) {
            $test = $courseTest->test;
            if (!$test || $test->status !== 'published') {
                continue;
            }

            $hasPassed = DB::table('test_results')
                ->where('user_id', $user->id)
                ->where('test_id', $test->id)
                ->where('percentage', '>=', $courseTest->passing_score)
                ->where('passed', true)
                ->exists();

            if (!$hasPassed) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if a course is complete (all modules + required exams passed)
     */
    public function isCourseComplete(User $user, Course $course): bool
    {
        // Get all published modules
        $modules = $course->modules()->where('status', 'published')->get();
        
        if ($modules->isEmpty()) {
            return false;
        }

        // Check if all modules are complete
        foreach ($modules as $module) {
            if (!$this->isModuleComplete($user, $module)) {
                return false;
            }
        }

        // Check if all required course-level tests are passed
        $requiredTests = CourseTest::where('course_id', $course->id)
            ->where('scope', 'course')
            ->where('required', true)
            ->get();

        foreach ($requiredTests as $courseTest) {
            $test = $courseTest->test;
            if (!$test || $test->status !== 'published') {
                continue;
            }

            $hasPassed = DB::table('test_results')
                ->where('user_id', $user->id)
                ->where('test_id', $test->id)
                ->where('percentage', '>=', $courseTest->passing_score)
                ->where('passed', true)
                ->exists();

            if (!$hasPassed) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get next incomplete lesson for a user in a course
     */
    public function getNextIncompleteLesson(User $user, Course $course): ?Lesson
    {
        $modules = $course->modules()
            ->where('status', 'published')
            ->orderBy('order')
            ->get();

        foreach ($modules as $module) {
            // Check if module is unlocked
            if (!$this->isModuleUnlocked($user, $module, $course)) {
                continue;
            }

            $lessons = $module->lessons()
                ->where('status', 'published')
                ->orderBy('order')
                ->get();

            foreach ($lessons as $lesson) {
                // Check if lesson is unlocked
                if (!$this->isLessonUnlocked($user, $lesson, $module, $course)) {
                    continue;
                }

                // Check if lesson is completed
                $isCompleted = DB::table('lesson_progress')
                    ->where('user_id', $user->id)
                    ->where('lesson_id', $lesson->id)
                    ->where('completed', true)
                    ->exists();

                if (!$isCompleted) {
                    return $lesson;
                }
            }
        }

        return null;
    }

    /**
     * Get next incomplete test for a user in a course
     */
    public function getNextIncompleteTest(User $user, Course $course): ?Test
    {
        // Check course-level tests first
        $courseTests = CourseTest::where('course_id', $course->id)
            ->where('scope', 'course')
            ->where('required', true)
            ->orderBy('order')
            ->get();

        foreach ($courseTests as $courseTest) {
            $test = $courseTest->test;
            if (!$test || $test->status !== 'published') {
                continue;
            }

            $hasPassed = DB::table('test_results')
                ->where('user_id', $user->id)
                ->where('test_id', $test->id)
                ->where('percentage', '>=', $courseTest->passing_score)
                ->where('passed', true)
                ->exists();

            if (!$hasPassed) {
                // Check if test is unlocked
                if ($this->isTestUnlocked($user, $test, $course)) {
                    return $test;
                }
            }
        }

        // Check module-level tests
        $modules = $course->modules()
            ->where('status', 'published')
            ->orderBy('order')
            ->get();

        foreach ($modules as $module) {
            if (!$this->isModuleUnlocked($user, $module, $course)) {
                continue;
            }

            $moduleTests = CourseTest::where('course_id', $course->id)
                ->where('scope', 'module')
                ->where('scope_id', $module->id)
                ->where('required', true)
                ->orderBy('order')
                ->get();

            foreach ($moduleTests as $courseTest) {
                $test = $courseTest->test;
                if (!$test || $test->status !== 'published') {
                    continue;
                }

                $hasPassed = DB::table('test_results')
                    ->where('user_id', $user->id)
                    ->where('test_id', $test->id)
                    ->where('percentage', '>=', $courseTest->passing_score)
                    ->where('passed', true)
                    ->exists();

                if (!$hasPassed) {
                    if ($this->isTestUnlocked($user, $test, $course)) {
                        return $test;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Check if user can progress (all required tests passed)
     */
    public function canUserProgress(User $user, Course $course): bool
    {
        // Get all required tests for the course
        $requiredTests = CourseTest::where('course_id', $course->id)
            ->where('required', true)
            ->get();

        foreach ($requiredTests as $courseTest) {
            $test = $courseTest->test;
            if (!$test || $test->status !== 'published') {
                continue;
            }

            $hasPassed = DB::table('test_results')
                ->where('user_id', $user->id)
                ->where('test_id', $test->id)
                ->where('percentage', '>=', $courseTest->passing_score)
                ->where('passed', true)
                ->exists();

            if (!$hasPassed) {
                return false;
            }
        }

        return true;
    }

    /**
     * Recalculate all progress for a course (after structure changes)
     */
    public function recalculateCourseProgress(Course $course): void
    {
        $enrolledUsers = DB::table('course_user')
            ->where('course_id', $course->id)
            ->where('enrolled', true)
            ->pluck('user_id');

        foreach ($enrolledUsers as $userId) {
            $user = User::find($userId);
            if ($user) {
                $this->calculateCourseProgress($user, $course);
            }
        }
    }

    /**
     * Get user's access status for course elements
     */
    public function getUserAccessStatus(User $user, Course $course): array
    {
        $modules = $course->modules()->where('status', 'published')->orderBy('order')->get();
        $accessStatus = [
            'course_progress' => $this->calculateCourseProgress($user, $course),
            'modules' => [],
        ];

        foreach ($modules as $module) {
            $moduleProgress = $this->calculateModuleProgress($user, $module);
            $isUnlocked = $this->isModuleUnlocked($user, $module, $course);

            $moduleData = [
                'id' => $module->id,
                'unlocked' => $isUnlocked,
                'progress' => $moduleProgress,
                'lessons' => [],
            ];

            $lessons = $module->lessons()->where('status', 'published')->orderBy('order')->get();
            foreach ($lessons as $lesson) {
                $isLessonUnlocked = $this->isLessonUnlocked($user, $lesson, $module, $course);
                $isCompleted = DB::table('lesson_progress')
                    ->where('user_id', $user->id)
                    ->where('lesson_id', $lesson->id)
                    ->where('completed', true)
                    ->exists();

                $moduleData['lessons'][] = [
                    'id' => $lesson->id,
                    'unlocked' => $isLessonUnlocked,
                    'completed' => $isCompleted,
                    'is_preview' => $lesson->is_preview,
                ];
            }

            $accessStatus['modules'][] = $moduleData;
        }

        return $accessStatus;
    }
}

