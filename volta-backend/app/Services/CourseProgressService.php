<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Exam;
use App\Models\Module;
use App\Models\Lesson;
use App\Models\Test;
use App\Models\User;
use App\Models\CourseTest;
use App\Models\ActivityLog;
use App\Support\StudentActivityLogger;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class CourseProgressService
{
    protected ProgressionEngine $progressionEngine;

    /** @var array<int, array<int, object>> */
    private array $lessonProgressByUser = [];

    /** @var array<string, float> */
    private array $courseProgressMemo = [];

    /** @var array<string, array> */
    private array $accessStatusMemo = [];

    public function __construct(ProgressionEngine $progressionEngine)
    {
        $this->progressionEngine = $progressionEngine;
    }

    private function forgetUserProgressCache(User $user, ?int $courseId = null): void
    {
        unset($this->lessonProgressByUser[$user->id]);
        if ($courseId !== null) {
            unset($this->courseProgressMemo[$user->id . ':' . $courseId], $this->accessStatusMemo[$user->id . ':' . $courseId]);
            return;
        }
        $prefix = $user->id . ':';
        foreach (array_keys($this->courseProgressMemo) as $key) {
            if (str_starts_with($key, $prefix)) {
                unset($this->courseProgressMemo[$key]);
            }
        }
        foreach (array_keys($this->accessStatusMemo) as $key) {
            if (str_starts_with($key, $prefix)) {
                unset($this->accessStatusMemo[$key]);
            }
        }
    }

    /**
     * @return array<int, object>
     */
    private function lessonProgressMap(User $user): array
    {
        if (isset($this->lessonProgressByUser[$user->id])) {
            return $this->lessonProgressByUser[$user->id];
        }

        $map = [];
        foreach (DB::table('lesson_progress')->where('user_id', $user->id)->get(['lesson_id', 'completed', 'progress_percentage']) as $row) {
            $map[(int) $row->lesson_id] = $row;
        }

        return $this->lessonProgressByUser[$user->id] = $map;
    }

    /**
     * @return array<int, true>
     */
    private function passedTestIdSet(User $user, int $courseId): array
    {
        $ids = [];
        foreach (DB::table('test_results')
            ->where('user_id', $user->id)
            ->where('course_id', $courseId)
            ->where('passed', true)
            ->pluck('test_id') as $id) {
            $ids[(int) $id] = true;
        }

        return $ids;
    }

    private function hasPassedTestResult(User $user, int $testId, int $courseId, ?array $passedIds = null): bool
    {
        $passedIds ??= $this->passedTestIdSet($user, $courseId);

        return isset($passedIds[$testId]);
    }

    private function progressRowIsComplete(?object $row): bool
    {
        if (!$row) {
            return false;
        }

        return (bool) ($row->completed ?? false) || (int) ($row->progress_percentage ?? 0) >= 100;
    }

    protected function getCourseRootLessons(Course $course)
    {
        if ($course->relationLoaded('lessons')) {
            return $course->lessons
                ->whereNull('module_id')
                ->where('status', 'published')
                ->sortBy('order')
                ->values();
        }

        return $course->lessons()
            ->whereNull('module_id')
            ->where('status', 'published')
            ->orderBy('order')
            ->get();
    }

    protected function isLessonMarkedComplete(User $user, int $lessonId): bool
    {
        if ($user->isLearningActivityExempt()) {
            return false;
        }

        return $this->progressRowIsComplete($this->lessonProgressMap($user)[$lessonId] ?? null);
    }
    /**
     * Calculate course progress for a user
     */
    public function calculateCourseProgress(User $user, Course $course): float
    {
        if ($user->isLearningActivityExempt()) {
            return 0;
        }

        $memoKey = $user->id . ':' . $course->id;
        if (isset($this->courseProgressMemo[$memoKey])) {
            return $this->courseProgressMemo[$memoKey];
        }

        $lessonIds = Lesson::query()
            ->where('status', 'published')
            ->where(function ($query) use ($course) {
                $query->where(function ($root) use ($course) {
                    $root->where('course_id', $course->id)->whereNull('module_id');
                })->orWhereHas('module', function ($module) use ($course) {
                    $module->where('course_id', $course->id)->where('status', 'published');
                });
            })
            ->pluck('id');
        $totalLessons = $lessonIds->count();
        $progressMap = $this->lessonProgressMap($user);
        $completedLessons = $totalLessons === 0 ? 0 : $lessonIds->filter(
            fn ($id) => $this->progressRowIsComplete($progressMap[(int) $id] ?? null)
        )->count();

        if ($totalLessons === 0) {
            return $this->courseProgressMemo[$memoKey] = 0;
        }

        $progress = ($completedLessons / $totalLessons) * 100;
        
        // Check if course is complete (100% progress + all required tests passed)
        $isComplete = false;
        if ($progress >= 100) {
            $isComplete = $this->isCourseComplete($user, $course);
        }

        $intPct = (int) round($progress, 0);
        $row = DB::table('course_user')
            ->where('user_id', $user->id)
            ->where('course_id', $course->id)
            ->first(['progress_percentage', 'completed_at']);

        $needsUpdate = $row && (
            (int) ($row->progress_percentage ?? 0) !== $intPct
            || ($isComplete && empty($row->completed_at))
        );

        if ($needsUpdate) {
            $updateData = [
                'progress_percentage' => $intPct,
                'updated_at' => Carbon::now(),
            ];
            if ($isComplete && empty($row->completed_at)) {
                $updateData['completed_at'] = Carbon::now();
            }
            DB::table('course_user')
                ->where('user_id', $user->id)
                ->where('course_id', $course->id)
                ->update($updateData);
        }

        return $this->courseProgressMemo[$memoKey] = round($progress, 2);
    }

    /**
     * Calculate module progress for a user
     */
    public function calculateModuleProgress(User $user, Module $module): float
    {
        if ($user->isLearningActivityExempt()) {
            return 0;
        }

        $lessonIds = $module->relationLoaded('lessons')
            ? $module->lessons->where('status', 'published')->pluck('id')
            : $module->lessons()->where('status', 'published')->pluck('id');
        if ($lessonIds->isEmpty()) {
            return 0;
        }

        $progressMap = $this->lessonProgressMap($user);
        $completed = $lessonIds->filter(
            fn ($id) => $this->progressRowIsComplete($progressMap[(int) $id] ?? null)
        )->count();
        $progress = ($completed / $lessonIds->count()) * 100;

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
    public function isLessonUnlocked(User $user, Lesson $lesson, ?Module $module, Course $course): bool
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
        // Examene fР вЂќРЎвЂњrР вЂќРЎвЂњ curs (catalog pe pagina Mape): published + vizibilitate elev
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
        if ($user->isLearningActivityExempt()) {
            return true;
        }

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

        $this->forgetUserProgressCache($user, $lesson->course_id ?? $lesson->module?->course_id);

        ActivityLog::create([
            'user_id' => $user->id,
            'action' => 'completed_lesson',
            'model_type' => 'Lesson',
            'model_id' => $lesson->id,
            'description' => "{$user->name} a finalizat lecția \"{$lesson->title}\"",
            'new_values' => [
                'lesson_id' => $lesson->id,
                'lesson_title' => $lesson->title,
                'module_id' => $lesson->module_id,
                'course_id' => $lesson->course_id ?? $lesson->module?->course_id,
                'completed_at' => Carbon::now()->toDateTimeString(),
            ],
            'ip_address' => request()?->ip(),
            'user_agent' => request()?->userAgent(),
        ]);

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
                        $course = $lesson->module->course;
                        $existingCourseProgress = DB::table('course_user')
                            ->where('user_id', $user->id)
                            ->where('course_id', $course->id)
                            ->first();
                        $wasCompleted = $existingCourseProgress && !empty($existingCourseProgress->completed_at);

                        // Mark course as completed
                        DB::table('course_user')
                            ->where('user_id', $user->id)
                            ->where('course_id', $course->id)
                            ->update([
                                'completed_at' => Carbon::now(),
                                'updated_at' => Carbon::now(),
                            ]);

                        if (! $wasCompleted && StudentActivityLogger::logCompletedCourseIfFirst($user, $course)) {
                            app(\App\Services\NotificationService::class)->notifyCourseCompleted($user, $course);
                        }
                    }
                }
            } else {
                // Module not complete yet, but still update course progress
                if ($lesson->module->course) {
                    $this->calculateCourseProgress($user, $lesson->module->course);
                }
            }
        } elseif ($lesson->course) {
            $this->calculateCourseProgress($user, $lesson->course);
        }

        return true;
    }

    /**
     * Check if a module is complete (all lessons + required exams passed)
     */
    public function isModuleComplete(User $user, Module $module): bool
    {
        if ($user->isLearningActivityExempt()) {
            return true;
        }

        $lessons = $module->lessons()->where('status', 'published')->get();
        
        if ($lessons->isEmpty()) {
            return false;
        }

        $passedIds = $this->passedTestIdSet($user, (int) $module->course_id);

        // Check if all lessons are completed
        foreach ($lessons as $lesson) {
            if (!$this->isLessonMarkedComplete($user, $lesson->id)) {
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

                $hasPassed = $this->hasPassedTestResult($user, (int) $test->id, (int) $courseTest->course_id, $passedIds);

                if (!$hasPassed) {
                    return false;
                }
            }
        }

        // Check if all module-level tests are passed (cursul nu se finalizeazР вЂќРЎвЂњ fР вЂќРЎвЂњrР вЂќРЎвЂњ test)
        $moduleTests = CourseTest::where('course_id', $module->course_id)
            ->where('scope', 'module')
            ->where('scope_id', $module->id)
            ->get();

        foreach ($moduleTests as $courseTest) {
            $test = $courseTest->test;
            if (!$test || $test->status !== 'published') {
                continue;
            }

            $hasPassed = $this->hasPassedTestResult($user, (int) $test->id, (int) $courseTest->course_id, $passedIds);

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
        if ($user->isLearningActivityExempt()) {
            return true;
        }

        $modules = $course->modules()->where('status', 'published')->get();
        $rootLessons = $this->getCourseRootLessons($course);
        $passedIds = $this->passedTestIdSet($user, (int) $course->id);

        if ($modules->isEmpty() && $rootLessons->isEmpty()) {
            return false;
        }

        foreach ($rootLessons as $lesson) {
            if (!$this->isLessonMarkedComplete($user, $lesson->id)) {
                return false;
            }

            $lessonTests = CourseTest::where('course_id', $course->id)
                ->where('scope', 'lesson')
                ->where('scope_id', $lesson->id)
                ->get();

            foreach ($lessonTests as $courseTest) {
                $test = $courseTest->test;
                if (!$test || $test->status !== 'published') {
                    continue;
                }

                $hasPassed = $this->hasPassedTestResult($user, (int) $test->id, (int) $courseTest->course_id, $passedIds);

                if (!$hasPassed) {
                    return false;
                }
            }
        }

        // Check if all modules are complete
        foreach ($modules as $module) {
            if (!$this->isModuleComplete($user, $module)) {
                return false;
            }
        }

        // Every published attached test must be passed, regardless of scope or optional legacy flags.
        $attachedTests = CourseTest::where('course_id', $course->id)
            ->whereHas('test', fn ($q) => $q->where('status', 'published'))
            ->get();

        foreach ($attachedTests as $courseTest) {
            $test = $courseTest->test;
            if (!$test || $test->status !== 'published') {
                continue;
            }

            $hasPassed = $this->hasPassedTestResult($user, (int) $test->id, (int) $courseTest->course_id, $passedIds);

            if (!$hasPassed) {
                return false;
            }
        }

        // Check if all course-level tests are passed (cursul nu se finalizeazР вЂќРЎвЂњ fР вЂќРЎвЂњrР вЂќРЎвЂњ test)
        $courseLevelTests = CourseTest::where('course_id', $course->id)
            ->where('scope', 'course')
            ->get();

        foreach ($courseLevelTests as $courseTest) {
            $test = $courseTest->test;
            if (!$test || $test->status !== 'published') {
                continue;
            }

            $hasPassed = $this->hasPassedTestResult($user, (int) $test->id, (int) $courseTest->course_id, $passedIds);

            if (!$hasPassed) {
                return false;
            }
        }

        return true;
    }

    /**
     * Legacy fallback: a course can also be finalized by passing its legacy exam.
     */
    public function hasPassedLegacyCourseExam(User $user, Course $course): bool
    {
        $exam = Exam::where('course_id', $course->id)
            ->where('status', 'published')
            ->first();

        if (!$exam) {
            return false;
        }

        return DB::table('exam_results')
            ->where('user_id', $user->id)
            ->where('exam_id', $exam->id)
            ->where('passed', true)
            ->exists();
    }

    /**
     * Unified completion gate for a course.
     */
    public function canFinalizeCourse(User $user, Course $course): bool
    {
        if ($this->isCourseComplete($user, $course)) {
            return true;
        }

        return $this->hasPassedLegacyCourseExam($user, $course);
    }

    /**
     * Get next incomplete lesson for a user in a course
     */
    public function getNextIncompleteLesson(User $user, Course $course): ?Lesson
    {
        $rootLessons = $this->getCourseRootLessons($course);
        foreach ($rootLessons as $lesson) {
            if (!$this->isLessonUnlocked($user, $lesson, null, $course)) {
                continue;
            }

            if (!$this->isLessonMarkedComplete($user, $lesson->id)) {
                return $lesson;
            }
        }

        $modules = $course->relationLoaded('modules')
            ? $course->modules->where('status', 'published')->sortBy('order')->values()
            : $course->modules()
                ->where('status', 'published')
                ->orderBy('order')
                ->get();

        foreach ($modules as $module) {
            // Check if module is unlocked
            if (!$this->isModuleUnlocked($user, $module, $course)) {
                continue;
            }

            $lessons = $module->relationLoaded('lessons')
                ? $module->lessons->where('status', 'published')->sortBy('order')->values()
                : $module->lessons()
                    ->where('status', 'published')
                    ->orderBy('order')
                    ->get();

            foreach ($lessons as $lesson) {
                // Check if lesson is unlocked
                if (!$this->isLessonUnlocked($user, $lesson, $module, $course)) {
                    continue;
                }

                // Check if lesson is completed
                if (!$this->isLessonMarkedComplete($user, $lesson->id)) {
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
        $passedIds = $this->passedTestIdSet($user, (int) $course->id);
        $rootLessons = $this->getCourseRootLessons($course);
        foreach ($rootLessons as $lesson) {
            if (!$this->isLessonUnlocked($user, $lesson, null, $course)) {
                continue;
            }

            if (!$this->isLessonMarkedComplete($user, $lesson->id)) {
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

                $hasPassed = $this->hasPassedTestResult($user, (int) $test->id, (int) $courseTest->course_id, $passedIds);

                if (!$hasPassed && $this->isTestUnlocked($user, $test, $course)) {
                    return $test;
                }
            }
        }

        $modules = $course->modules()
            ->where('status', 'published')
            ->orderBy('order')
            ->get();

        foreach ($modules as $module) {
            if (!$this->isModuleUnlocked($user, $module, $course)) {
                continue;
            }

            $lessons = $module->lessons()
                ->where('status', 'published')
                ->orderBy('order')
                ->get();

            foreach ($lessons as $lesson) {
                if (!$this->isLessonUnlocked($user, $lesson, $module, $course)) {
                    continue;
                }

                $lessonCompleted = $this->isLessonMarkedComplete($user, $lesson->id);

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

                    $hasPassed = $this->hasPassedTestResult($user, (int) $test->id, (int) $courseTest->course_id, $passedIds);

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

                $hasPassed = $this->hasPassedTestResult($user, (int) $test->id, (int) $courseTest->course_id, $passedIds);

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

            $hasPassed = $this->hasPassedTestResult($user, (int) $test->id, (int) $courseTest->course_id, $passedIds);

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
        if ($user->isLearningActivityExempt()) {
            return true;
        }

        // Aliniat cu isCourseComplete: orice test publicat legat de curs trebuie promovat
        foreach (CourseTest::where('course_id', $course->id)->with('test')->get() as $courseTest) {
            $test = $courseTest->test;
            if (!$test || $test->status !== 'published') {
                continue;
            }

            $hasPassed = $this->hasPassedTestResult($user, (int) $test->id, (int) $courseTest->course_id, $passedIds);

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
        $memoKey = $user->id . ':' . $course->id;
        if (isset($this->accessStatusMemo[$memoKey])) {
            return $this->accessStatusMemo[$memoKey];
        }

        $modules = $course->relationLoaded('modules')
            ? $course->modules->where('status', 'published')->sortBy('order')->values()
            : $course->modules()->where('status', 'published')->orderBy('order')->get();
        $rootLessons = $this->getCourseRootLessons($course);
        $progressMap = $this->lessonProgressMap($user);
        $accessStatus = [
            'course_progress' => $this->calculateCourseProgress($user, $course),
            'modules' => [],
            'root_lessons' => [],
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

        $passedIds = $this->passedTestIdSet($user, (int) $course->id);
        $progressForCourseTest = function (CourseTest $courseTest) use ($user, $course, $passedIds): ?array {
            $test = $courseTest->test;
            if (!$test || $test->status !== 'published') {
                return null;
            }

            $hasPassed = $this->hasPassedTestResult($user, (int) $test->id, (int) $courseTest->course_id, $passedIds);

            return [
                'test_id' => $test->id,
                'passed' => $hasPassed,
                'unlocked' => $this->isTestUnlocked($user, $test, $course),
                'required' => true,
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

            $lessons = $module->relationLoaded('lessons')
                ? $module->lessons->where('status', 'published')->sortBy('order')->values()
                : $module->lessons()->where('status', 'published')->orderBy('order')->get();
            foreach ($lessons as $lesson) {
                $isLessonUnlocked = $this->isLessonUnlocked($user, $lesson, $module, $course);
                
                $lessonProgress = $progressMap[(int) $lesson->id] ?? null;
                $progressPercentage = $lessonProgress->progress_percentage ?? 0;
                $isCompleted = $this->progressRowIsComplete($lessonProgress);

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

        $accessStatus['root_lessons'] = $rootLessons->map(function ($lesson) use ($user, $course, $ctByKey, $progressForCourseTest, $progressMap) {
            $lessonProgress = $progressMap[(int) $lesson->id] ?? null;
            $progressPercentage = $lessonProgress->progress_percentage ?? 0;

            return [
                'id' => $lesson->id,
                'unlocked' => $this->isLessonUnlocked($user, $lesson, null, $course),
                'completed' => ($lessonProgress->completed ?? false) || ($progressPercentage >= 100),
                'progress_percentage' => $progressPercentage,
                'is_preview' => $lesson->is_preview,
                'tests' => $ctByKey->get('lesson:' . $lesson->id, collect())
                    ->map($progressForCourseTest)
                    ->filter()
                    ->values()
                    ->all(),
            ];
        })->values()->all();

        $accessStatus['course_level_tests'] = $ctByKey->get('course:null', collect())
            ->map($progressForCourseTest)
            ->filter()
            ->values()
            ->all();

        return $this->accessStatusMemo[$memoKey] = $accessStatus;
    }
}

