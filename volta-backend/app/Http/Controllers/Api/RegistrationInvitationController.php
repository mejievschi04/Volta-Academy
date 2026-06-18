<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\RegistrationInvitationService;
use App\Support\AuthActivityLogger;
use App\Support\StudentSessionLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class RegistrationInvitationController extends Controller
{
    public function show(string $token, RegistrationInvitationService $invitationService)
    {
        $invitation = $invitationService->findPendingByPlainToken($token);

        if (! $invitation) {
            return response()->json([
                'valid' => false,
                'message' => 'Linkul de invitație este invalid sau a expirat.',
            ], 404);
        }

        return response()->json([
            'valid' => true,
            'email' => $invitation->email,
            'name' => $invitation->name,
            'role' => $invitation->role,
            'expires_at' => $invitation->expires_at?->toIso8601String(),
        ]);
    }

    public function accept(Request $request, string $token, RegistrationInvitationService $invitationService)
    {
        $invitation = $invitationService->findPendingByPlainToken($token);

        if (! $invitation) {
            return response()->json([
                'message' => 'Linkul de invitație este invalid sau a expirat.',
            ], 404);
        }

        if (User::where('email', $invitation->email)->exists()) {
            return response()->json([
                'message' => 'Există deja un cont cu acest email.',
            ], 422);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255|regex:/^[a-zA-Z0-9\s\-\.]+$/u',
            'password' => [
                'required',
                'string',
                'min:8',
                'confirmed',
                'regex:/[a-z]/',
                'regex:/[A-Z]/',
                'regex:/[0-9]/',
            ],
        ], [
            'password.regex' => 'Parola trebuie să conțină cel puțin 8 caractere, incluzând o literă mare, o literă mică și o cifră.',
        ]);

        $user = User::create([
            'name' => strip_tags($validated['name']),
            'email' => $invitation->email,
            'password' => Hash::make($validated['password']),
            'role' => $invitation->role ?: 'student',
            'level' => 1,
            'points' => 0,
            'status' => 'active',
            'must_change_password' => false,
        ]);

        if ($invitation->team_id) {
            $user->teams()->syncWithoutDetaching([$invitation->team_id]);
        }

        $invitation->update([
            'accepted_at' => now(),
            'user_id' => $user->id,
        ]);

        if (Schema::hasTable('activity_logs')) {
            \App\Models\ActivityLog::create([
                'user_id' => $user->id,
                'action' => 'user_invited',
                'model_type' => 'User',
                'model_id' => $user->id,
                'description' => "{$user->name} și-a activat contul prin invitație email",
                'new_values' => [
                    'email' => $user->email,
                    'invited_by' => $invitation->invited_by,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
        }

        Auth::login($user);
        $request->session()->regenerate();

        $user->forceFill(['last_login_at' => now()])->save();
        AuthActivityLogger::logLoggedIn($user, $request);
        StudentSessionLogger::recordOpened($user, $request);

        Log::info('User registered via invitation', [
            'user_id' => $user->id,
            'email' => $user->email,
            'invitation_id' => $invitation->id,
        ]);

        return response()->json([
            'message' => 'Cont creat cu succes. Bine ai venit!',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role ?? 'student',
                'level' => $user->level ?? 1,
                'points' => $user->points ?? 0,
                'must_change_password' => false,
            ],
        ], 201);
    }
}
