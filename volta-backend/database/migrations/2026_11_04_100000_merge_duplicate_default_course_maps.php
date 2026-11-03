<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Mapa implicită „Cursuri fara mapa” se crea câte una pentru fiecare admin. Le unim în cea mai veche:
 * cursurile trec în ea (fără dubluri), coperta se păstrează dacă păstrata nu are, apoi dublurile goale se șterg.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('course_maps') || ! Schema::hasTable('course_map_course')) {
            return;
        }

        $ids = DB::table('course_maps')->where('name', 'Cursuri fara mapa')->orderBy('id')->pluck('id')->all();
        if (count($ids) < 2) {
            return;
        }
        $keepId = array_shift($ids);

        DB::transaction(function () use ($keepId, $ids) {
            $present = DB::table('course_map_course')->where('course_map_id', $keepId)->pluck('course_id')->flip();
            $nextOrder = (int) DB::table('course_map_course')->where('course_map_id', $keepId)->max('order') + 1;

            foreach (DB::table('course_map_course')->whereIn('course_map_id', $ids)->orderBy('order')->get() as $link) {
                if (isset($present[$link->course_id])) {
                    continue;
                }
                DB::table('course_map_course')->insert([
                    'course_map_id' => $keepId,
                    'course_id' => $link->course_id,
                    'order' => $nextOrder++,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $present[$link->course_id] = true;
            }

            if (Schema::hasColumn('course_maps', 'cover_image_path')) {
                $keep = DB::table('course_maps')->where('id', $keepId)->first();
                if (empty($keep->cover_image_path)) {
                    $cover = DB::table('course_maps')->whereIn('id', $ids)->whereNotNull('cover_image_path')->orderBy('id')->first();
                    if ($cover) {
                        $copy = ['cover_image_path' => $cover->cover_image_path];
                        if (Schema::hasColumn('course_maps', 'cover_focus')) {
                            $copy['cover_focus'] = $cover->cover_focus;
                        }
                        DB::table('course_maps')->where('id', $keepId)->update($copy);
                    }
                }
            }

            DB::table('course_map_course')->whereIn('course_map_id', $ids)->delete();
            DB::table('course_maps')->whereIn('id', $ids)->delete();
        });
    }

    public function down(): void
    {
        // Unirea nu se poate desface: nu mai știm ce curs era în ce dublură.
    }
};
