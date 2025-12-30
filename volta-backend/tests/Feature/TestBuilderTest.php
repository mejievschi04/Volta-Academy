<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use App\Models\User;
use App\Models\Test;
use App\Models\Question;
use App\Models\Course;
use App\Services\TestBuilderService;
use PHPUnit\Framework\Attributes\Test as TestAttribute;

class TestBuilderTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected TestBuilderService $testBuilderService;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create admin user
        $this->admin = User::factory()->create([
            'role' => 'admin',
            'email' => 'admin@test.com',
        ]);

        $this->testBuilderService = app(TestBuilderService::class);
    }

    #[TestAttribute]
    public function it_can_create_a_test_in_draft_mode()
    {
        $testData = [
            'title' => 'Test Title',
            'description' => 'Test Description',
            'type' => 'graded',
            'status' => 'draft',
            'questions' => [
                [
                    'type' => 'multiple_choice',
                    'content' => 'What is 2+2?',
                    'answers' => [
                        ['text' => '3', 'is_correct' => false],
                        ['text' => '4', 'is_correct' => true],
                        ['text' => '5', 'is_correct' => false],
                    ],
                    'points' => 10,
                ],
            ],
        ];

        $test = $this->testBuilderService->createTest($testData, $this->admin);

        $this->assertDatabaseHas('tests', [
            'id' => $test->id,
            'title' => 'Test Title',
            'status' => 'draft',
        ]);

        $this->assertEquals(1, $test->questions()->count());
    }

    #[TestAttribute]
    public function it_cannot_publish_test_without_questions()
    {
        $test = Test::factory()->create([
            'status' => 'draft',
            'question_source' => 'direct',
            'created_by' => $this->admin->id,
        ]);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Cannot publish test without questions');

        $this->testBuilderService->publishTest($test);
    }

    #[TestAttribute]
    public function it_can_publish_test_with_questions()
    {
        $test = Test::factory()->create([
            'status' => 'draft',
            'question_source' => 'direct',
            'created_by' => $this->admin->id,
        ]);

        Question::factory()->create([
            'test_id' => $test->id,
            'type' => 'multiple_choice',
            'content' => 'Test Question',
            'answers' => [],
            'points' => 10,
        ]);

        $publishedTest = $this->testBuilderService->publishTest($test);

        $this->assertEquals('published', $publishedTest->status);
    }

    #[TestAttribute]
    public function it_cannot_delete_test_linked_to_course()
    {
        $test = Test::factory()->create([
            'status' => 'published',
            'created_by' => $this->admin->id,
        ]);

        $course = Course::factory()->create();

        // Link test to course
        \DB::table('course_test')->insert([
            'course_id' => $course->id,
            'test_id' => $test->id,
            'scope' => 'course',
            'required' => true,
            'passing_score' => 70,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Cannot delete test that is linked to courses');

        $this->testBuilderService->deleteTest($test);
    }

    #[TestAttribute]
    public function it_can_delete_unlinked_test()
    {
        $test = Test::factory()->create([
            'status' => 'draft',
            'created_by' => $this->admin->id,
        ]);

        $this->testBuilderService->deleteTest($test);

        $this->assertSoftDeleted('tests', ['id' => $test->id]);
    }

    #[TestAttribute]
    public function it_cannot_modify_questions_of_published_linked_test()
    {
        $test = Test::factory()->create([
            'status' => 'published',
            'question_source' => 'direct',
            'created_by' => $this->admin->id,
        ]);

        $question = Question::factory()->create([
            'test_id' => $test->id,
            'type' => 'multiple_choice',
            'content' => 'Original Question',
            'points' => 10,
        ]);

        $course = Course::factory()->create();

        // Link test to course
        \DB::table('course_test')->insert([
            'course_id' => $course->id,
            'test_id' => $test->id,
            'scope' => 'course',
            'required' => true,
            'passing_score' => 70,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Cannot modify questions of a published test that is linked to courses');

        $this->testBuilderService->updateQuestion($question, [
            'content' => 'Modified Question',
        ]);
    }

    #[TestAttribute]
    public function it_can_create_test_version()
    {
        $originalTest = Test::factory()->create([
            'title' => 'Original Test',
            'version' => '1.0.0',
            'status' => 'published',
            'question_source' => 'direct',
            'created_by' => $this->admin->id,
        ]);

        Question::factory()->create([
            'test_id' => $originalTest->id,
            'type' => 'multiple_choice',
            'content' => 'Question 1',
            'points' => 10,
        ]);

        $newVersion = $this->testBuilderService->createTestVersion($originalTest, $this->admin);

        $this->assertNotEquals($originalTest->id, $newVersion->id);
        $this->assertEquals('1.0.1', $newVersion->version);
        $this->assertEquals('draft', $newVersion->status);
        $this->assertStringContainsString('Original Test', $newVersion->title);
        $this->assertEquals(1, $newVersion->questions()->count());
    }
}

