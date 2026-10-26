<?php

namespace App\Services;

use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamAttemptSession;
use App\Models\ExamQuestion;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ExamAttemptSessionService
{
    public function __construct(protected ExamBankQuestionSyncService $questionSync)
    {
    }

    public function find(Exam $exam, User $user, int $attemptNumber): ?ExamAttemptSession
    {
        return ExamAttemptSession::query()
            ->where('exam_id', $exam->id)
            ->where('user_id', $user->id)
            ->where('attempt_number', $attemptNumber)
            ->first();
    }

    public function ensure(Exam $exam, User $user, int $attemptNumber): ExamAttemptSession
    {
        $existing = $this->find($exam, $user, $attemptNumber);
        if ($existing) {
            return $existing;
        }

        try {
            return DB::transaction(function () use ($exam, $user, $attemptNumber) {
                $locked = ExamAttemptSession::query()
                    ->where('exam_id', $exam->id)
                    ->where('user_id', $user->id)
                    ->where('attempt_number', $attemptNumber)
                    ->lockForUpdate()
                    ->first();
                if ($locked) {
                    return $locked;
                }

                $exam->loadMissing(['questions.answers']);
                $picked = $this->questionSync->selectForAttempt($exam, (int) $user->id, $attemptNumber);
                $picked->loadMissing('answers');
                $startedAt = now();
                $minutes = (int) ($exam->time_limit_minutes ?? 0);

                return ExamAttemptSession::create([
                    'exam_id' => $exam->id,
                    'user_id' => $user->id,
                    'attempt_number' => $attemptNumber,
                    'question_snapshot' => $this->snapshot($picked, $this->answerSeed($exam, (int) $user->id, $attemptNumber)),
                    'answers' => [],
                    'started_at' => $startedAt,
                    'expires_at' => $minutes > 0 ? $startedAt->copy()->addMinutes($minutes) : null,
                ]);
            });
        } catch (QueryException $e) {
            $existing = $this->find($exam, $user, $attemptNumber);
            if ($existing) {
                return $existing;
            }

            throw $e;
        }
    }

    public function rememberAnswers(ExamAttemptSession $session, array $answers): ExamAttemptSession
    {
        $session->answers = $answers;
        $session->save();

        return $session;
    }

    public function firstStartedAt(int $examId, int $userId): ?Carbon
    {
        $started = ExamAttemptSession::query()
            ->where('exam_id', $examId)
            ->where('user_id', $userId)
            ->min('started_at');

        return $started ? Carbon::parse($started) : null;
    }

    /**
     * Întrebările încercării. Variantele vin în ordinea salvată a examenului; cu $displayOrder
     * vin în ordinea amestecată pe care o vede elevul (indicii trimiși de el se raportează la ea).
     */
    public function questions(ExamAttemptSession $session, bool $displayOrder = false): Collection
    {
        return collect($session->question_snapshot ?? [])->map(function (array $row) use ($displayOrder) {
            $question = new ExamQuestion();
            $question->forceFill([
                'id' => (int) ($row['id'] ?? 0),
                'exam_id' => (int) ($row['exam_id'] ?? 0),
                'question_text' => $row['question_text'] ?? '',
                'question_type' => $row['question_type'] ?? 'multiple_choice',
                'order' => (int) ($row['order'] ?? 0),
                'points' => (int) ($row['points'] ?? 1),
                'payload' => is_array($row['payload'] ?? null) ? $row['payload'] : [],
            ]);
            $question->exists = true;

            $answers = collect($row['answers'] ?? [])->map(function (array $answer) use ($question) {
                $model = new ExamAnswer();
                $model->forceFill([
                    'id' => (int) ($answer['id'] ?? 0),
                    'exam_question_id' => (int) $question->id,
                    'answer_text' => $answer['answer_text'] ?? '',
                    'is_correct' => (bool) ($answer['is_correct'] ?? false),
                    'order' => (int) ($answer['order'] ?? 0),
                ]);
                $model->exists = true;

                return $model;
            })->values();
            if ($displayOrder) {
                $answers = $this->applyAnswerOrder($answers, $row['answer_order'] ?? null);
            }
            $question->setRelation('answers', $answers);

            return $question;
        })->filter(fn (ExamQuestion $question) => (int) $question->id > 0)->values();
    }

    /**
     * Traduce indicii variantelor din ordinea afișată în ordinea salvată a examenului,
     * ca rezultatul, corectarea manuală și revizuirea să rămână pe ordinea originală.
     */
    public function toStoredAnswerIndices(ExamAttemptSession $session, array $answers): array
    {
        foreach ($session->question_snapshot ?? [] as $row) {
            $order = $row['answer_order'] ?? null;
            if (! is_array($order) || $order === []) {
                continue;
            }
            $key = array_key_exists((int) ($row['id'] ?? 0), $answers) ? (int) $row['id'] : (string) ($row['id'] ?? '');
            if (! array_key_exists($key, $answers)) {
                continue;
            }

            $storedIndexById = [];
            foreach (array_values($row['answers'] ?? []) as $index => $answer) {
                $storedIndexById[(int) ($answer['id'] ?? 0)] = $index;
            }
            $map = static function ($displayIndex) use ($order, $storedIndexById) {
                if (! is_numeric($displayIndex) || ! isset($order[(int) $displayIndex])) {
                    return $displayIndex;
                }

                return $storedIndexById[(int) $order[(int) $displayIndex]] ?? $displayIndex;
            };

            $value = $answers[$key];
            if (is_array($value) && array_is_list($value)) {
                $answers[$key] = array_map($map, $value);
            } elseif (is_int($value) || (is_string($value) && ctype_digit($value))) {
                $answers[$key] = $map($value);
            }
        }

        return $answers;
    }

    protected function applyAnswerOrder(Collection $answers, mixed $order): Collection
    {
        if (! is_array($order) || $order === []) {
            return $answers;
        }
        $position = array_flip(array_map('intval', $order));

        return $answers
            ->sortBy(fn (ExamAnswer $answer) => $position[(int) $answer->id] ?? PHP_INT_MAX)
            ->values();
    }

    protected function answerSeed(Exam $exam, int $userId, int $attemptNumber): ?string
    {
        $settings = is_array($exam->settings) ? $exam->settings : [];

        return (bool) ($settings['shuffle_answers'] ?? false)
            ? 'exam-a:' . $exam->id . ':u' . $userId . ':a' . max(1, $attemptNumber)
            : null;
    }

    protected function snapshot(Collection $questions, ?string $answerSeed = null): array
    {
        return $questions->map(function (ExamQuestion $question) use ($answerSeed) {
            $answers = $question->relationLoaded('answers')
                ? $question->answers
                : $question->answers()->get();
            $shuffle = $answerSeed !== null
                && in_array((string) $question->question_type, ['multiple_choice', 'single_choice', 'true_false', 'yes_no'], true)
                && count($answers) > 1;

            return [
                'id' => (int) $question->id,
                'exam_id' => (int) $question->exam_id,
                'question_text' => $question->question_text,
                'question_type' => $question->question_type,
                'order' => (int) $question->order,
                'points' => (int) ($question->points ?? 1),
                'payload' => is_array($question->payload) ? $question->payload : [],
                'answers' => collect($answers)->map(fn ($answer) => [
                    'id' => (int) $answer->id,
                    'answer_text' => $answer->answer_text,
                    'is_correct' => (bool) $answer->is_correct,
                    'order' => (int) $answer->order,
                ])->values()->all(),
                'answer_order' => $shuffle
                    ? collect($answers)
                        ->sortBy(fn ($answer) => hash('sha1', $answerSeed . ':q' . $question->id . ':a' . $answer->id))
                        ->map(fn ($answer) => (int) $answer->id)
                        ->values()
                        ->all()
                    : null,
            ];
        })->values()->all();
    }
}
