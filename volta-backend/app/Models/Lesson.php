<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model; // <--- import esențial
use App\Models\Course; // pentru relația course

class Lesson extends Model
{
    use HasFactory;

    protected $fillable = [
        'course_id', 
        'section_id', 
        'title', 
        'content', 
        'video_url', 
        'resources', 
        'duration_minutes', 
        'order', 
        'is_preview'
    ];

    protected $casts = [
        'resources' => 'array',
        'is_preview' => 'boolean',
    ];

    public function course() {
        return $this->belongsTo(Course::class);
    }

    public function section() {
        return $this->belongsTo(Section::class);
    }

    public function usersProgress()
{
    return $this->belongsToMany(User::class, 'lesson_progress')
                ->withPivot('completed')
                ->withTimestamps();
}


}
