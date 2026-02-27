<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CourseMap extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'created_by',
        'order',
    ];

    protected $casts = [
        'order' => 'integer',
    ];

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Cursurile din această mapă (cu ordinea din pivot).
     */
    public function courses()
    {
        return $this->belongsToMany(Course::class, 'course_map_course')
            ->withPivot('order')
            ->withTimestamps()
            ->orderByPivot('order');
    }
}
