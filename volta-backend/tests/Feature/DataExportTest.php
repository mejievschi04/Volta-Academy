<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\Question;
use App\Models\Test;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DataExportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_export_runs_in_the_queue_and_the_file_can_be_imported_back(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $test = Test::factory()->create(['title' => 'Test exportat']);
        Question::factory()->create(['test_id' => $test->id, 'content' => 'Întrebare exportată']);
        $event = Event::create([
            'title' => 'Eveniment exportat', 'description' => 'd', 'type' => 'webinar', 'status' => 'published',
            'start_date' => now()->addDay(), 'end_date' => now()->addDays(2), 'access_type' => 'free',
        ]);
        $this->actingAs($admin, 'sanctum');

        $id = $this->postJson('/api/admin/export')->assertStatus(202)->json('id');
        $this->getJson("/api/admin/export/{$id}")->assertOk()->assertJsonPath('status', 'ready');

        $content = $this->get("/api/admin/export/{$id}/download")->assertOk()->streamedContent();
        $data = json_decode($content, true, flags: JSON_THROW_ON_ERROR);
        $this->assertSame(2, $data['format_version']);
        $this->assertSame(User::orderBy('id')->pluck('id')->all(), array_column($data['users'], 'id'));
        $this->assertSame('Întrebare exportată', $data['tests'][0]['questions'][0]['content']);

        Question::query()->delete();
        $test->forceDelete();
        $event->delete();
        $this->post('/api/admin/import', [
            'backup_file' => UploadedFile::fake()->createWithContent('backup.json', $content),
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertDatabaseHas('tests', ['id' => $test->id, 'title' => 'Test exportat']);
        $this->assertDatabaseHas('questions', ['content' => 'Întrebare exportată']);
        $this->assertDatabaseHas('events', ['id' => $event->id, 'title' => 'Eveniment exportat']);
    }

    public function test_export_request_returns_immediately_and_is_private_to_its_author(): void
    {
        Queue::fake();
        $admin = User::factory()->create(['role' => 'admin']);
        $otherAdmin = User::factory()->create(['role' => 'admin']);

        $id = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/export')
            ->assertStatus(202)->assertJsonPath('status', 'pending')->json('id');
        Queue::assertPushed(\App\Jobs\GenerateDataExportJob::class);

        $this->getJson("/api/admin/export/{$id}/download")->assertNotFound();
        $this->actingAs($otherAdmin, 'sanctum')->getJson("/api/admin/export/{$id}")->assertNotFound();
    }
}
