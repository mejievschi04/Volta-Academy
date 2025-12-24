<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'avatar',
        'bio',
        'level',
        'points',
        'role',
        'must_change_password',
        'status',
        'permissions',
        'last_login_at',
        'last_activity_at',
        'suspended_reason',
        'suspended_until',
    ];

    protected $casts = [
        'permissions' => 'array',
        'last_login_at' => 'datetime',
        'last_activity_at' => 'datetime',
        'suspended_until' => 'datetime',
    ];

    public function courses() {
        return $this->hasMany(Course::class, 'teacher_id');
    }

    public function events() {
        return $this->hasMany(Event::class, 'instructor_id');
    }

    public function teams() {
        return $this->belongsToMany(Team::class);
    }

    public function assignedCourses() {
        return $this->belongsToMany(Course::class, 'course_user')
                    ->withPivot('is_mandatory', 'assigned_at', 'enrolled', 'enrolled_at', 'started_at', 'completed_at', 'progress_percentage')
                    ->withTimestamps();
    }

    public function lessonsProgress()
{
    return $this->belongsToMany(Lesson::class, 'lesson_progress')
                ->withPivot('completed')
                ->withTimestamps();
}

}
