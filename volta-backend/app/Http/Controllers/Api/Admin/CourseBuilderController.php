<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\ContentBlock;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\CourseVersion;
use App\Models\Test;
use App\Models\CourseTest;
use App\Models\MediaAsset;
use App\Services\CourseBuilderService;
use App\Services\CourseBuilderValidator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class CourseBuilderController extends Controller
{
    public function __construct(
        protected CourseBuilderService $courseBuilderService,
        protected CourseBuilderValidator $courseBuilderValidator
    ) {}

    /**
     * Returns the normalized builder structure for a course.
     */
    public function structure(Request $request, int $courseId)
    {
        $structure = $this->courseBuilderService->getBuilderStructure($courseId);

        return response()->json($structure);
    }

    /**
     * Applies atomic patch operations for autosave / drag&drop.
     *
     * Body: { ops: [{ op: string, ... }] }
     */
    public function patchStructure(Request $request, int $courseId)
    {
        $request->validate([
            'ops' => 'required|array|min:1',
            'ops.*.op' => 'required|string|max:64',
        ]);

        // Folosim input-ul brut pentru ops – validated() poate elimina chei nestandardizate (module_ids, etc.)
        $ops = $request->input('ops', []);

        $result = $this->courseBuilderService->applyStructurePatch(
            $courseId,
            $ops,
            $request->user()
        );

        return response()->json($result);
    }

    public function uploadContentFile(Request $request, int $courseId)
    {
        Course::findOrFail($courseId);

        $validated = $request->validate([
            'file' => 'required|file|max:10240', // 10MB
            'type' => 'nullable|in:image,video,audio,document,other',
        ]);

        $file = $request->file('file');
        $type = $validated['type'] ?? null;

        if (!$type) {
            $mime = (string)($file->getMimeType() ?? '');
            if (str_starts_with($mime, 'image/')) $type = 'image';
            else if (str_starts_with($mime, 'video/')) $type = 'video';
            else if (str_starts_with($mime, 'audio/')) $type = 'audio';
            else if ($mime === 'application/pdf' || str_contains($mime, 'document') || str_contains($mime, 'msword') || str_contains($mime, 'officedocument')) $type = 'document';
            else $type = 'other';
        }

        $path = $file->store("content-blocks/{$type}", 'public');
        // Returnează path relativ – frontend-ul adaugă origin-ul corect (proxy / producție)
        $url = '/storage/' . ltrim($path, '/');

        $asset = MediaAsset::create([
            'course_id' => $courseId,
            'uploaded_by_user_id' => $request->user()?->id,
            'disk' => 'public',
            'type' => $type,
            'path' => $path,
            'filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize() ?? 0,
        ]);

        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => 'builder.upload_content_file',
            'model_type' => Course::class,
            'model_id' => $courseId,
            'description' => 'Upload content file',
            'old_values' => null,
            'new_values' => [
                'media_asset_id' => $asset->id,
                'path' => $path,
                'url' => $url,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
                'type' => $type,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'url' => $url,
            'path' => $path,
            'media_asset_id' => $asset->id,
            'filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'type' => $type,
        ], 201);
    }

    public function createModule(Request $request, int $courseId)
    {
        $course = Course::findOrFail($courseId);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|in:draft,published,archived,disabled',
            'order' => 'nullable|integer|min:0',
        ]);

        $module = $this->courseBuilderService->createModule($course, $validated);

        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => 'builder.create_module',
            'model_type' => Module::class,
            'model_id' => $module->id,
            'description' => 'Create module',
            'old_values' => null,
            'new_values' => $module->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'module' => $module->fresh(),
        ], 201);
    }

    public function createLesson(Request $request, int $courseId)
    {
        $validated = $request->validate([
            'module_id' => 'required|exists:modules,id',
            'title' => 'required|string|max:255',
            'type' => 'nullable|string|max:50',
            'status' => 'nullable|in:draft,published,archived,disabled',
            'duration_minutes' => 'nullable|integer|min:0',
            'is_preview' => 'nullable|boolean',
            'order' => 'nullable|integer|min:0',
        ]);

        $module = Module::where('id', $validated['module_id'])
            ->where('course_id', $courseId)
            ->firstOrFail();

        // Ensure builder lessons can exist without legacy `content` field (content blocks are canonical)
        $lesson = $this->courseBuilderService->createLesson($module, array_merge([
            'content' => $request->input('content', ''), // keep backward compatibility
        ], $validated));

        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => 'builder.create_lesson',
            'model_type' => Lesson::class,
            'model_id' => $lesson->id,
            'description' => 'Create lesson',
            'old_values' => null,
            'new_values' => $lesson->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'lesson' => $lesson->fresh(),
        ], 201);
    }

    public function updateLesson(Request $request, int $courseId, int $lessonId)
    {
        $lesson = Lesson::where('id', $lessonId)
            ->where('course_id', $courseId)
            ->firstOrFail();

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'type' => 'nullable|string|max:50',
            'status' => 'nullable|in:draft,published,archived,disabled',
            'duration_minutes' => 'nullable|integer|min:0',
            'is_preview' => 'nullable|boolean',
            'is_locked' => 'nullable|boolean',
            'unlock_after_lesson_id' => 'nullable|exists:lessons,id',
            'content' => 'nullable|string',
            'video_url' => 'nullable|string',
            'resources' => 'nullable|array',
            'attachments' => 'nullable|array',
        ]);

        $old = $lesson->toArray();
        $lesson = $this->courseBuilderService->updateLesson($lesson, $validated);

        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => 'builder.update_lesson',
            'model_type' => Lesson::class,
            'model_id' => $lesson->id,
            'description' => 'Update lesson',
            'old_values' => $old,
            'new_values' => $lesson->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'lesson' => $lesson->fresh(),
        ]);
    }

    public function createContentBlock(Request $request, int $courseId, int $lessonId)
    {
        try {
            $lesson = Lesson::where('id', $lessonId)
                ->where('course_id', $courseId)
                ->firstOrFail();

            $validated = $request->validate([
                'type' => 'required|string|max:50',
                'source' => 'nullable|string',
                'metadata' => 'nullable|array',
                'language' => 'nullable|string|max:25',
                'visible' => 'nullable|boolean',
            ]);

            $block = $this->courseBuilderService->createContentBlock($lesson, $validated);

            ActivityLog::create([
                'user_id' => $request->user()?->id,
                'action' => 'builder.create_content_block',
                'model_type' => ContentBlock::class,
                'model_id' => $block->id,
                'description' => 'Create content block',
                'old_values' => null,
                'new_values' => $block->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            return response()->json([
                'content_block' => $block->fresh(),
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            throw $e;
        } catch (\Exception $e) {
            \Log::error('createContentBlock failed', [
                'course_id' => $courseId,
                'lesson_id' => $lessonId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => config('app.debug') ? $e->getMessage() : 'Eroare la crearea content block.',
            ], 500);
        }
    }

    public function updateContentBlock(Request $request, int $courseId, int $blockId)
    {
        $block = ContentBlock::query()
            ->where('id', $blockId)
            ->whereHas('lesson', function ($q) use ($courseId) {
                $q->where('course_id', $courseId);
            })
            ->firstOrFail();

        $validated = $request->validate([
            'type' => 'sometimes|required|string|max:50',
            'source' => 'nullable|string',
            'metadata' => 'nullable|array',
            'language' => 'nullable|string|max:25',
            'visible' => 'nullable|boolean',
            'order' => 'nullable|integer|min:0',
        ]);

        $old = $block->toArray();
        $block = $this->courseBuilderService->updateContentBlock($block, $validated);

        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => 'builder.update_content_block',
            'model_type' => ContentBlock::class,
            'model_id' => $block->id,
            'description' => 'Update content block',
            'old_values' => $old,
            'new_values' => $block->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'content_block' => $block->fresh(),
        ]);
    }

    public function deleteContentBlock(Request $request, int $courseId, int $blockId)
    {
        $block = ContentBlock::query()
            ->where('id', $blockId)
            ->whereHas('lesson', function ($q) use ($courseId) {
                $q->where('course_id', $courseId);
            })
            ->firstOrFail();

        $old = $block->toArray();
        $lessonId = $block->lesson_id;
        $this->courseBuilderService->deleteContentBlock($block);

        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => 'builder.delete_content_block',
            'model_type' => ContentBlock::class,
            'model_id' => $blockId,
            'description' => 'Delete content block',
            'old_values' => $old,
            'new_values' => ['deleted' => true, 'lesson_id' => $lessonId],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'message' => 'Content block deleted',
        ]);
    }

    public function reorderContentBlocks(Request $request, int $courseId, int $lessonId)
    {
        $lesson = Lesson::where('id', $lessonId)
            ->where('course_id', $courseId)
            ->firstOrFail();

        $validated = $request->validate([
            'content_block_ids' => 'required|array|min:1',
            'content_block_ids.*' => 'exists:content_blocks,id',
        ]);

        $this->courseBuilderService->reorderContentBlocks($lesson, $validated['content_block_ids']);

        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => 'builder.reorder_content_blocks',
            'model_type' => Lesson::class,
            'model_id' => $lesson->id,
            'description' => 'Reorder content blocks',
            'old_values' => null,
            'new_values' => ['content_block_ids' => $validated['content_block_ids']],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'content_blocks' => $lesson->contentBlocks()->orderBy('order')->get(),
        ]);
    }

    public function validateCourse(Request $request, int $courseId)
    {
        $course = Course::with(['modules.lessons.contentBlocks'])->findOrFail($courseId);
        $report = $this->courseBuilderValidator->validate($course);

        return response()->json($report);
    }

    public function submitForReview(Request $request, int $courseId)
    {
        $course = Course::with(['modules.lessons.contentBlocks'])->findOrFail($courseId);
        $report = $this->courseBuilderValidator->validate($course);

        if (!($report['ok'] ?? false)) {
            return response()->json($report, 422);
        }

        // Keep `status` as draft (so students don't see it), but mark workflow as review.
        $course->update(['workflow_status' => 'review']);

        $this->courseBuilderService->createCourseVersionSnapshot($course->id, $request->user(), 'review');

        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => 'builder.submit_for_review',
            'model_type' => Course::class,
            'model_id' => $course->id,
            'description' => 'Submit for review',
            'old_values' => null,
            'new_values' => ['workflow_status' => 'review'],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'ok' => true,
            'course' => $course->fresh(),
            'report' => $report,
        ]);
    }

    public function publish(Request $request, int $courseId)
    {
        $course = Course::with(['modules.lessons'])->findOrFail($courseId);
        $report = $this->courseBuilderValidator->validate($course->load(['modules.lessons.contentBlocks']));

        if (!($report['ok'] ?? false)) {
            return response()->json($report, 422);
        }

        $validated = $request->validate([
            'team_ids' => 'nullable|array',
            'team_ids.*' => 'exists:teams,id',
        ]);
        $teamIds = $validated['team_ids'] ?? [];

        DB::transaction(function () use ($course, $teamIds) {
            $course->update(['status' => 'published', 'workflow_status' => 'published']);
            Module::where('course_id', $course->id)->where('status', '!=', 'published')->update(['status' => 'published']);
            Lesson::where('course_id', $course->id)->where('status', '!=', 'published')->update(['status' => 'published']);
            if (count($teamIds) > 0 && \Illuminate\Support\Facades\Schema::hasTable('course_team')) {
                $course->teams()->sync($teamIds);
            }
        });

        $notifiedCount = 0;
        try {
            $this->courseBuilderService->createCourseVersionSnapshot($course->id, $request->user(), 'published');
        } catch (\Throwable $e) {
            \Log::warning('CourseBuilderController::publish - createCourseVersionSnapshot failed', [
                'course_id' => $courseId,
                'error' => $e->getMessage(),
            ]);
        }

        try {
            $notifiedCount = app(\App\Services\NotificationService::class)->notifyCoursePublished($course, $teamIds);
        } catch (\Throwable $e) {
            \Log::warning('CourseBuilderController::publish - notifyCoursePublished failed', [
                'course_id' => $courseId,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'ok' => true,
            'course' => $course->fresh(),
            'notified_count' => $notifiedCount,
        ]);
    }

    public function clone(Request $request, int $courseId)
    {
        $validated = $request->validate([
            'include_teams' => 'nullable|boolean',
        ]);

        $newCourse = $this->courseBuilderService->cloneCourse(
            $courseId,
            $request->user(),
            (bool)($validated['include_teams'] ?? true)
        );

        return response()->json([
            'course' => $newCourse,
        ], 201);
    }

    /**
     * List course versions (snapshots).
     */
    public function versions(Request $request, int $courseId)
    {
        $versions = CourseVersion::with([
            'creator:id,name,email',
            'snapshot:id,course_version_id,created_at',
        ])->where('course_id', $courseId)
            ->orderByDesc('version')
            ->get();

        return response()->json([
            'versions' => $versions,
        ]);
    }

    /**
     * Restore a version into a NEW course (safe rollback).
     */
    public function restoreVersion(Request $request, int $courseId, int $versionId)
    {
        $validated = $request->validate([
            'include_teams' => 'nullable|boolean',
        ]);

        $newCourse = $this->courseBuilderService->restoreCourseFromVersion(
            $courseId,
            $versionId,
            $request->user(),
            (bool)($validated['include_teams'] ?? true)
        );

        return response()->json([
            'course' => $newCourse,
        ], 201);
    }

    /**
     * List published tests + currently attached course tests (pivot rows).
     */
    public function tests(Request $request, int $courseId)
    {
        // Ensure course exists
        Course::findOrFail($courseId);

        $tests = Test::query()
            ->where('status', 'published')
            ->orderByDesc('created_at')
            ->get();

        $attached = CourseTest::where('course_id', $courseId)
            ->with(['test'])
            ->orderBy('order')
            ->get();

        return response()->json([
            'tests' => $tests,
            'attached' => $attached,
        ]);
    }

    /**
     * Attach a published test to course/module/lesson scope.
     */
    public function attachTest(Request $request, int $courseId)
    {
        $course = Course::findOrFail($courseId);

        $validated = $request->validate([
            'test_id' => 'required|exists:tests,id',
            'scope' => 'required|in:lesson,module,course',
            'scope_id' => 'nullable|integer',
            'required' => 'nullable|boolean',
            'passing_score' => 'nullable|integer|min:0|max:100',
            'order' => 'nullable|integer|min:0',
            'unlock_after_previous' => 'nullable|boolean',
            'unlock_after_test_id' => 'nullable|exists:tests,id',
        ]);

        // Ensure scope_id belongs to this course if set
        $scope = $validated['scope'];
        $scopeId = $validated['scope_id'] ?? null;
        if ($scope !== 'course') {
            if (!$scopeId) {
                return response()->json(['error' => 'scope_id is required for module/lesson scope'], 422);
            }
            if ($scope === 'module') {
                Module::where('id', $scopeId)->where('course_id', $courseId)->firstOrFail();
            }
            if ($scope === 'lesson') {
                Lesson::where('id', $scopeId)->where('course_id', $courseId)->firstOrFail();
            }
        }

        $test = Test::findOrFail((int)$validated['test_id']);

        $courseTest = $this->courseBuilderService->attachTest($course, $test, $validated);

        return response()->json([
            'course_test' => $courseTest->fresh(['test']),
        ], 201);
    }

    /**
     * Detach a test from course (optionally scoped).
     */
    public function detachTest(Request $request, int $courseId, int $testId)
    {
        $course = Course::findOrFail($courseId);
        $test = Test::findOrFail($testId);

        $validated = $request->validate([
            'scope' => 'nullable|in:lesson,module,course',
            'scope_id' => 'nullable|integer',
        ]);

        $deleted = $this->courseBuilderService->detachTest(
            $course,
            $test,
            $validated['scope'] ?? null,
            $validated['scope_id'] ?? null
        );

        return response()->json([
            'deleted' => (bool)$deleted,
        ]);
    }
}

