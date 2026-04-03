<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Exam;
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
        // Include draft + published (lessons created in builder default to draft)
        $modules = $course->modules()->whereIn('status', ['published', 'draft'])->get();
        
        if ($modules->isEmpty()) {
            return 0;
        }

        $totalLessons = 0;
        $completedLessons = 0;

        foreach ($modules as $module) {
            $moduleLessons = $module->lessons()->whereIn('status', ['published', 'draft'])->get();
            $totalLessons += $moduleLessons->count();

            foreach ($moduleLessons as $lesson) {
                // Check if lesson is completed (either marked as completed OR has 100% progress)
                $lessonProgress = DB::table('lesson_progress')
                    ->where('user_id', $user->id)
                    ->where('lesson_id', $lesson->id)
                    ->first();
                
                $isCompleted = false;
                if ($lessonProgress) {
                    $progressPercentage = $lessonProgress->progress_percentage ?? 0;
                    // Lesson is completed if marked as completed OR has 100% progress
                    $isCompleted = ($lessonProgress->completed ?? false) || ($progressPercentage >= 100);
                }

                if ($isCompleted) {
                    $completedLessons++;
                }
            }
        }

        if ($totalLessons === 0) {
            return 0;
        }

        $progress = ($completedLessons / $totalLessons) * 100;
        
        // Check if course is complete (100% progress + all required tests passed)
        $isComplete = false;
        if ($progress >= 100) {
            $isComplete = $this->isCourseComplete($user, $course);
        }
        
        // Update course_user progress and completion status
        // Cast to int - course_user.progress_percentage is integer
        $updateData = [
            'progress_percentage' => (int) round($progress, 0),
            'updated_at' => Carbon::now(),
        ];
        
        // If course is complete, mark it as completed
        if ($isComplete) {
            $updateData['completed_at'] = Carbon::now();
        }
        
        DB::table('course_user')
            ->where('user_id', $user->id)
            ->where('course_id', $course->id)
            ->update($updateData);

        return round($progress, 2);
    }

    /**
     * Calculate module progress for a user
     */
    public function calculateModuleProgress(User $user, Module $module): float
    {
        $lessons = $module->lessons()->whereIn('status', ['published', 'draft'])->get();
        
        if ($lessons->isEmpty()) {
            return 0;
        }

        $completed = 0;
        foreach ($lessons as $lesson) {
            // Check if lesson is completed (either marked as completed OR has 100% progress)
            $lessonProgress = DB::table('lesson_progress')
                ->where('user_id', $user->id)
                ->where('lesson_id', $lesson->id)
                ->first();
            
            $isCompleted = false;
            if ($lessonProgress) {
                $progressPercentage = $lessonProgress->progress_percentage ?? 0;
                // Lesson is completed if marked as completed OR has 100% progress
                $isCompleted = ($lessonProgress->completed ?? false) || ($progressPercentage >= 100);
            }

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
     * Legacy exams table: access mirrors lesson/module progression (same idea as tests).
     */
    public function isExamUnlocked(User $user, Exam $exam, ?Module $module = null, ?Lesson $lesson = null): bool
    {
        // Examene fără curs (catalog pe pagina Mape): published + vizibilitate elev
        if (empty($exam->course_id)) {
            if (($exam->status ?? 'draft') !== 'published') {
                return false;
            }

            return $exam->isVisibleToLearner($user);
        }

        $course = $exam->relationLoaded('course') && $exam->course
            ? $exam->course
            : Course::find($exam->course_id);

        if (!$course) {
            return false;
        }

        if ($lesson) {
            $lessonModule = $lesson->relationLoaded('module') && $lesson->module
                ? $lesson->module
                : ($module ?? ($lesson->module_id ? Module::find($lesson->module_id) : null));

            if (!$lessonModule) {
                return false;
            }

            return $this->isLessonUnlocked($user, $lesson, $lessonModule, $course);
        }

        if ($module) {
            return $this->isModuleUnlocked($user, $module, $course);
        }

        return true;
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
                        app(\App\Services\NotificationService::class)->notifyCourseCompleted($user, $lesson->module->course);
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
        $lessons = $module->lessons()->whereIn('status', ['published', 'draft'])->get();
        
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

        // Check if all lesson-level tests in this module are passed
        foreach ($lessons as $lesson) {
            $lessonTests = CourseTest::where('course_id', $module->course_id)
                ->where('scope', 'lesson')
                ->where('scope_id', $lesson->id)
                ->get();

            foreach ($lessonTests as $courseTest) {
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
        }

        // Check if all module-level tests are passed (cursul nu se finalizează fără test)
        $moduleTests = CourseTest::where('course_id', $module->course_id)
            ->where('scope', 'module')
            ->where('scope_id', $module->id)
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
        $modules = $course->modules()->whereIn('status', ['published', 'draft'])->get();
        
        if ($modules->isEmpty()) {
            return false;
        }

        // Check if all modules are complete
        foreach ($modules as $module) {
            if (!$this->isModuleComplete($user, $module)) {
                return false;
            }
        }

        // În special: testul final (type='final') trebuie promovat
        $finalTests = CourseTest::where('course_id', $course->id)
            ->whereHas('test', fn ($q) => $q->where('type', 'final'))
            ->get();

        foreach ($finalTests as $courseTest) {
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

        // Check if all course-level tests are passed (cursul nu se finalizează fără test)
        $courseLevelTests = CourseTest::where('course_id', $course->id)
            ->where('scope', 'course')
            ->get();

        foreach ($courseLevelTests as $courseTest) {
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
            ->whereIn('status', ['published', 'draft'])
            ->orderBy('order')
            ->get();

        foreach ($modules as $module) {
            // Check if module is unlocked
            if (!$this->isModuleUnlocked($user, $module, $course)) {
                continue;
            }

            $lessons = $module->lessons()
                ->whereIn('status', ['published', 'draft'])
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
     * Order follows course flow: lesson tests (after each completed lesson), module tests, then course-level tests.
     */
    public function getNextIncompleteTest(User $user, Course $course): ?Test
    {
        $modules = $course->modules()
            ->whereIn('status', ['published', 'draft'])
            ->orderBy('order')
            ->get();

        foreach ($modules as $module) {
            if (!$this->isModuleUnlocked($user, $module, $course)) {
                continue;
            }

            $lessons = $module->lessons()
                ->whereIn('status', ['published', 'draft'])
                ->orderBy('order')
                ->get();

            foreach ($lessons as $lesson) {
                if (!$this->isLessonUnlocked($user, $lesson, $module, $course)) {
                    continue;
                }

                $lessonCompleted = DB::table('lesson_progress')
                    ->where('user_id', $user->id)
                    ->where('lesson_id', $lesson->id)
                    ->where('completed', true)
                    ->exists();

                if (!$lessonCompleted) {
                    continue;
                }

                $lessonTests = CourseTest::where('course_id', $course->id)
                    ->where('scope', 'lesson')
                    ->where('scope_id', $lesson->id)
                    ->orderBy('order')
                    ->get();

                foreach ($lessonTests as $courseTest) {
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

                    if (!$hasPassed && $this->isTestUnlocked($user, $test, $course)) {
                        return $test;
                    }
                }
            }

            $moduleTests = CourseTest::where('course_id', $course->id)
                ->where('scope', 'module')
                ->where('scope_id', $module->id)
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

                if (!$hasPassed && $this->isTestUnlocked($user, $test, $course)) {
                    return $test;
                }
            }
        }

        $courseTests = CourseTest::where('course_id', $course->id)
            ->where('scope', 'course')
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

            if (!$hasPassed && $this->isTestUnlocked($user, $test, $course)) {
                return $test;
            }
        }

        return null;
    }

    /**
     * Check if user can progress (all required tests passed)
     */
    public function canUserProgress(User $user, Course $course): bool
    {
        // Aliniat cu isCourseComplete: orice test publicat legat de curs trebuie promovat
        foreach (CourseTest::where('course_id', $course->id)->with('test')->get() as $courseTest) {
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
        $modules = $course->modules()->whereIn('status', ['published', 'draft'])->orderBy('order')->get();
        $accessStatus = [
            'course_progress' => $this->calculateCourseProgress($user, $course),
            'modules' => [],
            'course_level_tests' => [],
        ];

        $allCourseTests = CourseTest::where('course_id', $course->id)
            ->with(['test' => function ($q) {
                $q->select('id', 'title', 'status', 'type');
            }])
            ->orderBy('order')
            ->get();

        $ctByKey = $allCourseTests->groupBy(function ($row) {
            $sid = $row->scope_id;

            return $row->scope . ':' . ($sid === null ? 'null' : (string) $sid);
        });

        $progressForCourseTest = function (CourseTest $courseTest) use ($user, $course): ?array {
            $test = $courseTest->test;
            if (!$test || $test->status !== 'published') {
                return null;
            }

            $hasPassed = DB::table('test_results')
                ->where('user_id', $user->id)
                ->where('test_id', $test->id)
                ->where('percentage', '>=', $courseTest->passing_score)
                ->where('passed', true)
                ->exists();

            return [
                'test_id' => $test->id,
                'passed' => $hasPassed,
                'unlocked' => $this->isTestUnlocked($user, $test, $course),
                'required' => (bool) $courseTest->required,
                'passing_score' => $courseTest->passing_score,
                'title' => $test->title,
            ];
        };

        foreach ($modules as $module) {
            $moduleProgress = $this->calculateModuleProgress($user, $module);
            $isUnlocked = $this->isModuleUnlocked($user, $module, $course);

            $moduleData = [
                'id' => $module->id,
                'unlocked' => $isUnlocked,
                'progress' => $moduleProgress,
                'lessons' => [],
                'tests' => [],
            ];

            $moduleData['tests'] = $ctByKey->get('module:' . $module->id, collect())
                ->map($progressForCourseTest)
                ->filter()
                ->values()
                ->all();

            $lessons = $module->lessons()->whereIn('status', ['published', 'draft'])->orderBy('order')->get();
            foreach ($lessons as $lesson) {
                $isLessonUnlocked = $this->isLessonUnlocked($user, $lesson, $module, $course);
                
                // Check if lesson is completed (either marked as completed OR has 100% progress)
                $lessonProgress = DB::table('lesson_progress')
                    ->where('user_id', $user->id)
                    ->where('lesson_id', $lesson->id)
                    ->first();
                
                $isCompleted = false;
                $progressPercentage = 0;
                
                if ($lessonProgress) {
                    $progressPercentage = $lessonProgress->progress_percentage ?? 0;
                    // Lesson is completed if marked as completed OR has 100% progress
                    $isCompleted = ($lessonProgress->completed ?? false) || ($progressPercentage >= 100);
                }

                $lessonTestsProgress = $ctByKey->get('lesson:' . $lesson->id, collect())
                    ->map($progressForCourseTest)
                    ->filter()
                    ->values()
                    ->all();

                $moduleData['lessons'][] = [
                    'id' => $lesson->id,
                    'unlocked' => $isLessonUnlocked,
                    'completed' => $isCompleted,
                    'progress_percentage' => $progressPercentage,
                    'is_preview' => $lesson->is_preview,
                    'tests' => $lessonTestsProgress,
                ];
            }

            $accessStatus['modules'][] = $moduleData;
        }

        $accessStatus['course_level_tests'] = $ctByKey->get('course:null', collect())
            ->map($progressForCourseTest)
            ->filter()
            ->values()
            ->all();

        return $accessStatus;
    }
}

