/**
 * Număr + substantiv acordat în română: „1 întrebare”, „5 întrebări”, „20 de întrebări”.
 * După 20 (și 101–119 etc. excluse) româna cere „de”: 20 de cursuri, 112 cursuri.
 */
export function countLabel(count, one, many) {
	const n = Math.abs(Number(count) || 0);
	if (n === 1) return `${count} ${one}`;
	const rest = n % 100;
	const needsDe = n >= 20 && (rest === 0 || rest >= 20);
	return `${Number(count) || 0} ${needsDe ? 'de ' : ''}${many}`;
}
