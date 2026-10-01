import { useEffect, useState } from 'react';
import { findLessonScrollRoot, lessonTabObstructionPx } from '../utils/lessonReadCompletion';

function visibleBottom(scrollRoot) {
	const edge = scrollRoot ? scrollRoot.getBoundingClientRect().bottom : window.innerHeight;
	const chrome = window.innerWidth <= 768 ? lessonTabObstructionPx() + 72 : 0;
	return edge - chrome;
}

function endIsVisible(root, scrollRoot) {
	const sentinel = root.querySelector('[data-lesson-read-end]');
	const limit = visibleBottom(scrollRoot);
	if (!sentinel) {
		return root.getBoundingClientRect().bottom <= limit + 8;
	}
	return sentinel.getBoundingClientRect().top <= limit + 12;
}

/**
 * Devine adevărat când finalul lecției intră în zona vizibilă.
 */
export function useLessonReachedEnd({ contentRef, lessonId, enabled = true }) {
	const [reachedEnd, setReachedEnd] = useState(false);

	useEffect(() => {
		setReachedEnd(false);
		if (!enabled || lessonId == null) return undefined;

		const root = contentRef.current;
		if (!root) return undefined;

		const scrollRoot = findLessonScrollRoot(root);
		const update = () => {
			setReachedEnd(endIsVisible(root, scrollRoot));
		};

		update();
		const target = scrollRoot || window;
		target.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update);

		const resizeObserver =
			typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
		resizeObserver?.observe(root);

		const lateCheck = window.setTimeout(update, 300);

		return () => {
			target.removeEventListener('scroll', update);
			window.removeEventListener('resize', update);
			resizeObserver?.disconnect();
			window.clearTimeout(lateCheck);
		};
	}, [contentRef, enabled, lessonId]);

	return reachedEnd;
}
