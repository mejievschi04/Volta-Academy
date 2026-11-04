<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pragurile salvate înainte de 2026_11_04_130000 erau rotunjite la întreg: „10 din 13” devenea 77%,
 * iar cine avea exact 10 din 13 (76,92%) pica. Migrarea aceea a schimbat doar tipul coloanei.
 * Aici refacem valoarea exactă acolo unde pragul e o fracție X/Y rotunjită în sus (Y = întrebările testului).
 * Pragurile care nu vin dintr-o fracție (ex. 70% la 3 întrebări) rămân neschimbate.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tests') || ! Schema::hasTable('questions') || ! Schema::hasColumn('questions', 'test_id')) {
            return;
        }

        $counts = DB::table('questions')->whereNotNull('test_id')
            ->groupBy('test_id')->selectRaw('test_id, count(*) as total')->pluck('total', 'test_id');

        $query = DB::table('tests')->whereNotNull('passing_score');
        if (Schema::hasColumn('tests', 'question_selection')) {
            // la selecție aleatorie numărul de întrebări din încercare nu e cel din test
            $query->whereNull('question_selection');
        }

        foreach ($query->get(['id', 'passing_score']) as $test) {
            $exact = self::exactScore((float) $test->passing_score, (int) ($counts[$test->id] ?? 0));
            if ($exact === null) {
                continue;
            }
            DB::table('tests')->where('id', $test->id)->update(['passing_score' => $exact]);
            if (Schema::hasTable('course_test') && Schema::hasColumn('course_test', 'passing_score')) {
                DB::table('course_test')->where('test_id', $test->id)
                    ->where('passing_score', $test->passing_score)
                    ->update(['passing_score' => $exact]);
            }
        }
    }

    /** Fracția X/total al cărei procent rotunjit e pragul și care e sub el; altfel null. */
    public static function exactScore(float $score, int $total): ?float
    {
        if ($total < 1 || floor($score) !== $score) {
            return null;
        }
        for ($correct = 1; $correct <= $total; $correct++) {
            $percent = round($correct * 100 / $total, 2);
            if ((int) round($correct * 100 / $total) === (int) $score && $percent < $score) {
                return $percent;
            }
        }

        return null;
    }

    public function down(): void
    {
        // Pragurile exacte sunt cele voite; nu revenim la valorile rotunjite.
    }
};
