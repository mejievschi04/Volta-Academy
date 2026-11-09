import test from 'node:test';
import assert from 'node:assert/strict';
import { nextLessonBarsHidden } from '../src/utils/lessonBars.js';

const at = (top, previousTop, remaining = 1000) => ({ top, previousTop, remaining });

test('barele dispar la derulare în jos și revin la urcare', () => {
	assert.equal(nextLessonBarsHidden(false, at(300, 200)), true);
	assert.equal(nextLessonBarsHidden(true, at(200, 300)), false);
});

test('mișcările foarte mici nu schimbă starea', () => {
	assert.equal(nextLessonBarsHidden(true, at(302, 300)), true);
	assert.equal(nextLessonBarsHidden(false, at(298, 300)), false);
});

test('barele rămân vizibile sus și la finalul lecției', () => {
	assert.equal(nextLessonBarsHidden(true, at(20, 10)), false);
	assert.equal(nextLessonBarsHidden(true, at(900, 800, 10)), false);
});
