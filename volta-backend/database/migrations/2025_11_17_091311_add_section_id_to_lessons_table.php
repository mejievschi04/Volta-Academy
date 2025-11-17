<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            $table->foreignId('section_id')->nullable()->after('course_id')->constrained('sections')->onDelete('cascade');
            $table->text('video_url')->nullable()->after('content');
            $table->text('resources')->nullable()->after('video_url'); // JSON array pentru documente, link-uri, etc.
            $table->integer('duration_minutes')->nullable()->after('resources');
            $table->boolean('is_preview')->default(false)->after('order'); // Lecție gratuită de preview
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            $table->dropForeign(['section_id']);
            $table->dropColumn(['section_id', 'video_url', 'resources', 'duration_minutes', 'is_preview']);
        });
    }
};
