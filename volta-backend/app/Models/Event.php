<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Event extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'type',
        'start_date',
        'end_date',
        'location',
    ];

    // Don't cast to datetime to avoid timezone conversions
    // We'll handle datetime as strings
    protected $casts = [
        // 'start_date' => 'datetime', // Removed to avoid timezone conversion
        // 'end_date' => 'datetime',   // Removed to avoid timezone conversion
    ];
}

