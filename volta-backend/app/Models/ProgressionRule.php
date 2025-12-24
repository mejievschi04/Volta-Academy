<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * ProgressionRule Model
 * 
 * Rule-based progression system for courses
 */
class ProgressionRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'course_id',
        'type',
        'target_type',
        'target_id',
        'condition_type',
        'condition_id',
        'condition_value',
        'action',
        'priority',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    /**
     * Get the course this rule belongs to
     */
    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    /**
     * Get the target entity
     */
    public function target()
    {
        if (!$this->target_type || !$this->target_id) {
            return null;
        }

        return match ($this->target_type) {
            'lesson' => Lesson::find($this->target_id),
            'module' => Module::find($this->target_id),
            'test' => Test::find($this->target_id),
            'course' => Course::find($this->target_id),
            default => null,
        };
    }

    /**
     * Get the condition entity
     */
    public function condition()
    {
        if (!$this->condition_type || !$this->condition_id) {
            return null;
        }

        return match ($this->condition_type) {
            'lesson' => Lesson::find($this->condition_id),
            'module' => Module::find($this->condition_id),
            'test' => Test::find($this->condition_id),
            default => null,
        };
    }
}

