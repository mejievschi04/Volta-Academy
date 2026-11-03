/** Procent exact, cu cel mult 2 zecimale, în format românesc: 77.78 → „77,78%”, 70 → „70%”. */
export function formatPercent(value) {
	const number = Number(value);
	if (!Number.isFinite(number)) return '—';
	return `${number.toLocaleString('ro-RO', { maximumFractionDigits: 2 })}%`;
}
