<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Test;
use App\Models\CourseTest;
use App\Models\Module;
use PHPUnit\Framework\Attributes\Test as TestAttribute;

class CourseTestAssignmentTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $student;
    protected Course $course;
    protected Test $test;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create admin user
        $this->admin = User::factory()->create([
            'role' => 'admin',
            'email' => 'admin@test.com',
        ]);

        // Create student user
        $this->student = User::factory()->create([
            'role' => 'student',
            'email' => 'student@test.com',
        ]);

        // Create course
        $this->course = Course::factory()->create([
            'title' => 'Test Course',
            'status' => 'published',
        ]);

        // Create test
        $this->test = Test::factory()->create([
            'title' => 'Test Final',
            'status' => 'published',
        ]);
    }

    #[TestAttribute]
    public function it_can_assign_required_test_to_course()
    {
        // Assign required test to course
        $courseTest = CourseTest::create([
            'course_id' => $this->course->id,
            'test_id' => $this->test->id,
            'scope' => 'course',
            'required' => true,
            'passing_score' => 70,
            'order' => 1,
        ]);

        $this->assertDatabaseHas('course_test', [
            'course_id' => $this->course->id,
            'test_id' => $this->test->id,
            'required' => true,
        ]);

        // Verify course has required test
        $this->assertTrue(
            CourseTest::where('course_id', $this->course->id)
                ->where('required', true)
                ->exists()
        );
    }

    #[TestAttribute]
    public function it_can_assign_optional_test_to_course()
    {
        // Assign optional test to course
        $courseTest = CourseTest::create([
            'course_id' => $this->course->id,
            'test_id' => $this->test->id,
            'scope' => 'course',
            'required' => false,
            'passing_score' => 60,
            'order' => 1,
        ]);

        $this->assertDatabaseHas('course_test', [
            'course_id' => $this->course->id,
            'test_id' => $this->test->id,
            'required' => false,
        ]);
    }

    #[TestAttribute]
    public function it_can_assign_test_to_module()
    {
        // Create module
        $module = Module::factory()->create([
            'course_id' => $this->course->id,
            'title' => 'Module 1',
        ]);

        // Assign test to module
        $courseTest = CourseTest::create([
            'course_id' => $this->course->id,
            'test_id' => $this->test->id,
            'scope' => 'module',
            'scope_id' => $module->id,
            'required' => true,
            'passing_score' => 70,
            'order' => 1,
        ]);

        $this->assertDatabaseHas('course_test', [
            'course_id' => $this->course->id,
            'test_id' => $this->test->id,
            'scope' => 'module',
            'scope_id' => $module->id,
            'required' => true,
        ]);
    }

    #[TestAttribute]
    public function it_prevents_assigning_mandatory_course_without_required_test()
    {
        // Create course without required test
        $courseWithoutTest = Course::factory()->create([
            'title' => 'Course Without Test',
            'status' => 'published',
        ]);

        // Try to assign course as mandatory to student
        $response = $this->actingAs($this->admin)->postJson(
            "/api/admin/users/{$this->student->id}/courses",
            [
                'course_ids' => [$courseWithoutTest->id],
                'is_mandatory' => true,
            ]
        );

        $response->assertStatus(422);
        $response->assertJson([
            'error' => 'Cursurile obligatorii trebuie să aibă cel puțin un test obligatoriu',
        ]);
    }

    #[TestAttribute]
    public function it_allows_assigning_mandatory_course_with_required_test()
    {
        // Assign required test to course
        CourseTest::create([
            'course_id' => $this->course->id,
            'test_id' => $this->test->id,
            'scope' => 'course',
            'required' => true,
            'passing_score' => 70,
            'order' => 1,
        ]);

        // Assign course as mandatory to student
        $response = $this->actingAs($this->admin)->postJson(
            "/api/admin/users/{$this->student->id}/courses",
            [
                'course_ids' => [$this->course->id],
                'is_mandatory' => true,
            ]
        );

        $response->assertStatus(200);
        $response->assertJson([
            'message' => 'Cursuri atribuite cu succes',
        ]);

        // Verify assignment
        $this->assertDatabaseHas('course_user', [
            'course_id' => $this->course->id,
            'user_id' => $this->student->id,
            'is_mandatory' => true,
        ]);
    }

    #[TestAttribute]
    public function it_allows_assigning_optional_course_without_required_test()
    {
        // Create course without required test
        $courseWithoutTest = Course::factory()->create([
            'title' => 'Course Without Test',
            'status' => 'published',
        ]);

        // Assign course as optional to student
        $response = $this->actingAs($this->admin)->postJson(
            "/api/admin/users/{$this->student->id}/courses",
            [
                'course_ids' => [$courseWithoutTest->id],
                'is_mandatory' => false,
            ]
        );

        $response->assertStatus(200);
        $response->assertJson([
            'message' => 'Cursuri atribuite cu succes',
        ]);

        // Verify assignment
        $this->assertDatabaseHas('course_user', [
            'course_id' => $courseWithoutTest->id,
            'user_id' => $this->student->id,
            'is_mandatory' => false,
        ]);
    }

    #[TestAttribute]
    public function it_can_have_multiple_tests_assigned_to_course()
    {
        // Create additional test
        $test2 = Test::factory()->create([
            'title' => 'Test 2',
            'status' => 'published',
        ]);

        // Assign first test (required)
        CourseTest::create([
            'course_id' => $this->course->id,
            'test_id' => $this->test->id,
            'scope' => 'course',
            'required' => true,
            'passing_score' => 70,
            'order' => 1,
        ]);

        // Assign second test (optional)
        CourseTest::create([
            'course_id' => $this->course->id,
            'test_id' => $test2->id,
            'scope' => 'course',
            'required' => false,
            'passing_score' => 60,
            'order' => 2,
        ]);

        // Verify both tests are assigned
        $this->assertEquals(2, CourseTest::where('course_id', $this->course->id)->count());
        $this->assertEquals(1, CourseTest::where('course_id', $this->course->id)
            ->where('required', true)
            ->count());
    }

    #[TestAttribute]
    public function it_validates_required_test_exists_when_assigning_multiple_courses()
    {
        // Create second course without required test
        $course2 = Course::factory()->create([
            'title' => 'Course 2 Without Test',
            'status' => 'published',
        ]);

        // Assign required test to first course
        CourseTest::create([
            'course_id' => $this->course->id,
            'test_id' => $this->test->id,
            'scope' => 'course',
            'required' => true,
            'passing_score' => 70,
            'order' => 1,
        ]);

        // Try to assign both courses as mandatory
        $response = $this->actingAs($this->admin)->postJson(
            "/api/admin/users/{$this->student->id}/courses",
            [
                'course_ids' => [$this->course->id, $course2->id],
                'is_mandatory' => true,
            ]
        );

        $response->assertStatus(422);
        $response->assertJsonStructure([
            'error',
            'message',
            'courses',
        ]);

        // Verify that no courses were assigned
        $this->assertDatabaseMissing('course_user', [
            'user_id' => $this->student->id,
        ]);
    }
}
