<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Course;
use App\Models\Test;
use App\Models\TestResult;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class StatisticsAdminController extends Controller
{
    public function __construct()
    {
        if (auth()->check() && auth()->user()->isInstructor()) {
            abort(403, 'Doar administratorii pot accesa statisticile.');
        }
    }

    /**
     * Date detaliate pentru compartimentul "Statistică curs și test":
     * cum a trecut fiecare student fiecare curs și test.
     */
    public function courseTestDetail(Request $request)
    {
        $courseId = $request->get('course_id'); // optional filter
        $userId = $request->get('user_id'); // optional filter

        $courses = Course::select('id', 'title')
            ->orderBy('title')
            ->when($courseId, fn ($q) => $q->where('id', (int) $courseId))
            ->get();

        $students = User::select('id', 'name', 'email')
            ->where('role', 'student')
            ->when($userId, fn ($q) => $q->where('id', (int) $userId))
            ->orderBy('name')
            ->get();

        $enrollments = [];
        if (Schema::hasTable('course_user')) {
            $query = DB::table('course_user')
                ->where('enrolled', true)
                ->select('user_id', 'course_id', 'progress_percentage', 'completed_at', 'enrolled_at');
            if ($courseId) {
                $query->where('course_id', (int) $courseId);
            }
            if ($userId) {
                $query->where('user_id', (int) $userId);
            }
            $enrollments = $query->get()->map(fn ($r) => [
                'user_id' => $r->user_id,
                'course_id' => $r->course_id,
                'progress_percentage' => (int) ($r->progress_percentage ?? 0),
                'completed_at' => $r->completed_at ? \Carbon\Carbon::parse($r->completed_at)->toIso8601String() : null,
                'enrolled_at' => $r->enrolled_at ? \Carbon\Carbon::parse($r->enrolled_at)->toIso8601String() : null,
            ])->all();
        }

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
                ->whereNotNull('completed_at');
            if ($userId) {
                $query->where('user_id', (int) $userId);
            }
            $results = $query->orderBy('completed_at', 'desc')->get();
            $testResults = $results->map(fn ($r) => [
                'user_id' => $r->user_id,
                'test_id' => $r->test_id,
                'test_title' => $r->test?->title,
                'passed' => (bool) $r->passed,
                'percentage' => $r->percentage !== null ? round((float) $r->percentage, 1) : null,
                'score' => $r->score,
                'max_score' => $r->max_score,
                'correct_answers_count' => $r->correct_answers_count ?? null,
                'total_questions' => $r->total_questions ?? null,
                'completed_at' => $r->completed_at?->toIso8601String(),
                'attempt_number' => $r->attempt_number,
            ])->all();
        }

        $courseTests = [];
        if (Schema::hasTable('course_test')) {
            $query = DB::table('course_test')->select('course_id', 'test_id');
            if ($courseId) {
                $query->where('course_id', (int) $courseId);
            }
            $courseTests = $query->get()->map(fn ($r) => ['course_id' => $r->course_id, 'test_id' => $r->test_id])->all();
        }

        return response()->json([
            'courses' => $courses,
            'students' => $students,
            'enrollments' => $enrollments,
            'test_results' => $testResults,
            'course_tests' => $courseTests,
        ]);
    }
}
