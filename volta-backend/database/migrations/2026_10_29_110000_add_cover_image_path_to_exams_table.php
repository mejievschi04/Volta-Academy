<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('exams', 'cover_image_path')) {
            return;
        }
        Schema::table('exams', function (Blueprint $table) {
            $table->string('cover_image_path')->nullable();
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('exams', 'cover_image_path')) {
            Schema::table('exams', function (Blueprint $table) {
                $table->dropColumn('cover_image_path');
            });
        }
    }
};
