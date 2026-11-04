<?php

namespace App\Models;

use App\Models\Concerns\ExtractsInlineImages;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ExamQuestion extends Model
{
    use ExtractsInlineImages;

    /** Coloane în care imaginile base64 devin fișiere la salvare (ExtractsInlineImages). */
    public const INLINE_IMAGE_COLUMNS = ['question_text', 'payload'];

    use HasFactory;

    protected $fillable = [
        'exam_id',
        'question_text',
        'question_type',
        'order',
        'points',
        'payload',
    ];

    protected $casts = [
        'payload' => 'array',
    ];

    /** Questions are auto-graded in the current flow. */
    public function requiresManualGrading(): bool
    {
        return false;
    }

    public function exam()
    {
        return $this->belongsTo(Exam::class);
    }

    public function answers()
    {
        return $this->hasMany(ExamAnswer::class)->orderBy('order');
    }
}
