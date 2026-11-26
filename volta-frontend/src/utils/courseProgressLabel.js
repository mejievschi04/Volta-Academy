/**
 * Textul progresului unui curs: „Finalizat” la 100%, altfel procentul rotunjit (ex. „67%”).
 */
export function courseProgressLabel(value) {
	const pct = Math.round(Math.min(100, Math.max(0, Number(value) || 0)));
	return pct >= 100 ? 'Finalizat' : `${pct}%`;
}

export function courseDeadlineStillOpen(course, now = Date.now()) {
	if (!course?.deadline_at) return true;
	const deadline = new Date(course.deadline_at);
	if (Number.isNaN(deadline.getTime())) return true;
	return deadline.getTime() >= now;
}

/** Cursul e început, testul nu e promovat și termenul e deschis: în loc de „0%” scrie „În progres”. */
export function courseProgressText(course, { status, progress, now = Date.now() } = {}) {
	const pct = Math.round(Math.min(100, Math.max(0, Number(progress) || 0)));
	if (pct >= 100 || status === 'completed') return 'Finalizat';
	const testStillOpen = !Array.isArray(course?.tests)
		|| course.tests.length === 0
		|| course.tests.some((test) => test?.status === 'in_progress' || test?.status === 'not_started');
	if (pct === 0 && status === 'in_progress' && testStillOpen && courseDeadlineStillOpen(course, now)) {
		return 'În progres';
	}
	return `${pct}%`;
}

export default courseProgressLabel;
