<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CourseMap;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Course maps for students: list and show only maps that contain published courses.
 */
class CourseMapController extends Controller
{
    /**
     * Lista mape de curs vizibile pentru student (doar mape care au cel puțin un curs publicat).
     */
    public function index(Request $request)
    {
        if (!Schema::hasTable('course_maps') || !Schema::hasTable('course_map_course')) {
            return response()->json(['data' => []]);
        }

        $query = CourseMap::query()
            ->whereHas('courses', function ($q) {
                $q->where('status', 'published');
            })
            ->withCount(['courses' => function ($q) {
                $q->where('status', 'published');
            }])
            ->orderBy('order')
            ->orderBy('name');

        $maps = $query->get()->map(function ($map) {
            return [
                'id' => $map->id,
                'name' => $map->name,
                'description' => $map->description,
                'courses_count' => $map->courses_count ?? 0,
            ];
        });

        return response()->json(['data' => $maps]);
    }

    /**
     * Detalii mapă + cursuri publicate, cu progres utilizator și durată estimată.
     */
    public function show(Request $request, $id)
    {
        if (!Schema::hasTable('course_maps') || !Schema::hasTable('course_map_course')) {
            return response()->json(['error' => 'Mapă negăsită'], 404);
        }

        $map = CourseMap::with([
            'courses' => function ($q) {
                $q->where('status', 'published')
                    ->orderBy('course_map_course.order')
                    ->with(['teacher:id,name', 'modules:id,course_id,estimated_duration_minutes']);
            },
        ])->findOrFail($id);

        $user = $request->user();
        $courseIds = $map->courses->pluck('id')->toArray();

        $progress = [];
        if ($user && !empty($courseIds)) {
            $rows = DB::table('course_user')
                ->where('user_id', $user->id)
                ->whereIn('course_id', $courseIds)
                ->select('course_id', 'progress_percentage', 'completed_at')
                ->get();
            foreach ($rows as $row) {
                $progress[$row->course_id] = [
                    'progress_percentage' => (int) $row->progress_percentage,
                    'completed_at' => $row->completed_at,
                ];
            }
        }

        $courses = $map->courses->map(function ($course) use ($progress) {
            $p = $progress[$course->id] ?? ['progress_percentage' => 0, 'completed_at' => null];
            $durationMinutes = $this->courseDurationMinutes($course);
            return [
                'id' => $course->id,
                'title' => $course->title,
                'short_description' => $course->short_description,
                'image_url' => $course->image_url ?? $course->image,
                'estimated_duration_minutes' => $durationMinutes,
                'views_count' => 0,
                'progress_percentage' => $p['progress_percentage'],
                'completed_at' => $p['completed_at'],
                'teacher' => $course->teacher ? ['id' => $course->teacher->id, 'name' => $course->teacher->name] : null,
            ];
        })->values();

        return response()->json([
            'id' => $map->id,
            'name' => $map->name,
            'description' => $map->description,
            'courses' => $courses,
        ]);
    }

    private function courseDurationMinutes($course): int
    {
        if ($course->estimated_duration_hours) {
            return (int) $course->estimated_duration_hours * 60;
        }
        if ($course->relationLoaded('modules') && $course->modules->isNotEmpty()) {
            $total = 0;
            foreach ($course->modules as $module) {
                $total += (int) ($module->estimated_duration_minutes ?? 0);
            }
            if ($total > 0) {
                return $total;
            }
        }
        return 0;
    }
}
