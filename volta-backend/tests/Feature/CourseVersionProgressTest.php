<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseTest;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\Test;
use App\Models\TestResult;
use App\Models\User;
use App\Services\CourseProgressService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * O versiune nouă a cursului (lecții adăugate și publicate) nu scade progresul cursanților:
 * cine terminase rămâne cu cursul terminat, iar procentul celor în curs nu coboară.
 */
class CourseVersionProgressTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Course $course;

    private Module $module;

    /** @var array<int, Lesson> */
    private array $lessons = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $this->course = Course::factory()->create(['status' => 'draft', 'teacher_id' => $this->admin->id, 'sequential_unlock' => false]);
        $this->module = Module::create(['course_id' => $this->course->id, 'title' => 'Modul', 'order' => 1, 'status' => 'draft']);
        foreach ([1, 2, 3] as $i) {
            $this->lessons[] = Lesson::create([
                'course_id' => $this->course->id, 'module_id' => $this->module->id, 'title' => "Lecția {$i}",
                'content' => "<p>Conținutul lecției {$i}, suficient pentru publicare.</p>", 'type' => 'text', 'status' => 'published', 'order' => $i,
            ]);
        }
        $this->asAdmin()->postJson("/api/admin/courses/{$this->course->id}/builder/publish")->assertOk();
    }

    private function asAdmin()
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($this->admin, 'sanctum');
    }

    private function enroll(User $student): void
    {
        DB::table('course_user')->insert([
            'course_id' => $this->course->id, 'user_id' => $student->id, 'enrolled' => true, 'enrolled_at' => now(),
            'is_mandatory' => false, 'assigned_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function complete(User $student, Lesson $lesson): void
    {
        DB::table('lesson_progress')->insert([
            'user_id' => $student->id, 'lesson_id' => $lesson->id, 'completed' => true, 'progress_percentage' => 100,
            'completed_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    /** Progresul calculat ca într-o cerere nouă (serviciul reține rezultate pe durata unei cereri). */
    private function progress(User $student): array
    {
        Cache::flush();
        $this->app->forgetInstance(CourseProgressService::class);
        $service = $this->app->make(CourseProgressService::class);
        $course = Course::findOrFail($this->course->id);
        $pct = (int) round($service->calculateCourseProgress($student->fresh(), $course));

        return [
            'pct' => $pct,
            'complete' => $service->isCourseComplete($student->fresh(), $course),
            'completed_at' => DB::table('course_user')->where('user_id', $student->id)->where('course_id', $this->course->id)->value('completed_at'),
        ];
    }

    private function addLessonAndPublish(): Lesson
    {
        $this->asAdmin()->postJson("/api/admin/courses/{$this->course->id}/builder/lessons", [
            'module_id' => $this->module->id, 'title' => 'Lecție nouă', 'content' => '<p>Lecție adăugată după ce cursanții au început.</p>', 'order' => 4, 'status' => 'published',
        ])->assertSuccessful();
        $newLesson = Lesson::where('title', 'Lecție nouă')->firstOrFail();
        $this->asAdmin()->putJson("/api/admin/courses/{$this->course->id}/builder/lessons/{$newLesson->id}", ['status' => 'published'])->assertOk();
        $this->asAdmin()->postJson("/api/admin/courses/{$this->course->id}/builder/publish")->assertOk();

        return Lesson::where('title', 'Lecție nouă')->firstOrFail();
    }

    public function test_finished_learner_stays_finished_after_a_new_version_adds_lessons(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $this->enroll($student);
        foreach ($this->lessons as $lesson) {
            $this->complete($student, $lesson);
        }
        $before = $this->progress($student);
        $this->assertSame(100, $before['pct']);
        $this->assertNotNull($before['completed_at']);

        $this->addLessonAndPublish();

        $after = $this->progress($student);
        $this->assertSame(100, $after['pct']);
        $this->assertTrue($after['complete']);
        $this->assertSame($before['completed_at'], $after['completed_at'], 'data finalizării se păstrează');
    }

    public function test_in_progress_learner_keeps_their_percentage_and_must_finish_the_new_lesson(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $this->enroll($student);
        $this->complete($student, $this->lessons[0]);
        $this->complete($student, $this->lessons[1]);
        $this->assertSame(67, $this->progress($student)['pct']);

        $newLesson = $this->addLessonAndPublish();

        // 2 din 4 ar fi 50%; procentul nu scade din cauza lecției noi
        $this->assertSame(67, $this->progress($student)['pct']);

        $this->complete($student, $this->lessons[2]);
        $state = $this->progress($student);
        $this->assertSame(75, $state['pct']);
        $this->assertFalse($state['complete'], 'lecția nouă e necesară pentru cine nu terminase');

        $this->complete($student, $newLesson);
        $state = $this->progress($student);
        $this->assertSame(100, $state['pct']);
        $this->assertTrue($state['complete']);
    }

    public function test_marking_complete_forces_100_and_undoing_resets_the_course_to_0(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $this->enroll($student);
        $this->complete($student, $this->lessons[0]);
        $test = Test::factory()->published()->create();
        CourseTest::create(['course_id' => $this->course->id, 'test_id' => $test->id, 'scope' => 'course', 'required' => true, 'passing_score' => 70, 'order' => 0]);
        $otherCourse = Course::factory()->create(['teacher_id' => $this->admin->id]);
        foreach ([$this->course->id, $otherCourse->id] as $courseId) {
            TestResult::create([
                'test_id' => $test->id, 'course_id' => $courseId, 'user_id' => $student->id,
                'score' => 50, 'max_score' => 100, 'percentage' => 50, 'passed' => false,
                'attempt_number' => 1, 'answers' => [], 'completed_at' => now(), 'status' => 'completed',
            ]);
        }

        $this->asAdmin()->postJson("/api/admin/users/{$student->id}/courses/{$this->course->id}/complete")->assertOk();
        $state = $this->progress($student);
        $this->assertSame(100, $state['pct']);
        $this->assertTrue($state['complete']);

        // și floor-ul de 100 lăsat de republicările dinainte de 3bda7b4 dispare
        DB::table('course_user')->where('user_id', $student->id)->where('course_id', $this->course->id)
            ->update(['progress_floor' => 100]);
        $this->asAdmin()->deleteJson("/api/admin/users/{$student->id}/courses/{$this->course->id}/complete")->assertOk();

        $state = $this->progress($student);
        $this->assertSame(0, $state['pct']);
        $this->assertFalse($state['complete']);
        $this->assertNull($state['completed_at']);
        $this->assertSame(0, DB::table('lesson_progress')->where('user_id', $student->id)->count());
        $this->assertSame(
            [$otherCourse->id],
            DB::table('test_results')->where('user_id', $student->id)->pluck('course_id')->map(fn ($id) => (int) $id)->all(),
            'rezultatul dat în alt curs rămâne'
        );
        $this->assertTrue((bool) DB::table('course_user')->where('user_id', $student->id)->where('course_id', $this->course->id)->value('enrolled'), 'rămâne înscris');
    }

    public function test_completing_a_lesson_deleted_after_publishing_does_not_fail(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $this->enroll($student);
        $deleted = $this->lessons[1];
        $this->asAdmin()->deleteJson("/api/admin/lessons/{$deleted->id}")->assertSuccessful();

        // până la următoarea publicare cursantul vede încă lecția (din versiunea publicată) și o poate deschide
        $this->app['auth']->forgetGuards();
        $this->actingAs($student, 'sanctum')->getJson("/api/lessons/{$deleted->id}")->assertOk();

        // finalizarea ei nu mai are ce înregistra, dar nu trebuie să dea eroare (înainte: 404)
        $this->app['auth']->forgetGuards();
        $this->actingAs($student, 'sanctum')
            ->postJson("/api/lessons/{$deleted->id}/complete")
            ->assertOk()
            ->assertJsonPath('lesson_removed', true);
        $this->app['auth']->forgetGuards();
        $this->actingAs($student, 'sanctum')
            ->putJson("/api/lessons/{$deleted->id}/progress", ['progress_percentage' => 50])
            ->assertOk();

        // o lecție care n-a existat niciodată rămâne 404
        $this->app['auth']->forgetGuards();
        $this->actingAs($student, 'sanctum')->postJson('/api/lessons/999999/complete')->assertNotFound();
    }
}
