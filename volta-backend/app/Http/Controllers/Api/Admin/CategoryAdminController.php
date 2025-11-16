<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryAdminController extends Controller
{
    public function index()
    {
        $categories = Category::orderBy('order')->orderBy('name')->get();
        return response()->json($categories);
    }

    public function show($id)
    {
        $category = Category::with('courses')->findOrFail($id);
        return response()->json($category);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:categories,name',
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:10',
            'color' => 'nullable|string|max:20',
            'order' => 'nullable|integer|min:0',
        ]);

        $category = Category::create($validated);

        return response()->json([
            'message' => 'Categorie creată cu succes',
            'category' => $category,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $category = Category::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255|unique:categories,name,' . $id,
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:10',
            'color' => 'nullable|string|max:20',
            'order' => 'nullable|integer|min:0',
        ]);

        $category->update($validated);

        return response()->json([
            'message' => 'Categorie actualizată cu succes',
            'category' => $category,
        ]);
    }

    public function destroy($id)
    {
        $category = Category::findOrFail($id);
        $category->delete();

        return response()->json([
            'message' => 'Categorie ștearsă cu succes',
        ]);
    }
}
