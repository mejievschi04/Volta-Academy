<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\RegistrationInvitationService;
use App\Services\UserAssignedCoursesService;
use App\Support\AuthActivityLogger;
use App\Support\StudentSessionLogger;
use App\Support\UserEmail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use App\Support\SchemaCache;

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
            'universal' => (bool) $invitation->reusable,
            'email' => $invitation->reusable ? null : $invitation->email,
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

        $chosenEmail = null;
        if ($invitation->reusable) {
            $chosenEmail = UserEmail::normalize((string) $request->input('email'));
            $request->merge(['email' => $chosenEmail]);
            $request->validate([
                'email' => 'required|string|email|max:255',
            ]);
            if (UserEmail::taken($chosenEmail)) {
                return response()->json([
                    'message' => 'Există deja un cont cu acest email.',
                ], 422);
            }
        } elseif (! $invitation->user_id && UserEmail::taken($invitation->email)) {
            return response()->json([
                'message' => 'Există deja un cont cu acest email.',
            ], 422);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255|regex:/^[\p{L}\p{M}0-9\s\-\.]+$/u',
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

        $user = \Illuminate\Support\Facades\DB::transaction(function () use ($token, $validated, $chosenEmail, $invitationService) {
            $invitation = \App\Models\RegistrationInvitation::where('token', hash('sha256', $token))
                ->whereNull('accepted_at')->where('expires_at', '>', now())->lockForUpdate()->first();
            abort_unless($invitation, 404, 'Linkul de invitație este invalid sau a expirat.');

            if ($invitation->reusable) {
                if (UserEmail::taken($chosenEmail)) {
                    abort(422, 'Există deja un cont cu acest email.');
                }
                $user = User::create([
                    'name' => strip_tags($validated['name']),
                    'email' => $chosenEmail,
                    'password' => Hash::make($validated['password']),
                    'role' => $invitation->role ?: 'student',
                    'level' => 1,
                    'points' => 0,
                    'status' => 'active',
                    'must_change_password' => false,
                ]);
            } elseif ($invitation->user_id) {
                $user = User::lockForUpdate()->find($invitation->user_id);
                $invitationService->assertUserInvitable($user, $invitation->email);
                $user->update([
                    'password' => Hash::make($validated['password']),
                    'must_change_password' => false,
                ]);
            } else {
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
            }

            if ($invitation->team_id) {
                $user->teams()->syncWithoutDetaching([$invitation->team_id]);
                app(UserAssignedCoursesService::class)->enrollUserInLinkedTeamCourses($user->fresh());
            }

            $user->forceFill(['last_login_at' => now()])->save();
            if (! $invitation->reusable) {
                $invitation->update(['accepted_at' => now(), 'user_id' => $user->id]);
            }

            return $user;
        });

        if (SchemaCache::hasTable('activity_logs')) {
            \App\Models\ActivityLog::create([
                'user_id' => $user->id,
                'action' => 'user_invited',
                'model_type' => 'User',
                'model_id' => $user->id,
                'description' => $invitation->reusable
                    ? "{$user->name} și-a creat contul prin linkul de înregistrare"
                    : "{$user->name} și-a activat contul prin invitație email",
                'new_values' => [
                    'email' => $user->email,
                    'invited_by' => $invitation->invited_by,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
        }

        Auth::login($user, true);
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
            'message' => 'Cont activat cu succes. Bine ai venit!',
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
