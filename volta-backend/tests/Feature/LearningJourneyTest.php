<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LearningJourneyTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_publish_enroll_lesson_exam_and_finish_course(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'student']);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/courses', ['title' => 'Journey course', 'status' => 'published'])
            ->assertCreated()
            ->assertJsonPath('course.status', 'draft');

        $courseId = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/courses', ['title' => 'Journey course'])
            ->assertCreated()
            ->json('course.id');

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/courses/{$courseId}/enroll")
            ->assertForbidden();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$courseId}/builder/publish")
            ->assertStatus(422);

        $moduleId = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$courseId}/builder/modules", ['title' => 'Modul 1'])
            ->assertCreated()
            ->json('module.id');

        $firstLessonId = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$courseId}/builder/lessons", [
                'module_id' => $moduleId,
                'title' => 'Lecția 1',
                'content' => '<p>Conținutul primei lecții</p>',
            ])
            ->assertCreated()
            ->json('lesson.id');

        $secondLessonId = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$courseId}/builder/lessons", [
                'module_id' => $moduleId,
                'title' => 'Lecția 2',
                'content' => '<p>Conținutul celei de-a doua lecții</p>',
            ])
            ->assertCreated()
            ->json('lesson.id');

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/tests', [
            'title' => 'Empty published',
            'status' => 'published',
            'question_source' => 'direct',
        ])->assertStatus(422);

        $testId = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/tests', [
            'title' => 'Test final',
            'type' => 'graded',
            'question_source' => 'direct',
            'passing_score' => 70,
            'max_attempts' => 3,
            'questions' => [[
                'type' => 'multiple_choice',
                'content' => 'Cât face 2+2?',
                'answers' => [
                    ['text' => '4', 'is_correct' => true],
                    ['text' => '3', 'is_correct' => false],
                ],
                'points' => 1,
                'order' => 0,
            ]],
        ])->assertCreated()->json('test.id');

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/courses/{$courseId}/builder/tests/attach", [
            'test_id' => $testId,
            'scope' => 'course',
            'required' => true,
        ])->assertCreated();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$courseId}/builder/validate")
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$courseId}/builder/publish")
            ->assertOk()
            ->assertJsonPath('course.status', 'published');

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/courses/{$courseId}/enroll")
            ->assertOk()
            ->assertJsonPath('enrolled', true);

        $this->actingAs($student, 'sanctum')
            ->getJson("/api/lessons/{$firstLessonId}")
            ->assertOk()
            ->assertJsonPath('title', 'Lecția 1');

        $this->actingAs($student, 'sanctum')
            ->getJson("/api/lessons/{$secondLessonId}")
            ->assertForbidden()
            ->assertJsonPath('locked', true);

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/lessons/{$firstLessonId}/complete")
            ->assertOk();

        $this->actingAs($student, 'sanctum')
            ->getJson("/api/lessons/{$secondLessonId}")
            ->assertOk();

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/lessons/{$secondLessonId}/complete")
            ->assertOk();

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/exams/{$testId}/submit", ['answers' => [], 'course_id' => $courseId])
            ->assertForbidden();

        $questionId = $this->actingAs($student, 'sanctum')
            ->getJson("/api/exams/{$testId}?course_id={$courseId}")
            ->assertOk()
            ->json('questions.0.id');

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/exams/{$testId}/submit", [
                'answers' => [$questionId => 0],
                'course_id' => $courseId,
            ])
            ->assertOk()
            ->assertJsonPath('result.passed', true);

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/courses/{$courseId}/finish")
            ->assertOk();

        $this->actingAs($student, 'sanctum')
            ->putJson("/api/lessons/{$firstLessonId}/notes", [
                'notes' => [['content' => 'Notiță de parcurs', 'timestamp' => 0]],
            ])
            ->assertOk();

        $cloneId = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$courseId}/builder/clone")
            ->assertCreated()
            ->json('course.id');
        $this->assertNotSame($courseId, $cloneId);
        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/courses/{$cloneId}")
            ->assertOk();
    }

    public function test_open_event_register_and_attendance_after_start(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $event = Event::create([
            'title' => 'Webinar',
            'description' => 'Live',
            'type' => 'webinar',
            'status' => 'published',
            'start_date' => now()->subHour()->format('Y-m-d H:i:s'),
            'end_date' => now()->addHour()->format('Y-m-d H:i:s'),
            'access_type' => 'free',
            'live_link' => 'https://example.com/live',
        ]);

        $this->actingAs($student, 'sanctum')->postJson("/api/events/{$event->id}/register")->assertOk();
        $this->actingAs($student, 'sanctum')->getJson('/api/events/my')->assertOk();
        $this->actingAs($student, 'sanctum')->postJson("/api/events/{$event->id}/mark-attendance")->assertOk();
    }
}
