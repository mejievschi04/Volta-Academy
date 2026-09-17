<?php

namespace App\Support;

use Illuminate\Support\Facades\Schema;

final class CourseUserPivot
{
    /**
     * @return list<string>
     */
    public static function columns(): array
    {
        $columns = [
            'is_mandatory',
            'assigned_at',
            'enrolled',
            'enrolled_at',
            'started_at',
            'completed_at',
            'progress_percentage',
        ];

        if (Schema::hasTable('course_user') && Schema::hasColumn('course_user', 'assignment_source')) {
            $columns[] = 'assignment_source';
        }

        return $columns;
    }
}
