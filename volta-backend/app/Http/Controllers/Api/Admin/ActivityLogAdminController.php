<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ActivityLogAdminController extends Controller
{
    protected const COUNT_CAP = 10000;

    public function __construct()
    {
        if (auth()->check() && auth()->user()->isInstructor()) {
            abort(403, 'Doar administratorii pot accesa jurnalul de activitate.');
        }
    }

    public function index(Request $request)
    {
        $perPage = min(200, max(1, (int) $request->get('per_page', 100)));
        $search = $request->get('search');
        $action = $request->get('action');
        $modelType = $request->get('model_type');
        $userId = $request->get('user_id');
        $teamFilter = (string) $request->get('team_id', '');
        $dateFrom = $request->get('date_from');
        $dateTo = $request->get('date_to');
        $actionScope = $request->get('action_scope'); // elev_progres | all | telemetry | learner | admin_ops | legacy
        $excludeSelf = $request->boolean('exclude_self', true);

        $sortBy = $request->get('sort_by', 'created_at');
        if (! in_array($sortBy, ['created_at', 'action', 'team'], true)) {
            $sortBy = 'created_at';
        }
        $sortDir = strtolower((string) $request->get('sort_dir', 'desc'));
        if (! in_array($sortDir, ['asc', 'desc'], true)) {
            $sortDir = 'desc';
        }
        if ($sortBy === 'action') {
            $sortDir = $sortDir === 'asc' ? 'asc' : 'desc';
        } else {
            $sortDir = $sortDir === 'asc' ? 'asc' : 'desc';
        }

        // Only the columns the journal list renders; old_values / user_agent can be large.
        $query = ActivityLog::query()
            ->select(['id', 'user_id', 'action', 'model_type', 'model_id', 'description', 'new_values', 'created_at'])
            ->with(['user:id,name,email', 'user.teams:id,name,accent_color'])
            ->whereNotIn('action', [
                'telemetry.learner_answer_saved',
                'telemetry.learner_attempt_started',
                'telemetry.learner_result_viewed',
                'telemetry.learner_retake_weak_areas_started',
                'builder.update_lesson',
            ]);

        if ($excludeSelf && ($viewer = $request->user())) {
            $query->where(function ($q) use ($viewer) {
                $q->whereNull('user_id')
                    ->orWhere('user_id', '!=', $viewer->id);
            });
        }

        // Apply filters
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->whereContainsText('description', $search)
                  ->orWhereContainsText('action', $search)
                  ->orWhereIn('user_id', User::query()
                      ->select('id')
                      ->whereContainsText('name', $search)
                      ->orWhereContainsText('email', $search));
            });
        }

        if ($action) {
            $query->where('action', $action);
        }

        if ($actionScope && $actionScope !== 'all') {
            match ($actionScope) {
                'elev_progres' => $query->where(function ($q) {
                    $q->whereIn('action', [
                        'completed_course',
                        'completed_exam',
                        'completed_lesson',
                        'enrolled_course',
                    ])
                        ->orWhereIn('action', ['telemetry.learner_attempt_submitted', 'telemetry.learner_focus_seconds']);
                }),
                'telemetry' => $query->where('action', 'like', 'telemetry.%'),
                'learner' => $query->where('action', 'like', 'telemetry.learner%'),
                'admin_ops' => $query->where(function ($q) {
                    $q->where('action', 'like', 'telemetry.admin%')
                        ->orWhere('action', 'like', 'builder.%');
                }),
                'legacy' => $query->where('action', 'not like', 'telemetry.%'),
                'auth' => $query->whereIn('action', ['logged_in', 'logged_out']),
                default => null,
            };
        }

        if ($modelType) {
            $query->where('model_type', $modelType);
        }

        if ($userId) {
            $query->where('user_id', $userId);
        }

        if ($teamFilter !== '' && $teamFilter !== 'all') {
            if ($teamFilter === 'none') {
                $query->whereNotIn('user_id', DB::table('team_user')->select('user_id'));
            } elseif (ctype_digit($teamFilter)) {
                $query->whereIn('user_id', DB::table('team_user')->where('team_id', (int) $teamFilter)->select('user_id'));
            }
        }

        // Range on the raw column (not whereDate) so the created_at index is usable.
        if ($dateFrom && ($from = $this->parseDate($dateFrom))) {
            $query->where('created_at', '>=', $from->startOfDay());
        }

        if ($dateTo && ($to = $this->parseDate($dateTo))) {
            $query->where('created_at', '<', $to->addDay()->startOfDay());
        }

        // Pagina are `per_page` rânduri, iar un rând = același utilizator, aceeași acțiune, aceeași zi
        // (ex. „a finalizat 5 lecții”). Gruparea se face aici ca să numărăm rânduri, nu evenimente.
        // created_at e în ora aplicației (Europe/Bucharest), deci DATE() dă ziua locală.
        $groups = (clone $query)->toBase()->reorder()
            ->select([
                'user_id',
                'action',
                DB::raw('DATE(created_at) as day'),
                DB::raw('MAX(created_at) as last_at'),
                DB::raw('MIN(created_at) as first_at'),
                DB::raw('MAX(id) as last_id'),
            ])
            ->groupBy('user_id', 'action', DB::raw('DATE(created_at)'));

        if ($sortBy === 'team') {
            // Echipa A–Z (prima echipă alfabetic, ca în lista de utilizatori; fără echipă la final),
            // iar în cadrul echipei cele mai noi rânduri primele.
            $teamName = DB::table('team_user')
                ->join('teams', 'teams.id', '=', 'team_user.team_id')
                ->whereColumn('team_user.user_id', 'activity_logs.user_id')
                ->selectRaw("COALESCE(MIN(LOWER(teams.name)), '~')");
            $groups->orderBy($teamName, $sortDir)->orderBy('last_at', 'desc')->orderBy('last_id', 'desc');
        } elseif ($sortBy === 'action') {
            $groups->orderBy('action', $sortDir)->orderBy('last_at', 'desc')->orderBy('last_id', 'desc');
        } elseif ($sortDir === 'asc') {
            $groups->orderBy('first_at', 'asc')->orderBy('last_id', 'asc');
        } else {
            $groups->orderBy('last_at', 'desc')->orderBy('last_id', 'desc');
        }

        // Numărarea exactă pe tot jurnalul e lentă; numărăm cel mult COUNT_CAP + 1 rânduri („10.000+”).
        $cappedGroups = (clone $groups)->reorder()->limit(static::COUNT_CAP + 1);
        $matched = DB::query()->fromSub($cappedGroups, 'capped')->count();
        $totalCapped = $matched > static::COUNT_CAP;
        $total = min($matched, static::COUNT_CAP);
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($lastPage, max(1, (int) $request->get('page', 1)));

        $pageGroups = $groups->forPage($page, $perPage)->get();
        $items = collect();
        if ($pageGroups->isNotEmpty()) {
            $logs = (clone $query)
                ->where(function ($q) use ($pageGroups) {
                    foreach ($pageGroups as $group) {
                        $day = Carbon::parse((string) $group->day)->startOfDay();
                        $q->orWhere(function ($g) use ($group, $day) {
                            $group->user_id === null ? $g->whereNull('user_id') : $g->where('user_id', $group->user_id);
                            $g->where('action', $group->action)
                                ->where('created_at', '>=', $day)
                                ->where('created_at', '<', $day->copy()->addDay());
                        });
                    }
                })
                ->orderBy('created_at', 'desc')
                ->orderBy('id', 'desc')
                ->get()
                ->groupBy(fn (ActivityLog $log) => $this->groupKey($log->user_id, $log->action, $log->created_at?->format('Y-m-d')));

            // aceeași ordine ca rândurile; în rând, cel mai nou eveniment primul
            foreach ($pageGroups as $group) {
                $key = $this->groupKey($group->user_id, $group->action, Carbon::parse((string) $group->day)->format('Y-m-d'));
                foreach ($logs->get($key, []) as $log) {
                    $log->setAttribute('group_key', $key);
                    $items->push($log);
                }
            }
        }

        return response()->json([
            'data' => $this->withContext($items),
            'pagination' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
                'total_capped' => $totalCapped,
            ],
            'filters' => [
                'action_scopes' => [
                    ['id' => 'elev_progres', 'label' => 'Progres elevi (cursuri și teste)'],
                    ['id' => 'all', 'label' => 'Tot jurnalul'],
                    ['id' => 'telemetry', 'label' => 'Telemetrie (toate)'],
                    ['id' => 'learner', 'label' => 'Elevi / învățare'],
                    ['id' => 'admin_ops', 'label' => 'Admin & builder'],
                    ['id' => 'legacy', 'label' => 'Fără telemetrie'],
                    ['id' => 'auth', 'label' => 'Autentificare (login / logout)'],
                ],
            ],
        ]);
    }

    /**
     * Fiecare rând primește titlurile lecției / testului / cursului la care se referă,
     * ca jurnalul să spună „lecția X”, „testul Y” în loc de „o lecție”, „un test”.
     * Titlurile se citesc acum (nu din momentul evenimentului), câte o interogare pe tip.
     */
    protected function withContext($items): array
    {
        $refs = $items->map(fn (ActivityLog $log) => $this->contextRefs($log));

        $lessonIds = $refs->pluck('lesson_id')->filter()->unique()->values();
        $lessons = $lessonIds->isEmpty() ? collect() : DB::table('lessons')
            ->leftJoin('modules', 'modules.id', '=', 'lessons.module_id')
            ->whereIn('lessons.id', $lessonIds)
            ->get(['lessons.id', 'lessons.title', DB::raw('COALESCE(lessons.course_id, modules.course_id) as course_id')])
            ->keyBy('id');

        $testIds = $refs->pluck('test_id')->filter()->unique()->values();
        $tests = $testIds->isEmpty() ? collect() : DB::table('tests')->whereIn('id', $testIds)->pluck('title', 'id');

        $examIds = $refs->pluck('exam_id')->filter()->unique()->values();
        $exams = $examIds->isEmpty() ? collect() : DB::table('exams')->whereIn('id', $examIds)->pluck('title', 'id');

        $courseIds = $refs->pluck('course_id')
            ->merge($lessons->pluck('course_id'))
            ->filter()->unique()->values();
        $courses = $courseIds->isEmpty() ? collect() : DB::table('courses')->whereIn('id', $courseIds)->pluck('title', 'id');

        return $items->values()->map(function (ActivityLog $log, int $i) use ($refs, $lessons, $tests, $exams, $courses) {
            $ref = $refs[$i];
            $lesson = $ref['lesson_id'] ? $lessons->get($ref['lesson_id']) : null;
            $courseId = $ref['course_id'] ?: ($lesson->course_id ?? null);
            $testTitle = $ref['test_id'] ? $tests->get($ref['test_id']) : null;
            if (! $testTitle && $ref['exam_id']) {
                $testTitle = $exams->get($ref['exam_id']);
            }

            return $log->toArray() + [
                'context' => array_filter([
                    'lesson_title' => $lesson->title ?? null,
                    'test_title' => $testTitle,
                    'course_title' => $courseId ? $courses->get($courseId) : null,
                ], fn ($v) => $v !== null && $v !== ''),
            ];
        })->all();
    }

    /** @return array{lesson_id: ?int, test_id: ?int, exam_id: ?int, course_id: ?int} */
    protected function contextRefs(ActivityLog $log): array
    {
        $nv = is_array($log->new_values) ? $log->new_values : [];
        $int = fn ($v) => is_numeric($v) && (int) $v > 0 ? (int) $v : null;
        $type = strtolower(class_basename((string) $log->model_type));

        $lessonId = $int($nv['lesson_id'] ?? null) ?? ($type === 'lesson' ? $int($log->model_id) : null);
        $testId = $int($nv['test_id'] ?? null) ?? ($type === 'test' ? $int($log->model_id) : null);
        // completed_exam pentru Test pune id-ul testului în exam_id (model_type = Test)
        $examId = $testId ? null : ($type === 'exam' ? ($int($nv['exam_id'] ?? null) ?? $int($log->model_id)) : null);
        $courseId = $int($nv['course_id'] ?? null) ?? ($type === 'course' ? $int($log->model_id) : null);

        return ['lesson_id' => $lessonId, 'test_id' => $testId, 'exam_id' => $examId, 'course_id' => $courseId];
    }

    protected function groupKey($userId, ?string $action, ?string $day): string
    {
        return ($userId ?? 'none').'|'.$action.'|'.$day;
    }

    protected function parseDate(string $value): ?Carbon
    {
        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }
}
