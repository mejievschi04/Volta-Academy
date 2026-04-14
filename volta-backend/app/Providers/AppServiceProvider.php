<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Citiri mesagerie (polling): buget mare, separat de mutații ca să nu se „fure” între ele.
        RateLimiter::for('api-messages-read', function (Request $request) {
            $key = (string) ($request->user()?->id ?? $request->ip());

            return Limit::perMinute((int) config('messages.read_per_minute', 2000))->by($key);
        });

        RateLimiter::for('api-messages-write', function (Request $request) {
            $key = (string) ($request->user()?->id ?? $request->ip());

            return Limit::perMinute((int) config('messages.write_per_minute', 180))->by($key);
        });

        if (config('database.default') === 'sqlite') {
            $databasePath = config('database.connections.sqlite.database');

            // Skip file creation for in-memory database (used in tests)
            if ($databasePath === ':memory:') {
                return;
            }

            if (is_string($databasePath) && ! file_exists($databasePath)) {
                $directory = dirname($databasePath);

                if (! is_dir($directory)) {
                    mkdir($directory, 0755, true);
                }

                touch($databasePath);
            }
        }
    }
}
