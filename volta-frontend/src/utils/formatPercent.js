/** Procent întreg pentru teste și examene: 77.78 → „78%”, 70 → „70%”. */
export function formatPercent(value) {
	if (value === null || value === undefined || value === '') return '—';
	const number = Number(value);
	if (!Number.isFinite(number)) return '—';
	return `${Math.round(number)}%`;
}
