<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Admin\ExamAdminController;
use App\Http\Controllers\Api\Admin\TestAdminController;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

/**
 * Toate contoarele din bara de sus într-o singură cerere (notificări, mesaje, corectări),
 * în loc de patru polling-uri separate din fiecare tab. Regulile de acces rămân ale endpoint-urilor originale.
 */
class BadgeController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $pendingReviews = null;
        if (in_array($user->role ?? '', ['admin', 'instructor', 'analyst'], true)) {
            $pendingReviews = (int) app(TestAdminController::class)->pendingReviewsCount($request)->getData(true)['count']
                + (int) app(ExamAdminController::class)->pendingReviewsCount($request)->getData(true)['count'];
        }

        return response()->json([
            'notifications' => (int) app(NotificationController::class)->unreadCount($request)->getData(true)['count'],
            'messages' => (int) app(MessageController::class)->getUnreadCount($request)->getData(true)['data']['unreadCount'],
            'pending_reviews' => $pendingReviews,
        ]);
    }
}
