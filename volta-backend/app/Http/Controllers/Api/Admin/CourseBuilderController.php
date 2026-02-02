<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\ContentBlock;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\Module;
use App\Services\CourseBuilderService;
use App\Services\CourseBuilderValidator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
        $validated = $request->validate([
            'ops' => 'required|array|min:1',
            'ops.*.op' => 'required|string|max:64',
        ]);

        $result = $this->courseBuilderService->applyStructurePatch(
            $courseId,
            $validated['ops'],
            $request->user()
        );

        return response()->json($result);
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

        DB::transaction(function () use ($course) {
            $course->update(['status' => 'published', 'workflow_status' => 'published']);
            Module::where('course_id', $course->id)->where('status', '!=', 'published')->update(['status' => 'published']);
            Lesson::where('course_id', $course->id)->where('status', '!=', 'published')->update(['status' => 'published']);
        });

        // Create a published snapshot version for history/audit
        $this->courseBuilderService->createCourseVersionSnapshot($course->id, $request->user(), 'published');

        return response()->json([
            'ok' => true,
            'course' => $course->fresh(),
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
}

