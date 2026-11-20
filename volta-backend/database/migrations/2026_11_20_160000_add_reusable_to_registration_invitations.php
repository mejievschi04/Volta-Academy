<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('registration_invitations') || Schema::hasColumn('registration_invitations', 'reusable')) {
            return;
        }

        Schema::table('registration_invitations', function (Blueprint $table) {
            $table->boolean('reusable')->default(false)->after('email');
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('registration_invitations') && Schema::hasColumn('registration_invitations', 'reusable')) {
            Schema::table('registration_invitations', function (Blueprint $table) {
                $table->dropColumn('reusable');
            });
        }
    }
};
