<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Legătura curs–test primea pragul 70 la atașare și nu se actualiza când adminul schimba pragul testului,
 * iar cursantul era corectat după ea. Interfața nu setează praguri diferite pe curs, deci pragul testului
 * e cel voit: îl copiem pe toate legăturile.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('course_test') || ! Schema::hasColumn('course_test', 'passing_score')
            || ! Schema::hasColumn('tests', 'passing_score')) {
            return;
        }

        foreach (DB::table('tests')->whereNotNull('passing_score')->get(['id', 'passing_score']) as $test) {
            DB::table('course_test')->where('test_id', $test->id)->update(['passing_score' => $test->passing_score]);
        }
    }

    public function down(): void
    {
        // Pragurile vechi de pe legături nu se pot reface.
    }
};
