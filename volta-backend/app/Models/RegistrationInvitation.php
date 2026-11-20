<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RegistrationInvitation extends Model
{
    /** Adresa internă a linkului universal. Nu este un cont și nu primește email. */
    public const UNIVERSAL_EMAIL = 'universal@registration.invalid';

    protected $fillable = [
        'email',
        'reusable',
        'token',
        'name',
        'role',
        'team_id',
        'invited_by',
        'user_id',
        'expires_at',
        'accepted_at',
        'encrypted_token',
        'email_status',
        'email_sent_at',
        'email_last_error',
        'reminder_sent_at',
    ];

    protected $casts = [
        'reusable' => 'boolean',
        'expires_at' => 'datetime',
        'accepted_at' => 'datetime',
        'email_sent_at' => 'datetime',
        'reminder_sent_at' => 'datetime',
    ];

    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function isAccepted(): bool
    {
        return $this->accepted_at !== null;
    }

}
