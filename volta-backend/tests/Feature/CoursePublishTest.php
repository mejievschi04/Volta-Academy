<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\User;
use App\Services\CourseBuilderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CoursePublishTest extends TestCase
{
    use RefreshDatabase;

    public function test_publishing_and_republishing_preserve_individual_lesson_statuses(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $course = Course::factory()->create(['status' => 'draft', 'teacher_id' => $admin->id]);
        $module = Module::create([
            'course_id' => $course->id, 'title' => 'Modul', 'order' => 1, 'status' => 'draft',
        ]);

        $lessons = collect();
        foreach ([null, $module->id] as $moduleId) {
            foreach (['draft', 'published'] as $status) {
                $lesson = Lesson::create([
                    'course_id' => $course->id,
                    'module_id' => $moduleId,
                    'title' => "Lecție {$status}",
                    'content' => '<p>Conținut lecție</p>',
                    'type' => 'text',
                    'status' => $status,
                    'order' => $lessons->count() + 1,
                ]);
                $lessons->push([$lesson, $status]);
            }
        }

        $service = app(CourseBuilderService::class);
        foreach (['draft', 'editing'] as $workflowStatus) {
            $course->update(['workflow_status' => $workflowStatus]);
            $result = $service->publishLive($course->fresh(), $admin);

            $this->assertTrue($result['ok']);
            $this->assertSame('published', $course->fresh()->status);
            $this->assertSame('published', $course->fresh()->workflow_status);
            foreach ($lessons as [$lesson, $status]) {
                $this->assertSame($status, $lesson->fresh()->status);
            }
        }
    }

    public function test_admin_builder_validate_requires_auth(): void
    {
        $course = Course::factory()->create(['status' => 'draft']);

        $this->postJson("/api/admin/courses/{$course->id}/builder/validate")
            ->assertUnauthorized();
    }

    public function test_admin_can_validate_draft_course(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $course = Course::factory()->create(['status' => 'draft']);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$course->id}/builder/validate")
            ->assertOk()
            ->assertJsonStructure(['ok', 'errors', 'warnings']);
    }
}
