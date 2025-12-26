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
        Schema::table('test_results', function (Blueprint $table) {
            // Add max_score if it doesn't exist (for compatibility with TestResult model)
            if (!Schema::hasColumn('test_results', 'max_score')) {
                $table->integer('max_score')->nullable()->after('score');
            }
            
            // Add status if it doesn't exist
            if (!Schema::hasColumn('test_results', 'status')) {
                $table->string('status')->default('completed')->after('passed');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('test_results', function (Blueprint $table) {
            if (Schema::hasColumn('test_results', 'max_score')) {
                $table->dropColumn('max_score');
            }
            if (Schema::hasColumn('test_results', 'status')) {
                $table->dropColumn('status');
            }
        });
    }
};
