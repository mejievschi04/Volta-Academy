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

function mediaHasSize(root) {
	const nodes = root.querySelectorAll('img, video, iframe[data-lesson-embed], iframe[data-lesson-media]');
	for (const node of nodes) {
		if (node.tagName === 'IMG') {
			if (!node.complete) return false;
			continue;
		}
		if (node.tagName === 'VIDEO' && node.readyState < 1 && node.clientHeight < 8) return false;
		if (node.tagName === 'IFRAME' && node.clientHeight < 8) return false;
	}
	return true;
}

function endIsVisible(root, scrollRoot) {
	if (!mediaHasSize(root)) return false;
	const sentinel = root.querySelector('[data-lesson-read-end]');
	const limit = visibleBottom(scrollRoot);
	if (sentinel) {
		return sentinel.getBoundingClientRect().top <= limit + 12;
	}
	if (scrolledToEnd(scrollRoot)) return true;
	return root.getBoundingClientRect().bottom <= limit + 8;
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
		root.addEventListener('load', update, true);
		root.addEventListener('loadedmetadata', update, true);
		if (target !== window) {
			window.addEventListener('scroll', update, { passive: true });
		}
		window.addEventListener('resize', update);

		const resizeObserver =
			typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
		resizeObserver?.observe(root);

		const lateCheck = window.setTimeout(update, 300);

		return () => {
			root.removeEventListener('load', update, true);
			root.removeEventListener('loadedmetadata', update, true);
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
