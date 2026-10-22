import test from 'node:test';
import assert from 'node:assert/strict';
import { thumbUrlFor } from '../src/utils/coverThumb.js';

test('storage covers map to their thumbnail next to the original', () => {
	assert.equal(thumbUrlFor('/storage/courses/a.webp'), '/storage/courses/a.thumb.webp');
	assert.equal(thumbUrlFor('https://lms.test/storage/course-map-covers/3_17.jpg'), 'https://lms.test/storage/course-map-covers/3_17.thumb.webp');
	assert.equal(thumbUrlFor('/storage/library/covers/x.PNG?v=2'), '/storage/library/covers/x.thumb.webp?v=2');
});

test('external, inline, svg and existing thumbnail urls have no thumbnail', () => {
	assert.equal(thumbUrlFor('https://cdn.test/a.jpg'), null);
	assert.equal(thumbUrlFor('data:image/png;base64,AAAA'), null);
	assert.equal(thumbUrlFor('/storage/courses/a.svg'), null);
	assert.equal(thumbUrlFor('/storage/courses/a.thumb.webp'), null);
	assert.equal(thumbUrlFor(null), null);
});
