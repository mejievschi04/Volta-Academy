<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Indexuri pentru cheile folosite la fiecare încărcare de curs, echipă sau examen. Pe PostgreSQL
 * cheile străine nu primesc index automat, deci join-urile pe aceste coloane scanau tabelul întreg.
 * Întrebările unui folder se citesc paginat, în ordine (bancă + order).
 * Plus contorul de corectări (polling /badges la 30 s pentru staff): rezultatele încă necorectate.
 */
return new class extends Migration
{
    private const INDEXES = [
        ['modules', 'modules_course_id_order_index', ['course_id', 'order']],
        ['lessons', 'lessons_module_id_order_index', ['module_id', 'order']],
        ['questions', 'questions_bank_order_index', ['question_bank_id', 'order']],
        ['team_user', 'team_user_team_id_index', ['team_id']],
        ['team_user', 'team_user_user_id_index', ['user_id']],
        ['course_team', 'course_team_course_id_index', ['course_id']],
        ['course_team', 'course_team_team_id_index', ['team_id']],
        ['course_map_course', 'course_map_course_course_id_index', ['course_id']],
        ['courses', 'courses_teacher_id_index', ['teacher_id']],
        ['courses', 'courses_status_index', ['status']],
        ['exams', 'exams_course_id_index', ['course_id']],
        ['exam_questions', 'exam_questions_exam_id_index', ['exam_id']],
        ['exam_results', 'exam_results_user_id_index', ['user_id']],
        ['exam_results', 'exam_results_review_pending_index', ['reviewed_at', 'needs_manual_review']],
        ['test_results', 'test_results_review_pending_index', ['reviewed_at', 'needs_manual_review', 'status']],
    ];

    public function up(): void
    {
        $isPgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        foreach (self::INDEXES as [$table, $name, $columns]) {
            if (! Schema::hasTable($table) || ! Schema::hasColumns($table, $columns)) {
                continue;
            }

            if ($isPgsql) {
                DB::statement(sprintf('CREATE INDEX IF NOT EXISTS %s ON %s (%s)', $name, $table, implode(', ', array_map(fn ($c) => '"' . $c . '"', $columns))));
                continue;
            }

            if (! Schema::hasIndex($table, $name)) {
                Schema::table($table, fn (Blueprint $t) => $t->index($columns, $name));
            }
        }
    }

    public function down(): void
    {
        $isPgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        foreach (self::INDEXES as [$table, $name]) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            if ($isPgsql) {
                DB::statement(sprintf('DROP INDEX IF EXISTS %s', $name));
                continue;
            }

            if (Schema::hasIndex($table, $name)) {
                Schema::table($table, fn (Blueprint $t) => $t->dropIndex($name));
            }
        }
    }
};
