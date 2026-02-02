<?php

namespace App\Services;

use App\Models\Course;
use App\Models\ContentBlock;
use App\Models\Module;
use App\Models\Lesson;
use App\Models\User;
use App\Models\Test;
use App\Models\CourseTest;
use App\Models\ActivityLog;
use App\Models\CourseVersion;
use App\Models\CourseVersionSnapshot;
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
     * Returns a normalized course builder structure for a given course.
     */
    public function getBuilderStructure(int $courseId): array
    {
        $course = Course::with([
            'teacher:id,name,email',
            'teams:id,name',
            'modules' => function ($q) {
                $q->orderBy('order')->with([
                    'lessons' => function ($lq) {
                        $lq->orderBy('order')->with(['contentBlocks' => function ($cbq) {
                            $cbq->orderBy('order');
                        }]);
                    },
                ]);
            },
        ])->findOrFail($courseId);

        $modules = $course->modules->values();

        $lessons = $modules->flatMap(fn ($m) => $m->lessons)->values();
        $blocks = $lessons->flatMap(fn ($l) => $l->contentBlocks)->values();

        return [
            'course' => $course,
            'modules' => $modules,
            'lessons' => $lessons,
            'content_blocks' => $blocks,
            'meta' => [
                'module_ids' => $modules->pluck('id')->all(),
                'lesson_ids' => $lessons->pluck('id')->all(),
                'content_block_ids' => $blocks->pluck('id')->all(),
            ],
        ];
    }

    /**
     * Apply atomic patch operations for autosave + DnD.
     */
    public function applyStructurePatch(int $courseId, array $ops, ?User $actor = null): array
    {
        $course = Course::findOrFail($courseId);

        DB::transaction(function () use ($course, $ops, $actor) {
            foreach ($ops as $op) {
                $type = $op['op'] ?? null;
                if (!$type) {
                    continue;
                }

                switch ($type) {
                    case 'reorderModules':
                        $moduleIds = $op['module_ids'] ?? [];
                        if (is_array($moduleIds) && count($moduleIds) > 0) {
                            $this->reorderModules($course, $moduleIds);
                            $this->logActivity($actor, 'builder.reorder_modules', Course::class, $course->id, [
                                'module_ids' => $moduleIds,
                            ]);
                        }
                        break;

                    case 'reorderLessons':
                        $moduleId = (int)($op['module_id'] ?? 0);
                        $lessonIds = $op['lesson_ids'] ?? [];
                        if ($moduleId > 0 && is_array($lessonIds) && count($lessonIds) > 0) {
                            $module = Module::where('id', $moduleId)->where('course_id', $course->id)->firstOrFail();
                            $this->reorderLessons($module, $lessonIds);
                            $this->logActivity($actor, 'builder.reorder_lessons', Module::class, $moduleId, [
                                'lesson_ids' => $lessonIds,
                            ]);
                        }
                        break;

                    case 'moveLesson':
                        $lessonId = (int)($op['lesson_id'] ?? 0);
                        $toModuleId = (int)($op['to_module_id'] ?? 0);
                        $toIndex = (int)($op['to_index'] ?? 0);
                        if ($lessonId > 0 && $toModuleId > 0) {
                            $lesson = Lesson::where('id', $lessonId)->where('course_id', $course->id)->firstOrFail();
                            $toModule = Module::where('id', $toModuleId)->where('course_id', $course->id)->firstOrFail();
                            $this->moveLessonToModule($lesson, $toModule, $toIndex);
                            $this->logActivity($actor, 'builder.move_lesson', Lesson::class, $lessonId, [
                                'to_module_id' => $toModuleId,
                                'to_index' => $toIndex,
                            ]);
                        }
                        break;

                    case 'toggleModuleStatus':
                        $moduleId = (int)($op['module_id'] ?? 0);
                        $status = $op['status'] ?? null;
                        if ($moduleId > 0 && is_string($status)) {
                            Module::where('id', $moduleId)->where('course_id', $course->id)->update(['status' => $status]);
                            $this->logActivity($actor, 'builder.update_module_status', Module::class, $moduleId, [
                                'status' => $status,
                            ]);
                        }
                        break;

                    case 'toggleLessonStatus':
                        $lessonId = (int)($op['lesson_id'] ?? 0);
                        $status = $op['status'] ?? null;
                        if ($lessonId > 0 && is_string($status)) {
                            Lesson::where('id', $lessonId)->where('course_id', $course->id)->update(['status' => $status]);
                            $this->logActivity($actor, 'builder.update_lesson_status', Lesson::class, $lessonId, [
                                'status' => $status,
                            ]);
                        }
                        break;

                    case 'toggleLessonPreview':
                        $lessonId = (int)($op['lesson_id'] ?? 0);
                        $isPreview = (bool)($op['is_preview'] ?? false);
                        if ($lessonId > 0) {
                            Lesson::where('id', $lessonId)->where('course_id', $course->id)->update(['is_preview' => $isPreview]);
                            $this->logActivity($actor, 'builder.update_lesson_preview', Lesson::class, $lessonId, [
                                'is_preview' => $isPreview,
                            ]);
                        }
                        break;

                    case 'setLessonPrerequisite':
                        $lessonId = (int)($op['lesson_id'] ?? 0);
                        $unlockAfterLessonId = $op['unlock_after_lesson_id'] ?? null;
                        $unlockAfterLessonId = $unlockAfterLessonId === null || $unlockAfterLessonId === '' ? null : (int)$unlockAfterLessonId;
                        if ($lessonId > 0) {
                            // Ensure prerequisite lesson belongs to same course (or null)
                            if ($unlockAfterLessonId !== null) {
                                Lesson::where('id', $unlockAfterLessonId)->where('course_id', $course->id)->firstOrFail();
                            }
                            Lesson::where('id', $lessonId)->where('course_id', $course->id)->update([
                                'unlock_after_lesson_id' => $unlockAfterLessonId,
                            ]);
                            $this->logActivity($actor, 'builder.set_lesson_prerequisite', Lesson::class, $lessonId, [
                                'unlock_after_lesson_id' => $unlockAfterLessonId,
                            ]);
                        }
                        break;

                    default:
                        // ignore unknown ops for forward compatibility
                        break;
                }
            }
        });

        return $this->getBuilderStructure($courseId);
    }

    /**
     * Move a lesson to another module and reindex orders.
     */
    protected function moveLessonToModule(Lesson $lesson, Module $toModule, int $toIndex): void
    {
        $fromModuleId = $lesson->module_id;

        // Move lesson to the new module
        $lesson->update([
            'module_id' => $toModule->id,
            'course_id' => $toModule->course_id,
        ]);

        // Reindex destination module lessons with insertion
        $destIds = Lesson::where('module_id', $toModule->id)->orderBy('order')->pluck('id')->all();
        $destIds = array_values(array_filter($destIds, fn ($id) => (int)$id !== (int)$lesson->id));
        array_splice($destIds, max(0, min($toIndex, count($destIds))), 0, [$lesson->id]);
        $this->reorderLessons($toModule, $destIds);

        // Reindex source module if different
        if ($fromModuleId && (int)$fromModuleId !== (int)$toModule->id) {
            $source = Module::find($fromModuleId);
            if ($source) {
                $sourceIds = Lesson::where('module_id', $source->id)->orderBy('order')->pluck('id')->all();
                $this->reorderLessons($source, $sourceIds);
            }
        }
    }

    /**
     * Create content block at the end of the lesson block list.
     */
    public function createContentBlock(Lesson $lesson, array $data): ContentBlock
    {
        $maxOrder = ContentBlock::where('lesson_id', $lesson->id)->max('order') ?? -1;

        return ContentBlock::create([
            'lesson_id' => $lesson->id,
            'type' => $data['type'],
            // `source` is required in DB; allow empty string for "placeholder" blocks.
            'source' => $data['source'] ?? '',
            'metadata' => $data['metadata'] ?? [],
            'language' => $data['language'] ?? null,
            'version' => (string)($data['version'] ?? '1'),
            'order' => $data['order'] ?? ($maxOrder + 1),
            'visible' => $data['visible'] ?? true,
        ]);
    }

    public function updateContentBlock(ContentBlock $block, array $data): ContentBlock
    {
        $block->update($data);
        return $block->fresh();
    }

    public function reorderContentBlocks(Lesson $lesson, array $contentBlockIds): void
    {
        DB::transaction(function () use ($lesson, $contentBlockIds) {
            foreach ($contentBlockIds as $index => $blockId) {
                ContentBlock::where('id', $blockId)
                    ->where('lesson_id', $lesson->id)
                    ->update(['order' => $index]);
            }
        });
    }

    /**
     * Deep clone a course structure (course + modules + lessons + content blocks).
     */
    public function cloneCourse(int $courseId, ?User $actor = null, bool $includeTeams = true): Course
    {
        $source = Course::with(['modules.lessons.contentBlocks', 'teams'])->findOrFail($courseId);

        return DB::transaction(function () use ($source, $actor, $includeTeams) {
            $newCourse = $source->replicate();
            $newCourse->title = $source->title . ' (Copy)';
            $newCourse->status = 'draft';
            $newCourse->save();

            if ($includeTeams) {
                $newCourse->teams()->sync($source->teams->pluck('id')->all());
            }

            $moduleIdMap = [];
            foreach ($source->modules as $module) {
                $newModule = $module->replicate();
                $newModule->course_id = $newCourse->id;
                $newModule->save();
                $moduleIdMap[$module->id] = $newModule->id;

                foreach ($module->lessons as $lesson) {
                    $newLesson = $lesson->replicate();
                    $newLesson->course_id = $newCourse->id;
                    $newLesson->module_id = $newModule->id;
                    $newLesson->save();

                    foreach ($lesson->contentBlocks as $block) {
                        $newBlock = $block->replicate();
                        $newBlock->lesson_id = $newLesson->id;
                        $newBlock->save();
                    }
                }
            }

            // Duplicate course_test pivot rows and remap scope_id for modules/lessons
            $pivotRows = CourseTest::where('course_id', $source->id)->get();
            foreach ($pivotRows as $row) {
                $newRow = $row->replicate();
                $newRow->course_id = $newCourse->id;
                if ($row->scope === 'module' && $row->scope_id) {
                    $newRow->scope_id = $moduleIdMap[$row->scope_id] ?? null;
                }
                if ($row->scope === 'lesson' && $row->scope_id) {
                    // Find new lesson by (module mapping + order) fallback: keep null if not found
                    $oldLesson = Lesson::find($row->scope_id);
                    if ($oldLesson && isset($moduleIdMap[$oldLesson->module_id])) {
                        $newLesson = Lesson::where('course_id', $newCourse->id)
                            ->where('module_id', $moduleIdMap[$oldLesson->module_id])
                            ->where('order', $oldLesson->order)
                            ->first();
                        $newRow->scope_id = $newLesson?->id;
                    } else {
                        $newRow->scope_id = null;
                    }
                }
                $newRow->save();
            }

            $this->logActivity($actor, 'builder.clone_course', Course::class, $newCourse->id, [
                'source_course_id' => $source->id,
            ]);

            return $newCourse->fresh();
        });
    }

    protected function logActivity(?User $actor, string $action, string $modelType, int $modelId, array $newValues = [], array $oldValues = []): void
    {
        if (!$actor) {
            return;
        }

        ActivityLog::create([
            'user_id' => $actor->id,
            'action' => $action,
            'model_type' => $modelType,
            'model_id' => $modelId,
            'description' => $action,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => request()?->ip(),
            'user_agent' => request()?->userAgent(),
        ]);
    }

    /**
     * Create a version + snapshot of the current course structure.
     */
    public function createCourseVersionSnapshot(int $courseId, ?User $actor, string $status = 'draft'): CourseVersion
    {
        $course = Course::findOrFail($courseId);
        $nextVersion = ((int)CourseVersion::where('course_id', $courseId)->max('version')) + 1;

        $structure = $this->getBuilderStructure($courseId);

        // Ensure snapshot is fully serializable (arrays only)
        $snapshot = [
            'course' => $course->fresh()->toArray(),
            'modules' => collect($structure['modules'] ?? [])->map(fn ($m) => is_object($m) ? $m->toArray() : $m)->all(),
            'lessons' => collect($structure['lessons'] ?? [])->map(fn ($l) => is_object($l) ? $l->toArray() : $l)->all(),
            'content_blocks' => collect($structure['content_blocks'] ?? [])->map(fn ($b) => is_object($b) ? $b->toArray() : $b)->all(),
            'course_tests' => CourseTest::where('course_id', $courseId)->get()->toArray(),
            'progression_rules' => DB::table('progression_rules')->where('course_id', $courseId)->get()->toArray(),
            'captured_at' => now()->toISOString(),
        ];

        $version = CourseVersion::create([
            'course_id' => $courseId,
            'version' => $nextVersion,
            'status' => $status,
            'created_by' => $actor?->id,
        ]);

        CourseVersionSnapshot::create([
            'course_version_id' => $version->id,
            'snapshot_json' => $snapshot,
        ]);

        $this->logActivity($actor, 'builder.create_version', Course::class, $courseId, [
            'version' => $nextVersion,
            'status' => $status,
        ]);

        return $version;
    }

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
            'access_type' => 'free', // All courses are free
            'price' => 0,
            'currency' => 'RON',
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

