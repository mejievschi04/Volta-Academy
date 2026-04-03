<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Course;
use App\Models\TestResult;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

class StatisticsAdminController extends Controller
{
    public function __construct()
    {
        if (auth()->check() && auth()->user()->isInstructor()) {
            abort(403, 'Doar administratorii pot accesa statisticile.');
        }
    }

    /**
     * Date detaliate pentru hub-ul Statistică: cursuri, elevi, înscrieri, teste, timp pe lecții.
     */
    public function courseTestDetail(Request $request)
    {
        $courseId = $request->get('course_id');
        $userId = $request->get('user_id');
        $dateFrom = $request->get('date_from');
        $dateTo = $request->get('date_to');

        $from = null;
        $to = null;
        if ($dateFrom) {
            try {
                $from = Carbon::parse($dateFrom)->startOfDay();
            } catch (\Throwable $e) {
                $from = null;
            }
        }
        if ($dateTo) {
            try {
                $to = Carbon::parse($dateTo)->endOfDay();
            } catch (\Throwable $e) {
                $to = null;
            }
        }

        $testCourseMap = [];
        if (Schema::hasTable('course_test')) {
            foreach (DB::table('course_test')->select('test_id', 'course_id')->get() as $ct) {
                if (!isset($testCourseMap[(int) $ct->test_id])) {
                    $testCourseMap[(int) $ct->test_id] = (int) $ct->course_id;
                }
            }
        }

        $courses = Course::select('id', 'title', 'updated_at', 'created_at')
            ->orderBy('title')
            ->when($courseId, fn ($q) => $q->where('id', (int) $courseId))
            ->get();

        $enrollments = [];
        if (Schema::hasTable('course_user')) {
            $query = DB::table('course_user')
                ->join('users', 'users.id', '=', 'course_user.user_id')
                ->where('users.role', 'student')
                ->where('course_user.enrolled', true)
                ->select(
                    'course_user.user_id',
                    'course_user.course_id',
                    'course_user.progress_percentage',
                    'course_user.completed_at',
                    'course_user.enrolled_at',
                    'course_user.updated_at'
                );
            if ($courseId) {
                $query->where('course_user.course_id', (int) $courseId);
            }
            if ($userId) {
                $query->where('course_user.user_id', (int) $userId);
            }
            if ($from && $to) {
                $query->where(function ($q) use ($from, $to) {
                    $q->whereBetween('course_user.enrolled_at', [$from, $to])
                        ->orWhereBetween('course_user.updated_at', [$from, $to])
                        ->orWhere(function ($q2) use ($from, $to) {
                            $q2->whereNotNull('course_user.completed_at')
                                ->whereBetween('course_user.completed_at', [$from, $to]);
                        });
                });
            }

            $enrollments = $query->get()->map(fn ($r) => [
                'user_id' => $r->user_id,
                'course_id' => $r->course_id,
                'progress_percentage' => (int) ($r->progress_percentage ?? 0),
                'completed_at' => $r->completed_at ? Carbon::parse($r->completed_at)->toIso8601String() : null,
                'enrolled_at' => $r->enrolled_at ? Carbon::parse($r->enrolled_at)->toIso8601String() : null,
                'updated_at' => $r->updated_at ? Carbon::parse($r->updated_at)->toIso8601String() : null,
            ])->all();
        }

        $learningKeyed = $this->getLearningAggregatesByUserCourse();

        foreach ($enrollments as &$e) {
            $k = $e['user_id'] . ':' . $e['course_id'];
            $agg = $learningKeyed[$k] ?? null;
            $e['lessons_completed'] = (int) ($agg->lessons_completed ?? 0);
            $e['time_spent_seconds'] = (int) ($agg->time_spent_seconds ?? 0);
        }
        unset($e);

        $testResults = [];
        if (Schema::hasTable('test_results')) {
            $columns = ['id', 'user_id', 'test_id', 'passed', 'percentage', 'score', 'max_score', 'completed_at', 'attempt_number'];
            if (Schema::hasColumn('test_results', 'correct_answers_count')) {
                $columns[] = 'correct_answers_count';
            }
            if (Schema::hasColumn('test_results', 'total_questions')) {
                $columns[] = 'total_questions';
            }
            $query = TestResult::with('test:id,title')
                ->select($columns)
                ->whereNotNull('completed_at')
                ->whereHas('user', fn ($q) => $q->where('role', 'student'));
            if ($userId) {
                $query->where('user_id', (int) $userId);
            }
            if ($from && $to) {
                $query->whereBetween('completed_at', [$from, $to]);
            }
            $results = $query->orderBy('completed_at', 'desc')->get();
            $testResults = $results->map(function ($r) use ($testCourseMap) {
                return [
                    'user_id' => $r->user_id,
                    'test_id' => $r->test_id,
                    'course_id' => $testCourseMap[(int) $r->test_id] ?? null,
                    'test_title' => $r->test?->title,
                    'passed' => (bool) $r->passed,
                    'percentage' => $r->percentage !== null ? round((float) $r->percentage, 1) : null,
                    'score' => $r->score,
                    'max_score' => $r->max_score,
                    'correct_answers_count' => $r->correct_answers_count ?? null,
                    'total_questions' => $r->total_questions ?? null,
                    'completed_at' => $r->completed_at?->toIso8601String(),
                    'attempt_number' => $r->attempt_number,
                ];
            })->all();
        }

        $activityUserIds = collect($enrollments)->pluck('user_id')
            ->merge(collect($testResults)->pluck('user_id'))
            ->unique()
            ->filter()
            ->values();

        $studentsQuery = User::select('id', 'name', 'email', 'created_at')
            ->where('role', 'student')
            ->when($userId, fn ($q) => $q->where('id', (int) $userId));

        if ($from && $to && !$userId) {
            if ($activityUserIds->isEmpty()) {
                $students = collect();
            } else {
                $students = $studentsQuery->whereIn('id', $activityUserIds->all())->orderBy('name')->get();
            }
        } else {
            $students = $studentsQuery->orderBy('name')->get();
        }

        $courseTests = [];
        if (Schema::hasTable('course_test')) {
            $query = DB::table('course_test')->select('course_id', 'test_id');
            if ($courseId) {
                $query->where('course_id', (int) $courseId);
            }
            $courseTests = $query->get()->map(fn ($r) => ['course_id' => $r->course_id, 'test_id' => $r->test_id])->all();
        }

        $totals = [
            'total_learning_seconds' => (int) collect($learningKeyed)->sum(fn ($row) => (int) ($row->time_spent_seconds ?? 0)),
        ];

        return response()->json([
            'courses' => $courses,
            'students' => $students,
            'enrollments' => $enrollments,
            'test_results' => $testResults,
            'course_tests' => $courseTests,
            'meta' => [
                'date_from' => $from?->toDateString(),
                'date_to' => $to?->toDateString(),
                'total_learning_seconds' => $totals['total_learning_seconds'],
            ],
        ]);
    }

    /**
     * @return array<string, object{user_id:int,course_id:int,time_spent_seconds:int,lessons_completed:int}>
     */
    private function getLearningAggregatesByUserCourse(): array
    {
        if (!Schema::hasTable('lesson_progress') || !Schema::hasTable('lessons') || !Schema::hasTable('modules')) {
            return [];
        }

        $rows = DB::table('lesson_progress as lp')
            ->join('users', 'users.id', '=', 'lp.user_id')
            ->where('users.role', 'student')
            ->join('lessons as l', 'l.id', '=', 'lp.lesson_id')
            ->join('modules as m', 'm.id', '=', 'l.module_id')
            ->select(
                'lp.user_id',
                'm.course_id',
                DB::raw('COALESCE(SUM(lp.time_spent_seconds), 0) as time_spent_seconds'),
                DB::raw('SUM(CASE WHEN lp.completed = 1 THEN 1 ELSE 0 END) as lessons_completed')
            )
            ->groupBy('lp.user_id', 'm.course_id')
            ->get();

        $out = [];
        foreach ($rows as $row) {
            $out[$row->user_id . ':' . $row->course_id] = $row;
        }

        return $out;
    }
}
