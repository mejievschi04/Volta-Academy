<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserExamAttemptGrant extends Model
{
    protected $fillable = [
        'user_id',
        'exam_id',
        'extra_attempts',
        'granted_by',
    ];

    protected $casts = [
        'extra_attempts' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function exam()
    {
        return $this->belongsTo(Exam::class);
    }

    public function grantedBy()
    {
        return $this->belongsTo(User::class, 'granted_by');
    }
}
