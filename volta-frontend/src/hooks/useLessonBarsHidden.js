import { useEffect, useState } from 'react';
import { LESSON_BARS_DELTA_PX, nextLessonBarsHidden } from '../utils/lessonBars.js';

const PHONE_QUERY = '(max-width: 768px)';

/** Pe telefon, ascunde barele lecției cât timp elevul citește în jos, ca textul să aibă tot ecranul. */
export function useLessonBarsHidden(contentRef, lessonId, enabled) {
	const [hiddenFor, setHiddenFor] = useState(null);

	useEffect(() => {
		if (!enabled || !window.matchMedia(PHONE_QUERY).matches) return undefined;
		const root = contentRef.current?.closest('.va-shell-main');
		if (!root) return undefined;

		let hidden = false;
		let previousTop = root.scrollTop;
		const onScroll = () => {
			const top = root.scrollTop;
			const remaining = root.scrollHeight - top - root.clientHeight;
			const next = nextLessonBarsHidden(hidden, { top, previousTop, remaining });
			if (Math.abs(top - previousTop) > LESSON_BARS_DELTA_PX) previousTop = top;
			if (next !== hidden) {
				hidden = next;
				setHiddenFor(next ? lessonId : null);
			}
		};
		root.addEventListener('scroll', onScroll, { passive: true });
		return () => root.removeEventListener('scroll', onScroll);
	}, [contentRef, lessonId, enabled]);

	return hiddenFor !== null && hiddenFor === lessonId;
}

export default useLessonBarsHidden;
