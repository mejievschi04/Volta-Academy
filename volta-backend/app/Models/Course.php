<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model; // <--- trebuie adăugat
use App\Models\User; // pentru relația teacher
use App\Models\Lesson; // pentru relația lessons

class Course extends Model
{
    use HasFactory;

    protected $fillable = ['title','description','image','teacher_id','reward_points'];

    public function lessons() {
        return $this->hasMany(Lesson::class);
    }

    public function teacher() {
        return $this->belongsTo(User::class, 'teacher_id');
    }
}
