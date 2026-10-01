import { useEffect, useState } from 'react';
import { findLessonScrollRoot, lessonTabObstructionPx } from '../utils/lessonReadCompletion';

function fixedLessonBarOverlap() {
	const bar = document.querySelector('.lessons-page-lesson-actions, .lesson-page-actions');
	if (!bar) return 0;
	const style = window.getComputedStyle(bar);
	if (style.position !== 'fixed' && style.position !== 'sticky') return 0;
	const hidden = Math.round(window.innerHeight - bar.getBoundingClientRect().top);
	return hidden > 0 ? hidden : 0;
}

function visibleBottom(scrollRoot) {
	const edge = scrollRoot ? scrollRoot.getBoundingClientRect().bottom : window.innerHeight;
	const bar = fixedLessonBarOverlap();
	const chrome = bar > 0 ? bar : (window.innerWidth <= 768 ? lessonTabObstructionPx() + 72 : 0);
	return edge - chrome;
}

function scrolledToEnd(scrollRoot) {
	if (scrollRoot) {
		return scrollRoot.scrollHeight - scrollRoot.scrollTop - scrollRoot.clientHeight <= 32;
	}
	const doc = document.scrollingElement || document.documentElement;
	return doc.scrollHeight - window.scrollY - window.innerHeight <= 32;
}

function endIsVisible(root, scrollRoot) {
	if (scrolledToEnd(scrollRoot)) return true;
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
		if (target !== window) {
			window.addEventListener('scroll', update, { passive: true });
		}
		window.addEventListener('resize', update);

		const resizeObserver =
			typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
		resizeObserver?.observe(root);

		const lateCheck = window.setTimeout(update, 300);

		return () => {
			target.removeEventListener('scroll', update);
			if (target !== window) {
				window.removeEventListener('scroll', update);
			}
			window.removeEventListener('resize', update);
			resizeObserver?.disconnect();
			window.clearTimeout(lateCheck);
		};
	}, [contentRef, enabled, lessonId]);

	return reachedEnd;
}
