<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseMap;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CoverThumbnailTest extends TestCase
{
    use RefreshDatabase;

    public function test_saving_a_cover_creates_a_small_thumbnail_next_to_it(): void
    {
        $path = UploadedFile::fake()->image('cover.png', 1600, 900)->store('courses', 'public');
        $course = Course::factory()->create(['image' => $path]);

        $thumb = preg_replace('/\.png$/', '.thumb.webp', $course->image);
        Storage::disk('public')->assertExists($thumb);
        [$width, $height] = getimagesize(Storage::disk('public')->path($thumb));
        $this->assertSame([640, 360], [$width, $height]);
    }

    public function test_command_fills_in_missing_thumbnails_for_existing_covers(): void
    {
        $map = CourseMap::create(['name' => 'Mapa']);
        $path = UploadedFile::fake()->image('map.jpg', 300, 200)->store('course-map-covers', 'public');
        // coperta pusă direct în bază (ex. date vechi), fără evenimentul de salvare
        CourseMap::whereKey($map->id)->update(['cover_image_path' => $path]);
        $thumb = preg_replace('/\.jpg$/', '.thumb.webp', $path);
        Storage::disk('public')->assertMissing($thumb);

        $this->artisan('volta:generate-thumbnails')->assertSuccessful();

        Storage::disk('public')->assertExists($thumb);
    }
}
