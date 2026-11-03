<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Bannerul „Continuă” din pagina de cursuri și numărătoarea lecțiilor din dashboard.
 */
class StudentNextLessonTest extends TestCase
{
    use RefreshDatabase;

    private User $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->student = User::factory()->create(['role' => 'student', 'status' => 'active']);
    }

    private function course(string $title): Course
    {
        $course = Course::factory()->published()->create(['title' => $title, 'sequential_unlock' => false]);
        DB::table('course_user')->insert([
            'user_id' => $this->student->id, 'course_id' => $course->id, 'enrolled' => true,
            'enrolled_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);

        return $course;
    }

    private function lesson(Course $course, string $title, int $order, ?int $moduleId = null): Lesson
    {
        return Lesson::withoutEvents(fn () => Lesson::create([
            'course_id' => $course->id, 'module_id' => $moduleId, 'title' => $title,
            'content' => '<p>x</p>', 'type' => 'text', 'status' => 'published', 'order' => $order,
        ]));
    }

    private function complete(Lesson $lesson, string $when): void
    {
        DB::table('lesson_progress')->insert([
            'user_id' => $this->student->id, 'lesson_id' => $lesson->id,
            'completed' => true, 'progress_percentage' => 100,
            'created_at' => $when, 'updated_at' => $when,
        ]);
    }

    public function test_resume_lesson_comes_from_the_course_worked_on_last(): void
    {
        $older = $this->course('Curs vechi');
        $olderDone = $this->lesson($older, 'Vechi 1', 1);
        $this->lesson($older, 'Vechi 2', 2);
        $recent = $this->course('Curs recent');
        $recentDone = $this->lesson($recent, 'Recent 1', 1);
        $this->lesson($recent, 'Recent 2', 2);
        $this->complete($olderDone, '2026-10-01 10:00:00');
        $this->complete($recentDone, '2026-11-02 10:00:00');

        $this->actingAs($this->student, 'sanctum')
            ->getJson('/api/student/next-lesson')
            ->assertOk()
            ->assertJsonPath('next_lesson.title', 'Recent 2')
            ->assertJsonPath('next_lesson.course_title', 'Curs recent')
            ->assertJsonPath('next_lesson.lesson_number', 2)
            ->assertJsonPath('next_lesson.lesson_count', 2);
    }

    public function test_next_lesson_is_null_when_everything_is_done(): void
    {
        $course = $this->course('Gata');
        $this->complete($this->lesson($course, 'Singura', 1), '2026-11-02 10:00:00');

        $this->actingAs($this->student, 'sanctum')
            ->getJson('/api/student/next-lesson')
            ->assertOk()
            ->assertJsonPath('next_lesson', null);
    }

    public function test_dashboard_counts_lessons_without_a_module(): void
    {
        $rootOnly = $this->course('Doar lecții fără modul');
        $this->complete($this->lesson($rootOnly, 'R1', 1), '2026-11-02 10:00:00');
        $this->lesson($rootOnly, 'R2', 2);
        $withModule = $this->course('Cu modul');
        $module = Module::withoutEvents(fn () => Module::create(['course_id' => $withModule->id, 'title' => 'M', 'order' => 1, 'status' => 'published']));
        $this->complete($this->lesson($withModule, 'M1', 1, $module->id), '2026-11-02 10:00:00');

        $this->actingAs($this->student, 'sanctum')
            ->getJson('/api/student/dashboard')
            ->assertOk()
            ->assertJsonPath('global_progress.total_lessons', 3)
            ->assertJsonPath('global_progress.completed_lessons', 2);
    }

    public function test_next_lesson_does_not_load_every_assigned_course(): void
    {
        $recent = $this->course('Curs recent');
        $this->complete($this->lesson($recent, 'Recent 1', 1), '2026-11-02 10:00:00');
        $this->lesson($recent, 'Recent 2', 2);
        $count = function () {
            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->actingAs($this->student, 'sanctum')->getJson('/api/student/next-lesson')
                ->assertOk()->assertJsonPath('next_lesson.title', 'Recent 2');
            $n = count(DB::getQueryLog());
            DB::disableQueryLog();

            return $n;
        };
        $few = $count();
        for ($i = 1; $i <= 15; $i++) {
            $this->lesson($this->course("Neînceput {$i}"), "Lecția {$i}", 1);
        }

        $this->assertLessThanOrEqual($few + 2, $count());
    }
}
