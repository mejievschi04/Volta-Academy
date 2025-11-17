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
    Schema::create('lessons', function (Blueprint $table) {
        $table->id();
        $table->foreignId('course_id')->constrained('courses')->onDelete('cascade');
        $table->foreignId('section_id')->nullable()->constrained('sections')->onDelete('cascade');
        $table->string('title');
        $table->text('content');
        $table->text('video_url')->nullable();
        $table->text('resources')->nullable(); // JSON array pentru documente, link-uri, etc.
        $table->integer('duration_minutes')->nullable();
        $table->integer('order')->default(1);
        $table->boolean('is_preview')->default(false); // Lecție gratuită de preview
        $table->timestamps();
    });
}


    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lessons');
    }
};
