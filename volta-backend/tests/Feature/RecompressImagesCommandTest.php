<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseVersion;
use App\Models\CourseVersionSnapshot;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Lecțiile publicate se văd din snapshot_json, unde căile sunt salvate cu slash-uri escapate
 * (`content-blocks\/image\/x.png`). Transformarea în WebP trebuie să le găsească și acolo.
 */
class RecompressImagesCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Comanda parcurge tot discul public; în test îl ținem într-un folder temporar gol.
        Storage::fake('public');
    }

    private function snapshotWithImage(string $src): CourseVersionSnapshot
    {
        $course = Course::factory()->create();
        $version = CourseVersion::create(['course_id' => $course->id, 'version' => 1, 'status' => 'published']);

        return CourseVersionSnapshot::create([
            'course_version_id' => $version->id,
            'snapshot_json' => ['lessons' => [['id' => 334, 'content' => '<p><img src="'.$src.'"></p>']]],
        ]);
    }

    private function noisyPng(): string
    {
        $image = imagecreatetruecolor(1200, 800);
        for ($y = 0; $y < 800; $y += 4) {
            for ($x = 0; $x < 1200; $x += 4) {
                imagefilledrectangle($image, $x, $y, $x + 3, $y + 3, imagecolorallocate($image, random_int(0, 255), random_int(0, 255), random_int(0, 255)));
            }
        }
        ob_start();
        imagepng($image);
        imagedestroy($image);

        return (string) ob_get_clean();
    }

    public function test_recompress_updates_paths_inside_published_snapshots(): void
    {
        Storage::disk('public')->put('content-blocks/image/poza.png', $this->noisyPng());
        $snapshot = $this->snapshotWithImage('https://academy.volta.md/storage/content-blocks/image/poza.png');

        $this->artisan('volta:recompress-images')->assertSuccessful();

        Storage::disk('public')->assertMissing('content-blocks/image/poza.png');
        Storage::disk('public')->assertExists('content-blocks/image/poza.webp');
        $content = $snapshot->fresh()->snapshot_json['lessons'][0]['content'];
        $this->assertStringContainsString('/storage/content-blocks/image/poza.webp', $content);
    }

    public function test_repair_points_old_png_links_to_the_existing_webp(): void
    {
        Storage::disk('public')->put('content-blocks/image/veche.webp', 'webp');
        $snapshot = $this->snapshotWithImage('https://academy.volta.md/storage/content-blocks/image/veche.png');

        $this->artisan('volta:recompress-images', ['--repair' => true])->assertSuccessful();

        $content = $snapshot->fresh()->snapshot_json['lessons'][0]['content'];
        $this->assertSame('<p><img src="https://academy.volta.md/storage/content-blocks/image/veche.webp"></p>', $content);
    }

    public function test_repair_leaves_links_whose_original_file_still_exists(): void
    {
        Storage::disk('public')->put('content-blocks/image/ambele.webp', 'webp');
        Storage::disk('public')->put('content-blocks/image/ambele.png', 'png');
        $snapshot = $this->snapshotWithImage('/storage/content-blocks/image/ambele.png');

        $this->artisan('volta:recompress-images', ['--repair' => true])->assertSuccessful();

        $this->assertStringContainsString('ambele.png', $snapshot->fresh()->snapshot_json['lessons'][0]['content']);
    }
}
