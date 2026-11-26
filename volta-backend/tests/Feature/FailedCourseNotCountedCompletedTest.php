<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Test;
use App\Models\TestResult;
use App\Models\User;
use App\Services\UserAssignedCoursesService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FailedCourseNotCountedCompletedTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_finished_course_with_a_failed_test_is_not_counted_as_completed(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $passedCourse = Course::factory()->published()->create(['title' => 'Curs promovat']);
        $failedCourse = Course::factory()->published()->create(['title' => 'Curs picat']);
        $service = app(UserAssignedCoursesService::class);
        $service->assignCourseDirectly($student, $passedCourse, []);
        $service->assignCourseDirectly($student, $failedCourse, []);

        DB::table('course_user')->where('user_id', $student->id)->update([
            'progress_percentage' => 100,
            'completed_at' => now(),
        ]);

        $failedTest = Test::factory()->published()->create(['created_by' => $student->id]);
        $failedCourse->tests()->attach($failedTest->id, ['scope' => 'course', 'required' => true]);
        TestResult::create([
            'test_id' => $failedTest->id,
            'course_id' => $failedCourse->id,
            'user_id' => $student->id,
            'score' => 5,
            'max_score' => 10,
            'percentage' => 50,
            'passed' => false,
            'attempt_number' => 1,
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        $student->unsetRelation('assignedCourses');
        $data = $service->buildProfileCoursesData($student->fresh());

        $this->assertSame(2, $data['course_stats']['total_assigned']);
        $this->assertSame(1, $data['course_stats']['completed']);
        $this->assertSame(1, $data['course_stats']['failed']);
        $this->assertSame($passedCourse->id, $data['courses_completed'][0]['id']);
        $this->assertSame($failedCourse->id, $data['courses_failed'][0]['id']);
        $this->assertSame('failed', $data['courses_failed'][0]['status']);
    }

    public function test_a_started_course_with_a_failed_test_is_not_in_progress(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $waiting = Course::factory()->published()->create(['title' => 'Test nedat']);
        $failed = Course::factory()->published()->create(['title' => 'Test picat']);
        $service = app(UserAssignedCoursesService::class);
        $service->assignCourseDirectly($student, $waiting, []);
        $service->assignCourseDirectly($student, $failed, []);

        DB::table('course_user')->where('user_id', $student->id)->update([
            'progress_percentage' => 90,
            'started_at' => now(),
            'completed_at' => null,
        ]);

        $failedTest = Test::factory()->published()->create(['created_by' => $student->id]);
        $failed->tests()->attach($failedTest->id, ['scope' => 'course', 'required' => true]);
        TestResult::create([
            'test_id' => $failedTest->id,
            'course_id' => $failed->id,
            'user_id' => $student->id,
            'score' => 2,
            'max_score' => 9,
            'percentage' => 23,
            'passed' => false,
            'attempt_number' => 1,
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        $student->unsetRelation('assignedCourses');
        $data = $service->buildProfileCoursesData($student->fresh());

        $this->assertSame(1, $data['course_stats']['in_progress']);
        $this->assertSame(1, $data['course_stats']['failed']);
        $this->assertSame($waiting->id, $data['courses_in_progress'][0]['id']);
        $this->assertSame($failed->id, $data['courses_failed'][0]['id']);
    }

    public function test_an_unpublished_course_is_left_out_of_the_user_statistics(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $published = Course::factory()->published()->create(['title' => 'Curs public']);
        $withdrawn = Course::factory()->create(['title' => 'Curs retras', 'status' => 'draft']);
        $service = app(UserAssignedCoursesService::class);
        $service->assignCourseDirectly($student, $published, []);
        $service->assignCourseDirectly($student, $withdrawn, []);

        $student->unsetRelation('assignedCourses');
        $data = $service->buildProfileCoursesData($student->fresh());

        $this->assertSame(1, $data['course_stats']['total_assigned']);
        $this->assertSame([$published->id], collect($data['courses_assigned'])->pluck('id')->all());
    }

    public function test_admin_profile_hides_unpublished_courses_from_the_count_and_the_list(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $visible = Course::factory()->published()->create(['title' => 'Curs public']);
        $withdrawn = Course::factory()->create(['title' => 'Curs retras', 'status' => 'draft']);
        $service = app(UserAssignedCoursesService::class);
        $service->assignCourseDirectly($student, $visible, []);
        $service->assignCourseDirectly($student, $withdrawn, []);

        DB::table('course_user')->where('user_id', $student->id)->update([
            'progress_percentage' => 90,
            'started_at' => now(),
        ]);

        $failedTest = Test::factory()->published()->create(['created_by' => $student->id]);
        $withdrawn->tests()->attach($failedTest->id, ['scope' => 'course', 'required' => true]);
        TestResult::create([
            'test_id' => $failedTest->id,
            'course_id' => $withdrawn->id,
            'user_id' => $student->id,
            'score' => 1,
            'max_score' => 9,
            'percentage' => 11,
            'passed' => false,
            'attempt_number' => 1,
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/users/'.$student->id)
            ->assertOk();

        $ids = collect($response->json('courses_assigned'))->pluck('id');
        $this->assertTrue($ids->contains($visible->id));
        $this->assertFalse($ids->contains($withdrawn->id));
        $this->assertSame(0, $response->json('course_stats.failed'));
        $this->assertSame(1, $response->json('course_stats.total_assigned'));
        $this->assertSame([], $response->json('courses_failed'));
    }

    public function test_a_started_course_shows_the_unfinished_test_as_in_progress(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $course = Course::factory()->published()->create([
            'settings' => ['deadline_at' => now()->addDays(3)->utc()->toIso8601String()],
        ]);
        $service = app(UserAssignedCoursesService::class);
        $service->assignCourseDirectly($student, $course, []);
        DB::table('course_user')->where('user_id', $student->id)->where('course_id', $course->id)->update([
            'progress_percentage' => 0,
            'started_at' => now(),
            'completed_at' => null,
        ]);
        $test = Test::factory()->published()->create(['created_by' => $student->id]);
        $course->tests()->attach($test->id, ['scope' => 'course', 'required' => true]);

        $student->unsetRelation('assignedCourses');
        $open = $service->buildProfileCoursesData($student->fresh());
        $this->assertSame('in_progress', $open['courses_in_progress'][0]['tests'][0]['status']);
        $this->assertNull($open['courses_in_progress'][0]['tests'][0]['percentage']);

        TestResult::create([
            'test_id' => $test->id,
            'course_id' => $course->id,
            'user_id' => $student->id,
            'score' => 0,
            'max_score' => 10,
            'percentage' => 0,
            'passed' => false,
            'attempt_number' => 1,
            'status' => 'in_progress',
            'started_at' => now(),
        ]);

        $student->unsetRelation('assignedCourses');
        $attempt = $service->buildProfileCoursesData($student->fresh());
        $this->assertSame('in_progress', $attempt['courses_in_progress'][0]['tests'][0]['status']);
        $this->assertNull($attempt['courses_in_progress'][0]['tests'][0]['percentage']);

        $course->update(['settings' => ['deadline_at' => now()->subDay()->utc()->toIso8601String()]]);
        $student->unsetRelation('assignedCourses');
        $late = $service->buildProfileCoursesData($student->fresh());
        $row = collect($late['courses_assigned'])->firstWhere('id', $course->id);
        $this->assertSame('not_started', $row['tests'][0]['status']);
    }
}
