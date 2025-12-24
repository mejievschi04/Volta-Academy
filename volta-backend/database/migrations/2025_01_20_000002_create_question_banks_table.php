<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Question banks allow reusable question sets across multiple tests
     */
    public function up(): void
    {
        Schema::create('question_banks', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('status', ['draft', 'published', 'archived'])->default('draft');
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
            $table->softDeletes();
            
            $table->index(['status', 'created_by']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('question_banks');
    }
};

