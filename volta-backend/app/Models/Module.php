<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Module extends Model
{
    use HasFactory;

    protected $fillable = [
        'course_id',
        'title',
        'description',
        'content',
        'order',
        'status',
        'is_locked',
        'unlock_after_module_id',
        'unlock_after_lesson_id',
        'estimated_duration_minutes',
        'completion_percentage',
    ];

    protected $casts = [
        'is_locked' => 'boolean',
        'completion_percentage' => 'decimal:2',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function lessons()
    {
        return $this->hasMany(Lesson::class)->orderBy('order');
    }

    /**
     * Get course-test links for this module
     */
    public function courseTests()
    {
        return $this->hasMany(CourseTest::class, 'scope_id')
            ->where('scope', 'module');
    }
    
    /**
     * Get tests linked to this module via course_test pivot
     * This is a helper method that returns the actual Test models
     */
    public function getTestsAttribute()
    {
        if (!$this->relationLoaded('courseTests')) {
            $this->load('courseTests.test');
        }
        
        return $this->courseTests->map(function($ct) {
            return $ct->test;
        })->filter();
    }

    /**
     * Boot method to handle events
     */
    protected static function boot()
    {
        parent::boot();

        // Recalculate course progress when module is updated
        static::saved(function ($module) {
            if ($module->course) {
                app(\App\Services\CourseProgressService::class)
                    ->recalculateCourseProgress($module->course);
            }
        });

        static::deleted(function ($module) {
            if ($module->course) {
                app(\App\Services\CourseProgressService::class)
                    ->recalculateCourseProgress($module->course);
            }
        });
    }
}
