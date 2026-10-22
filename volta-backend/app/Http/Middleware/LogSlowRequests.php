<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Măsoară fiecare cerere API: timpul total, numărul de interogări și timpul lor în baza de date.
 * Valorile apar în headerul Server-Timing (tab-ul Network din browser), iar cererile peste
 * `volta.slow_request_ms` se scriu în storage/logs/slow-requests-*.log.
 */
class LogSlowRequests
{
    public function handle(Request $request, Closure $next): Response
    {
        $start = microtime(true);
        $queries = 0;
        $dbMs = 0.0;
        DB::listen(function (QueryExecuted $query) use (&$queries, &$dbMs) {
            $queries++;
            $dbMs += $query->time;
        });

        $response = $next($request);

        $totalMs = (microtime(true) - $start) * 1000;
        $response->headers->set('Server-Timing', sprintf('app;dur=%.0f, db;dur=%.0f;desc="%d queries"', $totalMs, $dbMs, $queries));

        $threshold = (int) config('volta.slow_request_ms', 1000);
        if ($threshold > 0 && $totalMs >= $threshold) {
            $content = $response->getContent();
            Log::channel('slow_requests')->info('slow request', [
                'method' => $request->method(),
                'path' => '/' . $request->path(),
                'query' => $request->getQueryString(),
                'status' => $response->getStatusCode(),
                'ms' => (int) round($totalMs),
                'db_ms' => (int) round($dbMs),
                'queries' => $queries,
                'bytes' => is_string($content) ? strlen($content) : null,
                'user_id' => $request->user()?->id,
            ]);
        }

        return $response;
    }
}
