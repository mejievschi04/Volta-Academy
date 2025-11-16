<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserAdminController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 15);
        
        // Get all courses once (outside the loop to avoid N+1)
        $allCourses = \App\Models\Course::with('lessons')->get();
        $totalCourses = $allCourses->count();
        
        // Pre-calculate lesson IDs per course
        $courseLessonMap = [];
        foreach ($allCourses as $course) {
            $courseLessonMap[$course->id] = $course->lessons->pluck('id')->toArray();
        }
        
        // Get paginated users with relationships
        $usersPaginated = User::with(['teams', 'courses'])->paginate($perPage);
        $users = $usersPaginated->items();
        
        // Get all completed lessons for current page users in one query
        $allProgress = \Illuminate\Support\Facades\DB::table('lesson_progress')
            ->whereIn('user_id', collect($users)->pluck('id'))
            ->where('completed', true)
            ->get()
            ->groupBy('user_id')
            ->map(function ($group) {
                return $group->pluck('lesson_id')->toArray();
            });
        
        // Calculate course statistics for each user
        $usersWithStats = collect($users)->map(function ($user) use ($courseLessonMap, $totalCourses, $allProgress) {
            $completedLessonIds = $allProgress->get($user->id, []);
            $completedCourses = 0;
            
            // Calculate completed courses
            foreach ($courseLessonMap as $courseId => $lessonIds) {
                if (count($lessonIds) > 0) {
                    $completedCourseLessons = array_intersect($lessonIds, $completedLessonIds);
                    if (count($completedCourseLessons) === count($lessonIds)) {
                        $completedCourses++;
                    }
                }
            }
            
            $user->total_courses = $totalCourses;
            $user->completed_courses = $completedCourses;
            $user->completion_percentage = $totalCourses > 0 
                ? round(($completedCourses / $totalCourses) * 100, 1) 
                : 0;
            
            return $user;
        });
        
        // Replace items in paginator
        $usersPaginated->setCollection($usersWithStats);
        
        return response()->json($usersPaginated);
    }

    public function show($id)
    {
        $user = User::with(['teams', 'courses'])->findOrFail($id);
        
        return response()->json($user);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|regex:/^[a-zA-Z0-9\s\-\.]+$/u', // Sanitize name
            'email' => 'required|string|email|max:255|unique:users',
            'password' => [
                'nullable',
                'string',
                'min:8', // Increased minimum length
                'regex:/[a-z]/', // At least one lowercase letter
                'regex:/[A-Z]/', // At least one uppercase letter
                'regex:/[0-9]/', // At least one number
            ],
            'role' => 'required|string|in:student,teacher,admin',
            'bio' => 'nullable|string|max:1000', // Limit bio length
			'team_id' => 'nullable|exists:teams,id',
        ], [
            'password.regex' => 'Parola trebuie să conțină cel puțin 8 caractere, incluzând o literă mare, o literă mică și o cifră.',
        ]);

        // Set default password "volta2025" if not provided
        $password = $validated['password'] ?? 'volta2025';
        $validated['password'] = Hash::make($password);
        $validated['must_change_password'] = true; // User must change password on first login
        $validated['level'] = 1; // Default value, not used in UI
        $validated['points'] = 0; // Default value, not used in UI
        $validated['name'] = strip_tags($validated['name']); // Sanitize HTML tags
        $validated['email'] = strtolower(trim($validated['email'])); // Normalize email
        $validated['bio'] = isset($validated['bio']) ? strip_tags($validated['bio']) : null; // Sanitize bio

        $user = User::create($validated);

		// Attach to team if provided
		if (!empty($validated['team_id'])) {
			$user->teams()->syncWithoutDetaching([$validated['team_id']]);
		}
        
        // Log user creation
        \Illuminate\Support\Facades\Log::info('Admin created user', [
            'admin_id' => \Illuminate\Support\Facades\Auth::id(),
            'created_user_id' => $user->id,
            'created_user_email' => $user->email,
        ]);

        return response()->json([
            'message' => 'Utilizator creat cu succes. Parola implicită: volta2025',
            'user' => $user->load(['teams', 'courses']),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|string|email|max:255|unique:users,email,' . $id,
            'password' => 'nullable|string|min:6',
            'role' => 'sometimes|required|string|in:student,teacher,admin',
            'bio' => 'nullable|string',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }
        
        // Don't update level and points - they're not used in UI

        $user->update($validated);

        return response()->json([
            'message' => 'Utilizator actualizat cu succes',
            'user' => $user->load(['teams', 'courses']),
        ]);
    }

    public function destroy($id)
    {
        $user = User::findOrFail($id);
        $user->delete();

        return response()->json([
            'message' => 'Utilizator șters cu succes',
        ]);
    }

    public function assignCourses(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'course_ids' => 'required|array',
            'course_ids.*' => 'exists:courses,id',
            'is_mandatory' => 'nullable|boolean',
        ]);

        $courseIds = $validated['course_ids'];
        $isMandatory = $validated['is_mandatory'] ?? true; // Implicit obligatoriu

        // Sync courses - remove old assignments and add new ones
        $syncData = [];
        foreach ($courseIds as $courseId) {
            $syncData[$courseId] = [
                'is_mandatory' => $isMandatory,
                'assigned_at' => now(),
            ];
        }

        $user->assignedCourses()->sync($syncData);

        // Clear cache for affected users
        \Illuminate\Support\Facades\Cache::forget("dashboard_user_{$user->id}_stats");
        \Illuminate\Support\Facades\Cache::forget("profile_user_{$user->id}");

        return response()->json([
            'message' => 'Cursuri atribuite cu succes',
            'user' => $user->load('assignedCourses'),
        ]);
    }

    public function removeCourse(Request $request, $id, $courseId)
    {
        $user = User::findOrFail($id);
        $user->assignedCourses()->detach($courseId);

        // Clear cache
        \Illuminate\Support\Facades\Cache::forget("dashboard_user_{$user->id}_stats");
        \Illuminate\Support\Facades\Cache::forget("profile_user_{$user->id}");

        return response()->json([
            'message' => 'Curs eliminat cu succes',
        ]);
    }
}

