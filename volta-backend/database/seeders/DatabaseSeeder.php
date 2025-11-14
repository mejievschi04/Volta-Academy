<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\Reward;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // --- Users ---
        $teachers = collect([
            [
                'email' => 'ana@example.com',
                'name' => 'Profesor Ana',
                'bio' => 'Profesor de dezvoltare web și PHP.',
            ],
            [
                'email' => 'ion@example.com',
                'name' => 'Profesor Ion',
                'bio' => 'Specialist Laravel & API design.',
            ],
            [
                'email' => 'elena@example.com',
                'name' => 'Profesoara Elena',
                'bio' => 'Designer UX și specialistă în cercetare utilizatori.',
            ],
        ])->map(function (array $data) {
            return User::firstOrCreate(
                ['email' => $data['email']],
                [
                    'name' => $data['name'],
                    'password' => Hash::make('password'),
                    'role' => 'teacher',
                    'avatar' => null,
                    'bio' => $data['bio'],
                    'level' => 5,
                    'points' => 1200,
                ]
            );
        })->values();

        $students = collect([
            ['email' => 'maria@example.com', 'name' => 'Maria Student'],
            ['email' => 'andrei@example.com', 'name' => 'Andrei Student'],
        ])->map(function (array $data) {
            return User::firstOrCreate(
                ['email' => $data['email']],
                [
                    'name' => $data['name'],
                    'password' => Hash::make('password'),
                    'role' => 'student',
                    'avatar' => null,
                    'bio' => 'Pasionat de învățare și tehnologie.',
                    'level' => 2,
                    'points' => 300,
                ]
            );
        })->values();

        // --- Courses & Lessons ---
        $courses = [
            [
                'title' => 'Introducere în PHP',
                'description' => 'Fundamentele PHP pentru a construi primele aplicații web.',
                'teacher' => $teachers[0],
                'reward_points' => 80,
                'lessons' => [
                    ['title' => 'Primul script PHP', 'content' => 'Scrie primul mesaj "Salut lume!" în PHP.'],
                    ['title' => 'Variabile și Tipuri de Date', 'content' => 'Explorăm variabile, array-uri și tipul dynamic al PHP.'],
                    ['title' => 'Controlul Fluxului', 'content' => 'Instrucțiuni if, switch și bucle while/for.'],
                ],
            ],
            [
                'title' => 'Laravel pentru Începători',
                'description' => 'De la instalare la primele rute și controllere.',
                'teacher' => $teachers[1],
                'reward_points' => 120,
                'lessons' => [
                    ['title' => 'Instalare Laravel', 'content' => 'Configurare mediu și instalare folosind Composer.'],
                    ['title' => 'Structura unui Proiect', 'content' => 'Înțelegem folderele esențiale și fluxul MVC.'],
                    ['title' => 'Rute & Controlere', 'content' => 'Construim primele pagini și conectăm controlere.'],
                ],
            ],
            [
                'title' => 'Front-end Modern cu React',
                'description' => 'Construiește interfețe armonioase cu React și hooks.',
                'teacher' => $teachers[0],
                'reward_points' => 150,
                'lessons' => [
                    ['title' => 'Bazele React', 'content' => 'Componentă, JSX și primul render.'],
                    ['title' => 'State & Hooks', 'content' => 'useState, useEffect și organizarea logicii.'],
                    ['title' => 'Routing & API-uri', 'content' => 'Integrarea react-router și fetch de date.'],
                ],
            ],
            [
                'title' => 'Node.js pentru Backend',
                'description' => 'API-uri REST, middleware și conexiuni la baze de date cu Node & Express.',
                'teacher' => $teachers[1],
                'reward_points' => 140,
                'lessons' => [
                    ['title' => 'Setarea mediului Node.js', 'content' => 'Instalăm Node.js și inițializăm un proiect Express.'],
                    ['title' => 'Routing cu Express', 'content' => 'Construim rute REST și middleware-uri personalizate.'],
                    ['title' => 'Persistență de date', 'content' => 'Conectăm aplicația la o bază de date și gestionăm erorile.'],
                ],
            ],
            [
                'title' => 'Design UX & Interfețe',
                'description' => 'Principii vizuale, experiență utilizator și prototipare rapidă.',
                'teacher' => $teachers[2],
                'reward_points' => 90,
                'lessons' => [
                    ['title' => 'Principiile UX', 'content' => 'Analizăm utilizabilitate, accesibilitate și parcursul utilizatorului.'],
                    ['title' => 'Design de Interfață', 'content' => 'Lucrăm cu tipografie, culoare și grile.'],
                    ['title' => 'Prototipare rapidă', 'content' => 'Folosim Figma pentru a testa ideile într-un prototip interactiv.'],
                ],
            ],
            [
                'title' => 'Analiză de Date cu Python',
                'description' => 'Curățare, analiză și vizualizare de dataset-uri cu ecosistemul Python.',
                'teacher' => $teachers[0],
                'reward_points' => 180,
                'lessons' => [
                    ['title' => 'Introducere în Pandas', 'content' => 'Încărcăm și curățăm datele cu DataFrame-uri.'],
                    ['title' => 'Vizualizare de date', 'content' => 'Creăm grafice relevante cu Matplotlib și Seaborn.'],
                    ['title' => 'Analiză statistică', 'content' => 'Aplicăm metode statistice și generăm insight-uri.'],
                ],
            ],
        ];

        foreach ($courses as $courseData) {
            $course = Course::firstOrCreate(
                ['title' => $courseData['title']],
                [
                    'description' => $courseData['description'],
                    'teacher_id' => $courseData['teacher']->id,
                    'reward_points' => $courseData['reward_points'],
                ]
            );

            foreach ($courseData['lessons'] as $index => $lessonData) {
                Lesson::firstOrCreate(
                    ['course_id' => $course->id, 'title' => $lessonData['title']],
                    [
                        'content' => $lessonData['content'],
                        'order' => $index + 1,
                    ]
                );
            }
        }

        // --- Rewards ---
        $rewards = [
            ['title' => 'Primii pași', 'description' => 'Completează prima lecție.', 'points_required' => 50],
            ['title' => 'Eroul Laravel', 'description' => 'Completează liniile de bază ale cursului Laravel.', 'points_required' => 200],
            ['title' => 'Starul React', 'description' => 'Finalizează toate lecțiile cursului React.', 'points_required' => 250],
            ['title' => 'Maestrul Node', 'description' => 'Finalizează cursul Node.js și rulează primul API.', 'points_required' => 260],
            ['title' => 'Designer cu Viziune', 'description' => 'Finalizează cursul de Design UX și prezintă un prototip.', 'points_required' => 180],
            ['title' => 'Analistul de Date', 'description' => 'Analizează un dataset complex și livrează un raport.', 'points_required' => 320],
        ];

        foreach ($rewards as $reward) {
            Reward::firstOrCreate(
                ['title' => $reward['title']],
                [
                    'description' => $reward['description'],
                    'points_required' => $reward['points_required'],
                ]
            );
        }

        // --- Level up some students with bonus points ---
        $students->each(function (User $student, int $index) use ($courses) {
            $student->update([
                'level' => 3 + $index,
                'points' => 400 + ($index * 150),
            ]);
        });
    }
}
