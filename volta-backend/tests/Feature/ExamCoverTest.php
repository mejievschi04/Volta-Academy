<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ExamCoverTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_sets_exam_cover_that_students_see_in_monthly_tests(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'student']);
        $exam = Exam::create([
            'title' => 'Test lunar',
            'status' => 'published',
            'course_id' => null,
            'settings' => ['access_mode' => 'all_students'],
        ]);

        $url = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/exams/{$exam->id}/cover", [
                'cover' => UploadedFile::fake()->image('cover.png', 1200, 675),
            ])
            ->assertOk()
            ->json('cover_image_url');

        $path = $exam->fresh()->cover_image_path;
        $this->assertStringStartsWith('exam-covers/', $path);
        $this->assertSame('/storage/' . $path, $url);
        Storage::disk('public')->assertExists($path);

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/exams')
            ->assertOk()
            ->assertJsonPath('data.0.cover_image_url', $url);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/admin/exams/{$exam->id}/cover")
            ->assertOk();
        $this->assertNull($exam->fresh()->cover_image_path);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_analyst_cannot_change_exam_cover(): void
    {
        $analyst = User::factory()->create(['role' => 'analyst']);
        $exam = Exam::create(['title' => 'Test lunar', 'status' => 'draft', 'course_id' => null]);

        $this->actingAs($analyst, 'sanctum')
            ->postJson("/api/admin/exams/{$exam->id}/cover", [
                'cover' => UploadedFile::fake()->image('cover.png', 400, 300),
            ])
            ->assertForbidden();
        $this->assertNull($exam->fresh()->cover_image_path);
    }
}
