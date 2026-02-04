<?php

namespace App\Services;

use App\Models\Course;

class CourseBuilderValidator
{
    /**
     * Returns a validation report suitable for UI display.
     *
     * Shape:
     * - ok: bool
     * - errors: [{ code, path, message }]
     * - warnings: [{ code, path, message }]
     */
    public function validate(Course $course): array
    {
        $errors = [];
        $warnings = [];

        $addError = function (string $code, string $path, string $message) use (&$errors) {
            $errors[] = compact('code', 'path', 'message');
        };
        $addWarning = function (string $code, string $path, string $message) use (&$warnings) {
            $warnings[] = compact('code', 'path', 'message');
        };

        if (!trim((string)$course->title)) {
            $addError('course.title.required', 'course.title', 'Titlul cursului este obligatoriu.');
        }

        if (!trim((string)$course->description)) {
            $addWarning('course.description.missing', 'course.description', 'Descrierea cursului lipsește (recomandat pentru B2B/B2C).');
        }

        if (!$course->image) {
            $addWarning('course.thumbnail.missing', 'course.image', 'Thumbnail-ul lipsește (recomandat).');
        }

        $modules = $course->modules ?? collect();
        if ($modules->count() === 0) {
            $addError('course.modules.required', 'course.modules', 'Cursul trebuie să aibă cel puțin un modul.');
        }

        foreach ($modules as $module) {
            if (!trim((string)$module->title)) {
                $addError('module.title.required', "modules.{$module->id}.title", 'Titlul modulului este obligatoriu.');
            }

            $lessons = $module->lessons ?? collect();
            if ($lessons->count() === 0) {
                $addError('module.lessons.required', "modules.{$module->id}.lessons", 'Modulul trebuie să aibă cel puțin o lecție.');
            }

            foreach ($lessons as $lesson) {
                if (!trim((string)$lesson->title)) {
                    $addError('lesson.title.required', "lessons.{$lesson->id}.title", 'Titlul lecției este obligatoriu.');
                }

                // Content requirement: prefer content blocks, fallback to legacy `content`
                $blocks = $lesson->contentBlocks ?? collect();
                $hasLegacyContent = trim((string)($lesson->content ?? '')) !== '';

                if ($blocks->count() === 0 && !$hasLegacyContent) {
                    $addError(
                        'lesson.content.required',
                        "lessons.{$lesson->id}.content",
                        'Lecția trebuie să conțină conținut (minim un content block sau text).'
                    );
                }

            }
        }

        // Basic consistency checks for sequential unlock
        if ($course->sequential_unlock) {
            $addWarning('course.sequential_unlock.enabled', 'course.sequential_unlock', 'Sequential unlock este activ; verifică dependențele și lecțiile preview.');
        }

        return [
            'ok' => count($errors) === 0,
            'errors' => $errors,
            'warnings' => $warnings,
        ];
    }
}

