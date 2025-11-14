<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model; // <--- import esențial
use App\Models\Course; // pentru relația course

class Lesson extends Model
{
    use HasFactory;

    protected $fillable = ['course_id','title','content','order'];

    public function course() {
        return $this->belongsTo(Course::class);
    }

    public function usersProgress()
{
    return $this->belongsToMany(User::class, 'lesson_progress')
                ->withPivot('completed')
                ->withTimestamps();
}


}
