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

    /**
     * Varianta A (decizie 2026-11-04): la prima publicare se publică toate lecțiile (builder-ul le creează în
     * Ciornă și cursul ieșea gol); la republicare lecțiile ascunse intenționat rămân ascunse, iar cele adăugate
     * de la ultima publicare se publică dacă sunt bifate în fereastra de publicare (implicit toate).
     */
    public function test_first_publish_publishes_lessons_and_republish_keeps_hidden_ones(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $course = Course::factory()->create(['status' => 'draft', 'teacher_id' => $admin->id]);
        $module = Module::create([
            'course_id' => $course->id, 'title' => 'Modul', 'order' => 1, 'status' => 'draft',
        ]);
        $make = fn (?int $moduleId, string $status, string $title, int $order) => Lesson::create([
            'course_id' => $course->id, 'module_id' => $moduleId, 'title' => $title,
            'content' => '<p>Conținut lecție</p>', 'type' => 'text', 'status' => $status, 'order' => $order,
        ]);
        $first = $make(null, 'draft', 'Lecția 1', 1);
        $second = $make($module->id, 'draft', 'Lecția 2', 2);
        $service = app(CourseBuilderService::class);

        // prima publicare: toate lecțiile devin publicate
        $this->assertTrue($service->publishLive($course->fresh(), $admin)['ok']);
        $this->assertSame('published', $first->fresh()->status);
        $this->assertSame('published', $second->fresh()->status);

        // ascunsă intenționat după publicare: rămâne ascunsă la republicare
        $first->fresh()->update(['status' => 'draft']);
        $course->update(['workflow_status' => 'editing']);
        $this->assertTrue($service->publishLive($course->fresh(), $admin)['ok']);
        $this->assertSame('draft', $first->fresh()->status);

        // lecție nouă: debifată rămâne în Ciornă, implicit se publică
        $added = $make(null, 'draft', 'Lecția nouă', 3);
        $this->assertSame([$added->id], $service->draftLessonsOfferedOnPublish($course->fresh())->pluck('id')->all());
        $this->assertTrue($service->publishLive($course->fresh(), $admin, [], false, [])['ok']);
        $this->assertSame('draft', $added->fresh()->status);
        $other = $make(null, 'draft', 'Încă una', 4);
        $this->assertTrue($service->publishLive($course->fresh(), $admin)['ok']);
        $this->assertSame('published', $other->fresh()->status);
        $this->assertSame('draft', $first->fresh()->status);
    }

    public function test_validate_endpoint_lists_lessons_published_with_the_course(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $course = Course::factory()->create(['status' => 'draft', 'teacher_id' => $admin->id, 'title' => 'Curs nou']);
        $lesson = Lesson::create([
            'course_id' => $course->id, 'module_id' => null, 'title' => 'Doar în Ciornă',
            'content' => '<p>Conținut lecție</p>', 'type' => 'text', 'status' => 'draft', 'order' => 1,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/courses/{$course->id}/builder/validate")
            ->assertOk()
            ->assertJsonPath('first_publish', true)
            ->assertJsonPath('draft_lessons.0.id', $lesson->id);
        $this->assertNotContains('course.lessons.published_required', collect($response->json('errors'))->pluck('code')->all());
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
