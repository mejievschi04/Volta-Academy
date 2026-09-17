<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourseAssignmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_attaching_a_team_enrolls_student_members_only(): void
    {
        [$admin, $course, $team, $student, $other] = $this->setupCourseTeamAndStudents();
        $team->users()->sync([$student->id, $other->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$course->id}/teams", ['team_ids' => [$team->id]])
            ->assertOk();

        $this->assertDatabaseHas('course_user', [
            'user_id' => $student->id,
            'course_id' => $course->id,
            'enrolled' => true,
            'assignment_source' => 'team',
        ]);
        $this->assertDatabaseMissing('course_user', [
            'user_id' => $other->id,
            'course_id' => $course->id,
        ]);
    }

    public function test_unchecking_a_team_unenrolls_team_members_but_keeps_direct_assigns(): void
    {
        [$admin, $course, $team, $student] = $this->setupCourseTeamAndStudents();
        $direct = User::factory()->create(['role' => 'student']);
        $team->users()->sync([$student->id, $direct->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$course->id}/teams", ['team_ids' => [$team->id]])
            ->assertOk();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$course->id}/learners", [
                'user_ids' => [$direct->id],
                'is_mandatory' => false,
            ])
            ->assertOk();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$course->id}/teams", ['team_ids' => []])
            ->assertOk();

        $this->assertDatabaseMissing('course_user', [
            'user_id' => $student->id,
            'course_id' => $course->id,
        ]);
        $this->assertDatabaseHas('course_user', [
            'user_id' => $direct->id,
            'course_id' => $course->id,
            'assignment_source' => 'direct',
        ]);
    }

    public function test_direct_assign_does_not_remove_other_courses(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'student']);
        $keep = Course::factory()->published()->create();
        $add = Course::factory()->published()->create();

        $student->assignedCourses()->attach($keep->id, [
            'is_mandatory' => false,
            'assigned_at' => now(),
            'enrolled' => true,
            'enrolled_at' => now(),
            'assignment_source' => 'direct',
        ]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$add->id}/learners", [
                'user_ids' => [$student->id],
                'is_mandatory' => false,
            ])
            ->assertOk();

        $this->assertEqualsCanonicalizing(
            [$keep->id, $add->id],
            $student->assignedCourses()->pluck('courses.id')->all()
        );
    }

    public function test_user_assign_courses_merges_instead_of_wiping_unrelated_enrollments_when_ids_include_existing(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'student']);
        $keep = Course::factory()->published()->create();
        $add = Course::factory()->published()->create();

        $student->assignedCourses()->attach($keep->id, [
            'is_mandatory' => false,
            'assigned_at' => now(),
            'enrolled' => true,
            'enrolled_at' => now(),
            'assignment_source' => 'direct',
        ]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/users/{$student->id}/courses", [
                'course_ids' => [$keep->id, $add->id],
                'is_mandatory' => false,
            ])
            ->assertOk();

        $this->assertEqualsCanonicalizing(
            [$keep->id, $add->id],
            $student->fresh()->assignedCourses()->pluck('courses.id')->all()
        );
        $this->assertDatabaseHas('course_user', [
            'user_id' => $student->id,
            'course_id' => $add->id,
            'enrolled' => true,
            'assignment_source' => 'direct',
        ]);
    }

    public function test_attaching_courses_to_team_enrolls_members_and_removing_unenrolls_team_source(): void
    {
        [$admin, $course, $team, $student] = $this->setupCourseTeamAndStudents();
        $team->users()->sync([$student->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/teams/{$team->id}/courses", ['course_ids' => [$course->id]])
            ->assertOk();

        $this->assertDatabaseHas('course_user', [
            'user_id' => $student->id,
            'course_id' => $course->id,
            'assignment_source' => 'team',
        ]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/teams/{$team->id}/courses", ['course_ids' => []])
            ->assertOk();

        $this->assertDatabaseMissing('course_user', [
            'user_id' => $student->id,
            'course_id' => $course->id,
        ]);
    }

    public function test_adding_a_student_to_a_team_enrolls_existing_team_courses(): void
    {
        [$admin, $course, $team, $student] = $this->setupCourseTeamAndStudents();
        $team->courses()->sync([$course->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/teams/{$team->id}/users", ['user_ids' => [$student->id]])
            ->assertOk();

        $this->assertDatabaseHas('course_user', [
            'user_id' => $student->id,
            'course_id' => $course->id,
            'assignment_source' => 'team',
        ]);
    }

    public function test_user_course_sync_keeps_team_enrollments_not_in_the_direct_list(): void
    {
        [$admin, $course, $team, $student] = $this->setupCourseTeamAndStudents();
        $direct = Course::factory()->published()->create();
        $team->users()->sync([$student->id]);
        $team->courses()->sync([$course->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$course->id}/teams", ['team_ids' => [$team->id]])
            ->assertOk();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/users/{$student->id}/courses", [
                'course_ids' => [$direct->id],
                'is_mandatory' => false,
            ])
            ->assertOk();

        $this->assertDatabaseHas('course_user', [
            'user_id' => $student->id,
            'course_id' => $course->id,
            'assignment_source' => 'team',
        ]);
        $this->assertDatabaseHas('course_user', [
            'user_id' => $student->id,
            'course_id' => $direct->id,
            'assignment_source' => 'direct',
        ]);
    }

    public function test_detaching_a_direct_assign_demotes_to_team_when_user_still_in_linked_team(): void
    {
        [$admin, $course, $team, $student] = $this->setupCourseTeamAndStudents();
        $team->users()->sync([$student->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$course->id}/teams", ['team_ids' => [$team->id]])
            ->assertOk();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/courses/{$course->id}/learners", [
                'user_ids' => [$student->id],
                'is_mandatory' => false,
            ])
            ->assertOk();

        $this->assertDatabaseHas('course_user', [
            'user_id' => $student->id,
            'course_id' => $course->id,
            'assignment_source' => 'direct',
        ]);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/admin/courses/{$course->id}/learners/{$student->id}")
            ->assertOk();

        $this->assertDatabaseHas('course_user', [
            'user_id' => $student->id,
            'course_id' => $course->id,
            'assignment_source' => 'team',
        ]);
    }

    public function test_creating_a_student_in_a_team_enrolls_team_courses(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $course = Course::factory()->published()->create();
        $team = Team::create([
            'name' => 'Echipa Alpha',
            'owner_id' => $admin->id,
        ]);
        $team->courses()->sync([$course->id]);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/users', [
                'name' => 'Elev Nou',
                'email' => 'elev.nou@example.test',
                'role' => 'student',
                'team_id' => $team->id,
            ])
            ->assertCreated();

        $userId = $response->json('user.id');
        $this->assertDatabaseHas('course_user', [
            'user_id' => $userId,
            'course_id' => $course->id,
            'assignment_source' => 'team',
        ]);
    }

    /**
     * @return array{0: User, 1: Course, 2: Team, 3: User, 4?: User}
     */
    private function setupCourseTeamAndStudents(): array
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $course = Course::factory()->published()->create();
        $team = Team::create([
            'name' => 'Echipa Test',
            'owner_id' => $admin->id,
        ]);
        $student = User::factory()->create(['role' => 'student']);
        $instructor = User::factory()->create(['role' => 'instructor']);

        return [$admin, $course, $team, $student, $instructor];
    }
}
