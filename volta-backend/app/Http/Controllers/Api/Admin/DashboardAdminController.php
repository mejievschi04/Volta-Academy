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
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Carbon\Carbon;

class DashboardAdminController extends Controller
{
    public function index(Request $request)
    {
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

        // Recent Activities
        $recentActivities = $this->getRecentActivities();

        // Alerts
        $alerts = $this->getAlerts();

        // Notifications (critical alerts)
        $notifications = array_filter($alerts, function($alert) {
            return $alert['severity'] === 'critical';
        });

        return response()->json([
            'kpis' => $kpis,
            'chart_data' => $chartData,
            'top_courses' => $topCourses,
            'problematic_courses' => $problematicCourses,
            'recent_activities' => $recentActivities,
            'alerts' => $alerts,
            'notifications' => array_values($notifications),
        ]);
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

        // Active Users (users who had activity in period - enrolled, completed, or updated courses)
        // Get users with course activity in period
        $usersWithCourseActivity = DB::table('course_user')
            ->where(function($query) use ($start, $end) {
                $query->whereBetween('course_user.updated_at', [$start, $end])
                      ->orWhereBetween('course_user.enrolled_at', [$start, $end])
                      ->orWhereBetween('course_user.completed_at', [$start, $end]);
            })
            ->distinct()
            ->pluck('user_id');
        
        // Get users updated in period
        $usersUpdated = DB::table('users')
            ->whereBetween('users.updated_at', [$start, $end])
            ->pluck('id');
        
        $activeUsers = $usersWithCourseActivity->merge($usersUpdated)->unique()->count();

        // Previous period for trend
        $prevStart = $start->copy()->subDays($start->diffInDays($end));
        $prevEnd = $start;
        
        $prevUsersWithCourseActivity = DB::table('course_user')
            ->where(function($query) use ($prevStart, $prevEnd) {
                $query->whereBetween('course_user.updated_at', [$prevStart, $prevEnd])
                      ->orWhereBetween('course_user.enrolled_at', [$prevStart, $prevEnd])
                      ->orWhereBetween('course_user.completed_at', [$prevStart, $prevEnd]);
            })
            ->distinct()
            ->pluck('user_id');
        
        $prevUsersUpdated = DB::table('users')
            ->whereBetween('users.updated_at', [$prevStart, $prevEnd])
            ->pluck('id');
        
        $previousActiveUsers = $prevUsersWithCourseActivity->merge($prevUsersUpdated)->unique()->count();

        $activeUsersTrend = $previousActiveUsers > 0 
            ? round((($activeUsers - $previousActiveUsers) / $previousActiveUsers) * 100, 1)
            : 0;

        // New Enrollments
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

        $enrollmentsTrend = $previousEnrollments > 0
            ? round((($newEnrollments - $previousEnrollments) / $previousEnrollments) * 100, 1)
            : 0;

        // Revenue (mock - you'll need to implement actual payment tracking)
        $revenueGross = 0; // TODO: Calculate from payments table
        $revenueNet = 0; // TODO: Calculate from payments table minus fees
        $revenueTrend = 0; // TODO: Calculate trend

        // Completion Rate
        $totalEnrollments = DB::table('course_user')
            ->where('enrolled', true)
            ->count();
        
        $completedEnrollments = DB::table('course_user')
            ->where('enrolled', true)
            ->whereNotNull('completed_at')
            ->count();

        $completionRate = $totalEnrollments > 0 
            ? round(($completedEnrollments / $totalEnrollments) * 100, 1)
            : 0;

        $previousCompletionRate = 75; // Mock - calculate from previous period
        $completionTrend = $completionRate - $previousCompletionRate;

        // Engagement (average progress across all enrollments)
        $avgProgress = DB::table('course_user')
            ->where('enrolled', true)
            ->whereNotNull('progress_percentage')
            ->avg('progress_percentage') ?? 0;

        $engagement = round($avgProgress, 1);
        $previousEngagement = 60; // Mock
        $engagementTrend = $engagement - $previousEngagement;

        // Issues/Tickets (mock - implement actual ticket system)
        $issues = 0; // TODO: Count from tickets/issues table
        $issuesTrend = 0;

        return [
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

            $enrollments = DB::table('course_user')
                ->whereBetween('enrolled_at', [$date, $dateEnd])
                ->where('enrolled', true)
                ->count();

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
                $enrollments = DB::table('course_user')
                    ->where('course_id', $course->id)
                    ->where('enrolled', true)
                    ->whereBetween('enrolled_at', [$start, $end])
                    ->count();
                
                $completed = DB::table('course_user')
                    ->where('course_id', $course->id)
                    ->whereNotNull('completed_at')
                    ->count();
                
                $totalEnrollments = DB::table('course_user')
                    ->where('course_id', $course->id)
                    ->where('enrolled', true)
                    ->count();
                
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
                $enrollments = DB::table('course_user')
                    ->where('course_id', $course->id)
                    ->where('enrolled', true)
                    ->count();
                
                $completed = DB::table('course_user')
                    ->where('course_id', $course->id)
                    ->whereNotNull('completed_at')
                    ->count();
                
                $completionRate = $enrollments > 0 
                    ? round(($completed / $enrollments) * 100, 1)
                    : 0;

                $started = DB::table('course_user')
                    ->where('course_id', $course->id)
                    ->whereNotNull('started_at')
                    ->count();

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

    private function getRecentActivities()
    {
        $activities = [];

        // Recent course completions
        $recentCompletions = DB::table('course_user')
            ->whereNotNull('completed_at')
            ->orderBy('completed_at', 'desc')
            ->take(15)
            ->get();

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
        $recentTestResults = TestResult::with(['test', 'user'])
            ->where(function($query) {
                $query->whereNotNull('completed_at')
                      ->orWhereNotNull('created_at');
            })
            ->orderByRaw('COALESCE(completed_at, created_at) DESC')
            ->take(15)
            ->get();

        foreach ($recentTestResults as $testResult) {
            if ($testResult->test && $testResult->user) {
                $passedText = $testResult->passed ? 'a trecut' : 'a eșuat';
                $scoreText = '';
                if ($testResult->max_score > 0 && $testResult->score !== null) {
                    $scoreText = " ({$testResult->score}/{$testResult->max_score})";
                }
                
                $activityDate = $testResult->completed_at ?? $testResult->created_at;
                
                $activities[] = [
                    'id' => 'test_' . $testResult->id,
                    'type' => 'exam_submitted',
                    'description' => "{$testResult->user->name} {$passedText} testul \"{$testResult->test->title}\"{$scoreText}",
                    'created_at' => $activityDate ? $activityDate->format('Y-m-d H:i:s') : now()->format('Y-m-d H:i:s'),
                ];
            }
        }

        // Sort by date and take most recent
        usort($activities, function($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });

        return array_slice($activities, 0, 30);
    }

    private function getAlerts()
    {
        $alerts = [];

        // Check for courses with low completion
        $lowCompletionCourses = Course::all()
            ->filter(function($course) {
                $enrollments = DB::table('course_user')
                    ->where('course_id', $course->id)
                    ->where('enrolled', true)
                    ->count();
                
                if ($enrollments === 0) return false;

                $completed = DB::table('course_user')
                    ->where('course_id', $course->id)
                    ->whereNotNull('completed_at')
                    ->count();
                
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

        return $alerts;
    }
}
