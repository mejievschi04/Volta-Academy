<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use ZipArchive;

class EventAttendanceReportTest extends TestCase
{
    use RefreshDatabase;

    private function event(string $title, string $date, string $status = 'completed'): Event
    {
        return Event::create([
            'title' => $title,
            'description' => 'x',
            'type' => 'physical',
            'status' => $status,
            'start_date' => "{$date} 10:00:00",
            'end_date' => "{$date} 12:00:00",
            'access_type' => 'free',
            'audience_type' => 'all',
        ]);
    }

    private function attend(Event $event, User $user, bool $attended = true): void
    {
        DB::table('event_user')->insert([
            'event_id' => $event->id, 'user_id' => $user->id,
            'registered' => true, 'attended' => $attended,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    /** @return string XML-ul foii din fișierul descărcat */
    private function downloadSheet(User $as, int $year): string
    {
        $response = $this->actingAs($as)->get("/api/admin/events/attendance-report?year={$year}");
        $response->assertOk();
        $this->assertStringContainsString("Prezenta_evenimente_{$year}.xlsx", (string) $response->headers->get('content-disposition'));

        $path = $response->baseResponse->getFile()->getPathname();
        $zip = new ZipArchive();
        $this->assertTrue($zip->open($path) === true, 'fișierul descărcat nu e un .xlsx valid');
        $sheet = $zip->getFromName('xl/worksheets/sheet1.xml');
        $this->assertNotFalse($zip->getFromName('xl/styles.xml'));
        $zip->close();

        return $sheet;
    }

    public function test_report_marks_attendance_in_green_grouped_by_team(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active', 'name' => 'Admin']);
        $team = Team::create(['name' => 'VOLTA 1', 'owner_id' => $admin->id]);
        $ana = User::factory()->create(['role' => 'student', 'status' => 'active', 'name' => 'Ana Pop']);
        $ion = User::factory()->create(['role' => 'student', 'status' => 'active', 'name' => 'Ion Rusu']);
        $ana->teams()->attach($team);
        $ion->teams()->attach($team);

        $training = $this->event('Bun venit la VOLTA', '2026-03-10');
        $products = $this->event('Panouri fotovoltaice', '2026-05-02');
        $this->event('Draft ascuns', '2026-06-01', 'draft');
        $this->event('Anul trecut', '2025-06-01');
        $this->attend($training, $ana);
        $this->attend($products, $ion, attended: false); // înscris, dar nu prezent

        $sheet = $this->downloadSheet($admin, 2026);

        $this->assertStringContainsString('VOLTA 1', $sheet);
        $this->assertStringContainsString('Ana Pop', $sheet);
        $this->assertStringContainsString('Ion Rusu', $sheet);
        $this->assertStringContainsString('Bun venit la VOLTA', $sheet);
        $this->assertStringContainsString('Panouri fotovoltaice', $sheet);
        $this->assertStringNotContainsString('Draft ascuns', $sheet);
        $this->assertStringNotContainsString('Anul trecut', $sheet);
        // adminul fără echipă și fără participări nu apare
        $this->assertStringNotContainsString('>Admin<', $sheet);

        // Ana (primul rând de date, rândul 5) e verde la primul eveniment (coloana C); Ion nu e verde nicăieri
        $this->assertMatchesRegularExpression('/<c r="C5" s="5"/', $sheet);
        $this->assertSame(1, preg_match_all('/s="5"/', $sheet));
    }

    public function test_only_admins_and_analysts_can_download(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $this->actingAs($student)->get('/api/admin/events/attendance-report')->assertForbidden();

        $analyst = User::factory()->create(['role' => 'analyst', 'status' => 'active']);
        $this->actingAs($analyst)->get('/api/admin/events/attendance-report?year=2026')->assertOk();
    }
}
