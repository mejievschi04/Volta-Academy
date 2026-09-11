<?php

namespace App\Services;

use App\Models\Question;
use App\Models\Test;
use App\Models\TestResult;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TestAttemptService
{
    public function openAttemptQuery(int $userId, int $testId, ?int $courseId)
    {
        return TestResult::query()
            ->where('user_id', $userId)
            ->where('test_id', $testId)
            ->where('status', 'in_progress')
            ->when(
                $courseId,
                fn ($q) => $q->where('course_id', $courseId),
                fn ($q) => $q->whereNull('course_id')
            );
    }

    public function completedAttemptsQuery(int $userId, int $testId, ?int $courseId)
    {
        return TestResult::query()
            ->where('user_id', $userId)
            ->where('test_id', $testId)
            ->where('status', '!=', 'in_progress')
            ->when($courseId, function ($query) use ($courseId) {
                $query->where(function ($scope) use ($courseId) {
                    $scope->where('course_id', $courseId)->orWhereNull('course_id');
                });
            });
    }

    public function snapshotQuestions(Collection $questions): array
    {
        return $questions->map(function ($question) {
            return [
                'id' => (int) $question->id,
                'test_id' => $question->test_id,
                'question_bank_id' => $question->question_bank_id ?? null,
                'type' => $question->type ?? 'multiple_choice',
                'content' => $question->content,
                'answers' => $question->answers,
                'points' => (int) ($question->points ?? 1),
                'order' => $question->order ?? 0,
                'explanation' => $question->explanation ?? null,
                'metadata' => $question->metadata ?? null,
            ];
        })->values()->all();
    }

    public function hydrateQuestions(?array $snapshot): Collection
    {
        return collect($snapshot ?? [])->map(function (array $row) {
            $question = new Question();
            $question->forceFill($row);
            $question->id = (int) ($row['id'] ?? 0);
            $question->exists = true;

            return $question;
        })->filter(fn ($q) => (int) $q->id > 0)->values();
    }

    public function ensureOpenAttempt(Test $test, User $user, ?int $courseId, Collection $questions, int $attemptNumber, int $passingScore): TestResult
    {
        try {
            return DB::transaction(function () use ($test, $user, $courseId, $questions, $attemptNumber, $passingScore) {
                $existing = $this->openAttemptQuery((int) $user->id, (int) $test->id, $courseId)
                    ->lockForUpdate()
                    ->first();
                if ($existing) {
                    return $existing;
                }

                $startedAt = now();
                $limitMinutes = (int) ($test->time_limit_minutes ?? 0);

                return TestResult::create([
                    'test_id' => $test->id,
                    'course_id' => $courseId,
                    'user_id' => $user->id,
                    'attempt_number' => $attemptNumber,
                    'score' => 0,
                    'max_score' => $questions->sum(fn ($q) => (int) ($q->points ?? 1)),
                    'percentage' => 0,
                    'passed' => false,
                    'answers' => [],
                    'started_at' => $startedAt,
                    'expires_at' => $limitMinutes > 0 ? $startedAt->copy()->addMinutes($limitMinutes) : null,
                    'completed_at' => null,
                    'status' => 'in_progress',
                    'question_snapshot' => $this->snapshotQuestions($questions),
                    'passing_score_applied' => $passingScore,
                    'attempt_token' => (string) Str::uuid(),
                    'attempt_scope' => $this->openScope((int) $user->id, (int) $test->id, $courseId),
                ]);
            });
        } catch (QueryException $e) {
            $existing = $this->openAttemptQuery((int) $user->id, (int) $test->id, $courseId)->first();
            if ($existing) {
                return $existing;
            }

            throw $e;
        }
    }

    public function openScope(int $userId, int $testId, ?int $courseId): string
    {
        return $userId . ':' . $testId . ':' . (int) ($courseId ?? 0) . ':open';
    }

    public function attemptHasExpired(TestResult $attempt): bool
    {
        if (! $attempt->expires_at) {
            return false;
        }

        return Carbon::parse($attempt->expires_at)->addSeconds(15)->isPast();
    }

    public function closeExpiredAttempt(TestResult $attempt): void
    {
        if ($attempt->status !== 'in_progress') {
            return;
        }

        $attempt->update([
            'status' => 'expired',
            'completed_at' => now(),
            'passed' => false,
            'attempt_scope' => null,
        ]);
    }

    public function currentOpenAttempt(int $userId, int $testId, ?int $courseId): ?TestResult
    {
        $existing = $this->openAttemptQuery($userId, $testId, $courseId)->first();
        if (! $existing) {
            return null;
        }
        if ($this->attemptHasExpired($existing)) {
            $this->closeExpiredAttempt($existing);

            return null;
        }

        return $existing;
    }
}
