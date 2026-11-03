<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pragul de promovare se setează „X din Y întrebări” (ex. 7 din 9 = 77,78%), dar coloanele erau întregi:
 * se salva 78, iar cine avea exact 7 din 9 pica. Pragul și procentul obținut păstrează acum 2 zecimale.
 */
return new class extends Migration
{
    /** @var array<string, list<string>> */
    private array $columns = [
        'tests' => ['passing_score'],
        'course_test' => ['passing_score'],
        'exams' => ['passing_score'],
        'test_results' => ['passing_score_applied', 'percentage'],
        'exam_results' => ['percentage'],
    ];

    public function up(): void
    {
        foreach ($this->columns as $table => $columns) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            Schema::table($table, function (Blueprint $blueprint) use ($table, $columns) {
                foreach ($columns as $column) {
                    if (! Schema::hasColumn($table, $column)) {
                        continue;
                    }
                    $definition = $blueprint->decimal($column, 5, 2);
                    if ($column === 'passing_score_applied') {
                        $definition->nullable();
                    } else {
                        $definition->default($column === 'percentage' ? 0 : 70);
                    }
                    $definition->change();
                }
            });
        }
    }

    public function down(): void
    {
        foreach ($this->columns as $table => $columns) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            Schema::table($table, function (Blueprint $blueprint) use ($table, $columns) {
                foreach ($columns as $column) {
                    if (! Schema::hasColumn($table, $column)) {
                        continue;
                    }
                    $definition = $column === 'passing_score_applied'
                        ? $blueprint->unsignedTinyInteger($column)->nullable()
                        : $blueprint->integer($column)->default($column === 'percentage' ? 0 : 70);
                    $definition->change();
                }
            });
        }
    }
};
