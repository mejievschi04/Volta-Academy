import { useCallback, useMemo, useState } from 'react';
import { thumbUrlFor } from '../utils/coverThumb';

/**
 * Coperta pentru liste și carduri: încearcă miniatura, apoi originalul.
 * `failed` = nicio variantă nu s-a încărcat (cardul își arată imaginea implicită).
 */
export function useCoverImage(url) {
	const candidates = useMemo(() => {
		if (!url) return [];
		const thumb = thumbUrlFor(url);
		return thumb ? [thumb, url] : [url];
	}, [url]);
	// erorile țin de URL-ul pentru care au apărut: la o copertă nouă se pornește iar de la miniatură
	const [errors, setErrors] = useState({ url, count: 0 });
	const index = errors.url === url ? errors.count : 0;

	const onError = useCallback(() => {
		setErrors((current) => ({ url, count: (current.url === url ? current.count : 0) + 1 }));
	}, [url]);

	return {
		src: candidates[index] ?? null,
		onError,
		failed: candidates.length > 0 && index >= candidates.length,
	};
}
