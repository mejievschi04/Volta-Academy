/**
 * URL-ul miniaturii unei coperte din storage: `/storage/courses/a.webp` → `/storage/courses/a.thumb.webp`.
 * Serverul o creează la salvarea copertei (640 px); pentru alte URL-uri (externe, blob, data) întoarce null.
 */
export function thumbUrlFor(url) {
	if (!url || typeof url !== 'string') return null;
	const match = url.match(/^(.*\/storage\/.+?)(\.thumb)?\.(webp|jpe?g|png)(\?.*)?$/i);
	if (!match || match[2]) return null;
	return `${match[1]}.thumb.webp${match[4] || ''}`;
}
