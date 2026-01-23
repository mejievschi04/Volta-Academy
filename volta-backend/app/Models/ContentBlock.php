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
        'type', // video, text, audio, file, link, live
        'source', // URL, file path, text content, etc.
        'metadata', // Additional metadata (duration, size, etc.)
        'language',
        'version',
        'order',
        'visible',
    ];

    protected $casts = [
        'metadata' => 'array',
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
