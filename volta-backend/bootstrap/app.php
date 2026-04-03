<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // În spatele Nginx / Docker, X-Forwarded-Proto și IP corect pentru HTTPS, rate limit, sesiuni.
        $middleware->trustProxies(at: '*');

        // Sanctum: sesiune cookie pentru SPA + Bearer token pentru mobil
        // Enable sessions for API routes (needed for authentication)
        // Order matters: StartSession must come early, after CORS
        $middleware->api(prepend: [
            \App\Http\Middleware\HandleCors::class,
            \App\Http\Middleware\SecurityHeaders::class,
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
            \Illuminate\Session\Middleware\StartSession::class,
        ]);
        // AuthenticateSession can cause issues with API routes, so we'll handle auth differently
        // $middleware->api(append: [
        //     \Illuminate\Session\Middleware\AuthenticateSession::class,
        // ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Suppress Laravel 12 ServeCommand parsing errors (non-critical)
        // These errors occur when parsing PHP server output and don't affect functionality
        $exceptions->reportable(function (\Throwable $e) {
            // Ignore non-critical ServeCommand parsing errors
            if ($e instanceof \ErrorException 
                && str_contains($e->getMessage(), 'Undefined array key') 
                && str_contains($e->getFile(), 'ServeCommand.php')) {
                return false; // Don't report this error
            }
        });

        // Pe VPS: pune VOLTA_EXPOSE_API_ERRORS=true temporar în .env ca răspunsul JSON la 500 să conțină mesajul excepției (fără APP_DEBUG complet).
        $exceptions->render(function (\Throwable $e, \Illuminate\Http\Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            if (! filter_var(env('VOLTA_EXPOSE_API_ERRORS', false), FILTER_VALIDATE_BOOLEAN)) {
                return null;
            }
            if ($e instanceof \Illuminate\Validation\ValidationException) {
                return null;
            }

            return response()->json([
                'message' => $e->getMessage(),
                'exception' => basename(str_replace('\\', '/', $e::class)),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ], 500);
        });
    })->create();
