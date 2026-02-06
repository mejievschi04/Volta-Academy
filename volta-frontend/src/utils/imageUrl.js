/**
 * Returnează origin-ul unde se servesc fișierele storage (backend).
 * Ordine: VITE_STORAGE_URL > VITE_API_URL (absolut) > fallback localhost:8000 > window.origin
 */
function getStorageOrigin() {
	// 1. Explicit – cel mai sigur
	const storageUrl = import.meta.env.VITE_STORAGE_URL;
	if (storageUrl && (storageUrl.startsWith('http://') || storageUrl.startsWith('https://'))) {
		try {
			const u = new URL(storageUrl);
			return `${u.protocol}//${u.host}`;
		} catch {}
	}
	// 2. Din API URL
	const apiUrl = import.meta.env.VITE_API_URL;
	if (apiUrl && (apiUrl.startsWith('http://') || apiUrl.startsWith('https://'))) {
		try {
			const u = new URL(apiUrl);
			return `${u.protocol}//${u.host}`;
		} catch {}
	}
	// 3. SSR / build time
	if (typeof window === 'undefined') {
		return 'http://localhost:8000';
	}
	// 4. localhost pe port 80/443 → backend e pe 8000
	const origin = window.location.origin;
	try {
		const u = new URL(origin);
		if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && (!u.port || u.port === '80' || u.port === '443')) {
			return 'http://localhost:8000';
		}
	} catch {}
	return origin;
}

/**
 * Convertește un URL de imagine în URL care se încarcă din origin-ul curent.
 * @param {string|null|undefined} url - URL relativ, absolut, sau doar path
 * @returns {string|null} URL care funcționează
 */
export function toImageUrl(url) {
	if (!url || typeof url !== 'string') return null;
	const trimmed = url.trim();
	if (!trimmed) return null;

	const origin = getStorageOrigin();
	if (!origin) return trimmed;

	// URL absolut (http/https)
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		try {
			const u = new URL(trimmed);
			if (!u.pathname.startsWith('/storage/')) return trimmed;
			// Dacă backend-ul e pe alt host (ex. producție), păstrăm URL-ul – fișierul e acolo
			if (u.host !== new URL(origin).host) return trimmed;
			// Același host – folosim origin-ul nostru (proxy / acces direct)
			return `${origin}${u.pathname}`;
		} catch {
			return trimmed;
		}
	}

	// Relativ cu / - ex: /storage/courses/xxx.jpg
	if (trimmed.startsWith('/')) {
		return `${origin}${trimmed}`;
	}

	// Doar filename (fără /) – backend stochează în content-blocks/image/
	const path = trimmed.replace(/^\/+/, '');
	if (!path.includes('/')) {
		return `${origin}/storage/content-blocks/image/${path}`;
	}
	// Path cu / – ex: content-blocks/image/xxx.jpg
	return `${origin}/storage/${path}`;
}
