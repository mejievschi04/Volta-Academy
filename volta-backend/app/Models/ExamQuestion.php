<?php

namespace App\Models;

use App\Models\Concerns\ExtractsInlineImages;
use App\Support\QuestionImageUrl;
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

    public function imageMatchingData(): array
    {
        $pairs = is_array($this->payload['pairs'] ?? null) ? array_values($this->payload['pairs']) : [];
        $leftItems = [];
        $rightItems = [];
        foreach ($pairs as $index => $pair) {
            if (! is_array($pair)) {
                continue;
            }

            $label = trim((string) ($pair['left'] ?? $pair['text'] ?? $pair['question'] ?? ''));
            $url = QuestionImageUrl::sanitize($pair['image_url'] ?? $pair['imageUrl'] ?? $pair['image'] ?? '');
            if ($label === '' || $url === '') {
                continue;
            }

            $id = (string) $index;
            $leftItems[] = ['id' => $id, 'text' => $label];
            $rightItems[] = ['id' => $id, 'image_url' => $url, 'alt' => $label];
        }

        return ['leftItems' => $leftItems, 'rightItems' => $rightItems, 'correctMap' => array_column($rightItems, 'id')];
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
