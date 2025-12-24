<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\ProgressionRule;
use Illuminate\Http\Request;

/**
 * ProgressionRulesController
 * 
 * Manages progression rules for courses
 * Rules drive course progression, not hardcoded flows
 */
class ProgressionRulesController extends Controller
{
    /**
     * Get all progression rules for a course
     */
    public function index($courseId)
    {
        $course = Course::findOrFail($courseId);
        
        $rules = $course->progressionRules()
            ->orderBy('priority')
            ->orderBy('created_at')
            ->get();

        return response()->json($rules);
    }

    /**
     * Create a new progression rule
     */
    public function store(Request $request, $courseId)
    {
        $course = Course::findOrFail($courseId);

        $validated = $request->validate([
            'type' => 'required|in:lesson_completion,test_passing,minimum_score,order_constraint,time_requirement,prerequisite',
            'target_type' => 'nullable|in:lesson,module,test,course',
            'target_id' => 'nullable|integer',
            'condition_type' => 'nullable|in:lesson,module,test,score,time',
            'condition_id' => 'nullable|integer',
            'condition_value' => 'nullable|string',
            'action' => 'required|in:unlock,lock,require,optional',
            'priority' => 'nullable|integer|min:0',
            'active' => 'nullable|boolean',
        ]);

        $rule = ProgressionRule::create([
            'course_id' => $course->id,
            'type' => $validated['type'],
            'target_type' => $validated['target_type'] ?? null,
            'target_id' => $validated['target_id'] ?? null,
            'condition_type' => $validated['condition_type'] ?? null,
            'condition_id' => $validated['condition_id'] ?? null,
            'condition_value' => $validated['condition_value'] ?? null,
            'action' => $validated['action'],
            'priority' => $validated['priority'] ?? 100,
            'active' => $validated['active'] ?? true,
        ]);

        // Update course progression_rules JSON for quick access
        $this->updateCourseProgressionRules($course);

        return response()->json([
            'message' => 'Progression rule created successfully',
            'rule' => $rule,
        ], 201);
    }

    /**
     * Update a progression rule
     */
    public function update(Request $request, $courseId, $ruleId)
    {
        $course = Course::findOrFail($courseId);
        $rule = ProgressionRule::where('course_id', $course->id)
            ->findOrFail($ruleId);

        $validated = $request->validate([
            'type' => 'sometimes|required|in:lesson_completion,test_passing,minimum_score,order_constraint,time_requirement,prerequisite',
            'target_type' => 'nullable|in:lesson,module,test,course',
            'target_id' => 'nullable|integer',
            'condition_type' => 'nullable|in:lesson,module,test,score,time',
            'condition_id' => 'nullable|integer',
            'condition_value' => 'nullable|string',
            'action' => 'sometimes|required|in:unlock,lock,require,optional',
            'priority' => 'nullable|integer|min:0',
            'active' => 'nullable|boolean',
        ]);

        $rule->update($validated);

        // Update course progression_rules JSON
        $this->updateCourseProgressionRules($course);

        return response()->json([
            'message' => 'Progression rule updated successfully',
            'rule' => $rule->fresh(),
        ]);
    }

    /**
     * Delete a progression rule
     */
    public function destroy($courseId, $ruleId)
    {
        $course = Course::findOrFail($courseId);
        $rule = ProgressionRule::where('course_id', $course->id)
            ->findOrFail($ruleId);

        $rule->delete();

        // Update course progression_rules JSON
        $this->updateCourseProgressionRules($course);

        return response()->json([
            'message' => 'Progression rule deleted successfully',
        ]);
    }

    /**
     * Toggle rule active status
     */
    public function toggle($courseId, $ruleId)
    {
        $course = Course::findOrFail($courseId);
        $rule = ProgressionRule::where('course_id', $course->id)
            ->findOrFail($ruleId);

        $rule->update(['active' => !$rule->active]);

        // Update course progression_rules JSON
        $this->updateCourseProgressionRules($course);

        return response()->json([
            'message' => 'Progression rule toggled successfully',
            'rule' => $rule->fresh(),
        ]);
    }

    /**
     * Reorder rules by priority
     */
    public function reorder(Request $request, $courseId)
    {
        $course = Course::findOrFail($courseId);

        $validated = $request->validate([
            'rule_ids' => 'required|array',
            'rule_ids.*' => 'exists:progression_rules,id',
        ]);

        foreach ($validated['rule_ids'] as $index => $ruleId) {
            ProgressionRule::where('id', $ruleId)
                ->where('course_id', $course->id)
                ->update(['priority' => $index]);
        }

        // Update course progression_rules JSON
        $this->updateCourseProgressionRules($course);

        return response()->json([
            'message' => 'Rules reordered successfully',
        ]);
    }

    /**
     * Update course progression_rules JSON field
     * This provides quick access to rule summaries
     */
    protected function updateCourseProgressionRules(Course $course): void
    {
        $rules = $course->progressionRules()
            ->where('active', true)
            ->orderBy('priority')
            ->get()
            ->map(function ($rule) {
                return [
                    'id' => $rule->id,
                    'type' => $rule->type,
                    'target_type' => $rule->target_type,
                    'target_id' => $rule->target_id,
                    'action' => $rule->action,
                    'priority' => $rule->priority,
                ];
            })
            ->toArray();

        $course->update(['progression_rules' => $rules]);
    }
}

