<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class LessonController extends Controller
{
    public function index()
{
    // returnează toate lecțiile (sau poți filtra după curs)
    $lessons = \App\Models\Lesson::all();
    return response()->json($lessons);
}

}
