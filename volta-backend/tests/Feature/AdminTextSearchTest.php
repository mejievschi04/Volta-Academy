<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseMap;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Căutările din admin găsesc textul indiferent de majuscule și diacritice
 * (pe PostgreSQL `like` simplu nu găsea „Produse” după „prod”).
 */
class AdminTextSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_map_search_ignores_case_and_diacritics(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        CourseMap::create(['name' => 'Produse noi', 'created_by' => $admin->id]);
        CourseMap::create(['name' => 'Tehnici de vânzări', 'created_by' => $admin->id]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/course-maps?search=PROD')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Produse noi'])
            ->assertJsonMissing(['name' => 'Tehnici de vânzări']);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/course-maps?search=vanzari')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Tehnici de vânzări']);
    }

    public function test_course_detail_sends_structure_without_lesson_content(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $course = Course::factory()->create();
        $module = \App\Models\Module::create(['course_id' => $course->id, 'title' => 'M', 'order' => 1]);
        \App\Models\Lesson::create([
            'course_id' => $course->id, 'module_id' => $module->id, 'title' => 'L', 'order' => 1,
            'content' => '<p>'.str_repeat('text lung ', 1000).'</p>',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson("/api/admin/courses/{$course->id}")
            ->assertOk()
            ->assertJsonPath('modules_count', 1)
            ->assertJsonPath('lessons_count', 1)
            ->assertJsonPath('modules.0.lessons.0.title', 'L');

        $this->assertArrayNotHasKey('content', $response->json('modules.0.lessons.0'));
    }

    public function test_course_search_ignores_diacritics(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Course::factory()->published()->create(['title' => 'Siguranța la lucru']);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/courses?search=siguranta&status=all')
            ->assertOk()
            ->assertJsonFragment(['title' => 'Siguranța la lucru']);
    }
}
