<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('exam_results', 'attempt_number')) {
            Schema::table('exam_results', function (Blueprint $table) {
                $table->integer('attempt_number')->default(1);
            });
        }

        try {
            Schema::table('exam_results', function (Blueprint $table) {
                $table->dropUnique(['exam_id', 'user_id']);
            });
        } catch (Throwable $e) {
            // Indexul vechi lipsește deja pe bazele unde migrarea MySQL a reușit.
        }

        Schema::table('exam_results', function (Blueprint $table) {
            $table->unique(['exam_id', 'user_id', 'attempt_number'], 'exam_results_exam_user_attempt_unique');
        });
    }

    public function down(): void
    {
        Schema::table('exam_results', function (Blueprint $table) {
            $table->dropUnique('exam_results_exam_user_attempt_unique');
            $table->unique(['exam_id', 'user_id']);
            $table->dropColumn('attempt_number');
        });
    }
};
