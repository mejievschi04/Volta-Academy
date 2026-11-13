import test from 'node:test';
import assert from 'node:assert/strict';
// stripHtml citește textul printr-un element DOM; în node ajunge un element care păstrează textul
globalThis.document ??= { createElement: () => ({ set innerHTML(v) { this.textContent = String(v).replace(/<[^>]*>/g, ''); } }) };

const { getFriendlyLogLine, getGroupedLogLine, groupActivityLogs } = await import('../src/utils/activityLogLabels.js');

const user = { name: 'Ana' };

test('admin journal rows name the lesson and its course', () => {
	const line = getFriendlyLogLine({
		user,
		action: 'telemetry.learner_focus_seconds',
		description: 'Telemetry event: learner_focus_seconds',
		new_values: { seconds: 180, lesson_id: 4 },
		context: { lesson_title: 'Siguranța la lucru', course_title: 'Electrică 1' },
	});
	assert.equal(line, 'Ana a citit lecția „Siguranța la lucru” din cursul „Electrică 1” (3 minute).');
});

test('admin journal rows name the test with the score', () => {
	const line = getFriendlyLogLine({
		user,
		action: 'telemetry.learner_attempt_submitted',
		description: 'Telemetry event: learner_attempt_submitted',
		new_values: { percentage: 80 },
		context: { test_title: 'Test final' },
	});
	assert.match(line, /^Ana a trimis testul „Test final” — 80/);
});

test('grouped rows list which lessons were finished', () => {
	const day = '2026-11-13T10:00:00';
	const logs = ['A', 'B', 'C', 'D', 'E'].map((title, i) => ({
		id: i + 1,
		user_id: 1,
		user,
		action: 'completed_lesson',
		created_at: day,
		new_values: { lesson_title: title },
		context: { lesson_title: title },
	}));
	const [group] = groupActivityLogs(logs);
	assert.equal(getGroupedLogLine(group), 'Ana a finalizat 5 lecții: „A”, „B”, „C” și încă 2.');
});

test('rows without context keep their stored description (learner page)', () => {
	const line = getFriendlyLogLine({
		user: { name: 'Tu' },
		action: 'completed_lesson',
		description: 'Ana a finalizat lecția "X"',
		new_values: { lesson_title: 'X' },
	});
	assert.equal(line, 'Ana a finalizat lecția "X"');
});
