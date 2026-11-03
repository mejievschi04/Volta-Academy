<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseMap;
use App\Models\User;
use App\Support\CourseMapBuckets;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Mapa implicită „Cursuri fara mapa” e una singură, indiferent ce admin creează cursul.
 */
class DefaultCourseMapTest extends TestCase
{
    use RefreshDatabase;

    public function test_courses_from_different_admins_share_one_default_map(): void
    {
        $first = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $second = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        CourseMapBuckets::attachCourseToDefaultMap(Course::factory()->create(), $first->id);
        CourseMapBuckets::attachCourseToDefaultMap(Course::factory()->create(), $second->id);

        $this->assertSame(1, CourseMap::where('name', CourseMapBuckets::DEFAULT_MAP_NAME)->count());
        $this->assertSame(2, CourseMapBuckets::defaultMapRecord()->courses()->count());
    }

    public function test_migration_merges_existing_duplicates_into_the_oldest(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $keep = CourseMap::create(['name' => CourseMapBuckets::DEFAULT_MAP_NAME, 'created_by' => $admin->id, 'order' => 0]);
        $dup = CourseMap::create(['name' => CourseMapBuckets::DEFAULT_MAP_NAME, 'created_by' => $admin->id, 'order' => 0, 'cover_image_path' => 'course-map-covers/cip.webp']);
        $other = CourseMap::create(['name' => 'Produse', 'created_by' => $admin->id, 'order' => 1]);
        [$a, $b, $c] = Course::factory()->count(3)->create()->all();
        DB::table('course_map_course')->insert([
            ['course_map_id' => $keep->id, 'course_id' => $a->id, 'order' => 0],
            ['course_map_id' => $dup->id, 'course_id' => $a->id, 'order' => 0],
            ['course_map_id' => $dup->id, 'course_id' => $b->id, 'order' => 1],
            ['course_map_id' => $other->id, 'course_id' => $c->id, 'order' => 0],
        ]);

        (require database_path('migrations/2026_11_04_100000_merge_duplicate_default_course_maps.php'))->up();

        $this->assertNull(CourseMap::find($dup->id));
        $this->assertEqualsCanonicalizing([$a->id, $b->id], $keep->fresh()->courses()->pluck('courses.id')->all());
        $this->assertSame('course-map-covers/cip.webp', $keep->fresh()->cover_image_path);
        $this->assertSame([$c->id], $other->fresh()->courses()->pluck('courses.id')->all());
    }
}
