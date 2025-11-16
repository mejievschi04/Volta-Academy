<?php

namespace App\Http\Controllers;

use App\Models\Reward;
use Illuminate\Http\Request;

class RewardController extends Controller
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
}

