<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Drop lesson_progress first (depends on lessons)
        Schema::dropIfExists('lesson_progress');
        
        // For SQLite, we can just drop the table directly
        // For MySQL, we need to handle foreign keys
        $driver = DB::getDriverName();
        
        if ($driver === 'mysql') {
        // Find and drop all foreign keys that reference lessons table
        if (Schema::hasTable('lessons')) {
                try {
            // Find all tables that have foreign keys referencing lessons
            $referencingTables = DB::select("
                SELECT TABLE_NAME, CONSTRAINT_NAME 
                FROM information_schema.KEY_COLUMN_USAGE 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND REFERENCED_TABLE_NAME = 'lessons'
            ");
            
            // Drop foreign keys from tables that reference lessons
            foreach ($referencingTables as $ref) {
                try {
                    DB::statement("ALTER TABLE `{$ref->TABLE_NAME}` DROP FOREIGN KEY `{$ref->CONSTRAINT_NAME}`");
                } catch (\Exception $e) {
                    // Foreign key might not exist or already dropped
                }
            }
            
            // Drop foreign keys from lessons table itself
            $foreignKeys = DB::select("
                SELECT CONSTRAINT_NAME 
                FROM information_schema.KEY_COLUMN_USAGE 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'lessons' 
                AND REFERENCED_TABLE_NAME IS NOT NULL
            ");
            
            foreach ($foreignKeys as $fk) {
                $constraintName = $fk->CONSTRAINT_NAME;
                try {
                    DB::statement("ALTER TABLE lessons DROP FOREIGN KEY `{$constraintName}`");
                } catch (\Exception $e) {
                    // Foreign key might not exist or already dropped
                        }
                    }
                } catch (\Exception $e) {
                    // If information_schema query fails, just try to drop the table
                }
            }
        }
        
        // Drop lessons table
        Schema::dropIfExists('lessons');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Recreate lessons table (simplified version)
        Schema::create('lessons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('courses')->onDelete('cascade');
            $table->foreignId('section_id')->nullable()->constrained('sections')->onDelete('cascade');
            $table->string('title');
            $table->text('content');
            $table->text('video_url')->nullable();
            $table->text('resources')->nullable();
            $table->integer('duration_minutes')->nullable();
            $table->integer('order')->default(1);
            $table->boolean('is_preview')->default(false);
            $table->timestamps();
        });
        
        // Recreate lesson_progress table
        Schema::create('lesson_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lesson_id')->constrained('lessons')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->boolean('completed')->default(false);
            $table->timestamps();
        });
    }
};
