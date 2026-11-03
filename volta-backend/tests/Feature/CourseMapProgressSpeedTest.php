<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseMap;
use App\Models\Lesson;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Lista de mape pentru cursant: cursurile neîncepute nu mai trec prin calculul complet de progres.
 */
class CourseMapProgressSpeedTest extends TestCase
{
    use RefreshDatabase;

    private User $student;

    private CourseMap $map;

    protected function setUp(): void
    {
        parent::setUp();
        $this->student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $this->map = CourseMap::create(['name' => 'Produse', 'order' => 1]);
    }

    private function assignedCourse(int $order): Course
    {
        $course = Course::factory()->published()->create(['sequential_unlock' => false]);
        Lesson::withoutEvents(fn () => Lesson::create([
            'course_id' => $course->id, 'module_id' => null, 'title' => "Lecția {$order}",
            'content' => '<p>x</p>', 'type' => 'text', 'status' => 'published', 'order' => 1,
        ]));
        DB::table('course_map_course')->insert(['course_map_id' => $this->map->id, 'course_id' => $course->id, 'order' => $order]);
        DB::table('course_user')->insert([
            'user_id' => $this->student->id, 'course_id' => $course->id, 'enrolled' => true,
            'enrolled_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);

        return $course;
    }

    private function queriesFor(string $url): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->actingAs($this->student, 'sanctum')->getJson($url)->assertOk();
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $count;
    }

    public function test_map_progress_counts_started_courses_and_untouched_ones_as_zero(): void
    {
        $started = $this->assignedCourse(1);
        $this->assignedCourse(2);
        DB::table('lesson_progress')->insert([
            'user_id' => $this->student->id, 'lesson_id' => $started->lessons()->value('id'),
            'completed' => true, 'progress_percentage' => 100, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->actingAs($this->student, 'sanctum')->getJson("/api/course-maps/{$this->map->id}")
            ->assertOk()
            ->assertJsonPath('progress_percentage', 50);

        $row = collect($this->actingAs($this->student, 'sanctum')->getJson('/api/course-maps')->assertOk()->json('data'))
            ->firstWhere('id', $this->map->id);
        $this->assertSame(50, $row['progress_percentage']);
    }

    public function test_untouched_courses_do_not_add_queries(): void
    {
        $this->assignedCourse(1);
        $few = $this->queriesFor('/api/course-maps');

        for ($i = 2; $i <= 15; $i++) {
            $this->assignedCourse($i);
        }
        $many = $this->queriesFor('/api/course-maps');

        $this->assertLessThanOrEqual($few + 2, $many, "15 cursuri neîncepute: {$many} interogări față de {$few}");
    }
}
