<?php

namespace App\Services;

use App\Support\SimpleXlsxWriter as X;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Tabelul de evidență a prezenței la evenimente pe un an: angajații pe echipe (rânduri) ×
 * evenimentele anului (coloane); celula e verde dacă adminul a marcat prezența.
 */
class EventAttendanceReportService
{
    public const NO_TEAM = 'Fără echipă';

    /**
     * @return array{
     *   year: int,
     *   events: list<array{id: int, title: string, date: string}>,
     *   groups: list<array{team: string, members: list<array{id: int, name: string, attended: list<int>}>}>
     * }
     */
    public function build(int $year): array
    {
        $events = DB::table('events')
            ->where('start_date', '>=', sprintf('%04d-01-01 00:00:00', $year))
            ->where('start_date', '<', sprintf('%04d-01-01 00:00:00', $year + 1))
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->orderBy('start_date')
            ->orderBy('id')
            ->get(['id', 'title', 'start_date']);
        $eventIds = $events->pluck('id')->all();

        /** @var Collection<int, list<int>> $attendedByUser */
        $attendedByUser = collect();
        if ($eventIds) {
            $attendedByUser = DB::table('event_user')
                ->whereIn('event_id', $eventIds)
                ->where('attended', true)
                ->get(['user_id', 'event_id'])
                ->groupBy('user_id')
                ->map(fn ($rows) => $rows->pluck('event_id')->map(fn ($id) => (int) $id)->all());
        }

        // Fiecare angajat apare o singură dată: la prima lui echipă (ordinea echipelor din admin).
        $memberships = DB::table('team_user')
            ->join('teams', 'teams.id', '=', 'team_user.team_id')
            ->orderBy('teams.sort_order')
            ->orderBy('teams.name')
            ->get(['team_user.user_id', 'teams.id as team_id', 'teams.name as team_name']);
        $teamOfUser = [];
        $teamOrder = [];
        foreach ($memberships as $m) {
            $teamOrder[$m->team_id] ??= $m->team_name;
            $teamOfUser[$m->user_id] ??= $m->team_id;
        }

        $users = DB::table('users')
            ->whereNull('deleted_at')
            ->where(fn ($q) => $q->whereNull('status')->orWhere('status', '!=', 'pending'))
            ->orderBy('name')
            ->get(['id', 'name']);

        $byTeam = [];
        $noTeam = [];
        foreach ($users as $user) {
            $member = [
                'id' => (int) $user->id,
                'name' => (string) $user->name,
                'attended' => $attendedByUser->get($user->id, []),
            ];
            if (isset($teamOfUser[$user->id])) {
                $byTeam[$teamOfUser[$user->id]][] = $member;
            } elseif ($member['attended']) {
                // fără echipă apar doar cei care au participat la ceva în anul ales
                $noTeam[] = $member;
            }
        }

        $groups = [];
        foreach ($teamOrder as $teamId => $teamName) {
            if (! empty($byTeam[$teamId])) {
                $groups[] = ['team' => (string) $teamName, 'members' => $byTeam[$teamId]];
            }
        }
        if ($noTeam) {
            $groups[] = ['team' => self::NO_TEAM, 'members' => $noTeam];
        }

        return [
            'year' => $year,
            'events' => $events->map(fn ($e) => [
                'id' => (int) $e->id,
                'title' => (string) $e->title,
                'date' => date('d.m.Y', strtotime((string) $e->start_date)),
            ])->all(),
            'groups' => $groups,
        ];
    }

    /** Scrie raportul ca .xlsx la $path. */
    public function writeXlsx(int $year, string $path): void
    {
        $data = $this->build($year);
        $events = $data['events'];
        $firstEventCol = 2;
        $totalCol = $firstEventCol + count($events);

        $x = new X("Prezență {$year}");
        $x->set(0, 0, 'Tabel de evidență a prezenței angajaților VOLTA la evenimente', X::STYLE_TITLE);
        $x->set(1, 0, "Anul {$year} · verde = a participat (prezență marcată în platformă)", X::STYLE_NOTE);

        $header = 2;
        $x->set($header, 0, 'Echipă', X::STYLE_HEADER)
            ->set($header, 1, 'Nume / Prenume', X::STYLE_HEADER)
            ->rowHeight($header, 54)
            ->columnWidth(0, 14)
            ->columnWidth(1, 26);
        foreach ($events as $i => $event) {
            $x->set($header, $firstEventCol + $i, $event['title']."\n(".$event['date'].')', X::STYLE_HEADER)
                ->columnWidth($firstEventCol + $i, 16);
        }
        $x->set($header, $totalCol, 'Total participări', X::STYLE_HEADER)->columnWidth($totalCol, 12);
        $x->freeze($header + 1, $firstEventCol);

        $perEvent = array_fill(0, count($events), 0);
        $row = $header + 2; // un rând liber după antet, ca în tabelul de evidență

        if (! $data['groups']) {
            $x->set($row, 0, 'Nu există angajați de afișat pentru acest an.', X::STYLE_NOTE);
        }

        foreach ($data['groups'] as $group) {
            $start = $row;
            foreach ($group['members'] as $member) {
                $attended = array_flip($member['attended']);
                $x->set($row, 0, '', X::STYLE_GROUP)->set($row, 1, $member['name'], X::STYLE_CELL);
                foreach ($events as $i => $event) {
                    $present = isset($attended[$event['id']]);
                    $x->set($row, $firstEventCol + $i, '', $present ? X::STYLE_MARKED : X::STYLE_CELL);
                    if ($present) {
                        $perEvent[$i]++;
                    }
                }
                $x->set($row, $totalCol, count(array_intersect_key($attended, array_flip(array_column($events, 'id')))), X::STYLE_CELL);
                $row++;
            }
            // numele echipei în celula unită din stânga, jos (ca „VOLTA 1” în foaie)
            $x->set($start, 0, $group['team'], X::STYLE_GROUP)->merge($start, 0, $row - 1, 0);
            $row++; // rând liber între echipe
        }

        if ($data['groups']) {
            $x->set($row, 0, '', X::STYLE_TOTAL)->set($row, 1, 'Prezenți la eveniment', X::STYLE_TOTAL)->merge($row, 0, $row, 1);
            foreach ($perEvent as $i => $count) {
                $x->set($row, $firstEventCol + $i, $count, X::STYLE_TOTAL);
            }
            $x->set($row, $totalCol, array_sum($perEvent), X::STYLE_TOTAL);
        }

        $x->save($path);
    }
}
