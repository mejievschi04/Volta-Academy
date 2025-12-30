<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\Exam;
use App\Models\CourseTest;
use App\Services\CourseProgressService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

class StudentDashboardController extends Controller
{
    protected $progressService;

    public function __construct(CourseProgressService $progressService)
    {
        $this->progressService = $progressService;
    }

    /**
     * Get comprehensive student dashboard data
     */
    public function index()
    {
        $user = Auth::user();

        // Get enrolled courses
        $enrolledCourses = DB::table('course_user')
            ->where('user_id', $user->id)
            ->where('enrolled', true)
            ->pluck('course_id');

        $courses = Course::with(['teacher', 'modules' => function($q) {
            $q->where('status', 'published')->orderBy('order');
        }])
        ->whereIn('id', $enrolledCourses)
        ->where('status', 'published')
        ->get();

        // Calculate global progress
        $globalProgress = $this->calculateGlobalProgress($user, $courses);

        // Get active courses (in progress, not completed)
        $activeCourses = $this->getActiveCourses($user, $courses);

        // Get next recommended lesson
        $nextLesson = $this->getNextRecommendedLesson($user, $courses);

        // Calculate learning time
        $learningTime = $this->calculateLearningTime($user);

        // Get incomplete lessons
        $incompleteLessons = $this->getIncompleteLessons($user, $courses);

        // Get pending exams
        $pendingExams = $this->getPendingExams($user, $courses);

        // Get badges/achievements
        $badges = $this->getBadges($user, $courses);

        return response()->json([
            'global_progress' => $globalProgress,
            'active_courses' => $activeCourses,
            'next_lesson' => $nextLesson,
            'learning_time' => $learningTime,
            'incomplete_lessons' => $incompleteLessons,
            'pending_exams' => $pendingExams,
            'badges' => $badges,
            'stats' => [
                'total_courses' => $courses->count(),
                'active_courses_count' => count($activeCourses),
                'completed_courses_count' => $courses->filter(function($course) use ($user) {
                    $progress = $this->progressService->calculateCourseProgress($user, $course);
                    return $progress >= 100;
                })->count(),
                'total_lessons_completed' => DB::table('lesson_progress')
                    ->where('user_id', $user->id)
                    ->where('completed', true)
                    ->count(),
                'total_exams_passed' => $this->getTotalExamsPassed($user),
            ],
        ]);
    }

    /**
     * Calculate global progress across all courses
     */
    private function calculateGlobalProgress($user, $courses)
    {
        if ($courses->isEmpty()) {
            return [
                'percentage' => 0,
                'completed_courses' => 0,
                'total_courses' => 0,
                'completed_lessons' => 0,
                'total_lessons' => 0,
            ];
        }

        $totalLessons = 0;
        $completedLessons = 0;
        $completedCourses = 0;

        foreach ($courses as $course) {
            $courseProgress = $this->progressService->calculateCourseProgress($user, $course);
            
            // Count lessons
            $modules = $course->modules;
            foreach ($modules as $module) {
                $moduleLessons = $module->lessons()->where('status', 'published')->get();
                $totalLessons += $moduleLessons->count();

                foreach ($moduleLessons as $lesson) {
                    $isCompleted = Schema::hasTable('lesson_progress')
                        ? DB::table('lesson_progress')
                            ->where('user_id', $user->id)
                            ->where('lesson_id', $lesson->id)
                            ->where('completed', true)
                            ->exists()
                        : false;

                    if ($isCompleted) {
                        $completedLessons++;
                    }
                }
            }

            if ($courseProgress >= 100) {
                $completedCourses++;
            }
        }

        $percentage = $totalLessons > 0 
            ? round(($completedLessons / $totalLessons) * 100, 1)
            : 0;

        return [
            'percentage' => $percentage,
            'completed_courses' => $completedCourses,
            'total_courses' => $courses->count(),
            'completed_lessons' => $completedLessons,
            'total_lessons' => $totalLessons,
        ];
    }

    /**
     * Get active courses (in progress, not completed)
     */
    private function getActiveCourses($user, $courses)
    {
        $activeCourses = [];

        foreach ($courses as $course) {
            $progress = $this->progressService->calculateCourseProgress($user, $course);
            
            if ($progress > 0 && $progress < 100) {
                $accessStatus = $this->progressService->getUserAccessStatus($user, $course);
                
                // Find next module to complete
                $nextModule = null;
                foreach ($accessStatus['modules'] as $module) {
                    if (!$module['unlocked'] || $module['progress'] < 100) {
                        $nextModule = $module;
                        break;
                    }
                }

                $moduleModel = $nextModule ? Module::find($nextModule['id']) : null;
                
                $activeCourses[] = [
                    'id' => $course->id,
                    'title' => $course->title,
                    'thumbnail' => $course->image_url ?? null,
                    'teacher' => $course->teacher ? $course->teacher->name : null,
                    'progress' => $progress,
                    'next_module' => $moduleModel ? [
                        'id' => $moduleModel->id,
                        'title' => $moduleModel->title,
                    ] : null,
                    'last_accessed_at' => DB::table('course_user')
                        ->where('user_id', $user->id)
                        ->where('course_id', $course->id)
                        ->value('updated_at'),
                ];
            }
        }

        // Sort by last accessed (most recent first)
        usort($activeCourses, function($a, $b) {
            $timeA = $a['last_accessed_at'] ? strtotime($a['last_accessed_at']) : 0;
            $timeB = $b['last_accessed_at'] ? strtotime($b['last_accessed_at']) : 0;
            return $timeB - $timeA;
        });

        return array_slice($activeCourses, 0, 6); // Return top 6
    }

