<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GuideItem extends Model
{
    protected $fillable = [
        'user_id',
        'title',
        'description',
        'url',
        'cover_image_path',
    ];

    protected $hidden = [
        'cover_image_path',
    ];

    protected $appends = [
        'cover_image_url',
    ];

    public function getCoverImageUrlAttribute(): ?string
    {
        $path = $this->cover_image_path ?? null;
        if (! $path) {
            return null;
        }

        return '/storage/' . ltrim($path, '/');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
