<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('questions')) return;

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE questions MODIFY COLUMN type ENUM(
                'single_choice', 'multiple_choice', 'true_false', 'yes_no',
                'short_answer', 'essay', 'fill_in_blank', 'matching', 'image_matching', 'ordering'
            ) NOT NULL DEFAULT 'multiple_choice'");
            return;
        }

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_type_allowed');
            DB::statement("ALTER TABLE questions ADD CONSTRAINT questions_type_allowed CHECK (type IN (
                'single_choice', 'multiple_choice', 'true_false', 'yes_no',
                'short_answer', 'essay', 'fill_in_blank', 'matching', 'image_matching', 'ordering'
            ))");
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('questions')) return;
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("UPDATE questions SET type = 'matching' WHERE type = 'image_matching'");
            DB::statement("ALTER TABLE questions MODIFY COLUMN type ENUM(
                'single_choice', 'multiple_choice', 'true_false', 'yes_no',
                'short_answer', 'essay', 'fill_in_blank', 'matching', 'ordering'
            ) NOT NULL DEFAULT 'multiple_choice'");
        } elseif ($driver === 'pgsql') {
            DB::statement("UPDATE questions SET type = 'matching' WHERE type = 'image_matching'");
            DB::statement('ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_type_allowed');
            DB::statement("ALTER TABLE questions ADD CONSTRAINT questions_type_allowed CHECK (type IN (
                'single_choice', 'multiple_choice', 'true_false', 'yes_no',
                'short_answer', 'essay', 'fill_in_blank', 'matching', 'ordering'
            ))");
        }
    }
};
