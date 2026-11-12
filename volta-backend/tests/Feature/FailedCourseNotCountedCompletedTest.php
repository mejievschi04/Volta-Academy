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
}
