<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\User;
use App\Services\CourseBuilderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Cât timp cursul e în editare, cursanții văd ultima versiune publicată. Lecțiile și modulele care erau
 * ascunse (Ciornă) la publicare sunt și ele în snapshot, dar nu trebuie să apară la cursanți.
 */
class HiddenLessonsInPublishedVersionTest extends TestCase
{
    use RefreshDatabase;

    private User $student;

    private Course $course;

    protected function setUp(): void
    {
        parent::setUp();
        $this->student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $this->course = Course::factory()->published()->create(['workflow_status' => 'published', 'sequential_unlock' => false]);
        DB::table('course_user')->insert([
            'user_id' => $this->student->id,
            'course_id' => $this->course->id,
            'enrolled' => true,
            'enrolled_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function lesson(string $title, string $status, int $order, ?int $moduleId = null): Lesson
    {
        return Lesson::withoutEvents(fn () => Lesson::create([
            'course_id' => $this->course->id,
            'module_id' => $moduleId,
            'title' => $title,
            'content' => "<p>{$title}</p>",
            'type' => 'text',
            'status' => $status,
            'order' => $order,
        ]));
    }

    private function publishThenStartEditing(): void
    {
        app(CourseBuilderService::class)->createCourseVersionSnapshot($this->course->id, null, 'published');
        $this->course->forceFill(['workflow_status' => 'editing'])->save();
    }

    public function test_lesson_hidden_at_publish_stays_hidden_while_course_is_edited(): void
    {
        $this->lesson('Lecție vizibilă', 'published', 1);
        $hidden = $this->lesson('Lecție ascunsă', 'draft', 2);
        $this->publishThenStartEditing();

        $titles = collect($this->actingAs($this->student, 'sanctum')
            ->getJson("/api/courses/{$this->course->id}")
            ->assertOk()
            ->json('lessons'))->pluck('title')->all();
        $this->assertSame(['Lecție vizibilă'], $titles);

        $this->actingAs($this->student, 'sanctum')
            ->getJson("/api/lessons/{$hidden->id}")
            ->assertNotFound();
    }

    public function test_lessons_of_a_hidden_module_stay_hidden_while_course_is_edited(): void
    {
        $visibleModule = Module::withoutEvents(fn () => Module::create(['course_id' => $this->course->id, 'title' => 'Modul vizibil', 'order' => 1, 'status' => 'published']));
        $hiddenModule = Module::withoutEvents(fn () => Module::create(['course_id' => $this->course->id, 'title' => 'Modul ascuns', 'order' => 2, 'status' => 'draft']));
        $this->lesson('În modul vizibil', 'published', 1, $visibleModule->id);
        $inHidden = $this->lesson('În modul ascuns', 'published', 1, $hiddenModule->id);
        $this->publishThenStartEditing();

        $modules = collect($this->actingAs($this->student, 'sanctum')
            ->getJson("/api/courses/{$this->course->id}")
            ->assertOk()
            ->json('modules'))->pluck('title')->all();
        $this->assertSame(['Modul vizibil'], $modules);

        $this->actingAs($this->student, 'sanctum')
            ->getJson("/api/lessons/{$inHidden->id}")
            ->assertNotFound();
    }
}
