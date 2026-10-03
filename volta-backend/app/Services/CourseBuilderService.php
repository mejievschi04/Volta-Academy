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
use App\Services\UserAssignedCoursesService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use App\Support\SchemaCache;
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
        $course = Course::query()->findOrFail($courseId);

        // Coloanele folosite de builder. `content` pe module și payload-ul content_blocks
        // nu intră în arbore: editorul citește lessons.content, iar blocurile se încarcă separat.
        $moduleColumns = [
            'id',
            'course_id',
            'title',
            'description',
            'order',
            'status',
            'is_locked',
            'unlock_after_module_id',
            'unlock_after_lesson_id',
            'estimated_duration_minutes',
            'completion_percentage',
            'updated_at',
        ];
        $lessonColumns = [
            'id',
            'course_id',
            'module_id',
            'title',
            'content',
            'type',
            'status',
            'order',
            'is_preview',
            'is_locked',
            'video_url',
            'duration_minutes',
            'unlock_after_lesson_id',
            'updated_at',
        ];

        $rootLessons = Lesson::query()
            ->where('course_id', $courseId)
            ->whereNull('module_id')
            ->orderBy('order')
            ->get($lessonColumns);

        $modules = Module::query()
            ->where('course_id', $courseId)
            ->orderBy('order')
            ->get($moduleColumns);

        $lessonsByModule = Lesson::query()
            ->where('course_id', $courseId)
            ->whereNotNull('module_id')
            ->orderBy('order')
            ->get($lessonColumns)
            ->groupBy('module_id');

        $modules->each(function (Module $module) use ($lessonsByModule) {
            $module->setRelation('lessons', $lessonsByModule->get($module->id, collect())->values());
        });

        $lessons = $rootLessons->concat($modules->flatMap(fn ($module) => $module->lessons))->values();

        return [
            'course' => $course,
            'modules' => $modules->values(),
            'root_lessons' => $rootLessons->values(),
            'lessons' => $lessons,
            'content_blocks' => [],
            'meta' => [
                'module_ids' => $modules->pluck('id')->all(),
                'root_lesson_ids' => $rootLessons->pluck('id')->all(),
                'lesson_ids' => $lessons->pluck('id')->all(),
                'content_block_ids' => [],
            ],
        ];
    }

    /**
     * Apply atomic patch operations for autosave + DnD.
     */
    public function applyStructurePatch(int $courseId, array $ops, ?User $actor = null): array
    {
        $course = Course::findOrFail($courseId);
        $this->markPublishedCourseEditing($course->id);

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
                            $moduleIds = array_map('intval', array_values($moduleIds));
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
                        $rawToModuleId = $op['to_module_id'] ?? null;
                        $toModuleId = $rawToModuleId === null || $rawToModuleId === '' ? null : (int)$rawToModuleId;
                        $toIndex = (int)($op['to_index'] ?? 0);
                        if ($lessonId > 0) {
                            $lesson = Lesson::where('id', $lessonId)->where('course_id', $course->id)->firstOrFail();
                            $toModule = $toModuleId
                                ? Module::where('id', $toModuleId)->where('course_id', $course->id)->firstOrFail()
                                : null;
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
    protected function moveLessonToModule(Lesson $lesson, ?Module $toModule, int $toIndex): void
    {
        $fromModuleId = $lesson->module_id;
        $toCourseId = $toModule?->course_id ?? $lesson->course_id;
        $toModuleId = $toModule?->id;

        // Move lesson to the new module
        $lesson->update([
            'module_id' => $toModuleId,
            'course_id' => $toCourseId,
        ]);

        // Reindex destination module lessons with insertion
        $destQuery = Lesson::where('course_id', $toCourseId)->orderBy('order');
        if ($toModuleId) {
            $destQuery->where('module_id', $toModuleId);
        } else {
            $destQuery->whereNull('module_id');
        }
        $destIds = $destQuery->pluck('id')->all();
        $destIds = array_values(array_filter($destIds, fn ($id) => (int)$id !== (int)$lesson->id));
        array_splice($destIds, max(0, min($toIndex, count($destIds))), 0, [$lesson->id]);
        $this->reorderLessonIds($destIds);

        // Reindex source module if different
        if ($fromModuleId && (int)$fromModuleId !== (int)$toModuleId) {
            $source = Module::find($fromModuleId);
            if ($source) {
                $sourceIds = Lesson::where('module_id', $source->id)->orderBy('order')->pluck('id')->all();
                $this->reorderLessons($source, $sourceIds);
            }
        } elseif (!$fromModuleId && $toModuleId) {
            $this->reindexCourseRootLessons($toCourseId);
        }
    }

    /**
     * Deep clone a course structure (course + modules + lessons + content blocks).
     */
    public function cloneCourse(int $courseId, ?User $actor = null, bool $includeTeams = true): Course
    {
        $source = Course::with(['modules.lessons.contentBlocks', 'lessons.contentBlocks', 'teams'])->findOrFail($courseId);

        return DB::transaction(function () use ($source, $actor, $includeTeams) {
            $newCourse = $source->replicate();
            $newCourse->title = $source->title . ' (Copy)';
            $newCourse->status = 'draft';
            $newCourse->save();

            if ($includeTeams) {
                $newCourse->teams()->sync($source->teams->pluck('id')->all());
            }

            $moduleIdMap = [];
            $lessonIdMap = [];
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
                    $lessonIdMap[$lesson->id] = $newLesson->id;

                    foreach ($lesson->contentBlocks as $block) {
                        $newBlock = $block->replicate();
                        $newBlock->lesson_id = $newLesson->id;
                        $newBlock->save();
                    }
                }
            }

            foreach ($source->lessons->whereNull('module_id') as $lesson) {
                $newLesson = $lesson->replicate();
                $newLesson->course_id = $newCourse->id;
                $newLesson->module_id = null;
                $newLesson->save();
                $lessonIdMap[$lesson->id] = $newLesson->id;

                foreach ($lesson->contentBlocks as $block) {
                    $newBlock = $block->replicate();
                    $newBlock->lesson_id = $newLesson->id;
                    $newBlock->save();
                }
            }

            // Duplicate course_test rows onto cloned tests so edits do not mutate the source.
            $pivotRows = CourseTest::where('course_id', $source->id)->get();
            $testIdMap = [];
            foreach ($pivotRows->pluck('test_id')->unique()->filter() as $oldTestId) {
                $sourceTest = Test::with('questions')->find($oldTestId);
                if (! $sourceTest) {
                    continue;
                }
                $newTest = $sourceTest->replicate();
                $newTest->status = 'draft';
                $newTest->save();
                foreach ($sourceTest->questions as $question) {
                    $cloneQuestion = $question->replicate();
                    $cloneQuestion->test_id = $newTest->id;
                    $cloneQuestion->save();
                }
                $testIdMap[(int) $oldTestId] = $newTest->id;
            }
            foreach ($pivotRows as $row) {
                $newRow = $row->replicate();
                $newRow->course_id = $newCourse->id;
                $newRow->test_id = $testIdMap[(int) $row->test_id] ?? $row->test_id;
                if ($row->unlock_after_test_id) {
                    $newRow->unlock_after_test_id = $testIdMap[(int) $row->unlock_after_test_id] ?? null;
                }
                if ($row->scope === 'module' && $row->scope_id) {
                    $newRow->scope_id = $moduleIdMap[$row->scope_id] ?? null;
                }
                if ($row->scope === 'lesson' && $row->scope_id) {
                    $newRow->scope_id = $lessonIdMap[$row->scope_id] ?? null;
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

        $modules = Module::query()->where('course_id', $courseId)->orderBy('order')->get();
        $lessons = Lesson::query()->where('course_id', $courseId)->orderBy('order')->get();
        $blocks = $lessons->isEmpty()
            ? collect()
            : ContentBlock::query()
                ->whereIn('lesson_id', $lessons->pluck('id'))
                ->orderBy('order')
                ->get();

        $snapshot = [
            'course' => $course->fresh()->toArray(),
            'modules' => $modules->map(fn ($module) => $module->toArray())->all(),
            'lessons' => $lessons->map(fn ($lesson) => $lesson->toArray())->all(),
            'content_blocks' => $blocks->map(fn ($block) => $block->toArray())->all(),
            'course_tests' => CourseTest::where('course_id', $courseId)->get()->toArray(),
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
        $table = 'courses';

        $createData = [
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'teacher_id' => $teacher?->id ?? $data['teacher_id'] ?? null,
            'reward_points' => $data['reward_points'] ?? 50,
        ];

        // Only add columns that exist (for PostgreSQL compatibility)
        if (SchemaCache::hasColumn($table, 'category')) {
            $createData['category'] = $data['category'] ?? null;
        }
        if (SchemaCache::hasColumn($table, 'level')) {
            $createData['level'] = $data['level'] ?? null;
        }
        if (SchemaCache::hasColumn($table, 'status')) {
            $createData['status'] = 'draft';
        }
        if (SchemaCache::hasColumn($table, 'workflow_status')) {
            $createData['workflow_status'] = 'draft';
        }
        if (SchemaCache::hasColumn($table, 'settings')) {
            $createData['settings'] = $settings;
        }
        if (SchemaCache::hasColumn($table, 'short_description')) {
            $createData['short_description'] = $data['short_description'] ?? null;
        }
        if (SchemaCache::hasColumn($table, 'access_type')) {
            $createData['access_type'] = $data['access_type'] ?? 'free';
        }
        if (SchemaCache::hasColumn($table, 'enrollment_type')) {
            $createData['enrollment_type'] = $data['enrollment_type'] ?? 'open';
        }
        if (SchemaCache::hasColumn($table, 'price')) {
            $createData['price'] = 0;
        }
        if (SchemaCache::hasColumn($table, 'currency')) {
            $createData['currency'] = $data['currency'] ?? 'RON';
        }
        if (SchemaCache::hasColumn($table, 'has_certificate')) {
            $createData['has_certificate'] = $settings['certificate']['enabled'] ?? false;
        }
        if (SchemaCache::hasColumn($table, 'min_test_score')) {
            $createData['min_test_score'] = $settings['certificate']['min_score'] ?? 70;
        } elseif (SchemaCache::hasColumn($table, 'min_exam_score')) {
            $createData['min_exam_score'] = $settings['certificate']['min_score'] ?? 70;
        }
        if (SchemaCache::hasColumn($table, 'allow_retake')) {
            $createData['allow_retake'] = $settings['certificate']['allow_retake'] ?? true;
        }
        if (SchemaCache::hasColumn($table, 'max_retakes')) {
            $createData['max_retakes'] = $settings['certificate']['max_retakes'] ?? 3;
        }
        if (SchemaCache::hasColumn($table, 'drip_content')) {
            $createData['drip_content'] = $settings['drip']['enabled'] ?? false;
        }
        if (SchemaCache::hasColumn($table, 'drip_schedule')) {
            $createData['drip_schedule'] = $settings['drip']['schedule'] ?? null;
        }
        if (SchemaCache::hasColumn($table, 'estimated_duration_hours')) {
            $createData['estimated_duration_hours'] = $data['estimated_duration_hours'] ?? null;
        }
        if (SchemaCache::hasColumn($table, 'visibility')) {
            $createData['visibility'] = $data['visibility'] ?? 'public';
        }
        if (SchemaCache::hasColumn($table, 'sequential_unlock')) {
            $createData['sequential_unlock'] = $data['sequential_unlock'] ?? true;
        }
        if (SchemaCache::hasColumn($table, 'marketing_tags')) {
            $createData['marketing_tags'] = is_array($data['marketing_tags'] ?? null) ? $data['marketing_tags'] : [];
        }
        if (SchemaCache::hasColumn($table, 'card_color') && array_key_exists('card_color', $data)) {
            $createData['card_color'] = $data['card_color'];
        }

        $course = Course::create($createData);

        // Handle image upload
        if (isset($data['image'])) {
            if ($data['image'] instanceof UploadedFile) {
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
     * Când cursul devine publicat: testele atașate cursului (course_test) rămase în draft
     * trec în published ca să apară în structura cursului pentru elevi.
     *
     * Examenele legacy (model Exam) sunt gestionate separat — nu le publicăm aici;
     * au propriul flux în admin (Publică / Draft / Arhivă), independent de curs.
     */
    public function publishDraftLinkedAssessmentsForCourse(int $courseId): void
    {
        $links = CourseTest::query()
            ->where('course_id', $courseId)
            ->get(['test_id', 'required']);

        $linkedTestIds = $links->pluck('test_id')->unique()->filter()->values()->all();
        if ($linkedTestIds === []) {
            return;
        }

        $requiredIds = $links->where('required', true)->pluck('test_id')->map(fn ($id) => (int) $id)->all();
        $publisher = app(TestBuilderService::class);
        $tests = Test::query()
            ->whereIn('id', $linkedTestIds)
            ->where('status', '!=', 'published')
            ->with(['questions', 'questionBank'])
            ->get();

        foreach ($tests as $test) {
            try {
                $publisher->publishTest($test);
            } catch (\Throwable $e) {
                if (in_array((int) $test->id, $requiredIds, true)) {
                    throw $e;
                }
            }
        }
    }

    /**
     * Single publish pipeline: validate, go live, snapshot.
     *
     * @return array{ok: bool, course?: Course, errors?: mixed}
     */
    public function publishLive(Course $course, ?User $actor = null, array $teamIds = [], bool $catalogOutsideMap = false): array
    {
        $course->load(['modules.lessons.contentBlocks']);
        $report = app(CourseBuilderValidator::class)->validate($course);
        if (! ($report['ok'] ?? false)) {
            return $report;
        }

        DB::transaction(function () use ($course, $actor, $teamIds, $catalogOutsideMap) {
            $course->update(['status' => 'published', 'workflow_status' => 'published']);
            \App\Support\CourseCatalog::applyOutsideMapFlag($course, $catalogOutsideMap);
            Module::where('course_id', $course->id)->where('status', '!=', 'published')->update(['status' => 'published']);
            Lesson::where('course_id', $course->id)->where('status', '!=', 'published')->update(['status' => 'published']);
            if (SchemaCache::hasTable('course_team') && $teamIds !== []) {
                app(UserAssignedCoursesService::class)->syncCourseTeams($course, $teamIds);
            }
            $this->publishDraftLinkedAssessmentsForCourse((int) $course->id);
            $this->createCourseVersionSnapshot($course->id, $actor, 'published');
        });

        return ['ok' => true, 'course' => $course->fresh()];
    }

    /**
     * Update a course
     */
    public function updateCourse(Course $course, array $data): Course
    {
        $updateData = [
            'title' => $data['title'] ?? $course->title,
            'description' => $data['description'] ?? $course->description,
            'short_description' => $data['short_description'] ?? $course->short_description,
            'category' => $data['category'] ?? $course->category,
            'card_color' => $data['card_color'] ?? $course->card_color,
            'level' => $data['level'] ?? $course->level,
            'status' => $data['status'] ?? $course->status,
            'reward_points' => $data['reward_points'] ?? $course->reward_points,
        ];
        if (array_key_exists('marketing_tags', $data)) {
            $updateData['marketing_tags'] = is_array($data['marketing_tags'])
                ? $data['marketing_tags']
                : (array) ($data['marketing_tags'] ?? []);
        }
        if (SchemaCache::hasColumn('courses', 'settings')) {
            $settings = $this->buildSettings($data, $course->settings);
            $updateData['settings'] = $settings;
        }
        if (array_key_exists('access_type', $data)) {
            $updateData['access_type'] = $data['access_type'];
        }
        if (array_key_exists('enrollment_type', $data)) {
            $updateData['enrollment_type'] = $data['enrollment_type'];
        }

        // Handle image upload
        if (isset($data['image'])) {
            if ($data['image'] instanceof UploadedFile) {
                if ($course->image) {
                    Storage::disk('public')->delete($course->image);
                }
                $updateData['image'] = $data['image']->store('courses', 'public');
            } elseif (is_string($data['image'])) {
                // Already stored path
                $updateData['image'] = $data['image'];
            }
        }

        $this->markPublishedCourseEditing($course->id);
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
        $this->markPublishedCourseEditing($course->id);
        $courseTest = CourseTest::updateOrCreate(
            [
                'course_id' => $course->id,
                'test_id' => $test->id,
                'scope' => $options['scope'] ?? 'course',
                'scope_id' => $options['scope_id'] ?? null,
            ],
            [
                'required' => array_key_exists('required', $options) ? (bool) $options['required'] : true,
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
        $this->markPublishedCourseEditing($course->id);
        $maxOrder = Module::where('course_id', $course->id)->max('order') ?? -1;

        return Module::create([
            'course_id' => $course->id,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'content' => $data['content'] ?? null,
            'order' => $data['order'] ?? ($maxOrder + 1),
            'status' => $this->defaultNewContentStatus($course, $data['status'] ?? null),
        ]);
    }

    /**
     * Create a lesson for a module
     */
    public function createLesson(Module $module, array $data): Lesson
    {
        $course = $module->course ?? Course::find($module->course_id);
        $this->markPublishedCourseEditing($course?->id);
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
            'status' => $this->defaultNewContentStatus($course, $data['status'] ?? null),
            'is_preview' => $data['is_preview'] ?? false,
        ]);
    }

    /**
     * Create a lesson directly under a course, without a module.
     */
    public function createCourseLesson(Course $course, array $data): Lesson
    {
        $this->markPublishedCourseEditing($course->id);
        $maxOrder = Lesson::where('course_id', $course->id)
            ->whereNull('module_id')
            ->max('order') ?? -1;

        return Lesson::create([
            'module_id' => null,
            'course_id' => $course->id,
            'title' => $data['title'],
            'content' => $data['content'] ?? null,
            'video_url' => $data['video_url'] ?? null,
            'type' => $data['type'] ?? 'text',
            'duration_minutes' => $data['duration_minutes'] ?? null,
            'order' => $data['order'] ?? ($maxOrder + 1),
            'status' => $this->defaultNewContentStatus($course, $data['status'] ?? null),
            'is_preview' => $data['is_preview'] ?? false,
        ]);
    }

    /**
     * Update a module
     */
    public function updateModule(Module $module, array $data): Module
    {
        $this->markPublishedCourseEditing($module->course_id);
        $module->update($data);
        return $module->fresh();
    }

    /**
     * Update a lesson
     */
    public function updateLesson(Lesson $lesson, array $data): Lesson
    {
        $this->markPublishedCourseEditing($lesson->course_id);
        $lesson->update($data);

        return $lesson->fresh();
    }

    /**
     * Delete a module
     */
    public function deleteModule(Module $module): bool
    {
        $this->markPublishedCourseEditing($module->course_id);
        return DB::transaction(function () use ($module) {
            $lessons = $module->lessons()->get();

            foreach ($lessons as $lesson) {
                $this->deleteLesson($lesson);
            }

            CourseTest::where('course_id', $module->course_id)
                ->where('scope', 'module')
                ->where('scope_id', $module->id)
                ->delete();

            $deleted = $module->delete();

            $remainingIds = Module::where('course_id', $module->course_id)
                ->orderBy('order')
                ->pluck('id')
                ->all();

            if (!empty($remainingIds)) {
                $this->reorderModules($module->course, $remainingIds);
            }

            return $deleted;
        });
    }

    /**
     * Delete a lesson
     */
    public function deleteLesson(Lesson $lesson): bool
    {
        $this->markPublishedCourseEditing($lesson->course_id);
        return DB::transaction(function () use ($lesson) {
            CourseTest::where('course_id', $lesson->course_id)
                ->where('scope', 'lesson')
                ->where('scope_id', $lesson->id)
                ->delete();

            Lesson::where('course_id', $lesson->course_id)
                ->where('unlock_after_lesson_id', $lesson->id)
                ->update(['unlock_after_lesson_id' => null]);

            $moduleId = $lesson->module_id;
            $courseId = $lesson->course_id;
            $deleted = $lesson->delete();

            if ($moduleId) {
                $module = Module::find($moduleId);
                if ($module) {
                    $remainingIds = Lesson::where('module_id', $moduleId)
                        ->orderBy('order')
                        ->pluck('id')
                        ->all();

                    if (!empty($remainingIds)) {
                        $this->reorderLessons($module, $remainingIds);
                    }
                }
            } else {
                $this->reindexCourseRootLessons($courseId);
            }

            return $deleted;
        });
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
     * Reorder a trusted lesson id list after a move.
     */
    protected function reorderLessonIds(array $lessonIds): void
    {
        DB::transaction(function () use ($lessonIds) {
            foreach ($lessonIds as $index => $lessonId) {
                Lesson::where('id', $lessonId)->update(['order' => $index]);
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

            // Delete course
            $course->delete();
        });

        return true;
    }

    protected function reindexCourseRootLessons(int $courseId): void
    {
        $ids = Lesson::where('course_id', $courseId)
            ->whereNull('module_id')
            ->orderBy('order')
            ->pluck('id')
            ->all();

        foreach ($ids as $index => $lessonId) {
            Lesson::where('id', $lessonId)->update(['order' => $index]);
        }
    }

    protected function markPublishedCourseEditing(?int $courseId): void
    {
        if (! $courseId) {
            return;
        }

        $course = Course::query()->find($courseId);
        if (! $course || ($course->status ?? '') !== 'published') {
            return;
        }
        if (($course->workflow_status ?? '') === 'editing') {
            return;
        }

        $course->forceFill(['workflow_status' => 'editing'])->save();
    }

    protected function defaultNewContentStatus(?Course $course, ?string $requested): string
    {
        if ($course && ($course->status ?? '') === 'published') {
            return 'draft';
        }

        return $requested ?: 'published';
    }
}
