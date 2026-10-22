import test from 'node:test';
import assert from 'node:assert/strict';
import { withResponseCache, clearApiCache } from '../src/utils/apiResponseCache.js';

function fakeAdapter() {
	const calls = [];
	const adapter = (config) => {
		calls.push(`${config.method} ${config.url}`);
		return Promise.resolve({ data: JSON.stringify({ n: calls.length }), status: 200, statusText: 'OK', headers: {} });
	};
	return { adapter, calls };
}

test('identical list requests are served once and parallel ones are merged', async () => {
	clearApiCache();
	const { adapter, calls } = fakeAdapter();
	const cached = withResponseCache(adapter);
	const config = { method: 'get', url: '/admin/teams' };

	const [a, b] = await Promise.all([cached(config), cached(config)]);
	const c = await cached(config);

	assert.deepEqual(calls, ['get /admin/teams']);
	assert.equal(a.data, b.data);
	assert.equal(c.data, a.data);
	assert.notEqual(a, c);
});

test('a write clears the cache so the next read is fresh', async () => {
	clearApiCache();
	const { adapter, calls } = fakeAdapter();
	const cached = withResponseCache(adapter);

	await cached({ method: 'get', url: '/admin/users', params: { all: true } });
	await cached({ method: 'put', url: '/admin/users/5' });
	await cached({ method: 'get', url: '/admin/users', params: { all: true } });

	assert.deepEqual(calls, ['get /admin/users', 'put /admin/users/5', 'get /admin/users']);
});

test('editors, exams, counters and opted-out requests always hit the server', async () => {
	clearApiCache();
	const { adapter, calls } = fakeAdapter();
	const cached = withResponseCache(adapter);
	const uncached = [
		{ method: 'get', url: '/admin/courses/3/builder/structure' },
		{ method: 'get', url: '/admin/lessons/9' },
		{ method: 'get', url: '/exams/4' },
		{ method: 'get', url: '/badges' },
		{ method: 'get', url: '/courses/7' },
		{ method: 'get', url: '/admin/teams', cache: false },
	];

	for (const config of [...uncached, ...uncached]) await cached(config);

	assert.equal(calls.length, uncached.length * 2);
});

test('different params are cached separately', async () => {
	clearApiCache();
	const { adapter, calls } = fakeAdapter();
	const cached = withResponseCache(adapter);

	await cached({ method: 'get', url: '/admin/users', params: { trashed: 1 } });
	await cached({ method: 'get', url: '/admin/users', params: { all: true } });

	assert.equal(calls.length, 2);
});

test('background writes marked keepCache leave the cache intact', async () => {
	clearApiCache();
	const { adapter, calls } = fakeAdapter();
	const cached = withResponseCache(adapter);

	await cached({ method: 'get', url: '/courses' });
	await cached({ method: 'put', url: '/lessons/4/progress', keepCache: true });
	await cached({ method: 'get', url: '/courses' });

	assert.deepEqual(calls, ['get /courses', 'put /lessons/4/progress']);
});
