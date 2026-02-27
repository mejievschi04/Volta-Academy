<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * ContentBlock Model
 * 
 * Conținut reutilizabil decuplat de lecție
 * Conform TODO.md - PAS 3: Adăugare conținut
 */
class ContentBlock extends Model
{
    use HasFactory;

    protected $fillable = [
        'lesson_id',
        'type', // text, video, file, image, gallery, interactive, assignment, etc.
        'source', // URL, file path, or legacy text content
        'metadata', // Additional metadata (duration, size, etc.)
        'payload', // Structured JSON payload for block content (instructiuni.md)
        'language',
        'version',
        'order',
        'visible',
    ];

    protected $casts = [
        'metadata' => 'array',
        'payload' => 'array',
        'visible' => 'boolean',
        'order' => 'integer',
    ];

    /**
     * Get the lesson that owns this content block
     */
    public function lesson()
    {
        return $this->belongsTo(Lesson::class);
    }
}
