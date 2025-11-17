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
        Schema::table('exam_results', function (Blueprint $table) {
            // Drop the unique constraint
            $table->dropUnique(['exam_id', 'user_id']);
            // Add attempt_number column
            $table->integer('attempt_number')->default(1)->after('user_id');
        });
        
        // Add unique constraint on exam_id, user_id, attempt_number
        Schema::table('exam_results', function (Blueprint $table) {
            $table->unique(['exam_id', 'user_id', 'attempt_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('exam_results', function (Blueprint $table) {
            // Drop the new unique constraint
            $table->dropUnique(['exam_id', 'user_id', 'attempt_number']);
            // Drop attempt_number column
            $table->dropColumn('attempt_number');
        });
        
        // Restore the original unique constraint
        Schema::table('exam_results', function (Blueprint $table) {
            $table->unique(['exam_id', 'user_id']);
        });
    }
};
