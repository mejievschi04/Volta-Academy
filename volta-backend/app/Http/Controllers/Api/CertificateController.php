<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CertificateController extends Controller
{
    /**
     * Generate certificate for completed course
     */
    public function generate($courseId)
    {
        $user = Auth::user();
        $course = Course::with(['teacher'])->findOrFail($courseId);

        // Check if user has completed the course
        $enrollment = DB::table('course_user')
            ->where('user_id', $user->id)
            ->where('course_id', $courseId)
            ->where('enrolled', true)
            ->first();

        if (!$enrollment) {
            return response()->json([
                'message' => 'Nu ești înscris la acest curs',
            ], 403);
        }

        if (!$enrollment->completed_at) {
            return response()->json([
                'message' => 'Cursul nu este finalizat',
            ], 403);
        }

        // Generate certificate
        $certificateData = [
            'user_name' => $user->name,
            'course_title' => $course->title,
            'completion_date' => $enrollment->completed_at,
            'certificate_id' => 'VOLTA-' . strtoupper(substr(md5($user->id . $courseId . $enrollment->completed_at), 0, 8)),
        ];

        // Generate HTML certificate (can be converted to PDF later with dompdf)
        // For now, return HTML view
        $html = view('certificates.course', $certificateData)->render();
        
        return response($html)
            ->header('Content-Type', 'text/html')
            ->header('Content-Disposition', 'inline; filename="certificat-' . Str::slug($course->title) . '.html"');
        
        // TODO: Install dompdf for PDF generation:
        // composer require barryvdh/laravel-dompdf
        // Then uncomment:
        // $pdf = Pdf::loadView('certificates.course', $certificateData);
        // return $pdf->download('certificat-' . Str::slug($course->title) . '.pdf');
    }

    /**
     * Get certificate info (without generating PDF)
     */
    public function info($courseId)
    {
        $user = Auth::user();
        $course = Course::with(['teacher'])->findOrFail($courseId);

        $enrollment = DB::table('course_user')
            ->where('user_id', $user->id)
            ->where('course_id', $courseId)
            ->where('enrolled', true)
            ->first();

        if (!$enrollment || !$enrollment->completed_at) {
            return response()->json([
                'available' => false,
                'message' => 'Cursul nu este finalizat',
            ]);
        }

        return response()->json([
            'available' => true,
            'course_title' => $course->title,
            'completion_date' => $enrollment->completed_at,
            'certificate_id' => 'VOLTA-' . strtoupper(substr(md5($user->id . $courseId . $enrollment->completed_at), 0, 8)),
        ]);
    }

    /**
     * Get all certificates for user
     */
    public function index()
    {
        $user = Auth::user();

        $certificates = DB::table('course_user')
            ->join('courses', 'course_user.course_id', '=', 'courses.id')
            ->where('course_user.user_id', $user->id)
            ->where('course_user.enrolled', true)
            ->whereNotNull('course_user.completed_at')
            ->select([
                'courses.id as course_id',
                'courses.title as course_title',
                'courses.image_url as course_thumbnail',
                'course_user.completed_at',
                'course_user.progress_percentage',
            ])
            ->orderBy('course_user.completed_at', 'desc')
            ->get()
            ->map(function ($cert) use ($user) {
                return [
                    'course_id' => $cert->course_id,
                    'course_title' => $cert->course_title,
                    'course_thumbnail' => $cert->course_thumbnail,
                    'completion_date' => $cert->completed_at,
                    'progress_percentage' => $cert->progress_percentage,
                    'certificate_id' => 'VOLTA-' . strtoupper(substr(md5($user->id . $cert->course_id . $cert->completed_at), 0, 8)),
                ];
            });

        return response()->json($certificates);
    }
}

