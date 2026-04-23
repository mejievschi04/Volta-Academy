<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseTest;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\QuestionBank;
use App\Models\Test;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourseAndQuestionBankTest extends TestCase
{
    use RefreshDatabase;

    public function test_course_show_includes_modules_lessons_and_linked_tests(): void
    {
        $course = Course::withoutEvents(function () {
            return Course::factory()->create([
                'title' => 'Laravel Basics',
                'status' => 'published',
            ]);
        });

        $module = Module::withoutEvents(function () use ($course) {
            return Module::create([
                'course_id' => $course->id,
                'title' => 'Introducere',
                'description' => 'Primii pași',
                'order' => 1,
                'status' => 'published',
            ]);
        });

        Lesson::withoutEvents(function () use ($course, $module) {
            return Lesson::create([
                'course_id' => $course->id,
                'module_id' => $module->id,
                'title' => 'Ce este Laravel',
                'content' => '<p>Laravel este un framework PHP.</p>',
                'type' => 'text',
                'status' => 'published',
                'order' => 1,
            ]);
        });

        $test = Test::withoutEvents(function () {
            return Test::factory()->published()->create([
                'title' => 'Quiz introductiv',
                'question_source' => 'direct',
            ]);
        });

        CourseTest::create([
            'course_id' => $course->id,
            'test_id' => $test->id,
            'scope' => 'course',
            'scope_id' => null,
            'required' => true,
            'passing_score' => 70,
            'order' => 1,
        ]);

        $response = $this->getJson("/api/courses/{$course->id}");

        $response->assertOk()
            ->assertJsonPath('title', 'Laravel Basics')
            ->assertJsonPath('modules.0.title', 'Introducere')
            ->assertJsonPath('modules.0.lessons.0.title', 'Ce este Laravel')
            ->assertJsonPath('exams.0.title', 'Quiz introductiv');
    }

    public function test_admin_can_create_question_bank_and_add_questions(): void
    {
        $admin = User::factory()->create([
            'name' => 'Admin User',
            'email' => 'admin.question-bank@example.com',
            'role' => 'admin',
        ]);

        $createResponse = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/question-banks', [
            'title' => 'Bancă PHP',
            'description' => 'Întrebări despre PHP',
            'status' => 'draft',
            'tags' => ['PHP', 'Backend'],
        ]);

        $createResponse->assertCreated()
            ->assertJsonPath('bank.title', 'Bancă PHP');

        $bankId = $createResponse->json('bank.id');

        $this->assertDatabaseHas('question_banks', [
            'id' => $bankId,
            'title' => 'Bancă PHP',
            'created_by' => $admin->id,
        ]);

        $addResponse = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/question-banks/{$bankId}/questions", [
            'type' => 'multiple_choice',
            'content' => 'Care este framework-ul folosit în exemplu?',
            'answers' => [
                ['text' => 'Laravel', 'is_correct' => true],
                ['text' => 'React', 'is_correct' => false],
                ['text' => 'Vue', 'is_correct' => false],
                ['text' => 'Angular', 'is_correct' => false],
            ],
            'points' => 2,
            'order' => 1,
            'explanation' => 'Laravel este framework-ul PHP menționat în întrebare.',
        ]);

        $addResponse->assertOk()
            ->assertJsonPath('bank.questions.0.content', 'Care este framework-ul folosit în exemplu?');

        $this->assertDatabaseHas('questions', [
            'question_bank_id' => $bankId,
            'type' => 'multiple_choice',
            'content' => 'Care este framework-ul folosit în exemplu?',
            'points' => 2,
        ]);
    }

    public function test_admin_cannot_add_unsupported_questions_to_bank(): void
    {
        $admin = User::factory()->create([
            'name' => 'Admin User',
            'email' => 'admin.question-bank-long-answer@example.com',
            'role' => 'admin',
        ]);

        $bank = QuestionBank::create([
            'title' => 'Bancă restricționată',
            'description' => 'Nu mai acceptă tipuri nepermise',
            'status' => 'draft',
            'created_by' => $admin->id,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/question-banks/{$bank->id}/questions", [
            'type' => 'unsupported_type',
            'content' => 'Ce tip de întrebare nu este acceptat?',
            'answers' => [
                ['text' => 'Răspuns liber', 'is_correct' => true],
            ],
            'points' => 1,
            'order' => 1,
        ]);

        $response->assertStatus(422);

        $this->assertDatabaseMissing('questions', [
            'question_bank_id' => $bank->id,
            'type' => 'unsupported_type',
        ]);
    }
}
