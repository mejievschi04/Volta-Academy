<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\User;
use App\Support\CourseCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class StandaloneCourseCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_sees_only_published_courses_marked_for_catalog_outside_map(): void
    {
        if (! Schema::hasColumn('courses', 'settings')) {
            $this->markTestSkipped('courses.settings column is not available in the test database.');
        }

        $student = User::factory()->create(['role' => 'student']);

        $catalogCourse = Course::factory()->published()->create([
            'title' => 'Catalog Direct',
        ]);
        CourseCatalog::applyOutsideMapFlag($catalogCourse, true);

        Course::factory()->published()->create([
            'title' => 'Doar in mapa',
        ]);

        Course::factory()->create([
            'title' => 'Draft catalog',
            'status' => 'draft',
        ]);
        CourseCatalog::applyOutsideMapFlag(
            Course::where('title', 'Draft catalog')->first(),
            true
        );

        $response = $this->actingAs($student)->getJson('/api/courses/standalone');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonFragment(['title' => 'Catalog Direct']);
        $response->assertJsonMissing(['title' => 'Doar in mapa']);
    }
}