    /**
     * Get next recommended lesson (resume functionality)
     */
    private function getNextRecommendedLesson($user, $courses)
    {
        // Use progress service to get next incomplete lesson
        foreach ($courses as $course) {
            $nextLesson = $this->progressService->getNextIncompleteLesson($user, $course);
            
            if ($nextLesson) {
                return [
                    'id' => $nextLesson->id,
                    'title' => $nextLesson->title,
                    'course_id' => $course->id,
                    'course_title' => $course->title,
                    'module_id' => $nextLesson->module_id,
                    'module_title' => $nextLesson->module ? $nextLesson->module->title : null,
                    'type' => $nextLesson->type,
                    'duration_minutes' => $nextLesson->duration_minutes,
                    'is_preview' => $nextLesson->is_preview ?? false,
                ];
            }
        }

        return null;
    }

    /**
     * Calculate total learning time
     */
    private function calculateLearningTime($user)
    {
        // Check if tables exist
        if (!Schema::hasTable('lesson_progress') || !Schema::hasTable('lessons')) {
            return [
                'total_minutes' => 0,
                'hours' => 0,
                'minutes' => 0,
                'formatted' => '0m',
            ];
        }

        // Get completed lessons with duration
        $completedLessons = DB::table('lesson_progress')
            ->join('lessons', 'lesson_progress.lesson_id', '=', 'lessons.id')
            ->where('lesson_progress.user_id', $user->id)
            ->where('lesson_progress.completed', true)
            ->whereNotNull('lessons.duration_minutes')
            ->sum('lessons.duration_minutes');

        $totalMinutes = $completedLessons ?? 0;
        $hours = floor($totalMinutes / 60);
        $minutes = $totalMinutes % 60;

        return [
            'total_minutes' => $totalMinutes,
            'hours' => $hours,
            'minutes' => $minutes,
            'formatted' => $hours > 0 ? "{$hours}h {$minutes}m" : "{$minutes}m",
        ];
    }

    /**
     * Get incomplete lessons
     */
    private function getIncompleteLessons($user, $courses)
    {
        $incompleteLessons = [];

        foreach ($courses as $course) {
            $accessStatus = $this->progressService->getUserAccessStatus($user, $course);
            
            foreach ($accessStatus['modules'] as $module) {
                if (!$module['unlocked']) {
                    continue;
                }

                foreach ($module['lessons'] as $lesson) {
                    if ($lesson['unlocked'] && !$lesson['completed']) {
                        $lessonModel = Lesson::find($lesson['id']);
                        if ($lessonModel) {
                            $incompleteLessons[] = [
                                'id' => $lessonModel->id,
                                'title' => $lessonModel->title,
                                'course_id' => $course->id,
                                'course_title' => $course->title,
                                'module_id' => $module['id'],
                                'module_title' => Module::find($module['id'])->title ?? null,
                                'type' => $lessonModel->type,
                                'duration_minutes' => $lessonModel->duration_minutes,
                            ];
                        }
                    }
                }
            }
        }

        return array_slice($incompleteLessons, 0, 10); // Return top 10
    }

