<?php

namespace App\Observers;

use App\Models\ExamQuestion;
use App\Models\Question;
use App\Services\ExamBankQuestionSyncService;
use Illuminate\Support\Facades\DB;

class QuestionObserver
{
    public function updated(Question $question): void
    {
        DB::transaction(function () use ($question): void {
            ExamQuestion::query()
                ->where('payload->source_question_id', $question->id)
                ->orderBy('id')
                ->get()
                ->each(fn (ExamQuestion $examQuestion) => app(ExamBankQuestionSyncService::class)
                    ->refreshExamQuestionFromSource($examQuestion, $question));
        });
    }
}
