<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Module;
use App\Models\Lesson;
use App\Models\User;
use App\Models\Test;
use App\Models\CourseTest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * CourseBuilderService
 * 
 * Handles course creation and management
 * Separated from test creation logic
 * Focus: Content & Structure
 */
class CourseBuilderService
{
    /**
     * Create a new course
     */
    public function createCourse(array $data, ?User $teacher = null): Course
    {
        $settings = $this->buildSettings($data);
        
        $course = Course::create([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'category' => $data['category'] ?? null,
            'level' => $data['level'] ?? null,
            'status' => $data['status'] ?? 'draft',
            'teacher_id' => $teacher?->id ?? $data['teacher_id'] ?? null,
            'reward_points' => $data['reward_points'] ?? 50,
            'settings' => $settings,
            'progression_rules' => $data['progression_rules'] ?? [],
            // Legacy fields (for backward compatibility)
            'short_description' => $data['short_description'] ?? null,
            'access_type' => $settings['access']['type'] ?? 'free',
            'price' => $settings['access']['price'] ?? 0,
            'currency' => $settings['access']['currency'] ?? 'RON',
            'has_certificate' => $settings['certificate']['enabled'] ?? false,
            'min_test_score' => $settings['certificate']['min_score'] ?? 70,
            'allow_retake' => $settings['certificate']['allow_retake'] ?? true,
            'max_retakes' => $settings['certificate']['max_retakes'] ?? 3,
            'drip_content' => $settings['drip']['enabled'] ?? false,
            'drip_schedule' => $settings['drip']['schedule'] ?? null,
        ]);

        // Handle image upload
        if (isset($data['image'])) {
            if (is_uploaded_file($data['image'])) {
                $course->image = $data['image']->store('courses', 'public');
                $course->save();
            } elseif (is_string($data['image'])) {
                // Already stored path
                $course->image = $data['image'];
                $course->save();
            }
        }

        return $course;
    }

    /**
     * Update a course
     */
    public function updateCourse(Course $course, array $data): Course
    {
        $settings = $this->buildSettings($data, $course->settings);
        
        $updateData = [
            'title' => $data['title'] ?? $course->title,
            'description' => $data['description'] ?? $course->description,
            'category' => $data['category'] ?? $course->category,
            'level' => $data['level'] ?? $course->level,
            'status' => $data['status'] ?? $course->status,
            'reward_points' => $data['reward_points'] ?? $course->reward_points,
            'settings' => $settings,
        ];

        // Update progression rules if provided
        if (isset($data['progression_rules'])) {
            $updateData['progression_rules'] = $data['progression_rules'];
        }

        // Handle image upload
        if (isset($data['image'])) {
            if (is_uploaded_file($data['image'])) {
                if ($course->image) {
                    Storage::disk('public')->delete($course->image);
                }
                $updateData['image'] = $data['image']->store('courses', 'public');
            } elseif (is_string($data['image'])) {
                // Already stored path
                $updateData['image'] = $data['image'];
            }
        }

        $course->update($updateData);

        return $course->fresh();
    }

    /**
     * Build settings array from data
     */
    protected function buildSettings(array $data, array $existingSettings = []): array
    {
        $settings = $existingSettings;

        // Access settings
        if (isset($data['access_type']) || isset($data['price']) || isset($data['currency'])) {
            $settings['access'] = [
                'type' => $data['access_type'] ?? $settings['access']['type'] ?? 'free',
                'price' => $data['price'] ?? $settings['access']['price'] ?? 0,
                'currency' => $data['currency'] ?? $settings['access']['currency'] ?? 'RON',
            ];
        }

        // Drip settings
        if (isset($data['drip_content']) || isset($data['drip_schedule'])) {
            $settings['drip'] = [
                'enabled' => $data['drip_content'] ?? $settings['drip']['enabled'] ?? false,
                'schedule' => $data['drip_schedule'] ?? $settings['drip']['schedule'] ?? null,
            ];
        }

        // Certificate settings
        if (isset($data['has_certificate']) || isset($data['min_test_score'])) {
            $settings['certificate'] = [
                'enabled' => $data['has_certificate'] ?? $settings['certificate']['enabled'] ?? false,
                'min_score' => $data['min_test_score'] ?? $settings['certificate']['min_score'] ?? 70,
                'allow_retake' => $data['allow_retake'] ?? $settings['certificate']['allow_retake'] ?? true,
                'max_retakes' => $data['max_retakes'] ?? $settings['certificate']['max_retakes'] ?? 3,
            ];
        }

        return $settings;
    }

