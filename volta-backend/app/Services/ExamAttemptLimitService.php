<?php

namespace App\Services;

use App\Models\Exam;
use App\Models\UserExamAttemptGrant;
use App\Support\SchemaCache;
use Illuminate\Support\Facades\DB;

/**
 * Limita de încercări la examene: `max_attempts` al examenului plus încercările acordate elevului de admin
 * (ca UserTestAttemptGrant la teste). `null` = încercări nelimitate.
 */
class ExamAttemptLimitService
{
    public function extraAttemptsFor(int $userId, int $examId): int
    {
        if (! SchemaCache::hasTable('user_exam_attempt_grants')) {
            return 0;
        }

        return (int) UserExamAttemptGrant::query()
            ->where('user_id', $userId)
            ->where('exam_id', $examId)
            ->value('extra_attempts');
    }

    public function allowedAttemptCount(Exam $exam, int $userId): ?int
    {
        if (! $exam->max_attempts) {
            return null;
        }

        return (int) $exam->max_attempts + $this->extraAttemptsFor($userId, (int) $exam->id);
    }

    public function remainingAttemptsFor(Exam $exam, int $userId, int $completedCount): ?int
    {
        $allowed = $this->allowedAttemptCount($exam, $userId);

        return $allowed === null ? null : max(0, $allowed - $completedCount);
    }

    public function grantExtraAttempt(int $userId, int $examId, int $grantedBy): UserExamAttemptGrant
    {
        return DB::transaction(function () use ($userId, $examId, $grantedBy) {
            $grant = UserExamAttemptGrant::query()->firstOrCreate(
                ['user_id' => $userId, 'exam_id' => $examId],
                ['extra_attempts' => 0, 'granted_by' => $grantedBy]
            );
            // increment atomic: două click-uri rapide dau două încercări, nu una pierdută
            $grant->increment('extra_attempts', 1, ['granted_by' => $grantedBy]);

            return $grant->fresh();
        });
    }
}
