<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use Illuminate\Http\Request;

class QuizController extends Controller
{
    public function show($courseId)
    {
        $course = Course::with('lessons')->findOrFail($courseId);
        
        // For now, return a simple quiz structure
        // TODO: Create quiz/exam table and questions
        $quiz = [
            'id' => 'quiz-' . $courseId,
            'title' => 'Test final: ' . $course->title,
            'courseId' => $course->id,
            'questions' => [
                [
                    'id' => 'q1',
                    'text' => 'Care este primul pas în învățarea ' . $course->title . '?',
                    'options' => [
                        'Citirea documentației',
                        'Practicarea directă',
                        'Urmărirea tutorialelor',
                        'Participarea la cursuri',
                    ],
                    'answerIndex' => 0,
                ],
                [
                    'id' => 'q2',
                    'text' => 'Câte lecții are acest curs?',
                    'options' => [
                        (string)$course->lessons->count(),
                        (string)($course->lessons->count() + 1),
                        (string)($course->lessons->count() - 1),
                        'Depinde de nivel',
                    ],
                    'answerIndex' => 0,
                ],
            ],
        ];

        return response()->json($quiz);
    }

    public function submit(Request $request, $courseId)
    {
        $course = Course::findOrFail($courseId);
        $answers = $request->input('answers', []);
        
        // Get quiz questions
        $quiz = $this->show($courseId);
        $questions = json_decode($quiz->getContent(), true)['questions'];
        
        // Calculate score
        $score = 0;
        $total = count($questions);
        
        foreach ($questions as $index => $question) {
            if (isset($answers[$question['id']]) && $answers[$question['id']] == $question['answerIndex']) {
                $score++;
            }
        }
        
        $passed = $score >= ($total / 2); // Pass if at least 50%
        
        // TODO: Save quiz result to database
        
        return response()->json([
            'score' => $score,
            'total' => $total,
            'passed' => $passed,
            'percentage' => round(($score / $total) * 100),
        ]);
    }
}

