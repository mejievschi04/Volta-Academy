<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Reward;
use Illuminate\Http\Request;

class RewardAdminController extends Controller
{
    public function index()
    {
        $rewards = Reward::all();

        return response()->json($rewards);
    }

    public function show($id)
    {
        $reward = Reward::findOrFail($id);

        return response()->json($reward);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'points_required' => 'required|integer|min:0',
        ]);

        $reward = Reward::create($validated);

        return response()->json([
            'message' => 'Recompensă creată cu succes',
            'reward' => $reward,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $reward = Reward::findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'sometimes|required|string',
            'points_required' => 'sometimes|required|integer|min:0',
        ]);

        $reward->update($validated);

        return response()->json([
            'message' => 'Recompensă actualizată cu succes',
            'reward' => $reward,
        ]);
    }

    public function destroy($id)
    {
        $reward = Reward::findOrFail($id);
        $reward->delete();

        return response()->json([
            'message' => 'Recompensă ștearsă cu succes',
        ]);
    }
}

