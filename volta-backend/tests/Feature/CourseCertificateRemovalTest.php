<?php

namespace Tests\Feature;

use App\Models\Course;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Certificatul la finalizare a fost scos; pragul și reluările testelor rămân, sub „assessment”.
 */
class CourseCertificateRemovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_certificate_column_is_gone(): void
    {
        $this->assertFalse(Schema::hasColumn('courses', 'has_certificate'));
    }

    public function test_migration_moves_test_settings_out_of_certificate(): void
    {
        $course = Course::factory()->create();
        DB::table('courses')->where('id', $course->id)->update(['settings' => json_encode([
            'certificate' => ['enabled' => true, 'min_score' => 85, 'allow_retake' => false, 'max_retakes' => 1],
        ])]);

        (require database_path('migrations/2026_11_04_120000_remove_course_certificates.php'))->up();

        $stored = json_decode(DB::table('courses')->where('id', $course->id)->value('settings'), true);
        $this->assertArrayNotHasKey('certificate', $stored);
        $this->assertSame(['min_score' => 85, 'allow_retake' => false, 'max_retakes' => 1], $stored['assessment']);
    }

    public function test_legacy_settings_are_read_as_assessment_without_certificate(): void
    {
        $course = Course::factory()->create();
        DB::table('courses')->where('id', $course->id)->update(['settings' => json_encode([
            'certificate' => ['enabled' => true, 'min_score' => 90],
        ])]);

        $settings = $course->fresh()->settings;
        $this->assertArrayNotHasKey('certificate', $settings);
        $this->assertSame(90, $settings['assessment']['min_score']);
        $this->assertArrayNotHasKey('enabled', $settings['assessment']);
    }
}