    /**
     * Attach a test to a course
     * This is the ONLY way tests are linked to courses
     */
    public function attachTest(Course $course, Test $test, array $options = []): CourseTest
    {
        // Validate test is published
        if ($test->status !== 'published') {
            throw new \Exception('Cannot attach unpublished test to course');
        }

        $courseTest = CourseTest::updateOrCreate(
            [
                'course_id' => $course->id,
                'test_id' => $test->id,
                'scope' => $options['scope'] ?? 'course',
                'scope_id' => $options['scope_id'] ?? null,
            ],
            [
                'required' => $options['required'] ?? false,
                'passing_score' => $options['passing_score'] ?? 70,
                'order' => $options['order'] ?? 0,
                'unlock_after_previous' => $options['unlock_after_previous'] ?? false,
                'unlock_after_test_id' => $options['unlock_after_test_id'] ?? null,
            ]
        );

        return $courseTest;
    }

    /**
     * Detach a test from a course
     */
    public function detachTest(Course $course, Test $test, ?string $scope = null, ?int $scopeId = null): bool
    {
        $query = CourseTest::where('course_id', $course->id)
            ->where('test_id', $test->id);

        if ($scope) {
            $query->where('scope', $scope);
        }

        if ($scopeId) {
            $query->where('scope_id', $scopeId);
        }

        return $query->delete() > 0;
    }

    /**
     * Create a module for a course
     */
    public function createModule(Course $course, array $data): Module
    {
        // Get next order
        $maxOrder = Module::where('course_id', $course->id)->max('order') ?? -1;

        return Module::create([
            'course_id' => $course->id,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'content' => $data['content'] ?? null,
            'order' => $data['order'] ?? ($maxOrder + 1),
            'status' => $data['status'] ?? 'published',
        ]);
    }

    /**
     * Create a lesson for a module
     */
    public function createLesson(Module $module, array $data): Lesson
    {
        // Get next order
        $maxOrder = Lesson::where('module_id', $module->id)->max('order') ?? -1;

        return Lesson::create([
            'module_id' => $module->id,
            'course_id' => $module->course_id,
            'title' => $data['title'],
            'content' => $data['content'] ?? null,
            'video_url' => $data['video_url'] ?? null,
            'type' => $data['type'] ?? 'text',
            'duration_minutes' => $data['duration_minutes'] ?? null,
            'order' => $data['order'] ?? ($maxOrder + 1),
            'status' => $data['status'] ?? 'published',
            'is_preview' => $data['is_preview'] ?? false,
        ]);
    }

    /**
     * Update a module
     */
    public function updateModule(Module $module, array $data): Module
    {
        $module->update($data);
        return $module->fresh();
    }

    /**
     * Update a lesson
     */
    public function updateLesson(Lesson $lesson, array $data): Lesson
    {
        $lesson->update($data);
        return $lesson->fresh();
    }

    /**
     * Delete a module
     */
    public function deleteModule(Module $module): bool
    {
        // Delete all lessons in module first
        $module->lessons()->delete();
        
        // Delete module
        return $module->delete();
    }

    /**
     * Delete a lesson
     */
    public function deleteLesson(Lesson $lesson): bool
    {
        return $lesson->delete();
    }

    /**
     * Reorder modules
     */
    public function reorderModules(Course $course, array $moduleIds): void
    {
        DB::transaction(function () use ($course, $moduleIds) {
            foreach ($moduleIds as $index => $moduleId) {
                Module::where('id', $moduleId)
                    ->where('course_id', $course->id)
                    ->update(['order' => $index]);
            }
        });
    }

    /**
     * Reorder lessons in a module
     */
    public function reorderLessons(Module $module, array $lessonIds): void
    {
        DB::transaction(function () use ($module, $lessonIds) {
            foreach ($lessonIds as $index => $lessonId) {
                Lesson::where('id', $lessonId)
                    ->where('module_id', $module->id)
                    ->update(['order' => $index]);
            }
        });
    }

    /**
     * Delete a course (with cleanup)
     */
    public function deleteCourse(Course $course): bool
    {
        DB::transaction(function () use ($course) {
            // Delete image
            if ($course->image) {
                Storage::disk('public')->delete($course->image);
            }

            // Delete course-test links
            CourseTest::where('course_id', $course->id)->delete();

            // Delete progression rules
            $course->progressionRules()->delete();

            // Delete course
            $course->delete();
        });

        return true;
    }
}

