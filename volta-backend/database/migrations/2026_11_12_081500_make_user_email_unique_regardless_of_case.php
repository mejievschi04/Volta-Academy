<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $duplicates = DB::table('users')
            ->selectRaw('LOWER(TRIM(email)) as email')
            ->groupByRaw('LOWER(TRIM(email))')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('email');

        if ($duplicates->isNotEmpty()) {
            throw new RuntimeException(
                'Există mai multe conturi pentru același email: '.$duplicates->implode(', ')
            );
        }

        foreach (DB::table('users')->select('id', 'email')->get() as $row) {
            $normalized = strtolower(trim((string) $row->email));
            if ($normalized !== $row->email) {
                DB::table('users')->where('id', $row->id)->update(['email' => $normalized]);
            }
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['email']);
        });

        DB::statement('CREATE UNIQUE INDEX users_email_unique ON users (LOWER(email))');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX users_email_unique');

        Schema::table('users', function (Blueprint $table) {
            $table->unique('email');
        });
    }
};
