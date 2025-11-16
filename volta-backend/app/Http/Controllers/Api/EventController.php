<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use Illuminate\Http\Request;

class EventController extends Controller
{
    public function index()
    {
        // Get all events ordered by start date
        $events = Event::orderBy('start_date')->get();
        
        // Map to format expected by frontend (raw datetime values, no timezone conversion)
        $events = $events->map(function($event) {
            // Get raw datetime values from database (no conversion)
            $startDate = $event->getRawOriginal('start_date') ?? $event->start_date;
            $endDate = $event->getRawOriginal('end_date') ?? $event->end_date;
            
            return [
                'id' => $event->id,
                'title' => $event->title,
                'description' => $event->description,
                'type' => $event->type,
                'startDate' => $startDate ? (new \DateTime($startDate))->format('c') : null,
                'endDate' => $endDate ? (new \DateTime($endDate))->format('c') : null,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'location' => $event->location,
            ];
        });

        return response()->json($events);
    }
}

