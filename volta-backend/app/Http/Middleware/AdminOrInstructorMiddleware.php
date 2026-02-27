<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Allows access for users with role 'admin' or 'instructor'.
 * Instructor is restricted to courses and tests (enforced in controllers).
 */
class AdminOrInstructorMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!auth()->check()) {
            return response()->json(['error' => 'Neautentificat'], 401);
        }

        $role = auth()->user()->role ?? 'student';
        if (!in_array($role, ['admin', 'instructor'], true)) {
            return response()->json([
                'error' => 'Acces interzis. Doar administratorii și instructorii pot accesa această resursă.',
            ], 403);
        }

        return $next($request);
    }
}
