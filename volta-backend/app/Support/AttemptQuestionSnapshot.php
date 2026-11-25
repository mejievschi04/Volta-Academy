<?php

namespace App\Support;

final class AttemptQuestionSnapshot
{
    public static function version(?array $questions, string $attempt = ''): string
    {
        return hash_hmac('sha256', serialize([$attempt, self::canonical($questions ?? [])]), (string) config('app.key'));
    }

    /** An answer belongs to the prompt and options that the learner actually saw. */
    public static function retainAnswers(array $answers, array $previous, array $current): array
    {
        $previousById = array_column($previous, null, 'id');
        $retained = [];
        foreach ($current as $question) {
            $id = $question['id'];
            if (! array_key_exists($id, $answers) || ! isset($previousById[$id])) {
                continue;
            }
            if (self::answerDefinition($previousById[$id]) === self::answerDefinition($question)) {
                $retained[$id] = $answers[$id];
            }
        }

        return $retained;
    }

    private static function answerDefinition(array $question): array
    {
        unset($question['order'], $question['points'], $question['explanation']);

        if (isset($question['exam_id'])) {
            $answers = $question['answers'] ?? [];
            if (is_array($question['answer_order'] ?? null)) {
                $answersById = array_column($answers, null, 'id');
                $answers = array_map(fn ($id) => $answersById[$id], $question['answer_order']);
            }
            $question['answers'] = array_map(fn ($answer) => [$answer['answer_text'], $answer['is_correct']], $answers);
            unset($question['answer_order'], $question['payload']['explanation']);
        }

        return self::canonical($question);
    }

    private static function canonical(array $value): array
    {
        if (! array_is_list($value)) {
            ksort($value);
        }

        return array_map(fn ($item) => is_array($item) ? self::canonical($item) : $item, $value);
    }
}
