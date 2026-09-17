<?php

namespace App\Http\Middleware;

use Illuminate\Support\Str;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful as SanctumEnsureFrontendRequestsAreStateful;
use Laravel\Sanctum\Sanctum;

/**
 * Sanctum SPA: Origin/Referer + fallback pe Host (Nginx reverse proxy, același domeniu).
 * În local, originea de pe IP din LAN (telefon pe același Wi‑Fi) e tratată ca frontend.
 */
class EnsureFrontendRequestsAreStateful extends SanctumEnsureFrontendRequestsAreStateful
{
    public static function fromFrontend($request): bool
    {
        if (parent::fromFrontend($request)) {
            return true;
        }

        $frontendUrl = $request->headers->get('origin') ?: $request->headers->get('referer');
        if ($frontendUrl && self::isLocalLanFrontendUrl($frontendUrl)) {
            return true;
        }

        $host = strtolower((string) $request->getHttpHost());
        if ($host === '') {
            return false;
        }

        foreach (config('sanctum.stateful', []) as $domain) {
            $domain = strtolower(trim((string) $domain));
            if ($domain === '') {
                continue;
            }

            if ($domain === Sanctum::$currentRequestHostPlaceholder) {
                return true;
            }

            if ($host === $domain) {
                return true;
            }

            $domainHost = Str::before($domain, ':');
            if ($host === $domainHost) {
                return true;
            }
        }

        return false;
    }

    private static function isLocalLanFrontendUrl(string $url): bool
    {
        if (! app()->environment('local') && ! config('app.debug')) {
            return false;
        }

        $host = parse_url($url, PHP_URL_HOST);
        if (! is_string($host) || $host === '') {
            $stripped = strtolower(preg_replace('#^https?://#i', '', $url) ?? '');
            $host = Str::before(Str::before($stripped, '/'), ':');
        }

        return self::isPrivateLanHost(strtolower((string) $host));
    }

    private static function isPrivateLanHost(string $host): bool
    {
        if ($host === 'localhost' || $host === '::1') {
            return true;
        }

        if (! filter_var($host, FILTER_VALIDATE_IP)) {
            return false;
        }

        return (bool) filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
    }
}
