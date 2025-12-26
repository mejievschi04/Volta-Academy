<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamResult;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class UserAdminController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 15);
        
        // Build query with filters
        $query = User::with(['teams', 'courses', 'assignedCourses']);
        
        // Search filter
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }
        
        // Role filter (for team members: admin, manager, instructor)
        if ($request->has('role') && $request->role !== 'all') {
            $query->where('role', $request->role);
        }
        
        // Status filter
        if ($request->has('status') && $request->status !== 'all') {
            if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'status')) {
                $query->where('status', $request->status);
            }
        }
        
        // Team members only filter (exclude students)
        if ($request->has('team_members_only') && $request->team_members_only) {
            $query->whereIn('role', ['admin', 'manager', 'instructor', 'teacher']);
        }
        
        // Sort
        $sortBy = $request->get('sort_by', 'updated_at');
        $sortDirection = $request->get('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);
        
        // Get all courses once (outside the loop to avoid N+1)
        $allCourses = \App\Models\Course::with('modules')->get();
        $totalCourses = $allCourses->count();
        
        // Get paginated users with relationships
        $usersPaginated = $query->paginate($perPage);
        $users = $usersPaginated->items();
        
        // Get all course progress for current page users in one query
        $allProgress = DB::table('course_user')
            ->whereIn('user_id', collect($users)->pluck('id'))
            ->where('enrolled', true)
            ->get()
            ->groupBy('user_id')
            ->map(function ($group) {
                return $group->keyBy('course_id');
            });
        
        // Calculate course statistics for each user (skip admins)
        $usersWithStats = collect($users)->map(function ($user) use ($allCourses, $totalCourses, $allProgress) {
            // Skip statistics for admin users
            if ($user->role === 'admin') {
                $user->total_courses = null;
                $user->completed_courses = null;
                $user->completion_percentage = null;
                $user->completed_modules = null;
                $user->total_modules = null;
                return $user;
            }
            
            $userProgress = $allProgress->get($user->id, collect());
            $completedCourses = 0;
            $totalModules = 0;
            $completedModules = 0;
            
            // Calculate completed courses and modules (based on completed_at and progress_percentage in course_user table)
            foreach ($allCourses as $course) {
                $progress = $userProgress->get($course->id);
                $moduleCount = $course->modules ? $course->modules->count() : 0;
                $totalModules += $moduleCount;
                
                if ($progress) {
                    // If course is completed, all modules are considered completed
                    if ($progress->completed_at) {
                        $completedCourses++;
                        $completedModules += $moduleCount;
                    } else {
                        // Calculate completed modules based on progress percentage
                        $courseProgressPercentage = $progress->progress_percentage ?? 0;
                        if ($courseProgressPercentage > 0) {
                            $completedModules += round(($courseProgressPercentage / 100) * $moduleCount);
                        }
                    }
                }
            }
            
            $user->total_courses = $totalCourses;
            $user->completed_courses = $completedCourses;
            $user->total_modules = $totalModules;
            $user->completed_modules = $completedModules;
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
        try {
            $user = User::with(['teams', 'courses'])->findOrFail($id);
            
            // Get courses with modules (optimized query)
            // Use try-catch to handle potential issues with column selection
            try {
                $courses = Course::with(['modules:id,course_id,title,order', 'teacher:id,name'])->get();
            } catch (\Exception $e) {
                // Fallback: get courses without column selection if it fails
                $courses = Course::with(['modules', 'teacher'])->get();
            }
            
            // Get user progress from course_user pivot table
            $courseProgress = DB::table('course_user')
                ->where('user_id', $user->id)
                ->where('enrolled', true)
                ->get()
                ->keyBy('course_id');

            // Get all exams for courses and their latest results for this user
            $courseIds = $courses->pluck('id')->toArray();
            $exams = [];
            $examIds = [];
            
            if (!empty($courseIds)) {
                try {
                    $exams = Exam::whereIn('course_id', $courseIds)->get();
                    $examIds = $exams->pluck('id')->toArray();
                } catch (\Exception $e) {
                    // If exams table doesn't exist or has issues, continue without exams
                    Log::warning('Error fetching exams for user profile', ['user_id' => $user->id, 'error' => $e->getMessage()]);
                }
            }
            
            // Get the latest exam result for each exam for this user
            $latestExamResults = collect();
            if (!empty($examIds)) {
                try {
                    $latestExamResults = ExamResult::whereIn('exam_id', $examIds)
                        ->where('user_id', $user->id)
                        ->orderBy('exam_id')
                        ->orderBy('attempt_number', 'desc')
                        ->get()
                        ->unique('exam_id')
                        ->keyBy('exam_id');
                } catch (\Exception $e) {
                    Log::warning('Error fetching exam results for user profile', ['user_id' => $user->id, 'error' => $e->getMessage()]);
                }
            }
            
            // Create a map of course_id => has_passed_exam (based on latest result)
            $courseExamMap = [];
            foreach ($exams as $exam) {
                $latestResult = $latestExamResults->get($exam->id);
                if ($latestResult && isset($latestResult->passed) && $latestResult->passed === true) {
                    $courseExamMap[$exam->course_id] = true;
                }
            }
            
            // Count passed quizzes
            $passedExamResults = $latestExamResults->filter(function($result) {
                return isset($result->passed) && $result->passed === true;
            });

            // Calculate stats using modules instead of lessons
            $totalCourses = $courses->count();
            $totalModules = $courses->sum(function($course) {
                return $course->modules ? $course->modules->count() : 0;
            });
            $completedModules = $courses->sum(function($course) use ($courseProgress) {
                $progress = $courseProgress->get($course->id);
                // If course is completed, all modules are considered completed
                $moduleCount = $course->modules ? $course->modules->count() : 0;
                return ($progress && isset($progress->completed_at) && $progress->completed_at) ? $moduleCount : 0;
            });
            $completedQuizzes = $passedExamResults->count();
            $progressPercentage = $totalModules > 0 ? round(($completedModules / $totalModules) * 100) : 0;

            // Get courses in progress
            $coursesInProgress = [];
            $coursesCompleted = [];
            
            foreach ($courses as $course) {
                $progress = $courseProgress->get($course->id);
                $courseProgressPercentage = $progress && isset($progress->progress_percentage) ? ($progress->progress_percentage ?? 0) : 0;
                $isCompleted = $progress && isset($progress->completed_at) && $progress->completed_at;
                
                // Check if user has passed the exam for this course
                $quizPassed = isset($courseExamMap[$course->id]) && $courseExamMap[$course->id] === true;
                
                $moduleCount = $course->modules ? $course->modules->count() : 0;
                
                if ($courseProgressPercentage > 0 && !$isCompleted) {
                    $coursesInProgress[] = [
                        'id' => $course->id,
                        'title' => $course->title ?? '',
                        'description' => $course->description ?? '',
                        'progress' => $courseProgressPercentage,
                        'completedModules' => round(($courseProgressPercentage / 100) * $moduleCount),
                        'totalModules' => $moduleCount,
                    ];
                } elseif ($isCompleted) {
                    $coursesCompleted[] = [
                        'id' => $course->id,
                        'title' => $course->title ?? '',
                        'description' => $course->description ?? '',
                        'quizPassed' => $quizPassed,
                    ];
                }
            }
            
            // Add profile data to user object
            $user->completed_modules = $completedModules;
            $user->completed_quizzes = $completedQuizzes;
            $user->in_progress_courses = count($coursesInProgress);
            $user->completion_percentage = $progressPercentage;
            $user->courses_in_progress = $coursesInProgress;
            $user->courses_completed = $coursesCompleted;
            
            return response()->json($user);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'message' => 'Utilizatorul nu a fost găsit',
                'error' => $e->getMessage()
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error fetching user profile', [
                'user_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Eroare la încărcarea profilului utilizatorului',
                'error' => config('app.debug') ? $e->getMessage() : 'Eroare internă'
            ], 500);
        }
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

    /**
     * Get team members (admin, manager, instructor)
     */
    public function getTeamMembers(Request $request)
    {
        $perPage = $request->get('per_page', 50);
        
        // Build query for team members only
        $query = User::with(['teams', 'courses', 'assignedCourses'])
            ->whereIn('role', ['admin', 'manager', 'instructor', 'teacher']);
        
        // Search filter
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }
        
        // Role filter
        if ($request->has('role') && $request->role !== 'all') {
            $query->where('role', $request->role);
        }
        
        // Status filter
        if ($request->has('status') && $request->status !== 'all') {
            if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'status')) {
                $query->where('status', $request->status);
            }
        }
        
        // Sort
        $sortBy = $request->get('sort_by', 'updated_at');
        $sortDirection = $request->get('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);
        
        $usersPaginated = $query->paginate($perPage);
        $users = $usersPaginated->items();
        
        // Add additional data for each user
        $usersWithData = collect($users)->map(function($user) {
            // Get assigned courses count
            $assignedCoursesCount = $user->assignedCourses()->count();
            
            // Get recent activity (last 7 days)
            $recentActivity = $this->getRecentActivity($user->id);
            
            // Add to user object
            $user->assigned_courses_count = $assignedCoursesCount;
            $user->recent_activity = $recentActivity;
            
            return $user;
        });
        
        $usersPaginated->setCollection($usersWithData);
        
        return response()->json($usersPaginated);
    }

    /**
     * Update user role and permissions
     */
    public function updateRoleAndPermissions(Request $request, $id)
    {
        $user = User::findOrFail($id);
        
        // Prevent changing own role/permissions
        if ($user->id === \Illuminate\Support\Facades\Auth::id()) {
            return response()->json([
                'message' => 'Nu poți modifica propriul rol sau permisiuni',
            ], 400);
        }
        
        $validated = $request->validate([
            'role' => 'sometimes|required|string|in:admin,manager,instructor,teacher,student',
            'permissions' => 'nullable|array',
        ]);
        
        if (isset($validated['role'])) {
            $user->role = $validated['role'];
        }
        
        if (isset($validated['permissions'])) {
            $user->permissions = $validated['permissions'];
        }
        
        $user->save();
        
        return response()->json([
            'message' => 'Rol și permisiuni actualizate cu succes',
            'user' => $user->load(['teams', 'courses']),
        ]);
    }

    /**
     * Activate user
     */
    public function activate($id)
    {
        $user = User::findOrFail($id);
        
        if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'status')) {
            $user->status = 'active';
            $user->suspended_reason = null;
            $user->suspended_until = null;
            $user->save();
        }
        
        return response()->json([
            'message' => 'Utilizator activat cu succes',
            'user' => $user->load(['teams', 'courses']),
        ]);
    }

    /**
     * Suspend user
     */
    public function suspend(Request $request, $id)
    {
        $user = User::findOrFail($id);
        
        // Prevent suspending self
        if ($user->id === \Illuminate\Support\Facades\Auth::id()) {
            return response()->json([
                'message' => 'Nu poți suspenda propriul cont',
            ], 400);
        }
        
        $validated = $request->validate([
            'reason' => 'nullable|string|max:1000',
            'suspended_until' => 'nullable|date',
        ]);
        
        if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'status')) {
            $user->status = 'suspended';
            $user->suspended_reason = $validated['reason'] ?? null;
            $user->suspended_until = isset($validated['suspended_until']) 
                ? \Carbon\Carbon::parse($validated['suspended_until']) 
                : null;
            $user->save();
        }
        
        return response()->json([
            'message' => 'Utilizator suspendat cu succes',
            'user' => $user->load(['teams', 'courses']),
        ]);
    }

    /**
     * Reset user access (force password change)
     */
    public function resetAccess($id)
    {
        $user = User::findOrFail($id);
        
        $user->must_change_password = true;
        $user->save();
        
        return response()->json([
            'message' => 'Acces resetat. Utilizatorul va trebui să schimbe parola la următoarea autentificare.',
            'user' => $user->load(['teams', 'courses']),
        ]);
    }

    /**
     * Remove user from team (remove from all teams)
     */
    public function removeFromTeam($id)
    {
        $user = User::findOrFail($id);
        
        $user->teams()->detach();
        
        return response()->json([
            'message' => 'Utilizator eliminat din toate echipele',
            'user' => $user->load(['teams', 'courses']),
        ]);
    }

    /**
     * Get recent activity for a user
     */
    private function getRecentActivity($userId)
    {
        $activities = [];
        
        // Recent course completions
        $recentCompletions = DB::table('course_user')
            ->where('user_id', $userId)
            ->whereNotNull('completed_at')
            ->where('completed_at', '>=', now()->subDays(7))
            ->count();
        
        if ($recentCompletions > 0) {
            $activities[] = [
                'type' => 'course_completion',
                'count' => $recentCompletions,
                'label' => 'Cursuri finalizate',
            ];
        }
        
        // Recent exam submissions
        $recentExams = DB::table('exam_results')
            ->where('user_id', $userId)
            ->where('created_at', '>=', now()->subDays(7))
            ->count();
        
        if ($recentExams > 0) {
            $activities[] = [
                'type' => 'exam_submission',
                'count' => $recentExams,
                'label' => 'Examene completate',
            ];
        }
        
        // Recent event registrations
        if (\Illuminate\Support\Facades\Schema::hasTable('event_user')) {
            $recentEvents = DB::table('event_user')
                ->where('user_id', $userId)
                ->where('registered', true)
                ->where('registered_at', '>=', now()->subDays(7))
                ->count();
            
            if ($recentEvents > 0) {
                $activities[] = [
                    'type' => 'event_registration',
                    'count' => $recentEvents,
                    'label' => 'Evenimente',
                ];
            }
        }
        
        return $activities;
    }
}