    /**
     * Get pending exams
     */
    private function getPendingExams($user, $courses)
    {
        $pendingExams = [];

        foreach ($courses as $course) {
            $modules = $course->modules()->where('status', 'published')->get();
            
            foreach ($modules as $module) {
                // Get tests linked to this module via CourseTest
                $module->load(['courseTests' => function($q) {
                    $q->where('scope', 'module');
                }, 'courseTests.test' => function($q) {
                    $q->where('status', 'published');
                }]);
                
                // Also get course-level tests
                $courseTests = \App\Models\CourseTest::where('course_id', $course->id)
                    ->where('scope', 'course')
                    ->with(['test' => function($q) {
                        $q->where('status', 'published');
                    }])
                    ->get();
                
                // Process module-level tests
                foreach ($module->courseTests as $courseTest) {
                    if (!$courseTest->test || $courseTest->test->status !== 'published') {
                        continue;
                    }
                    
                    $test = $courseTest->test;
                    
                    // Check if test is unlocked
                    try {
                        $isUnlocked = $this->progressService->isTestUnlocked($user, $test, $course);
                    } catch (\Exception $e) {
                        Log::warning('Error checking if test is unlocked', [
                            'test_id' => $test->id,
                            'user_id' => $user->id,
                            'error' => $e->getMessage(),
                        ]);
                        // For now, assume unlocked if test exists
                        $isUnlocked = true;
                    }
                    
                    if ($isUnlocked) {
                        // Check if test has been passed
                        $hasPassed = DB::table('test_results')
                            ->where('user_id', $user->id)
                            ->where('test_id', $test->id)
                            ->where('percentage', '>=', $courseTest->passing_score ?? 70)
                            ->exists();

                        if (!$hasPassed) {
                            $pendingExams[] = [
                                'id' => $test->id,
                                'title' => $test->title,
                                'course_id' => $course->id,
                                'course_title' => $course->title,
                                'module_id' => $module->id,
                                'module_title' => $module->title,
                                'passing_score' => $courseTest->passing_score ?? 70,
                                'is_required' => $courseTest->required ?? false,
                            ];
                        }
                    }
                }
                
                // Process course-level tests
                foreach ($courseTests as $courseTest) {
                    if (!$courseTest->test || $courseTest->test->status !== 'published') {
                        continue;
                    }
                    
                    $test = $courseTest->test;
                    
                    // For course-level tests
                    try {
                        $isUnlocked = $this->progressService->isTestUnlocked($user, $test, $course);
                    } catch (\Exception $e) {
                        Log::warning('Error checking if course test is unlocked', [
                            'test_id' => $test->id,
                            'user_id' => $user->id,
                            'error' => $e->getMessage(),
                        ]);
                        $isUnlocked = true;
                    }
                    
                    if ($isUnlocked) {
                        // Check if test has been passed
                        $hasPassed = DB::table('test_results')
                            ->where('user_id', $user->id)
                            ->where('test_id', $test->id)
                            ->where('percentage', '>=', $courseTest->passing_score ?? 70)
                            ->exists();

                        if (!$hasPassed) {
                            $pendingExams[] = [
                                'id' => $test->id,
                                'title' => $test->title,
                                'course_id' => $course->id,
                                'course_title' => $course->title,
                                'module_id' => null,
                                'module_title' => null,
                                'passing_score' => $courseTest->passing_score ?? 70,
                                'is_required' => $courseTest->required ?? false,
                            ];
                        }
                    }
                }
            }
        }

        return array_slice($pendingExams, 0, 10); // Return top 10
    }

    /**
     * Get badges/achievements
     */
    private function getBadges($user, $courses)
    {
        $badges = [];

        // Course completion badges
        $completedCourses = $courses->filter(function($course) use ($user) {
            $progress = $this->progressService->calculateCourseProgress($user, $course);
            return $progress >= 100;
        })->count();

        if ($completedCourses >= 1) {
            $badges[] = [
                'id' => 'first_course',
                'name' => 'Primul Curs',
                'description' => 'Ai finalizat primul curs',
                'icon' => '🎓',
                'earned_at' => now()->toDateString(),
            ];
        }

        if ($completedCourses >= 5) {
            $badges[] = [
                'id' => 'five_courses',
                'name' => 'Expert',
                'description' => 'Ai finalizat 5 cursuri',
                'icon' => '⭐',
                'earned_at' => now()->toDateString(),
            ];
        }

        // Lesson completion badges
        $completedLessons = Schema::hasTable('lesson_progress')
            ? DB::table('lesson_progress')
                ->where('user_id', $user->id)
                ->where('completed', true)
                ->count()
            : 0;

        if ($completedLessons >= 10) {
            $badges[] = [
                'id' => 'ten_lessons',
                'name' => 'Dedicație',
                'description' => 'Ai finalizat 10 lecții',
                'icon' => '📚',
                'earned_at' => now()->toDateString(),
            ];
        }

        if ($completedLessons >= 50) {
            $badges[] = [
                'id' => 'fifty_lessons',
                'name' => 'Maestru',
                'description' => 'Ai finalizat 50 lecții',
                'icon' => '🏆',
                'earned_at' => now()->toDateString(),
            ];
        }

        return $badges;
    }

    /**
     * Get total exams passed
     */
    private function getTotalExamsPassed($user)
    {
        if (!Schema::hasTable('exam_results') || !Schema::hasTable('exams')) {
            return 0;
        }

        return DB::table('exam_results')
            ->join('exams', 'exam_results.exam_id', '=', 'exams.id')
            ->where('exam_results.user_id', $user->id)
            ->whereColumn('exam_results.score', '>=', DB::raw('exams.passing_score'))
            ->count();
    }
}

