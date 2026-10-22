<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\Course;
use App\Models\Notification;
use App\Models\Team;
use App\Models\User;
use App\Services\UserAssignedCoursesService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminPerformanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_teams_list_returns_only_the_fields_the_admin_pages_use(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $course = Course::factory()->create(['teacher_id' => $admin->id]);
        $team = Team::create(['name' => 'Vânzări', 'owner_id' => $admin->id]);
        $team->users()->attach($student->id);
        $team->courses()->attach($course->id);

        $team = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/teams')->assertOk()->json('0');

        $this->assertSame(['id', 'name', 'email', 'role', 'status'], array_values(array_diff(array_keys($team['users'][0]), ['pivot'])));
        $this->assertSame($student->id, $team['users'][0]['id']);
        $this->assertSame($course->id, $team['courses'][0]['id']);
        $this->assertArrayNotHasKey('description', $team['courses'][0]);
        $this->assertSame($admin->name, $team['owner']['name']);
    }

    public function test_api_responses_carry_server_timing(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $header = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/teams')->headers->get('Server-Timing');

        $this->assertMatchesRegularExpression('/^app;dur=\d+, db;dur=\d+;desc="\d+ queries"$/', (string) $header);
    }

    public function test_chat_messages_do_not_create_notifications(): void
    {
        $sender = User::factory()->create(['role' => 'student']);
        $recipient = User::factory()->create(['role' => 'student']);
        $conversation = Conversation::create(['user1_id' => $sender->id, 'user2_id' => $recipient->id, 'is_group' => false, 'created_by' => $sender->id]);
        $conversation->participants()->attach([$sender->id, $recipient->id]);

        $this->actingAs($sender, 'sanctum')
            ->postJson("/api/messages/conversations/{$conversation->id}/messages", ['content' => 'Salut'])
            ->assertSuccessful();

        $this->assertSame(0, Notification::count());
    }

    public function test_direct_course_assignment_notifies_the_student_once(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $course = Course::factory()->published()->create(['title' => 'Siguranța muncii']);
        $assignment = app(UserAssignedCoursesService::class);

        $assignment->assignCourseDirectly($student, $course, []);
        $assignment->assignCourseDirectly($student, $course, []);

        $notification = Notification::where('user_id', $student->id)->sole();
        $this->assertSame('course_assigned', $notification->type);
        $this->assertSame(['course_id' => $course->id], $notification->data);
    }

    public function test_badges_return_all_top_bar_counters_in_one_request(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'student']);
        Notification::create(['user_id' => $admin->id, 'type' => 'course_completed', 'title' => 'Curs finalizat', 'severity' => 'info']);
        $conversation = Conversation::create(['user1_id' => $student->id, 'user2_id' => $admin->id, 'is_group' => false, 'created_by' => $student->id]);
        \App\Models\Message::create(['conversation_id' => $conversation->id, 'sender_id' => $student->id, 'content' => 'Bună', 'read' => false]);

        $this->actingAs($admin, 'sanctum')->getJson('/api/badges')
            ->assertOk()
            ->assertExactJson(['notifications' => 1, 'messages' => 1, 'pending_reviews' => 0]);

        $this->actingAs($student, 'sanctum')->getJson('/api/badges')
            ->assertOk()
            ->assertExactJson(['notifications' => 0, 'messages' => 0, 'pending_reviews' => null]);
    }
}
