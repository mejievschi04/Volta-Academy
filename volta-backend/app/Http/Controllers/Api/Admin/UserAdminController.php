<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamResult;
use App\Models\Test;
use App\Services\UserAssignedCoursesService;
use App\Services\TestAttemptService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class UserAdminController extends Controller
{
    /** Câmpuri echipe folosite în admin (swatch, ordine); belongsToMany cere `teams.id`. */
    private const TEAMS_ADMIN_EAGER = 'teams:id,name,accent_color,sort_order';

    /** @return array<int, string> */
    private function eagerLoadTeamsCoursesAssigned(): array
    {
        return [self::TEAMS_ADMIN_EAGER, 'courses', 'assignedCourses'];
    }

    /** @return array<int, string> */
    private function eagerLoadTeamsCourses(): array
    {
        return [self::TEAMS_ADMIN_EAGER, 'courses'];
    }

    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 15);
        $trashedOnly = $request->boolean('trashed');

        // Build query: normal users sau doar cei din coș (șterși soft)
        $query = $trashedOnly
            ? User::onlyTrashed()->with($this->eagerLoadTeamsCoursesAssigned())
            : User::with($this->eagerLoadTeamsCoursesAssigned());

        // Search filter
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }
        
        // Role filter (staff roles)
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
            $query->whereIn('role', ['admin', 'instructor', 'analyst']);
        }
        
        // Sort
        $sortBy = $request->get('sort_by', 'updated_at');
        $sortDirection = $request->get('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);
        
        // Get all courses once (outside the loop to avoid N+1)
        $allCourses = \App\Models\Course::with('modules')->get();
        $totalCourses = $allCourses->count();
        
        // Get paginated users with relationships
        $usersPaginated = $request->boolean('all') ? null : $query->paginate($perPage);
        $users = $usersPaginated ? $usersPaginated->items() : $query->get()->all();
        
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
            if (in_array($user->role, ['admin', 'analyst'], true)) {
                $user->total_courses = null;
                $user->completed_courses = null;
                $user->completion_percentage = null;
                $user->completed_modules = null;
                $user->total_modules = null;
                return $user;
            }
            
            $userProgress = $allProgress->get($user->id, collect());
            $completedCourses = 0;
            $assignedCount = $userProgress->count();
            $totalModules = 0;
            $completedModules = 0;
            
            foreach ($userProgress as $progress) {
                $course = $allCourses->firstWhere('id', $progress->course_id);
                $moduleCount = $course && $course->modules ? $course->modules->count() : 0;
                $totalModules += $moduleCount;
                if ($progress->completed_at) {
                    $completedCourses++;
                    $completedModules += $moduleCount;
                } elseif (($progress->progress_percentage ?? 0) > 0 && $moduleCount > 0) {
                    $completedModules += round(($progress->progress_percentage / 100) * $moduleCount);
                }
            }
            
            $user->total_courses = $assignedCount;
            $user->completed_courses = $completedCourses;
            $user->total_modules = $totalModules;
            $user->completed_modules = $completedModules;
            $user->completion_percentage = $assignedCount > 0 
                ? round(($completedCourses / $assignedCount) * 100, 1) 
                : 0;
            
            return $user;
        });
        
        if (! $usersPaginated) {
            return response()->json($usersWithStats->values());
        }

        // Replace items in paginator
        $usersPaginated->setCollection($usersWithStats);
        
        return response()->json($usersPaginated);
    }

    public function show($id)
    {
        try {
            $user = User::with([
                self::TEAMS_ADMIN_EAGER,
                'assignedCourses.modules:id,course_id,title,order',
                'assignedCourses.teacher:id,name',
            ])->findOrFail($id);

            $coursesData = app(UserAssignedCoursesService::class)->buildProfileCoursesData($user);

            $user->completed_modules = $coursesData['completed_modules'];
            $user->completed_quizzes = $coursesData['completed_quizzes'];
            $user->in_progress_courses = $coursesData['in_progress_courses'];
            $user->completed_courses = $coursesData['completed_courses'];
            $user->total_courses = $coursesData['total_courses'];
            $user->completion_percentage = $coursesData['completion_percentage'];
            $user->courses_in_progress = $coursesData['courses_in_progress'];
            $user->courses_completed = $coursesData['courses_completed'];
            $user->courses_not_accessed = $coursesData['courses_not_accessed'];
            $user->courses_assigned = $coursesData['courses_assigned'];
            $user->course_stats = $coursesData['course_stats'];

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
        if ($request->input('team_id') === '' || $request->input('team_id') === null) {
            $request->merge(['team_id' => null]);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255|regex:/^[\p{L}\p{M}0-9\s\-\.]+$/u', // Sanitize name
            'email' => 'required|string|email|max:255|unique:users',
            'password' => [
                'nullable',
                'string',
                'min:8', // Increased minimum length
                'regex:/[a-z]/', // At least one lowercase letter
                'regex:/[A-Z]/', // At least one uppercase letter
                'regex:/[0-9]/', // At least one number
            ],
            'role' => 'required|string|in:student,admin,instructor,analyst',
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
        $validated['status'] = 'active'; // Admin-created users sunt activi imediat
        $validated['name'] = strip_tags($validated['name']); // Sanitize HTML tags
        $validated['email'] = strtolower(trim($validated['email'])); // Normalize email
        $validated['bio'] = isset($validated['bio']) ? strip_tags($validated['bio']) : null; // Sanitize bio

        $user = User::create(collect($validated)->except('team_id')->all());

		// Attach to team if provided
		if (!empty($validated['team_id'])) {
			$user->teams()->syncWithoutDetaching([$validated['team_id']]);
			app(UserAssignedCoursesService::class)->enrollUserInLinkedTeamCourses($user->fresh());
		}
        
        // Log user creation
        \Illuminate\Support\Facades\Log::info('Admin created user', [
            'admin_id' => \Illuminate\Support\Facades\Auth::id(),
            'created_user_id' => $user->id,
            'created_user_email' => $user->email,
        ]);

        return response()->json([
            'message' => 'Utilizator creat cu succes. Parola implicită: volta2025',
            'user' => $user->load($this->eagerLoadTeamsCourses()),
        ], 201);
    }

    public function sendInvitation(int $id, \App\Services\RegistrationInvitationService $service)
    {
        abort_unless(Auth::user()?->role === 'admin', 403);
        if (! (bool) \App\Models\Setting::get('email_notifications', true)) {
            return response()->json(['message' => 'Trimiterea emailurilor este dezactivată în setări.'], 422);
        }

        DB::transaction(function () use ($id, $service) {
            $user = User::lockForUpdate()->findOrFail($id);
            $service->createAndSend(
                email: $user->email,
                invitedBy: Auth::user(),
                name: $user->name,
                role: $user->role,
                existingUser: $user,
            );
        });

        return response()->json(['message' => 'Invitația a fost programată pentru trimitere prin email.']);
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|string|email|max:255|unique:users,email,' . $id,
            'password' => 'nullable|string|min:6',
            'role' => 'sometimes|required|string|in:student,admin,instructor,analyst',
            'bio' => 'nullable|string|max:1000',
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
            'user' => $user->load($this->eagerLoadTeamsCourses()),
        ]);
    }

    /**
     * Ștergere soft: utilizatorul este mutat în coș (deleted_at).
     * Poate fi restabilit cu restore() păstrând progresul.
     */
    public function destroy($id)
    {
        $user = User::findOrFail($id);
        if ($user->id === Auth::id()) {
            return response()->json(['message' => 'Nu te poți șterge pe tine însuți.'], 422);
        }
        $user->delete(); // soft delete

        return response()->json([
            'message' => 'Utilizator mutat în coș. Poate fi restabilit din Coș.',
        ]);
    }

    /**
     * Restabilește un utilizator din coș (cu tot progresul).
     */
    public function restore($id)
    {
        $user = User::onlyTrashed()->findOrFail($id);
        $user->restore();

        return response()->json([
            'message' => 'Utilizator restabilit cu succes',
            'user' => $user->load($this->eagerLoadTeamsCoursesAssigned()),
        ]);
    }

    /**
     * Ștergere definitivă din coș. Progresul utilizatorului se șterge prin cascadă;
     * conținutul creat de el (cursuri, teste, bănci, echipe) este transferat adminului curent,
     * altfel cheile străine cu cascade l-ar șterge.
     */
    public function forceDestroy($id)
    {
        $user = User::onlyTrashed()->findOrFail($id);
        $adminId = Auth::id();
        if ($user->id === $adminId) {
            return response()->json(['message' => 'Nu te poți șterge pe tine însuți.'], 422);
        }

        $ownedContent = [
            'courses' => 'teacher_id',
            'tests' => 'created_by',
            'question_banks' => 'created_by',
            'teams' => 'owner_id',
        ];

        $email = $user->email;

        DB::transaction(function () use ($user, $adminId, $ownedContent) {
            foreach ($ownedContent as $table => $column) {
                if (Schema::hasTable($table) && Schema::hasColumn($table, $column)) {
                    DB::table($table)->where($column, $user->id)->update([$column => $adminId]);
                }
            }
            $user->forceDelete();
        });

        Log::info('Admin permanently deleted user', [
            'admin_id' => $adminId,
            'deleted_user_id' => (int) $id,
            'deleted_email' => $email,
        ]);

        return response()->json([
            'message' => 'Utilizator șters definitiv',
        ]);
    }

    /**
     * Aprobă o cerere de înregistrare (status pending -> active)
     */
    public function approve($id)
    {
        $user = User::findOrFail($id);
        if (($user->status ?? 'active') !== 'pending') {
            return response()->json([
                'message' => 'Acest utilizator nu așteaptă aprobare',
            ], 422);
        }
        $user->status = 'active';
        $user->save();

        Log::info('Admin approved user registration', [
            'admin_id' => Auth::id(),
            'user_id' => $user->id,
            'user_email' => $user->email,
        ]);

        return response()->json([
            'message' => 'Cererea a fost aprobată. Utilizatorul poate accesa platforma.',
            'user' => $user->load($this->eagerLoadTeamsCourses()),
        ]);
    }

    /**
     * Respinge o cerere de înregistrare (șterge utilizatorul pending)
     */
    public function reject(Request $request, $id)
    {
        $user = User::findOrFail($id);
        if (($user->status ?? 'active') !== 'pending') {
            return response()->json([
                'message' => 'Acest utilizator nu așteaptă aprobare',
            ], 422);
        }
        $email = $user->email;
        $user->delete();

        Log::info('Admin rejected user registration', [
            'admin_id' => Auth::id(),
            'rejected_email' => $email,
        ]);

        return response()->json([
            'message' => 'Cererea a fost respinsă',
        ]);
    }

    public function assignCourses(Request $request, $id)
    {
        $user = User::findOrFail($id);

        if ($user->isLearningActivityExempt()) {
            return response()->json([
                'message' => 'Nu atribuim cursuri pentru rolurile administrator sau analist.',
            ], 422);
        }

        $validated = $request->validate([
            'course_ids' => 'present|array',
            'course_ids.*' => 'exists:courses,id',
            'is_mandatory' => 'nullable|boolean',
        ]);

        $courseIds = $validated['course_ids'];
        $isMandatory = $validated['is_mandatory'] ?? true;

        $assignment = app(UserAssignedCoursesService::class);
        $assignment->syncDirectAssignments($user, $courseIds, [
            'is_mandatory' => $isMandatory,
            'assigned_at' => now(),
            'enrolled' => true,
            'enrolled_at' => now(),
        ]);

        \Illuminate\Support\Facades\Cache::forget("dashboard_user_{$user->id}_stats");
        \Illuminate\Support\Facades\Cache::forget("profile_user_{$user->id}");

        return response()->json([
            'message' => 'Cursuri atribuite cu succes',
            'user' => $user->load('assignedCourses'),
        ]);
    }

    public function markCourseCompleted(Request $request, $id, $courseId)
    {
        $user = User::findOrFail($id);
        if ($user->isLearningActivityExempt()) {
            return response()->json([
                'message' => 'Nu marcăm progres pentru rolurile administrator sau analist.',
            ], 422);
        }
        $course = Course::findOrFail($courseId);
        app(\App\Services\CourseProgressService::class)->markCourseCompletedByAdmin($user, $course);
        \Illuminate\Support\Facades\Cache::forget("dashboard_user_{$user->id}_stats");
        \Illuminate\Support\Facades\Cache::forget("profile_user_{$user->id}");

        return response()->json([
            'message' => 'Curs marcat ca finalizat',
        ]);
    }

    public function grantTestExtraAttempt(Request $request, $id, $testId)
    {
        $actor = Auth::user();
        if (! $actor || (! $actor->isAdmin() && ! $actor->isInstructor())) {
            return response()->json(['message' => 'Acces interzis.'], 403);
        }

        $user = User::findOrFail($id);
        $test = Test::findOrFail($testId);
        $courseId = $request->filled('course_id') ? (int) $request->input('course_id') : null;

        $grant = app(TestAttemptService::class)->grantExtraAttempt(
            (int) $user->id,
            (int) $test->id,
            (int) $actor->id,
            $courseId
        );

        $completedCount = app(TestAttemptService::class)
            ->completedAttemptsQuery((int) $user->id, (int) $test->id, $courseId)
            ->count();

        return response()->json([
            'message' => 'A fost adăugată 1 încercare.',
            'extra_attempts' => (int) $grant->extra_attempts,
            'remaining_attempts' => app(TestAttemptService::class)->remainingAttemptsFor(
                $test,
                (int) $user->id,
                $completedCount
            ),
        ]);
    }

    public function removeCourse(Request $request, $id, $courseId)
    {
        $user = User::findOrFail($id);
        $course = Course::findOrFail($courseId);
        app(UserAssignedCoursesService::class)->revokeDirectAssignment($user, $course);

        \Illuminate\Support\Facades\Cache::forget("dashboard_user_{$user->id}_stats");
        \Illuminate\Support\Facades\Cache::forget("profile_user_{$user->id}");

        return response()->json([
            'message' => 'Curs eliminat cu succes',
        ]);
    }

    /**
     * Get team members (admin, instructor, analyst)
     */
    public function getTeamMembers(Request $request)
    {
        $perPage = $request->get('per_page', 50);
        
        // Build query for team members only
        $query = User::with($this->eagerLoadTeamsCoursesAssigned())
            ->whereIn('role', ['admin', 'instructor', 'analyst']);
        
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
            'role' => 'sometimes|required|string|in:admin,instructor,analyst,student',
            'permissions' => 'nullable|array',
        ]);
        
        if (isset($validated['role'])) {
            $user->role = $validated['role'];
        }
        
        if (isset($validated['permissions'])) {
            $user->permissions = $validated['permissions'];
        }
        
        $user->save();
        if ($user->isLearningActivityExempt()) {
            $user->assignedCourses()->detach();
        }
        
        return response()->json([
            'message' => 'Rol și permisiuni actualizate cu succes',
            'user' => $user->load($this->eagerLoadTeamsCourses()),
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
            'user' => $user->load($this->eagerLoadTeamsCourses()),
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
            $user->tokens()->delete();
        }
        
        return response()->json([
            'message' => 'Utilizator suspendat cu succes',
            'user' => $user->load($this->eagerLoadTeamsCourses()),
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
            'user' => $user->load($this->eagerLoadTeamsCourses()),
        ]);
    }

    /**
     * Remove user from team (remove from all teams)
     */
    public function removeFromTeam($id)
    {
        $user = User::findOrFail($id);
        
        $teams = $user->teams()->get();
        $user->teams()->detach();
        foreach ($teams as $team) {
            app(UserAssignedCoursesService::class)->revokeTeamOnlyEnrollmentsForUser($user, $team);
        }

        return response()->json([
            'message' => 'Utilizator eliminat din toate echipele',
            'user' => $user->load($this->eagerLoadTeamsCourses()),
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
