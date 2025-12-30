<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Exam extends Model
{
    use HasFactory;

    protected $fillable = [
        'course_id',
        'module_id',
        'lesson_id',
        'title',
        'description',
        'status',
        'max_score',
        'passing_score',
        'time_limit_minutes',
        'max_attempts',
        'is_required',
        'unlock_after_completion',
        'unlock_target_id',
        'unlock_target_type',
        'question_types',
        'attempts_count',
        'passes_count',
        'average_score',
    ];

    protected $casts = [
        'question_types' => 'array',
        'is_required' => 'boolean',
        'unlock_after_completion' => 'boolean',
        'average_score' => 'decimal:2',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function module()
    {
        return $this->belongsTo(Module::class);
    }

    public function lesson()
    {
        return $this->belongsTo(Lesson::class);
    }


    public function questions()
    {
        return $this->hasMany(ExamQuestion::class)->orderBy('order');
    }

    public function results()
    {
        return $this->hasMany(ExamResult::class);
    }
}
