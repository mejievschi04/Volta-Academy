<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExamResult;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ExamResultController extends Controller
{
    /**
     * Get all exam results for the authenticated user
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        
        $results = ExamResult::with([
            'exam.course:id,title',
            'exam.questions' => function($query) {
                $query->orderBy('order');
            },
            'exam.questions.answers' => function($query) {
                $query->orderBy('order');
            }
        ])
        ->where('user_id', $user->id)
        ->orderBy('completed_at', 'desc')
        ->get();

        return response()->json($results);
    }

    /**
     * Get a specific exam result with full details
     */
    public function show($id)
    {
        $user = Auth::user();
        
        $result = ExamResult::with([
            'exam.course:id,title',
            'exam.questions' => function($query) {
                $query->orderBy('order');
            },
            'exam.questions.answers' => function($query) {
                $query->orderBy('order');
            }
        ])
        ->where('user_id', $user->id)
        ->findOrFail($id);

        return response()->json($result);
    }
}

