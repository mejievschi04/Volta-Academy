<?php

/**
 * Script de verificare pentru lecții și module
 * Verifică:
 * 1. Cursuri fără module
 * 2. Lecții fără module_id
 * 3. Lecții cu module_id invalid
 * 4. Module fără lecții
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Course;
use App\Models\Module;
use App\Models\Lesson;
use Illuminate\Support\Facades\DB;

echo "========================================\n";
echo "VERIFICARE ATRIBUȚIE LECȚII LA CURSURI\n";
echo "========================================\n\n";

// 1. Verifică cursuri fără module
echo "1. CURSURI FĂRĂ MODULE:\n";
echo "----------------------------------------\n";
$coursesWithoutModules = Course::whereDoesntHave('modules')->get();
if ($coursesWithoutModules->count() > 0) {
    foreach ($coursesWithoutModules as $course) {
        echo "  ❌ Curs ID: {$course->id} - \"{$course->title}\"\n";
        echo "     Status: {$course->status}\n";
        echo "     Creat: {$course->created_at}\n";
    }
    echo "\n  Total: {$coursesWithoutModules->count()} cursuri fără module\n\n";
} else {
    echo "  ✅ Toate cursurile au module\n\n";
}

// 2. Verifică lecții fără module_id
echo "2. LECȚII FĂRĂ MODULE_ID:\n";
echo "----------------------------------------\n";
$lessonsWithoutModule = Lesson::whereNull('module_id')->get();
if ($lessonsWithoutModule->count() > 0) {
    foreach ($lessonsWithoutModule as $lesson) {
        echo "  ❌ Lecție ID: {$lesson->id} - \"{$lesson->title}\"\n";
        echo "     Curs ID: {$lesson->course_id}\n";
        echo "     Module ID: NULL\n";
        echo "     Creat: {$lesson->created_at}\n";
    }
    echo "\n  Total: {$lessonsWithoutModule->count()} lecții fără module_id\n\n";
} else {
    echo "  ✅ Toate lecțiile au module_id\n\n";
}

// 3. Verifică lecții cu module_id invalid (modulul nu există)
echo "3. LECȚII CU MODULE_ID INVALID:\n";
echo "----------------------------------------\n";
$lessonsWithInvalidModule = DB::table('lessons')
    ->leftJoin('modules', 'lessons.module_id', '=', 'modules.id')
    ->whereNull('modules.id')
    ->whereNotNull('lessons.module_id')
    ->select('lessons.*')
    ->get();

if ($lessonsWithInvalidModule->count() > 0) {
    foreach ($lessonsWithInvalidModule as $lesson) {
        echo "  ❌ Lecție ID: {$lesson->id} - \"{$lesson->title}\"\n";
        echo "     Curs ID: {$lesson->course_id}\n";
        echo "     Module ID: {$lesson->module_id} (NU EXISTĂ)\n";
    }
    echo "\n  Total: {$lessonsWithInvalidModule->count()} lecții cu module_id invalid\n\n";
} else {
    echo "  ✅ Toate lecțiile au module_id valid\n\n";
}

// 4. Verifică lecții fără course_id
echo "4. LECȚII FĂRĂ COURSE_ID:\n";
echo "----------------------------------------\n";
$lessonsWithoutCourse = Lesson::whereNull('course_id')->get();
if ($lessonsWithoutCourse->count() > 0) {
    foreach ($lessonsWithoutCourse as $lesson) {
        echo "  ❌ Lecție ID: {$lesson->id} - \"{$lesson->title}\"\n";
        echo "     Course ID: NULL\n";
        echo "     Module ID: {$lesson->module_id}\n";
    }
    echo "\n  Total: {$lessonsWithoutCourse->count()} lecții fără course_id\n\n";
} else {
    echo "  ✅ Toate lecțiile au course_id\n\n";
}

// 5. Verifică module fără lecții
echo "5. MODULE FĂRĂ LECȚII:\n";
echo "----------------------------------------\n";
$modulesWithoutLessons = Module::whereDoesntHave('lessons')->get();
if ($modulesWithoutLessons->count() > 0) {
    foreach ($modulesWithoutLessons as $module) {
        echo "  ⚠️  Modul ID: {$module->id} - \"{$module->title}\"\n";
        echo "     Curs ID: {$module->course_id}\n";
        echo "     Status: {$module->status}\n";
    }
    echo "\n  Total: {$modulesWithoutLessons->count()} module fără lecții\n\n";
} else {
    echo "  ✅ Toate modulele au lecții\n\n";
}

// 6. Verifică inconsistențe: lecții cu course_id diferit de course_id al modulului
echo "6. INCONSISTENȚE COURSE_ID:\n";
echo "----------------------------------------\n";
$inconsistentLessons = DB::table('lessons')
    ->join('modules', 'lessons.module_id', '=', 'modules.id')
    ->whereColumn('lessons.course_id', '!=', 'modules.course_id')
    ->select('lessons.*', 'modules.course_id as module_course_id')
    ->get();

if ($inconsistentLessons->count() > 0) {
    foreach ($inconsistentLessons as $lesson) {
        echo "  ❌ Lecție ID: {$lesson->id} - \"{$lesson->title}\"\n";
        echo "     Course ID în lecție: {$lesson->course_id}\n";
        echo "     Course ID în modul: {$lesson->module_course_id}\n";
    }
    echo "\n  Total: {$inconsistentLessons->count()} lecții cu course_id inconsistent\n\n";
} else {
    echo "  ✅ Toate lecțiile au course_id consistent cu modulul\n\n";
}

// 7. Statistici generale
echo "7. STATISTICI GENERALE:\n";
echo "----------------------------------------\n";
$totalCourses = Course::count();
$totalModules = Module::count();
$totalLessons = Lesson::count();
$coursesWithModules = Course::has('modules')->count();
$modulesWithLessons = Module::has('lessons')->count();
$lessonsWithModule = Lesson::whereNotNull('module_id')->count();

echo "  Total cursuri: {$totalCourses}\n";
echo "  Cursuri cu module: {$coursesWithModules}\n";
echo "  Total module: {$totalModules}\n";
echo "  Module cu lecții: {$modulesWithLessons}\n";
echo "  Total lecții: {$totalLessons}\n";
echo "  Lecții cu module_id: {$lessonsWithModule}\n";
echo "  Lecții fără module_id: " . ($totalLessons - $lessonsWithModule) . "\n\n";

// 8. Recomandări de fix
echo "8. RECOMANDĂRI:\n";
echo "----------------------------------------\n";

if ($lessonsWithoutModule->count() > 0) {
    echo "  ⚠️  Există lecții fără module_id. Acestea trebuie:\n";
    echo "     - Fie șterse dacă nu sunt necesare\n";
    echo "     - Fie atribuite unui modul existent\n";
    echo "     - Fie create module noi pentru ele\n\n";
}

if ($coursesWithoutModules->count() > 0) {
    echo "  ⚠️  Există cursuri fără module. Acestea trebuie:\n";
    echo "     - Fie șterse dacă nu sunt necesare\n";
    echo "     - Fie create module pentru ele\n\n";
}

if ($inconsistentLessons->count() > 0) {
    echo "  ⚠️  Există lecții cu course_id inconsistent. Acestea trebuie:\n";
    echo "     - Actualizate pentru a avea course_id corect (din modul)\n\n";
}

if ($lessonsWithoutModule->count() === 0 && 
    $coursesWithoutModules->count() === 0 && 
    $inconsistentLessons->count() === 0) {
    echo "  ✅ Nu există probleme de atribuire!\n\n";
}

echo "========================================\n";
echo "VERIFICARE COMPLETĂ\n";
echo "========================================\n";
