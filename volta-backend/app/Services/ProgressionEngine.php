<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\Test;
use App\Models\ProgressionRule;
use App\Models\User;
use App\Models\CourseTest;
use Illuminate\Support\Facades\DB;

/**
 * ProgressionEngine Service
 * 
 * Rule-based progression system for courses
 * Evaluates rules to determine if users can progress
 */
class ProgressionEngine
{
    /**
     * Check if a lesson is unlocked for a user
     */
    public function isLessonUnlocked(User $user, Lesson $lesson, Course $course): bool
    {
        // Preview lessons are always unlocked
        if ($lesson->is_preview) {
            return true;
        }

        // Get all active progression rules for this course
        $rules = $course->progressionRules()
            ->where('target_type', 'lesson')
            ->where('target_id', $lesson->id)
            ->get();

        // If no specific rules, check default sequential unlock
        if ($rules->isEmpty()) {
            return $this->checkSequentialUnlock($user, $lesson, $course);
        }

        // Evaluate each rule
        foreach ($rules as $rule) {
            if (!$this->evaluateRule($user, $rule, $course)) {
                if ($rule->action === 'lock' || $rule->action === 'require') {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Check if a module is unlocked for a user
     */
    public function isModuleUnlocked(User $user, Module $module, Course $course): bool
    {
        // If module is not locked, check rules
        if (!$module->is_locked) {
            return $this->checkModuleRules($user, $module, $course);
        }

        // Get all active progression rules for this module
        $rules = $course->progressionRules()
            ->where('target_type', 'module')
            ->where('target_id', $module->id)
            ->get();

        // If no specific rules, check default sequential unlock
        if ($rules->isEmpty()) {
            return $this->checkSequentialModuleUnlock($user, $module, $course);
        }

        // Evaluate each rule
        foreach ($rules as $rule) {
            if (!$this->evaluateRule($user, $rule, $course)) {
                if ($rule->action === 'lock' || $rule->action === 'require') {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Check if a test is unlocked for a user
     */
    public function isTestUnlocked(User $user, Test $test, Course $course): bool
    {
        // Get course-test relationship
        $courseTest = CourseTest::where('course_id', $course->id)
            ->where('test_id', $test->id)
            ->first();

        if (!$courseTest) {
            return false; // Test not linked to course
        }

        // Check unlock conditions from course_test
        if ($courseTest->unlock_after_previous) {
            // Must complete previous test in sequence
            $previousTest = CourseTest::where('course_id', $course->id)
                ->where('scope', $courseTest->scope)
                ->where('scope_id', $courseTest->scope_id)
                ->where('order', '<', $courseTest->order)
                ->orderBy('order', 'desc')
                ->first();

            if ($previousTest) {
                $hasPassed = $this->hasUserPassedTest($user, $previousTest->test_id, $courseTest->passing_score);
                if (!$hasPassed) {
                    return false;
                }
            }
        }

        if ($courseTest->unlock_after_test_id) {
            $hasPassed = $this->hasUserPassedTest($user, $courseTest->unlock_after_test_id, $courseTest->passing_score);
            if (!$hasPassed) {
                return false;
            }
        }

        // Check scope-based unlock
        if ($courseTest->scope === 'lesson') {
            $lesson = Lesson::find($courseTest->scope_id);
            if ($lesson) {
                return $this->isLessonUnlocked($user, $lesson, $course);
            }
        } elseif ($courseTest->scope === 'module') {
            $module = Module::find($courseTest->scope_id);
            if ($module) {
                return $this->isModuleUnlocked($user, $module, $course);
            }
        }

        return true;
    }

    /**
     * Evaluate a progression rule
     */
    public function evaluateRule(User $user, ProgressionRule $rule, Course $course): bool
    {
        return match ($rule->type) {
            'lesson_completion' => $this->checkLessonCompletion($user, $rule),
            'test_passing' => $this->checkTestPassing($user, $rule),
            'minimum_score' => $this->checkMinimumScore($user, $rule),
            'order_constraint' => $this->checkOrderConstraint($user, $rule, $course),
            'time_requirement' => $this->checkTimeRequirement($user, $rule),
            'prerequisite' => $this->checkPrerequisite($user, $rule, $course),
            default => true,
        };
    }

    /**
     * Check if lesson is completed
     */
    protected function checkLessonCompletion(User $user, ProgressionRule $rule): bool
    {
        if ($rule->condition_type !== 'lesson' || !$rule->condition_id) {
            return false;
        }

        return DB::table('lesson_progress')
            ->where('user_id', $user->id)
            ->where('lesson_id', $rule->condition_id)
            ->where('completed', true)
            ->exists();
    }

    /**
     * Check if test is passed
     */
    protected function checkTestPassing(User $user, ProgressionRule $rule): bool
    {
        if ($rule->condition_type !== 'test' || !$rule->condition_id) {
            return false;
        }

        $passingScore = $rule->condition_value ? (int) $rule->condition_value : 70;

        return $this->hasUserPassedTest($user, $rule->condition_id, $passingScore);
    }

    /**
     * Check minimum score requirement
     */
    protected function checkMinimumScore(User $user, ProgressionRule $rule): bool
    {
        if (!$rule->condition_value) {
            return false;
        }

        $minScore = (int) $rule->condition_value;

        if ($rule->condition_type === 'test' && $rule->condition_id) {
            $latestResult = DB::table('test_results')
                ->where('user_id', $user->id)
                ->where('test_id', $rule->condition_id)
                ->orderBy('created_at', 'desc')
                ->first();

            if (!$latestResult) {
                return false;
            }

            return $latestResult->percentage >= $minScore;
        }

        return false;
    }

    /**
     * Check order constraint (must complete in order)
     */
    protected function checkOrderConstraint(User $user, ProgressionRule $rule, Course $course): bool
    {
        if ($rule->condition_type === 'lesson' && $rule->condition_id) {
            // Check if previous lessons are completed
            $targetLesson = Lesson::find($rule->target_id);
            if (!$targetLesson) {
                return false;
            }

            $previousLessons = Lesson::where('module_id', $targetLesson->module_id)
                ->where('order', '<', $targetLesson->order)
                ->where('status', 'published')
                ->get();

            foreach ($previousLessons as $prevLesson) {
                $isCompleted = DB::table('lesson_progress')
                    ->where('user_id', $user->id)
                    ->where('lesson_id', $prevLesson->id)
                    ->where('completed', true)
                    ->exists();

                if (!$isCompleted) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Check time requirement
     */
    protected function checkTimeRequirement(User $user, ProgressionRule $rule): bool
    {
        // Implementation for time-based requirements
        // This could check if user has spent minimum time on lessons
        return true; // Placeholder
    }

    /**
     * Check prerequisite
     */
    protected function checkPrerequisite(User $user, ProgressionRule $rule, Course $course): bool
    {
        // Check if prerequisite course/module/lesson is completed
        if ($rule->condition_type === 'module' && $rule->condition_id) {
            $module = Module::find($rule->condition_id);
            if ($module) {
                // Check if all lessons in module are completed
                $lessons = $module->lessons()->where('status', 'published')->get();
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
                // Check required tests
                $requiredTests = CourseTest::where('course_id', $module->course_id)
                    ->where('scope', 'module')
                    ->where('scope_id', $module->id)
                    ->where('required', true)
                    ->get();
                foreach ($requiredTests as $courseTest) {
                    $test = $courseTest->test;
                    if ($test && $test->status === 'published') {
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
                return true;
            }
        }

        return true;
    }

    /**
     * Check sequential unlock for lessons
     */
    protected function checkSequentialUnlock(User $user, Lesson $lesson, Course $course): bool
    {
        if (!$course->sequential_unlock) {
            return true;
        }

        // Check if previous lesson in module is completed
        $previousLesson = Lesson::where('module_id', $lesson->module_id)
            ->where('order', '<', $lesson->order)
            ->where('status', 'published')
            ->orderBy('order', 'desc')
            ->first();

        if ($previousLesson) {
            return DB::table('lesson_progress')
                ->where('user_id', $user->id)
                ->where('lesson_id', $previousLesson->id)
                ->where('completed', true)
                ->exists();
        }

        return true;
    }

    /**
     * Check sequential unlock for modules
     */
    protected function checkSequentialModuleUnlock(User $user, Module $module, Course $course): bool
    {
        if (!$course->sequential_unlock) {
            return true;
        }

        // Check if previous module is completed
        $previousModule = Module::where('course_id', $course->id)
            ->where('order', '<', $module->order)
            ->where('status', 'published')
            ->orderBy('order', 'desc')
            ->first();

        if ($previousModule) {
            // Check if all lessons are completed
            $lessons = $previousModule->lessons()->where('status', 'published')->get();
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
            // Check required tests
            $requiredTests = CourseTest::where('course_id', $course->id)
                ->where('scope', 'module')
                ->where('scope_id', $previousModule->id)
                ->where('required', true)
                ->get();
            foreach ($requiredTests as $courseTest) {
                $test = $courseTest->test;
                if ($test && $test->status === 'published') {
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
            return true;
        }

        return true;
    }

    /**
     * Check module rules
     */
    protected function checkModuleRules(User $user, Module $module, Course $course): bool
    {
        $rules = $course->progressionRules()
            ->where('target_type', 'module')
            ->where('target_id', $module->id)
            ->get();

        if ($rules->isEmpty()) {
            return true;
        }

        foreach ($rules as $rule) {
            if (!$this->evaluateRule($user, $rule, $course)) {
                if ($rule->action === 'lock' || $rule->action === 'require') {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Check if user has passed a test
     */
    protected function hasUserPassedTest(User $user, int $testId, int $passingScore = 70): bool
    {
        return DB::table('test_results')
            ->where('user_id', $user->id)
            ->where('test_id', $testId)
            ->where('percentage', '>=', $passingScore)
            ->where('passed', true)
            ->exists();
    }
}

