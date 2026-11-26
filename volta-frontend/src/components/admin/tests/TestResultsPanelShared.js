import { formatPercent } from '../../../utils/formatPercent';

export function statisticsTeamParams(teamKey) {
	if (teamKey === 'none') return { unassigned: 1 };
	if (teamKey) return { team_id: teamKey };
	return {};
}

export function formatResultDate(iso) {
	if (!iso) return '—';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return String(iso);
	return date.toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function resultAttemptOpen(row, now = Date.now()) {
	if (row?.status !== 'in_progress') return false;
	if (!row?.expires_at) return true;
	const expires = new Date(row.expires_at);
	if (Number.isNaN(expires.getTime())) return true;
	return expires.getTime() > now;
}

export function resultStatusLabel(row) {
	if (resultAttemptOpen(row)) return 'În progres';
	if (row?.needs_manual_review || row?.status === 'pending' || row?.status === 'pending_review') {
		return 'În așteptare';
	}
	return row?.passed ? 'Promovat' : 'Nepromovat';
}

export function resultPercentLabel(row) {
	if (resultAttemptOpen(row)) return 'În progres';
	return formatPercent(row?.percentage);
}

export function rowMatchesResultFilters(row, { statusFilter = 'all', dateFrom = '', dateTo = '' } = {}) {
	if (statusFilter === 'passed' && !row?.passed) return false;
	if (statusFilter === 'failed' && (row?.passed || resultAttemptOpen(row) || row?.needs_manual_review || row?.status === 'pending_review')) return false;
	if (statusFilter === 'pending' && !(row?.needs_manual_review || row?.status === 'pending' || row?.status === 'pending_review')) {
		return false;
	}
	if (dateFrom || dateTo) {
		if (!row?.completed_at) return false;
		const completed = new Date(row.completed_at);
		if (dateFrom) {
			const from = new Date(`${dateFrom}T00:00:00`);
			if (completed < from) return false;
		}
		if (dateTo) {
			const to = new Date(`${dateTo}T23:59:59`);
			if (completed > to) return false;
		}
	}
	return true;
}
