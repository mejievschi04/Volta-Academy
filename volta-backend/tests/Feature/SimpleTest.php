<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Test;
use App\Models\CourseTest;
use PHPUnit\Framework\Attributes\Test as TestAttribute;

/**
 * Test Simplu de Probă
 * Verifică funcționalitățile de bază ale sistemului
 */
class SimpleTest extends TestCase
{
    use RefreshDatabase;

    #[TestAttribute]
    public function test_database_connection()
    {
        // Verifică că baza de date funcționează
        $this->assertTrue(true);
    }

    #[TestAttribute]
    public function test_can_create_user()
    {
        $user = User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'role' => 'student',
        ]);

        $this->assertDatabaseHas('users', [
            'email' => 'test@example.com',
            'name' => 'Test User',
        ]);

        $this->assertEquals('student', $user->role);
    }

    #[TestAttribute]
    public function test_can_create_course()
    {
        $course = Course::factory()->create([
            'title' => 'Test Course',
            'status' => 'published',
        ]);

        $this->assertDatabaseHas('courses', [
            'title' => 'Test Course',
            'status' => 'published',
        ]);

        $this->assertNotNull($course->id);
    }

    #[TestAttribute]
    public function test_can_create_test()
    {
        $test = Test::factory()->create([
            'title' => 'Test Final',
            'status' => 'published',
        ]);

        $this->assertDatabaseHas('tests', [
            'title' => 'Test Final',
            'status' => 'published',
        ]);

        $this->assertNotNull($test->id);
    }

    #[TestAttribute]
    public function test_can_link_test_to_course()
    {
        $course = Course::factory()->create([
            'title' => 'Test Course',
            'status' => 'published',
        ]);

        $test = Test::factory()->create([
            'title' => 'Test Final',
            'status' => 'published',
        ]);

        $courseTest = CourseTest::create([
            'course_id' => $course->id,
            'test_id' => $test->id,
            'scope' => 'course',
            'required' => true,
            'passing_score' => 70,
            'order' => 1,
        ]);

        $this->assertDatabaseHas('course_test', [
            'course_id' => $course->id,
            'test_id' => $test->id,
            'required' => true,
        ]);

        // Verifică relația
        $this->assertEquals($course->id, $courseTest->course_id);
        $this->assertEquals($test->id, $courseTest->test_id);
        $this->assertTrue($courseTest->required);
    }

    #[TestAttribute]
    public function test_mandatory_course_must_have_required_test()
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'email' => 'admin@test.com',
        ]);

        $student = User::factory()->create([
            'role' => 'student',
            'email' => 'student@test.com',
        ]);

        // Curs fără test obligatoriu
        $courseWithoutTest = Course::factory()->create([
            'title' => 'Course Without Test',
            'status' => 'published',
        ]);

        // Încearcă să atribuie cursul ca obligatoriu
        $response = $this->actingAs($admin)->postJson(
            "/api/admin/users/{$student->id}/courses",
            [
                'course_ids' => [$courseWithoutTest->id],
                'is_mandatory' => true,
            ]
        );

        // Ar trebui să returneze eroare
        $response->assertStatus(422);
        $response->assertJson([
            'error' => 'Cursurile obligatorii trebuie să aibă cel puțin un test obligatoriu',
        ]);
    }

    #[TestAttribute]
    public function test_can_assign_mandatory_course_with_required_test()
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'email' => 'admin@test.com',
        ]);

        $student = User::factory()->create([
            'role' => 'student',
            'email' => 'student@test.com',
        ]);

        $course = Course::factory()->create([
            'title' => 'Test Course',
            'status' => 'published',
        ]);

        $test = Test::factory()->create([
            'title' => 'Test Final',
            'status' => 'published',
        ]);

        // Adaugă test obligatoriu la curs
        CourseTest::create([
            'course_id' => $course->id,
            'test_id' => $test->id,
            'scope' => 'course',
            'required' => true,
            'passing_score' => 70,
            'order' => 1,
        ]);

        // Atribuie cursul ca obligatoriu
        $response = $this->actingAs($admin)->postJson(
            "/api/admin/users/{$student->id}/courses",
            [
                'course_ids' => [$course->id],
                'is_mandatory' => true,
            ]
        );

        // Ar trebui să funcționeze
        $response->assertStatus(200);
        $response->assertJson([
            'message' => 'Cursuri atribuite cu succes',
        ]);

        // Verifică atribuirea
        $this->assertDatabaseHas('course_user', [
            'course_id' => $course->id,
            'user_id' => $student->id,
            'is_mandatory' => true,
        ]);
    }

    #[TestAttribute]
    public function test_can_assign_optional_course_without_required_test()
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'email' => 'admin@test.com',
        ]);

        $student = User::factory()->create([
            'role' => 'student',
            'email' => 'student@test.com',
        ]);

        // Curs fără test obligatoriu
        $courseWithoutTest = Course::factory()->create([
            'title' => 'Optional Course',
            'status' => 'published',
        ]);

        // Atribuie cursul ca opțional
        $response = $this->actingAs($admin)->postJson(
            "/api/admin/users/{$student->id}/courses",
            [
                'course_ids' => [$courseWithoutTest->id],
                'is_mandatory' => false,
            ]
        );

        // Ar trebui să funcționeze
        $response->assertStatus(200);

        // Verifică atribuirea
        $this->assertDatabaseHas('course_user', [
            'course_id' => $courseWithoutTest->id,
            'user_id' => $student->id,
            'is_mandatory' => false,
        ]);
    }
}
