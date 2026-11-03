function clampByte(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return 0;
	return Math.min(255, Math.max(0, Math.round(n)));
}

function byteToHex(value) {
	return clampByte(value).toString(16).padStart(2, '0');
}

function normalizeHexInput(raw) {
	const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(raw || '').trim());
	if (!match) return null;
	let hex = match[1];
	if (hex.length === 3) {
		hex = hex.split('').map((c) => c + c).join('');
	}
	return `#${hex.toLowerCase()}`;
}

function normalizeRgbInput(raw) {
	const match = /^rgba?\(\s*([+-]?\d{1,3})\s*,\s*([+-]?\d{1,3})\s*,\s*([+-]?\d{1,3})(?:\s*,\s*(?:\d*\.?\d+))?\s*\)$/i.exec(String(raw || '').trim());
	if (!match) return null;
	return `#${byteToHex(match[1])}${byteToHex(match[2])}${byteToHex(match[3])}`;
}

export function normalizeColorInputToHex(value, fallback = '#6366f1') {
	const normalized = normalizeHexInput(value) || normalizeRgbInput(value);
	if (normalized) return normalized;
	if (fallback == null) return null;
	return normalizeHexInput(fallback) || '#6366f1';
}


function relativeLuminance(hex) {
	const channel = (i) => {
		const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** Raportul de contrast WCAG dintre două culori (1–21). */
export function contrastRatio(a, b) {
	const ha = normalizeColorInputToHex(a, null);
	const hb = normalizeColorInputToHex(b, null);
	if (!ha || !hb) return 1;
	const la = relativeLuminance(ha);
	const lb = relativeLuminance(hb);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Text lizibil pe un fundal colorat: alb dacă are contrast suficient, altfel culoarea închisă.
 * `minRatio` 3 pentru titluri mari (WCAG, text mare), 4.5 pentru text obișnuit.
 * Ex.: titlul mapei „Produse” era alb pe mov deschis (contrast 1.46).
 */
export function readableTextOn(background, { dark = '#111827', light = '#f8fafc', minRatio = 4.5 } = {}) {
	if (!normalizeColorInputToHex(background, null)) return light;
	const onLight = contrastRatio(background, light);
	if (onLight >= minRatio) return light;
	return contrastRatio(background, dark) > onLight ? dark : light;
}
