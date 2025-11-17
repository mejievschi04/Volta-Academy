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
        // Enable sessions for API routes (needed for authentication)
        // Order matters: StartSession must come early, after CORS
        $middleware->api(prepend: [
            \App\Http\Middleware\HandleCors::class,
            \App\Http\Middleware\SecurityHeaders::class,
            \Illuminate\Session\Middleware\StartSession::class,
        ]);
        // AuthenticateSession can cause issues with API routes, so we'll handle auth differently
        // $middleware->api(append: [
        //     \Illuminate\Session\Middleware\AuthenticateSession::class,
        // ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
