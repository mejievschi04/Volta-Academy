import { useCallback, useMemo, useRef } from 'react';
import { telemetryService } from '../services/api';

function parsePositiveInt(value) {
	const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
	return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Telemetrie pentru încercări la test/examen (ActivityLog: telemetry.learner_*).
 */
export function useTestAttemptTelemetry({
	enabled = true,
	userId,
	entityId,
	courseId = null,
	testId = null,
	modelType = 'exam',
}) {
	const modelId = parsePositiveInt(entityId);
	const startedRef = useRef(false);
	const attemptSessionRef = useRef(null);

	const basePayload = useCallback(
		() => ({
			course_id: parsePositiveInt(courseId),
			test_id: parsePositiveInt(testId),
			exam_id: modelType === 'exam' ? modelId : null,
			attempt_session: attemptSessionRef.current,
		}),
		[courseId, testId, modelId, modelType]
	);

	const resetSession = useCallback(() => {
		startedRef.current = false;
		attemptSessionRef.current = null;
	}, []);

	const trackStarted = useCallback(
		async () => {
			if (!enabled || !userId || !modelId || startedRef.current) return;
			startedRef.current = true;
			attemptSessionRef.current = Date.now();
		},
		[enabled, userId, modelId]
	);

	const trackSubmitted = useCallback(
		async (result = {}) => {
			if (!enabled || !userId || !modelId) return;
			await telemetryService.track(
				'learner_attempt_submitted',
				{
					...basePayload(),
					passed: Boolean(result.passed),
					percentage: result.percentage ?? result.percent ?? null,
					score: result.score ?? null,
					max_score: result.max_score ?? result.total_points ?? null,
					attempt_number: result.attempt_number ?? null,
				},
				modelType,
				modelId
			);
		},
		[enabled, userId, modelId, basePayload, modelType]
	);

	return useMemo(
		() => ({
			trackStarted,
			trackSubmitted,
			resetSession,
		}),
		[trackStarted, trackSubmitted, resetSession]
	);
}
