<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Lesson;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ExtractInlineImagesTest extends TestCase
{
    use RefreshDatabase;

    private function pngBase64(): string
    {
        return base64_encode(UploadedFile::fake()->image('p.png', 40, 30)->getContent());
    }

    public function test_inline_images_in_html_and_json_become_shared_files(): void
    {
        $course = Course::factory()->create();
        $png = $this->pngBase64();
        $lesson = Lesson::create([
            'course_id' => $course->id, 'title' => 'L', 'order' => 1,
            'content' => '<p>a</p><img src="data:image/png;base64,' . $png . '"><img src="data:image/png;base64,' . $png . '">',
        ]);
        $questionId = DB::table('questions')->insertGetId([
            'type' => 'single_choice', 'content' => 'Q', 'points' => 1, 'order' => 1,
            'answers' => json_encode([['text' => '<img src="data:image/png;base64,' . $png . '">', 'is_correct' => true]]),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->artisan('volta:extract-inline-images', ['--dry-run' => true])->assertSuccessful();
        $this->assertStringContainsString('data:image', $lesson->fresh()->content);

        $this->artisan('volta:extract-inline-images')->assertSuccessful();

        $content = $lesson->fresh()->content;
        $this->assertStringNotContainsString('data:image', $content);
        preg_match_all('#src="(/storage/content/images/[^"]+)"#', $content, $m);
        $this->assertCount(2, $m[1]);
        $this->assertSame($m[1][0], $m[1][1]);
        Storage::disk('public')->assertExists(substr($m[1][0], strlen('/storage/')));

        $answers = json_decode(DB::table('questions')->where('id', $questionId)->value('answers'), true);
        $this->assertSame('<img src="' . $m[1][0] . '">', $answers[0]['text']);
        $this->assertCount(1, Storage::disk('public')->files('content/images'));
    }

    public function test_content_image_upload_returns_a_storage_url(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $url = $this->actingAs($admin, 'sanctum')
            ->post('/api/admin/content-images', ['file' => UploadedFile::fake()->image('a.png', 300, 200)], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('url');

        $this->assertStringStartsWith('/storage/content/images/', $url);
        Storage::disk('public')->assertExists(substr($url, strlen('/storage/')));
    }
}
