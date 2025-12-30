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
        Schema::table('lessons', function (Blueprint $table) {
            // Check if section_id column already exists (it might have been added in create_lessons_table)
            if (!Schema::hasColumn('lessons', 'section_id')) {
                // Add section_id with foreign key if sections/modules table exists
                if (Schema::hasTable('sections')) {
                    $table->foreignId('section_id')->nullable()->after('course_id')->constrained('sections')->onDelete('cascade');
                } else if (Schema::hasTable('modules')) {
                    // If sections was renamed to modules, use modules instead
                    $table->foreignId('section_id')->nullable()->after('course_id')->constrained('modules')->onDelete('cascade');
                } else {
                    // Just add the column without foreign key constraint for now
                    $table->unsignedBigInteger('section_id')->nullable()->after('course_id');
                }
            } else {
                // Column exists, but might not have foreign key constraint - add it if sections/modules table exists
                if (Schema::hasTable('sections')) {
                    try {
                        // Check if foreign key already exists
                        $foreignKeys = DB::select("
                            SELECT CONSTRAINT_NAME 
                            FROM information_schema.KEY_COLUMN_USAGE 
                            WHERE TABLE_SCHEMA = DATABASE() 
                            AND TABLE_NAME = 'lessons' 
                            AND COLUMN_NAME = 'section_id' 
                            AND REFERENCED_TABLE_NAME IS NOT NULL
                        ");
                        
                        if (empty($foreignKeys)) {
                            // Add foreign key constraint
                            $table->foreign('section_id')->references('id')->on('sections')->onDelete('cascade');
                        }
                    } catch (\Exception $e) {
                        // Foreign key might already exist or there's another issue
                    }
                } else if (Schema::hasTable('modules')) {
                    // If sections was renamed to modules, add foreign key to modules
                    try {
                        $foreignKeys = DB::select("
                            SELECT CONSTRAINT_NAME 
                            FROM information_schema.KEY_COLUMN_USAGE 
                            WHERE TABLE_SCHEMA = DATABASE() 
                            AND TABLE_NAME = 'lessons' 
                            AND COLUMN_NAME = 'section_id' 
                            AND REFERENCED_TABLE_NAME IS NOT NULL
                        ");
                        
                        if (empty($foreignKeys)) {
                            // Add foreign key constraint to modules
                            $table->foreign('section_id')->references('id')->on('modules')->onDelete('cascade');
                        }
                    } catch (\Exception $e) {
                        // Foreign key might already exist or there's another issue
                    }
                }
            }
            
            // These columns might already exist from create_lessons_table, so check before adding
            if (!Schema::hasColumn('lessons', 'video_url')) {
                $table->text('video_url')->nullable()->after('content');
            }
            if (!Schema::hasColumn('lessons', 'resources')) {
                $table->text('resources')->nullable()->after('video_url'); // JSON array pentru documente, link-uri, etc.
            }
            if (!Schema::hasColumn('lessons', 'duration_minutes')) {
                $table->integer('duration_minutes')->nullable()->after('resources');
            }
            if (!Schema::hasColumn('lessons', 'is_preview')) {
                $table->boolean('is_preview')->default(false)->after('order'); // Lecție gratuită de preview
            }
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
