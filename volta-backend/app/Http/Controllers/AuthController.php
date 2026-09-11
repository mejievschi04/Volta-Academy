<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Setting;
use Illuminate\Support\Facades\Auth;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function showLoginForm() {
        return view('auth.login');
    }

    public function login(Request $request) {
        $credentials = $request->only('email','password');

        if (Auth::attempt($credentials)) {
            $request->session()->regenerate();
            return redirect('/dashboard');
        }

        return back()->withErrors(['email' => 'Datele nu sunt corecte']);
    }

    public function logout(Request $request) {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect('/login');
    }

    public function showRegisterForm() {
        return view('auth.register');
    }

    public function register(Request $request) {
        $registrationEnabled = Setting::get('registration_enabled', true);
        if ($registrationEnabled === false || $registrationEnabled === 0 || $registrationEnabled === '0') {
            return back()->withErrors([
                'email' => 'Înregistrările sunt dezactivate. Folosește o invitație sau contactează un administrator.',
            ]);
        }

        $request->validate([
            'name' => 'required|string|max:255|regex:/^[\p{L}\p{M}0-9\s\-\.]+$/u',
            'email' => 'required|email|unique:users,email',
            'password' => [
                'required',
                'string',
                'min:8',
                'regex:/[a-z]/',
                'regex:/[A-Z]/',
                'regex:/[0-9]/',
                'confirmed',
            ],
        ], [
            'password.regex' => 'Parola trebuie să conțină cel puțin 8 caractere, incluzând o literă mare, o literă mică și o cifră.',
        ]);

        User::create([
            'name' => strip_tags($request->name),
            'email' => strtolower(trim($request->email)),
            'password' => Hash::make($request->password),
            'role' => 'student',
            'status' => 'pending',
        ]);

        return redirect('/login')->with('status', 'Contul așteaptă aprobarea unui administrator.');
    }
}
