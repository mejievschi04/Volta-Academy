<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseTest;
use App\Models\Lesson;
use App\Models\Question;
use App\Models\Test;
use App\Services\CourseBuilderValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Publicarea refuză un curs pe care cursanții l-ar vedea gol sau blocat.
 */
class PublishValidationLessonsTest extends TestCase
{
    use RefreshDatabase;

    private function lesson(Course $course, string $status, string $title = 'Lecție'): Lesson
    {
        return Lesson::withoutEvents(fn () => Lesson::create([
            'course_id' => $course->id, 'module_id' => null, 'title' => $title,
            'content' => '<p>Conținut suficient pentru validare.</p>', 'type' => 'text', 'status' => $status, 'order' => 1,
        ]));
    }

    private function codes(Course $course): array
    {
        return collect(app(CourseBuilderValidator::class)->validate($course->fresh())['errors'])->pluck('code')->all();
    }

    public function test_course_with_only_draft_lessons_cannot_be_published(): void
    {
        $course = Course::factory()->create(['title' => 'Ventilatoare']);
        $this->lesson($course, 'draft');

        $this->assertContains('course.lessons.published_required', $this->codes($course));
    }

    public function test_required_test_on_a_draft_lesson_blocks_publishing(): void
    {
        $course = Course::factory()->create(['title' => 'UPS-uri']);
        $this->lesson($course, 'published', 'Introducere');
        $hidden = $this->lesson($course, 'draft', 'Stație portabilă');
        $test = Test::factory()->published()->create(['title' => 'UPS-uri']);
        Question::factory()->create(['test_id' => $test->id]);
        CourseTest::create([
            'course_id' => $course->id, 'test_id' => $test->id, 'scope' => 'lesson',
            'scope_id' => $hidden->id, 'required' => true, 'passing_score' => 70, 'order' => 0,
        ]);

        $codes = $this->codes($course);
        $this->assertContains('test.lesson.unpublished', $codes);
        $this->assertNotContains('course.lessons.published_required', $codes);
    }

    public function test_course_with_a_published_lesson_passes_these_checks(): void
    {
        $course = Course::factory()->create(['title' => 'Bun']);
        $this->lesson($course, 'published');
        $this->lesson($course, 'draft');

        $codes = $this->codes($course);
        $this->assertNotContains('course.lessons.published_required', $codes);
        $this->assertNotContains('test.lesson.unpublished', $codes);
    }
}
