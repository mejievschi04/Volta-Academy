const deadlineDateFormat = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });

export function courseDeadlineInputValue(value) {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
}

export function courseDeadlineLabel(course, { completed = false, now = Date.now() } = {}) {
	if (!course?.deadline_at) return '';
	const deadline = new Date(course.deadline_at);
	if (Number.isNaN(deadline.getTime())) return '';
	const isComplete = completed || Boolean(course.completed_at) || course.status === 'completed';
	const label = !isComplete && deadline.getTime() < now ? 'Termen depășit' : 'Termen-limită';
	return `${label} · ${deadlineDateFormat.format(deadline)}`;
}
