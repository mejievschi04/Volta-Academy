<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CourseMap;
use App\Models\Course;
use Illuminate\Http\Request;

class CourseMapAdminController extends Controller
{
    /**
     * Lista mape de curs. Instructor: doar mapele create de el.
     */
    public function index(Request $request)
    {
        $query = CourseMap::with(['createdBy:id,name,email', 'courses:id,title,status'])
            ->withCount('courses');

        if (auth()->user()->isInstructor()) {
            $query->where('created_by', auth()->id());
        }

        if ($request->has('search') && $request->search) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                    ->orWhere('description', 'like', "%{$s}%");
            });
        }

        $maps = $query->orderBy('order')->orderBy('name')->paginate($request->get('per_page', 20));
        return response()->json($maps);
    }

    /**
     * Detalii mapă + cursuri ordonate.
     */
    public function show($id)
    {
        $map = CourseMap::with(['createdBy:id,name,email', 'courses' => fn ($q) => $q->orderBy('course_map_course.order')])
            ->withCount('courses')
            ->findOrFail($id);

        if (auth()->user()->isInstructor() && (int) $map->created_by !== (int) auth()->id()) {
            abort(403, 'Acces interzis. Poți accesa doar mapele tale.');
        }

        return response()->json($map);
    }

    /**
     * Creare mapă. created_by = user curent.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'order' => 'nullable|integer|min:0',
        ]);

        $validated['created_by'] = auth()->id();
        $validated['order'] = $validated['order'] ?? 0;

        $map = CourseMap::create($validated);
        $map->load('createdBy:id,name,email');
        $map->loadCount('courses');

        return response()->json($map, 201);
    }

    /**
     * Actualizare mapă. Instructor: doar mapele proprii.
     */
    public function update(Request $request, $id)
    {
        $map = CourseMap::findOrFail($id);
        if (auth()->user()->isInstructor() && (int) $map->created_by !== (int) auth()->id()) {
            abort(403, 'Acces interzis.');
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:5000',
            'order' => 'nullable|integer|min:0',
        ]);

        $map->update($validated);
        $map->load('createdBy:id,name,email');
        $map->loadCount('courses');

        return response()->json($map);
    }

    /**
     * Ștergere mapă.
     */
    public function destroy($id)
    {
        $map = CourseMap::findOrFail($id);
        if (auth()->user()->isInstructor() && (int) $map->created_by !== (int) auth()->id()) {
            abort(403, 'Acces interzis.');
        }
        $map->delete();
        return response()->json(null, 204);
    }

    /**
     * Adaugă cursuri în mapă. Body: { course_ids: [1,2,3] }.
     * Instructor: doar cursuri unde teacher_id = auth.
     */
    public function attachCourses(Request $request, $id)
    {
        $map = CourseMap::findOrFail($id);
        if (auth()->user()->isInstructor() && (int) $map->created_by !== (int) auth()->id()) {
            abort(403, 'Acces interzis.');
        }

        $courseIds = $request->validate(['course_ids' => 'required|array', 'course_ids.*' => 'integer|exists:courses,id'])['course_ids'];

        if (auth()->user()->isInstructor()) {
            $allowed = Course::where('teacher_id', auth()->id())->pluck('id')->toArray();
            $courseIds = array_values(array_intersect($courseIds, $allowed));
        }

        $maxOrder = $map->courses()->max('course_map_course.order') ?? 0;
        foreach ($courseIds as $i => $courseId) {
            $map->courses()->syncWithoutDetaching([$courseId => ['order' => $maxOrder + $i + 1]]);
        }

        $map->load(['courses' => fn ($q) => $q->orderBy('course_map_course.order')]);
        $map->loadCount('courses');
        return response()->json($map);
    }

    /**
     * Scoate un curs din mapă.
     */
    public function detachCourse($id, $courseId)
    {
        $map = CourseMap::findOrFail($id);
        if (auth()->user()->isInstructor() && (int) $map->created_by !== (int) auth()->id()) {
            abort(403, 'Acces interzis.');
        }
        $map->courses()->detach($courseId);
        return response()->json(null, 204);
    }

    /**
     * Reordonare cursuri în mapă. Body: { order: [ { course_id: 1, order: 0 }, ... ] }.
     */
    public function reorderCourses(Request $request, $id)
    {
        $map = CourseMap::findOrFail($id);
        if (auth()->user()->isInstructor() && (int) $map->created_by !== (int) auth()->id()) {
            abort(403, 'Acces interzis.');
        }

        $order = $request->validate([
            'order' => 'required|array',
            'order.*.course_id' => 'required|integer|exists:courses,id',
            'order.*.order' => 'required|integer|min:0',
        ])['order'];

        foreach ($order as $item) {
            $map->courses()->updateExistingPivot($item['course_id'], ['order' => $item['order']]);
        }

        $map->load(['courses' => fn ($q) => $q->orderBy('course_map_course.order')]);
        $map->loadCount('courses');
        return response()->json($map);
    }
}
