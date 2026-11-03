<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Certificatul la finalizare a fost scos din platformă. Pragul și reluările testelor, care stăteau în
 * setări sub „certificate”, se mută sub „assessment”; coloana has_certificate dispare.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('courses') && Schema::hasColumn('courses', 'settings')) {
            foreach (DB::table('courses')->whereNotNull('settings')->get(['id', 'settings']) as $row) {
                $settings = json_decode((string) $row->settings, true);
                if (! is_array($settings) || ! array_key_exists('certificate', $settings)) {
                    continue;
                }
                $legacy = is_array($settings['certificate']) ? $settings['certificate'] : [];
                unset($settings['certificate'], $legacy['enabled']);
                if ($legacy !== []) {
                    $settings['assessment'] = array_replace($legacy, $settings['assessment'] ?? []);
                }
                DB::table('courses')->where('id', $row->id)->update(['settings' => json_encode($settings)]);
            }
        }

        if (Schema::hasTable('courses') && Schema::hasColumn('courses', 'has_certificate')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->dropColumn('has_certificate');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('courses') && ! Schema::hasColumn('courses', 'has_certificate')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->boolean('has_certificate')->default(false);
            });
        }
    }
};
