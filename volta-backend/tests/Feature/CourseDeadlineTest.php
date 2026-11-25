<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourseDeadlineTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_can_create_a_course_with_an_optional_deadline(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/courses', ['title' => 'Instruire', 'deadline_at' => '2030-05-20T18:30:00+03:00'])
            ->assertCreated()
            ->assertJsonPath('course.deadline_at', '2030-05-20T15:30:00+00:00');

        $this->postJson('/api/admin/courses', ['title' => 'Temă opțională'])
            ->assertCreated()
            ->assertJsonPath('course.deadline_at', null);

        $this->postJson('/api/admin/courses', ['title' => 'Instruire', 'deadline_at' => 'dată invalidă'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('deadline_at');
    }

    public function test_an_updated_deadline_is_visible_to_learners_and_can_be_removed(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'student']);
        $course = Course::factory()->published()->create([
            'settings' => ['deadline_at' => '2030-05-20T15:30:00+00:00'],
        ]);
        $adminPath = "/api/admin/courses/{$course->id}";

        $this->actingAs($admin, 'sanctum')->postJson("$adminPath/learners", [
            'user_ids' => [$student->id],
        ])->assertOk();
        $notification = Notification::where('user_id', $student->id)->where('type', 'course_assigned')->sole();
        $this->assertStringContainsString('de finalizat până la 20.05.2030', $notification->description);

        $this->actingAs($student, 'sanctum')->getJson('/api/profile')
            ->assertOk()->assertJsonPath('coursesAssigned.0.deadline_at', '2030-05-20T15:30:00+00:00');

        $this->actingAs($admin, 'sanctum')->putJson($adminPath, ['deadline_at' => '2025-05-20T11:00:00+03:00'])
            ->assertOk()->assertJsonPath('course.deadline_at', '2025-05-20T08:00:00+00:00');
        $this->putJson($adminPath, ['title' => 'Titlu actualizat'])
            ->assertOk()->assertJsonPath('course.deadline_at', '2025-05-20T08:00:00+00:00');

        $this->actingAs($student, 'sanctum')->getJson('/api/profile')
            ->assertOk()->assertJsonPath('coursesAssigned.0.deadline_at', '2025-05-20T08:00:00+00:00');
        $this->getJson("/api/courses/{$course->id}")
            ->assertOk()->assertJsonPath('deadline_at', '2025-05-20T08:00:00+00:00');

        $this->actingAs($admin, 'sanctum')->post($adminPath, ['deadline_at' => ''], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('course.deadline_at', null);
        $this->actingAs($student, 'sanctum')->getJson('/api/profile')
            ->assertOk()->assertJsonPath('coursesAssigned.0.deadline_at', null);
    }
}
