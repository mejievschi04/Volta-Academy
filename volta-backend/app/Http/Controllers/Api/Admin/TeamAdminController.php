<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\Request;

class TeamAdminController extends Controller
{
    public function index()
    {
        $teams = Team::with(['owner', 'users', 'courses'])->get();
        
        return response()->json($teams);
    }

    public function show($id)
    {
        $team = Team::with(['owner', 'users', 'courses'])->findOrFail($id);
        
        return response()->json($team);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'owner_id' => 'required|exists:users,id',
        ]);

        $team = Team::create($validated);

        return response()->json([
            'message' => 'Echipă creată cu succes',
            'team' => $team->load(['owner', 'users', 'courses']),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $team = Team::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'owner_id' => 'sometimes|required|exists:users,id',
        ]);

        $team->update($validated);

        return response()->json([
            'message' => 'Echipă actualizată cu succes',
            'team' => $team->load(['owner', 'users', 'courses']),
        ]);
    }

    public function destroy($id)
    {
        $team = Team::findOrFail($id);
        $team->delete();

        return response()->json([
            'message' => 'Echipă ștearsă cu succes',
        ]);
    }

    public function attachUsers(Request $request, $id)
    {
        $team = Team::findOrFail($id);

        $validated = $request->validate([
            'user_ids' => 'required|array',
            'user_ids.*' => 'exists:users,id',
        ]);

        $team->users()->sync($validated['user_ids']);

        return response()->json([
            'message' => 'Utilizatori atașați cu succes',
            'team' => $team->load(['owner', 'users', 'courses']),
        ]);
    }

    public function attachCourses(Request $request, $id)
    {
        $team = Team::findOrFail($id);

        $validated = $request->validate([
            'course_ids' => 'required|array',
            'course_ids.*' => 'exists:courses,id',
        ]);

        $team->courses()->sync($validated['course_ids']);

        return response()->json([
            'message' => 'Cursuri atașate cu succes',
            'team' => $team->load(['owner', 'users', 'courses']),
        ]);
    }
}

