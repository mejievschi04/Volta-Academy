<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class HandleCors
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Allowed origins
        $allowedOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];
        $origin = $request->headers->get('Origin');
        
        // Handle preflight requests
        if ($request->getMethod() === 'OPTIONS') {
            $allowedOrigin = in_array($origin, $allowedOrigins) ? $origin : $allowedOrigins[0];
            return response('', 200)
                ->header('Access-Control-Allow-Origin', $allowedOrigin)
                ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-XSRF-TOKEN, Accept, Origin')
                ->header('Access-Control-Allow-Credentials', 'true')
                ->header('Access-Control-Expose-Headers', 'X-XSRF-TOKEN');
        }

        $response = $next($request);

        // Add CORS headers to response
        $allowedOrigin = in_array($origin, $allowedOrigins) ? $origin : $allowedOrigins[0];
        $response->headers->set('Access-Control-Allow-Origin', $allowedOrigin);
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-XSRF-TOKEN, Accept, Origin');
        $response->headers->set('Access-Control-Allow-Credentials', 'true');
        $response->headers->set('Access-Control-Expose-Headers', 'X-XSRF-TOKEN');

        return $response;
    }
}

