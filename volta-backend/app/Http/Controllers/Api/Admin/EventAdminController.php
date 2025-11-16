<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Event;
use Illuminate\Http\Request;

class EventAdminController extends Controller
{
    public function index()
    {
        $events = Event::orderBy('start_date')->get();

        // Return datetime as string (raw value from database, no conversion)
        $events = $events->map(function($event) {
            $event->start_date = $event->getRawOriginal('start_date') ?? $event->start_date;
            $event->end_date = $event->getRawOriginal('end_date') ?? $event->end_date;
            return $event;
        });

        return response()->json($events);
    }

    public function show($id)
    {
        $event = Event::findOrFail($id);

        // Return raw datetime values without timezone conversion
        $event->start_date = $event->getRawOriginal('start_date') ?? $event->start_date;
        $event->end_date = $event->getRawOriginal('end_date') ?? $event->end_date;

        return response()->json($event);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'type' => 'required|string|in:curs,workshop,examen,webinar,eveniment',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'location' => 'nullable|string|max:255',
        ]);

        // Treat datetime-local input as local time (no timezone conversion)
        // datetime-local sends format like "2025-11-15T13:00" which should be treated as local time
        // We need to save it as-is without timezone conversion
        if (isset($validated['start_date'])) {
            $validated['start_date'] = $this->parseLocalDateTime($validated['start_date']);
        }
        if (isset($validated['end_date'])) {
            $validated['end_date'] = $this->parseLocalDateTime($validated['end_date']);
        }

        $event = Event::create($validated);
        $event->refresh();

        // Return raw datetime values without timezone conversion
        $event->start_date = $event->getRawOriginal('start_date') ?? $event->start_date;
        $event->end_date = $event->getRawOriginal('end_date') ?? $event->end_date;

        return response()->json([
            'message' => 'Eveniment creat cu succes',
            'event' => $event,
        ], 201);
    }

    /**
     * Parse datetime-local format (YYYY-MM-DDTHH:mm) as-is without timezone conversion
     * Save exactly what user entered, no conversions
     */
    private function parseLocalDateTime($dateTimeString)
    {
        // If it's in format YYYY-MM-DDTHH:mm (datetime-local input), convert to YYYY-MM-DD HH:mm:ss
        if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $dateTimeString)) {
            // Simply replace T with space and add :00 for seconds
            // Save exactly as user entered, no timezone conversion
            return str_replace('T', ' ', $dateTimeString) . ':00';
        }
        return $dateTimeString;
    }

    public function update(Request $request, $id)
    {
        $event = Event::findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'sometimes|required|string',
            'type' => 'sometimes|required|string|in:curs,workshop,examen,webinar,eveniment',
            'start_date' => 'sometimes|required|date',
            'end_date' => 'sometimes|required|date|after_or_equal:start_date',
            'location' => 'nullable|string|max:255',
        ]);

        // Treat datetime-local input as local time (no timezone conversion)
        if (isset($validated['start_date'])) {
            $validated['start_date'] = $this->parseLocalDateTime($validated['start_date']);
        }
        if (isset($validated['end_date'])) {
            $validated['end_date'] = $this->parseLocalDateTime($validated['end_date']);
        }

        $event->update($validated);
        $event->refresh();

        // Return raw datetime values without timezone conversion
        $event->start_date = $event->getRawOriginal('start_date') ?? $event->start_date;
        $event->end_date = $event->getRawOriginal('end_date') ?? $event->end_date;

        return response()->json([
            'message' => 'Eveniment actualizat cu succes',
            'event' => $event,
        ]);
    }

    public function destroy($id)
    {
        $event = Event::findOrFail($id);
        $event->delete();

        return response()->json([
            'message' => 'Eveniment șters cu succes',
        ]);
    }
}

