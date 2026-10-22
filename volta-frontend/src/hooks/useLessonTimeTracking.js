import { useEffect, useRef } from 'react';
import { courseProgressService } from '../services/api';
import { clearApiCache } from '../api';
import { logger } from '../utils/logger';

const FLUSH_INTERVAL_MS = 60000;
const MAX_DELTA_SEC = 120;

/**
 * Trimite periodic (o cerere pe minut, plus la ieșire) timpul petrecut pe lecție. Serverul îl adaugă
 * la `lesson_progress.time_spent_seconds` și îl înregistrează ca `learner_focus_seconds` pentru statistici.
 */
export function useLessonTimeTracking(lessonId, { userId, isCompleted, enabled = true }) {
	const lessonTickLastRef = useRef(null);

	useEffect(() => {
		if (!enabled || !userId || lessonId == null || lessonId === '' || isCompleted) {
			lessonTickLastRef.current = null;
			return undefined;
		}

		const lid = typeof lessonId === 'number' ? lessonId : parseInt(String(lessonId), 10);
		if (!Number.isFinite(lid) || lid < 1) {
			return undefined;
		}

		lessonTickLastRef.current = Date.now();

		const flushSeconds = async () => {
			const now = Date.now();
			const last = lessonTickLastRef.current ?? now;
			lessonTickLastRef.current = now;
			const delta = Math.min(MAX_DELTA_SEC, Math.max(0, Math.round((now - last) / 1000)));
			if (delta < 1) return;
			try {
				// fără golirea cache-ului de citire: e o scriere de fundal, nu o modificare făcută de utilizator
				const result = await courseProgressService.updateLessonProgress(lid, {
					add_time_spent_seconds: delta,
				}, { keepCache: true });
				// lecția s-a finalizat automat: progresul afișat din cache nu mai e valabil
				if (result?.auto_completed) clearApiCache();
			} catch (err) {
				logger.debug('lesson time sync', err?.message || err);
			}
		};

		const intervalId = setInterval(flushSeconds, FLUSH_INTERVAL_MS);
		const onVisibility = () => {
			if (document.visibilityState === 'hidden') flushSeconds();
		};
		const onPageHide = () => {
			flushSeconds();
		};
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('pagehide', onPageHide);

		return () => {
			clearInterval(intervalId);
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('pagehide', onPageHide);
			flushSeconds();
		};
	}, [enabled, userId, lessonId, isCompleted]);
}
