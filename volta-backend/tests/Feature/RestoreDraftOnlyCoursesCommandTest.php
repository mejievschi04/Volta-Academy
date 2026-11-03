<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Lesson;
use App\Models\User;
use App\Services\CourseBuilderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Cursurile publicate doar cu lecții în Ciornă (cursanții le vedeau goale după repararea lecțiilor ascunse).
 */
class RestoreDraftOnlyCoursesCommandTest extends TestCase
{
    use RefreshDatabase;

    private function course(string $title, array $lessonStatuses): Course
    {
        $course = Course::factory()->published()->create(['title' => $title, 'workflow_status' => 'published', 'sequential_unlock' => false]);
        foreach ($lessonStatuses as $i => $status) {
            Lesson::withoutEvents(fn () => Lesson::create([
                'course_id' => $course->id, 'module_id' => null, 'title' => "{$title} {$i}",
                'content' => '<p>x</p>', 'type' => 'text', 'status' => $status, 'order' => $i,
            ]));
        }
        app(CourseBuilderService::class)->createCourseVersionSnapshot($course->id, null, 'published');
        $course->forceFill(['workflow_status' => 'editing'])->save();

        return $course;
    }

    private function visibleLessons(User $student, Course $course): int
    {
        return count($this->actingAs($student, 'sanctum')->getJson("/api/courses/{$course->id}")->assertOk()->json('lessons') ?? []);
    }

    public function test_restores_lessons_of_courses_students_saw_empty_and_leaves_the_rest(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $empty = $this->course('Ventilatoare', ['draft', 'draft']);
        $mixed = $this->course('UPS', ['published', 'draft']);
        foreach ([$empty, $mixed] as $course) {
            DB::table('course_user')->insert(['user_id' => $student->id, 'course_id' => $course->id, 'enrolled' => true, 'created_at' => now(), 'updated_at' => now()]);
        }
        $this->assertSame(0, $this->visibleLessons($student, $empty));

        $this->artisan('volta:restore-draft-only-courses')->expectsOutputToContain('Ventilatoare')->assertSuccessful();
        $this->assertSame(0, $this->visibleLessons($student, $empty), 'fără --apply nu se schimbă nimic');

        $this->artisan('volta:restore-draft-only-courses', ['--apply' => true])->assertSuccessful();

        $this->assertSame(2, $this->visibleLessons($student, $empty));
        $this->assertSame(1, $this->visibleLessons($student, $mixed), 'cursul cu o lecție publicată rămâne neatins');
        $this->assertSame(0, Lesson::where('course_id', $empty->id)->where('status', 'draft')->count());
        $this->assertSame(1, Lesson::where('course_id', $mixed->id)->where('status', 'draft')->count());
    }
}
