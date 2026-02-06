<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Module;
use App\Models\User;
use App\Models\Event;
use App\Models\Team;
use App\Models\Test;
use App\Models\TestResult;
use App\Models\Notification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\Request;
use Carbon\Carbon;

class DashboardAdminController extends Controller
{
    public function index(Request $request)
    {
        try {
            $period = $request->get('period', 'month');
            $dateRange = $this->getDateRange($period);

            // KPIs
            $kpis = $this->calculateKPIs($dateRange);

            // Chart Data
            $chartData = $this->getChartData($dateRange);

            // Top Courses
            $topCourses = $this->getTopCourses($dateRange);

            // Problematic Courses
            $problematicCourses = $this->getProblematicCourses();

            // Learning Funnel (real data from course_user)
            $learningFunnel = $this->getLearningFunnel();

            // User Segments (real data)
            $userSegments = $this->getUserSegments($dateRange);

            // Recent Activities
            $recentActivities = $this->getRecentActivities();

            // Alerts
            $alerts = $this->getAlerts();

            // Stored notifications for current user (admin)
            $storedNotifications = [];
            if ($request->user()) {
                $storedNotifications = Notification::where('user_id', $request->user()->id)
                    ->whereNull('read_at')
                    ->orderByDesc('created_at')
                    ->take(20)
                    ->get()
                    ->map(fn ($n) => [
                        'id' => $n->id,
                        'type' => $n->type,
                        'title' => $n->title,
                        'description' => $n->description,
                        'action_url' => $n->action_url,
                        'severity' => $n->severity,
                        'created_at' => $n->created_at?->toISOString(),
                    ])
                    ->all();
            }

            // Notifications = stored + critical alerts
            $criticalAlerts = array_filter($alerts, fn($a) => ($a['severity'] ?? '') === 'critical');
            $notifications = array_merge($storedNotifications, $criticalAlerts);
            usort($notifications, fn($a, $b) => strtotime($b['created_at'] ?? 0) - strtotime($a['created_at'] ?? 0));

            // Average test completion percentage across all students
            $avgTestCompletionPercentage = $this->getAvgTestCompletionPercentage();

            return response()->json([
                'kpis' => $kpis,
                'chart_data' => $chartData,
                'engagement_metrics' => [
                    'avg_test_completion_percentage' => $avgTestCompletionPercentage,
                ],
                'learning_funnel' => $learningFunnel,
                'user_segments' => $userSegments,
                'top_courses' => $topCourses,
                'problematic_courses' => $problematicCourses,
                'recent_activities' => $recentActivities,
                'alerts' => $alerts,
                'notifications' => array_values($notifications),
            ]);
        } catch (\Exception $e) {
            \Log::error('Admin Dashboard Error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => 'Error loading dashboard data',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }

    private function getDateRange($period)
    {
        $now = Carbon::now();
        
        switch ($period) {
            case 'today':
                return [
                    'start' => $now->copy()->startOfDay(),
                    'end' => $now->copy()->endOfDay(),
                ];
            case 'week':
                return [
                    'start' => $now->copy()->startOfWeek(),
                    'end' => $now->copy()->endOfWeek(),
                ];
            case 'month':
                return [
                    'start' => $now->copy()->startOfMonth(),
                    'end' => $now->copy()->endOfMonth(),
                ];
            case 'quarter':
                return [
                    'start' => $now->copy()->startOfQuarter(),
                    'end' => $now->copy()->endOfQuarter(),
                ];
            case 'year':
                return [
                    'start' => $now->copy()->startOfYear(),
                    'end' => $now->copy()->endOfYear(),
                ];
            default:
                return [
                    'start' => Carbon::parse('2020-01-01'),
                    'end' => $now,
                ];
        }
    }

    private function calculateKPIs($dateRange)
    {
        $start = $dateRange['start'];
        $end = $dateRange['end'];

        // Total Users (only students - total count, not period-based)
        $totalUsers = User::where('role', 'student')->count();
        
        // Log for debugging (remove in production)
        \Log::info('Dashboard Users Count', [
            'all_users' => User::count(),
            'admin_users' => User::where('role', 'admin')->count(),
            'student_users' => User::where('role', 'student')->count(),
            'teacher_users' => User::where('role', 'teacher')->count(),
            'total_users' => $totalUsers
        ]);
        
        // Previous period for trend calculation
        $prevStart = $start->copy()->subDays($start->diffInDays($end));
        $prevEnd = $start;
        
        // Calculate trend based on new students in current period vs previous period
        $newUsersCurrentPeriod = User::where('role', 'student')
            ->whereBetween('created_at', [$start, $end])
            ->count();
        
        $newUsersPreviousPeriod = User::where('role', 'student')
            ->whereBetween('created_at', [$prevStart, $prevEnd])
            ->count();
        
        $totalUsersTrend = $newUsersPreviousPeriod > 0 
            ? round((($newUsersCurrentPeriod - $newUsersPreviousPeriod) / $newUsersPreviousPeriod) * 100, 1)
            : ($newUsersCurrentPeriod > 0 ? 100 : 0);

        // Total Courses (all published courses - total count, not period-based)
        $totalCourses = Course::where('status', 'published')->count();
        
        // Calculate trend based on new courses in current period vs previous period
        $newCoursesCurrentPeriod = Course::where('status', 'published')
            ->whereBetween('created_at', [$start, $end])
            ->count();
        
        $newCoursesPreviousPeriod = Course::where('status', 'published')
            ->whereBetween('created_at', [$prevStart, $prevEnd])
            ->count();
        
        $totalCoursesTrend = $newCoursesPreviousPeriod > 0 
            ? round((($newCoursesCurrentPeriod - $newCoursesPreviousPeriod) / $newCoursesPreviousPeriod) * 100, 1)
            : ($newCoursesCurrentPeriod > 0 ? 100 : 0);

        // Active Users (users who had activity in period - enrolled, completed, or updated courses)
        // Get users with course activity in period
        $usersWithCourseActivity = collect([]);
        if (Schema::hasTable('course_user')) {
            $query = DB::table('course_user')
                ->whereBetween('course_user.updated_at', [$start, $end]);
            
            if (Schema::hasColumn('course_user', 'enrolled_at')) {
                $query->orWhereBetween('course_user.enrolled_at', [$start, $end]);
            }
            if (Schema::hasColumn('course_user', 'completed_at')) {
                $query->orWhereBetween('course_user.completed_at', [$start, $end]);
            }
            
            $usersWithCourseActivity = $query->distinct()->pluck('user_id');
        }
        
        // Get users updated in period
        $usersUpdated = DB::table('users')
            ->whereBetween('users.updated_at', [$start, $end])
            ->pluck('id');
        
        $activeUsers = $usersWithCourseActivity->merge($usersUpdated)->unique()->count();

        // Previous period for trend
        $prevStart = $start->copy()->subDays($start->diffInDays($end));
        $prevEnd = $start;
        
        $prevUsersWithCourseActivity = collect([]);
        if (Schema::hasTable('course_user')) {
            $query = DB::table('course_user')
                ->whereBetween('course_user.updated_at', [$prevStart, $prevEnd]);
            
            if (Schema::hasColumn('course_user', 'enrolled_at')) {
                $query->orWhereBetween('course_user.enrolled_at', [$prevStart, $prevEnd]);
            }
            if (Schema::hasColumn('course_user', 'completed_at')) {
                $query->orWhereBetween('course_user.completed_at', [$prevStart, $prevEnd]);
            }
            
            $prevUsersWithCourseActivity = $query->distinct()->pluck('user_id');
        }
        
        $prevUsersUpdated = DB::table('users')
            ->whereBetween('users.updated_at', [$prevStart, $prevEnd])
            ->pluck('id');
        
        $previousActiveUsers = $prevUsersWithCourseActivity->merge($prevUsersUpdated)->unique()->count();

        $activeUsersTrend = $previousActiveUsers > 0 
            ? round((($activeUsers - $previousActiveUsers) / $previousActiveUsers) * 100, 1)
            : 0;

        // New Enrollments
        $newEnrollments = 0;
        $previousEnrollments = 0;
        if (Schema::hasTable('course_user') && Schema::hasColumn('course_user', 'enrolled_at')) {
            $newEnrollments = DB::table('course_user')
                ->whereBetween('enrolled_at', [$start, $end])
                ->where('enrolled', true)
                ->count();

            $previousEnrollments = DB::table('course_user')
                ->whereBetween('enrolled_at', [
                    $start->copy()->subDays($start->diffInDays($end)),
                    $start
                ])
                ->where('enrolled', true)
                ->count();
        }

        $enrollmentsTrend = $previousEnrollments > 0
            ? round((($newEnrollments - $previousEnrollments) / $previousEnrollments) * 100, 1)
            : 0;

        // Revenue (mock - you'll need to implement actual payment tracking)
        $revenueGross = 0; // TODO: Calculate from payments table
        $revenueNet = 0; // TODO: Calculate from payments table minus fees
        $revenueTrend = 0; // TODO: Calculate trend

        // Completion Rate
        $totalEnrollments = 0;
        $completedEnrollments = 0;
        if (Schema::hasTable('course_user')) {
            $totalEnrollments = DB::table('course_user')
                ->where('enrolled', true)
                ->count();
            
            if (Schema::hasColumn('course_user', 'completed_at')) {
                $completedEnrollments = DB::table('course_user')
                    ->where('enrolled', true)
                    ->whereNotNull('completed_at')
                    ->count();
            }
        }

        $completionRate = $totalEnrollments > 0 
            ? round(($completedEnrollments / $totalEnrollments) * 100, 1)
            : 0;

        $previousCompleted = 0;
        $previousTotal = 0;
        if (Schema::hasTable('course_user')) {
            $prevEnd = $start->copy()->subDay();
            $prevStart = $prevEnd->copy()->subDays($start->diffInDays($end));
            $previousTotal = DB::table('course_user')
                ->where('enrolled', true)
                ->where('enrolled_at', '<=', $prevEnd)
                ->count();
            if (Schema::hasColumn('course_user', 'completed_at')) {
                $previousCompleted = DB::table('course_user')
                    ->where('enrolled', true)
                    ->where('enrolled_at', '<=', $prevEnd)
                    ->whereNotNull('completed_at')
                    ->count();
            }
        }
        $previousCompletionRate = $previousTotal > 0 ? ($previousCompleted / $previousTotal) * 100 : 0;
        $completionTrend = round($completionRate - $previousCompletionRate, 1);

        // Engagement (average progress across all enrollments)
        $avgProgress = 0;
        if (Schema::hasTable('course_user') && Schema::hasColumn('course_user', 'progress_percentage')) {
            $avgProgress = DB::table('course_user')
                ->where('enrolled', true)
                ->whereNotNull('progress_percentage')
                ->avg('progress_percentage') ?? 0;
        }

        $engagement = round($avgProgress, 1);
        $previousAvgProgress = 0;
        if (Schema::hasTable('course_user') && Schema::hasColumn('course_user', 'progress_percentage')) {
            $prevEnd = $start->copy()->subDay();
            $previousAvgProgress = DB::table('course_user')
                ->where('enrolled', true)
                ->where('updated_at', '<', $start)
                ->whereNotNull('progress_percentage')
                ->avg('progress_percentage') ?? 0;
        }
        $engagementTrend = round($engagement - $previousAvgProgress, 1);

        // Issues/Tickets (mock - implement actual ticket system)
        $issues = 0; // TODO: Count from tickets/issues table
        $issuesTrend = 0;

        return [
            'total_users' => [
                'value' => (string)$totalUsers, // Return as string directly, no formatting
                'trend' => $totalUsersTrend >= 0 ? 'up' : 'down',
                'trendValue' => abs($totalUsersTrend) . '%',
                'color' => '#6366f1',
            ],
            'total_courses' => [
                'value' => number_format($totalCourses),
                'trend' => $totalCoursesTrend >= 0 ? 'up' : 'down',
                'trendValue' => abs($totalCoursesTrend) . '%',
                'color' => '#8b5cf6',
            ],
            'active_users' => [
                'value' => number_format($activeUsers),
                'trend' => $activeUsersTrend >= 0 ? 'up' : 'down',
                'trendValue' => abs($activeUsersTrend) . '%',
                'color' => '#3b82f6',
            ],
            'new_enrollments' => [
                'value' => number_format($newEnrollments),
                'trend' => $enrollmentsTrend >= 0 ? 'up' : 'down',
                'trendValue' => abs($enrollmentsTrend) . '%',
                'color' => '#10b981',
            ],
            'revenue_gross' => [
                'value' => $revenueGross, // Return as number for frontend formatting
                'trend' => $revenueTrend >= 0 ? 'up' : 'down',
                'trendValue' => abs($revenueTrend) . '%',
                'color' => '#f59e0b',
            ],
            'revenue_net' => [
                'value' => $revenueNet, // Return as number for frontend formatting
                'trend' => $revenueTrend >= 0 ? 'up' : 'down',
                'trendValue' => abs($revenueTrend) . '%',
                'color' => '#8b5cf6',
            ],
            'completion_rate' => [
                'value' => $completionRate . '%',
                'trend' => $completionTrend >= 0 ? 'up' : 'down',
                'trendValue' => abs($completionTrend) . '%',
                'color' => '#ef4444',
            ],
            'engagement' => [
                'value' => $engagement . '%',
                'trend' => $engagementTrend >= 0 ? 'up' : 'down',
                'trendValue' => abs($engagementTrend) . '%',
                'color' => '#ec4899',
            ],
            'issues' => [
                'value' => number_format($issues),
                'trend' => $issuesTrend >= 0 ? 'up' : 'down',
                'trendValue' => abs($issuesTrend),
                'color' => '#f97316',
            ],
        ];
    }

    private function getChartData($dateRange)
    {
        $start = $dateRange['start'];
        $end = $dateRange['end'];
        $days = $start->diffInDays($end);
        $dataPoints = min($days, 30); // Max 30 data points

        $chartData = [];
        $interval = $days / $dataPoints;

        for ($i = 0; $i <= $dataPoints; $i++) {
            $date = $start->copy()->addDays($i * $interval);
            $dateEnd = $date->copy()->addDays($interval);

            $enrollments = 0;
            if (Schema::hasTable('course_user') && Schema::hasColumn('course_user', 'enrolled_at')) {
                $enrollments = DB::table('course_user')
                    ->whereBetween('enrolled_at', [$date, $dateEnd])
                    ->where('enrolled', true)
                    ->count();
            }

            $revenue = 0; // TODO: Calculate from payments

            $users = User::whereBetween('created_at', [$date, $dateEnd])->count();

            $chartData[] = [
                'date' => $date->format('Y-m-d'),
                'enrollments' => $enrollments,
                'revenue' => $revenue,
                'users' => $users,
            ];
        }

        return $chartData;
    }

    private function getTopCourses($dateRange)
    {
        $start = $dateRange['start'];
        $end = $dateRange['end'];

        return Course::with('teacher')
            ->get()
            ->map(function($course) use ($start, $end) {
                $enrollments = 0;
                $completed = 0;
                $totalEnrollments = 0;
                
                if (Schema::hasTable('course_user')) {
                    if (Schema::hasColumn('course_user', 'enrolled_at')) {
                        $enrollments = DB::table('course_user')
                            ->where('course_id', $course->id)
                            ->where('enrolled', true)
                            ->whereBetween('enrolled_at', [$start, $end])
                            ->count();
                    }
                    
                    if (Schema::hasColumn('course_user', 'completed_at')) {
                        $completed = DB::table('course_user')
                            ->where('course_id', $course->id)
                            ->whereNotNull('completed_at')
                            ->count();
                    }
                    
                    $totalEnrollments = DB::table('course_user')
                        ->where('course_id', $course->id)
                        ->where('enrolled', true)
                        ->count();
                }
                
                $completionRate = $totalEnrollments > 0 
                    ? round(($completed / $totalEnrollments) * 100, 1)
                    : 0;

                return [
                    'id' => $course->id,
                    'title' => $course->title,
                    'enrollments' => $enrollments,
                    'revenue' => 0, // TODO: Calculate from payments
                    'completion_rate' => $completionRate,
                ];
            })
            ->sortByDesc('enrollments')
            ->take(5)
            ->values()
            ->toArray();
    }

    private function getProblematicCourses()
    {
        return Course::all()
            ->map(function($course) {
                $enrollments = 0;
                $completed = 0;
                $started = 0;
                
                if (Schema::hasTable('course_user')) {
                    $enrollments = DB::table('course_user')
                        ->where('course_id', $course->id)
                        ->where('enrolled', true)
                        ->count();
                    
                    if (Schema::hasColumn('course_user', 'completed_at')) {
                        $completed = DB::table('course_user')
                            ->where('course_id', $course->id)
                            ->whereNotNull('completed_at')
                            ->count();
                    }
                    
                    if (Schema::hasColumn('course_user', 'started_at')) {
                        $started = DB::table('course_user')
                            ->where('course_id', $course->id)
                            ->whereNotNull('started_at')
                            ->count();
                    }
                }
                
                $completionRate = $enrollments > 0 
                    ? round(($completed / $enrollments) * 100, 1)
                    : 0;

                $dropoffRate = $started > 0
                    ? round((($started - $completed) / $started) * 100, 1)
                    : 0;

                return [
                    'id' => $course->id,
                    'title' => $course->title,
                    'completion_rate' => $completionRate,
                    'rating' => 0, // TODO: Calculate from reviews
                    'dropoff_rate' => $dropoffRate,
                ];
            })
            ->filter(function($course) {
                return $course['completion_rate'] < 30 
                    || $course['dropoff_rate'] > 50
                    || ($course['rating'] > 0 && $course['rating'] < 3);
            })
            ->take(5)
            ->values()
            ->toArray();
    }

    /**
     * Learning funnel - real counts from course_user
     */
    private function getLearningFunnel()
    {
        if (!Schema::hasTable('course_user')) {
            return [
                'enrolled' => 0,
                'started' => 0,
                'progress_25' => 0,
                'progress_50' => 0,
                'progress_75' => 0,
                'completed' => 0,
            ];
        }

        $enrolled = DB::table('course_user')
            ->where('enrolled', true)
            ->count();

        $started = 0;
        if (Schema::hasColumn('course_user', 'started_at')) {
            $started = DB::table('course_user')
                ->where('enrolled', true)
                ->whereNotNull('started_at')
                ->count();
        } else {
            $started = $enrolled; // fallback: consider all enrolled as started
        }

        $completed = 0;
        if (Schema::hasColumn('course_user', 'completed_at')) {
            $completed = DB::table('course_user')
                ->where('enrolled', true)
                ->whereNotNull('completed_at')
                ->count();
        }

        $progress25 = 0;
        $progress50 = 0;
        $progress75 = 0;
        if (Schema::hasColumn('course_user', 'progress_percentage')) {
            $progress25 = DB::table('course_user')
                ->where('enrolled', true)
                ->where('progress_percentage', '>=', 25)
                ->count();
            $progress50 = DB::table('course_user')
                ->where('enrolled', true)
                ->where('progress_percentage', '>=', 50)
                ->count();
            $progress75 = DB::table('course_user')
                ->where('enrolled', true)
                ->where('progress_percentage', '>=', 75)
                ->count();
        } else {
            $progress25 = $started;
            $progress50 = $started;
            $progress75 = $completed;
        }

        return [
            'enrolled' => $enrolled,
            'started' => $started,
            'progress_25' => $progress25,
            'progress_50' => $progress50,
            'progress_75' => $progress75,
            'completed' => $completed,
        ];
    }

    /**
     * User segments - real counts
     * new: created in last 30 days
     * at_risk: enrolled, started, but no update in 14+ days and not completed
     * highly_engaged: at least one enrollment with progress >= 50%
     * inactive: no course_user activity in 30+ days
     */
    private function getUserSegments($dateRange)
    {
        $new = User::where('role', 'student')
            ->where('created_at', '>=', now()->subDays(30))
            ->count();

        $highlyEngaged = 0;
        $atRisk = 0;
        $inactive = 0;

        if (!Schema::hasTable('course_user')) {
            return [
                'new' => $new,
                'at_risk' => 0,
                'highly_engaged' => 0,
                'inactive' => 0,
            ];
        }

        if (Schema::hasColumn('course_user', 'progress_percentage')) {
            $highlyEngagedIds = DB::table('course_user')
                ->join('users', 'course_user.user_id', '=', 'users.id')
                ->where('users.role', 'student')
                ->where('course_user.enrolled', true)
                ->where('course_user.progress_percentage', '>=', 50)
                ->distinct()
                ->pluck('course_user.user_id');
            $highlyEngaged = $highlyEngagedIds->count();
        }

        $cutoff14d = now()->subDays(14);
        $cutoff30d = now()->subDays(30);

        $usersActive14d = DB::table('course_user')
            ->where('updated_at', '>=', $cutoff14d)
            ->distinct()
            ->pluck('user_id');

        $usersActive30d = DB::table('course_user')
            ->where('updated_at', '>=', $cutoff30d)
            ->distinct()
            ->pluck('user_id');

        $enrolledStartedNotCompleted = DB::table('course_user')
            ->join('users', 'course_user.user_id', '=', 'users.id')
            ->where('users.role', 'student')
            ->where('course_user.enrolled', true)
            ->where(function ($q) {
                $q->whereNotNull('course_user.started_at')
                    ->orWhereRaw('course_user.progress_percentage > 0');
            })
            ->whereNull('course_user.completed_at')
            ->distinct()
            ->pluck('course_user.user_id');

        $atRisk = $enrolledStartedNotCompleted->diff($usersActive14d)->count();

        $inactive = User::where('role', 'student')
            ->whereNotIn('id', $usersActive30d)
            ->count();

        return [
            'new' => $new,
            'at_risk' => $atRisk,
            'highly_engaged' => $highlyEngaged,
            'inactive' => $inactive,
        ];
    }

    private function getRecentActivities()
    {
        $activities = [];

        // Recent course completions
        $recentCompletions = collect([]);
        if (Schema::hasTable('course_user') && Schema::hasColumn('course_user', 'completed_at')) {
            $recentCompletions = DB::table('course_user')
                ->whereNotNull('completed_at')
                ->orderBy('completed_at', 'desc')
                ->take(15)
                ->get();
        }

        foreach ($recentCompletions as $completion) {
            $course = Course::find($completion->course_id);
            $user = User::find($completion->user_id);
            
            if ($course && $user && $completion->completed_at) {
                $activities[] = [
                    'id' => 'completion_' . $completion->id,
                    'type' => 'completion',
                    'description' => "{$user->name} a finalizat cursul \"{$course->title}\"",
                    'created_at' => is_string($completion->completed_at) 
                        ? $completion->completed_at 
                        : $completion->completed_at->format('Y-m-d H:i:s'),
                ];
            }
        }

        // Recent test completions
        if (Schema::hasTable('test_results') || Schema::hasTable('exam_results')) {
            try {
                $tableName = Schema::hasTable('test_results') ? 'test_results' : 'exam_results';
                $recentTestResults = DB::table($tableName)
                    ->where(function($query) use ($tableName) {
                        if (Schema::hasColumn($tableName, 'completed_at')) {
                            $query->whereNotNull('completed_at');
                        }
                        $query->orWhereNotNull('created_at');
                    })
                    ->orderByRaw('COALESCE(completed_at, created_at) DESC')
                    ->take(15)
                    ->get();

                foreach ($recentTestResults as $testResult) {
                    $test = Test::find($testResult->test_id ?? $testResult->exam_id ?? null);
                    $user = User::find($testResult->user_id);
                    
                    if ($test && $user) {
                        $passed = isset($testResult->passed) ? (bool)$testResult->passed : false;
                        $passedText = $passed ? 'a trecut' : 'a eșuat';
                        $scoreText = '';
                        
                        if (isset($testResult->max_score) && $testResult->max_score > 0 && isset($testResult->score) && $testResult->score !== null) {
                            $scoreText = " ({$testResult->score}/{$testResult->max_score})";
                        } elseif (isset($testResult->score) && $testResult->score !== null) {
                            $scoreText = " ({$testResult->score})";
                        }
                        
                        $activityDate = $testResult->completed_at ?? $testResult->created_at ?? now();
                        
                        $activities[] = [
                            'id' => 'test_' . ($testResult->id ?? uniqid()),
                            'type' => 'exam_submitted',
                            'description' => "{$user->name} {$passedText} testul \"{$test->title}\"{$scoreText}",
                            'created_at' => is_string($activityDate) ? $activityDate : (is_object($activityDate) ? $activityDate->format('Y-m-d H:i:s') : now()->format('Y-m-d H:i:s')),
                        ];
                    }
                }
            } catch (\Exception $e) {
                \Log::warning('Error fetching test results for dashboard: ' . $e->getMessage());
            }
        }

        // Sort by date and take most recent
        usort($activities, function($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });

        return array_slice($activities, 0, 30);
    }

    /**
     * Get average test completion percentage across all students
     */
    private function getAvgTestCompletionPercentage()
    {
        if (!Schema::hasTable('test_results')) {
            return 0;
        }

        $avg = DB::table('test_results')
            ->whereNotNull('percentage')
            ->avg('percentage');

        return $avg !== null ? round((float) $avg, 1) : 0;
    }

    private function getPlatformAverageCompletionRate(): float
    {
        if (!Schema::hasTable('course_user') || !Schema::hasColumn('course_user', 'completed_at')) {
            return 50;
        }
        $total = DB::table('course_user')->where('enrolled', true)->count();
        if ($total === 0) return 50;
        $completed = DB::table('course_user')->where('enrolled', true)->whereNotNull('completed_at')->count();
        return round(($completed / $total) * 100, 1);
    }

    private function getAlerts()
    {
        $alerts = [];

        // Check for courses with low completion
        $lowCompletionCourses = Course::all()
            ->filter(function($course) {
                if (!Schema::hasTable('course_user')) {
                    return false;
                }
                
                $enrollments = DB::table('course_user')
                    ->where('course_id', $course->id)
                    ->where('enrolled', true)
                    ->count();
                
                if ($enrollments === 0) return false;

                $completed = 0;
                if (Schema::hasColumn('course_user', 'completed_at')) {
                    $completed = DB::table('course_user')
                        ->where('course_id', $course->id)
                        ->whereNotNull('completed_at')
                        ->count();
                }
                
                $rate = ($completed / $enrollments) * 100;
                return $rate < 20;
            })
            ->take(3);

        foreach ($lowCompletionCourses as $course) {
            $alerts[] = [
                'id' => 'alert_low_completion_' . $course->id,
                'type' => 'low_completion',
                'severity' => 'warning',
                'title' => 'Rată de finalizare scăzută',
                'description' => "Cursul \"{$course->title}\" are o rată de finalizare sub 20%",
                'action_url' => "/admin/courses/{$course->id}",
                'created_at' => now()->toDateTimeString(),
            ];
        }

        // Check for inactive instructors (mock - implement based on your logic)
        $inactiveInstructors = User::where('role', 'teacher')
            ->whereDoesntHave('courses', function($query) {
                $query->where('updated_at', '>=', now()->subMonths(3));
            })
            ->take(2)
            ->get();

        foreach ($inactiveInstructors as $instructor) {
            $alerts[] = [
                'id' => 'alert_inactive_instructor_' . $instructor->id,
                'type' => 'instructor_inactive',
                'severity' => 'info',
                'title' => 'Instructor inactiv',
                'description' => "Instructorul {$instructor->name} nu a actualizat cursuri în ultimele 3 luni",
                'action_url' => "/admin/users/{$instructor->id}",
                'created_at' => now()->toDateTimeString(),
            ];
        }

        // Course success below/above average
        $avgRate = $this->getPlatformAverageCompletionRate();
        foreach (Course::where('status', 'published')->get() as $course) {
            $enrollments = 0;
            $completed = 0;
            if (Schema::hasTable('course_user')) {
                $enrollments = DB::table('course_user')->where('course_id', $course->id)->where('enrolled', true)->count();
                if ($enrollments > 0 && Schema::hasColumn('course_user', 'completed_at')) {
                    $completed = DB::table('course_user')->where('course_id', $course->id)->where('enrolled', true)->whereNotNull('completed_at')->count();
                }
            }
            if ($enrollments < 3) continue;
            $rate = $enrollments > 0 ? round(($completed / $enrollments) * 100, 1) : 0;
            if ($rate < $avgRate - 15 && $rate < 30) {
                $alerts[] = [
                    'id' => 'alert_success_below_' . $course->id,
                    'type' => 'course_success_below',
                    'severity' => 'warning',
                    'title' => 'Rată de finalizare sub medie',
                    'description' => 'Cursul "' . $course->title . '" are ' . $rate . '% (medie: ' . $avgRate . '%)',
                    'action_url' => "/admin/courses/{$course->id}",
                    'created_at' => now()->toDateTimeString(),
                ];
            } elseif ($rate > $avgRate + 15 && $rate >= 50) {
                $alerts[] = [
                    'id' => 'alert_success_above_' . $course->id,
                    'type' => 'course_success_above',
                    'severity' => 'info',
                    'title' => 'Rată de finalizare peste medie',
                    'description' => 'Cursul "' . $course->title . '" are ' . $rate . '% (medie: ' . $avgRate . '%)',
                    'action_url' => "/admin/courses/{$course->id}",
                    'created_at' => now()->toDateTimeString(),
                ];
            }
        }

        return $alerts;
    }
}
