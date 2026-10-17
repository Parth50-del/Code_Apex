import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { analyzeRepo, analyzeErrorResponse } = await import('../src/server.js');

function stubFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    if (original === undefined) delete globalThis.fetch;
    else globalThis.fetch = original;
  };
}

const headers = (extra = {}) => ({ get: (name) => extra[name.toLowerCase()] ?? null });
const okResponse = (body) => ({ ok: true, status: 200, headers: headers(), json: async () => body });
const errResponse = (status, extraHeaders = {}) => ({
  ok: false,
  status,
  headers: headers(extraHeaders),
  json: async () => ({}),
});

describe('analyzeRepo branch routing (mocked GitHub)', () => {
  it('walks the default branch when none is requested', async () => {
    const seen = [];
    const restore = stubFetch(async (url) => {
      seen.push(url);
      if (url === 'https://api.github.com/repos/o/r') {
        return okResponse({ name: 'r', full_name: 'o/r', default_branch: 'main', html_url: 'https://github.com/o/r' });
      }
      if (url.startsWith('https://api.github.com/repos/o/r/commits?')) {
        return okResponse([{ sha: 'a'.repeat(40), commit: { message: 'm', author: { name: 'A', date: '2026-01-01T00:00:00Z' } } }]);
      }
      if (url.startsWith('https://api.github.com/repos/o/r/commits/')) {
        return okResponse({ sha: 'a'.repeat(40), stats: { total: 1, additions: 1, deletions: 0 }, files: [] });
      }
      throw new Error(`unexpected ${url}`);
    });
    try {
      const result = await analyzeRepo('o', 'r', 1, 100, '');
      assert.equal(result.source, 'live');
      assert.equal(result.repository.analyzed_branch, 'main');
      assert.ok(seen.some((u) => u.includes('/commits?') && !u.includes('sha=')), 'default walk must not pin sha');
    } finally {
      restore();
    }
  });

  it('pins the sha param and maps a branch miss to invalid_branch', async () => {
    let commitsUrl = '';
    const restore = stubFetch(async (url) => {
      if (url === 'https://api.github.com/repos/o/r') {
        return okResponse({ name: 'r', full_name: 'o/r', default_branch: 'main', html_url: 'https://github.com/o/r' });
      }
      if (url.startsWith('https://api.github.com/repos/o/r/commits?')) {
        commitsUrl = url;
        return errResponse(404);
      }
      throw new Error(`unexpected ${url}`);
    });
    try {
      await assert.rejects(() => analyzeRepo('o', 'r', 1, 100, 'ghost'), (error) => {
        assert.equal(error.branchNotFound, true);
        assert.equal(error.branch, 'ghost');
        const mapped = analyzeErrorResponse(error, 'Branch "ghost"');
        assert.equal(mapped.body.code, 'invalid_branch');
        return true;
      });
      assert.ok(commitsUrl.includes('sha=ghost'), `expected sha=ghost in ${commitsUrl}`);
    } finally {
      restore();
    }
  });

  it('keeps partial commit details with accurate coverage instead of failing', async () => {
    const restore = stubFetch(async (url) => {
      if (url === 'https://api.github.com/repos/o/r') {
        return okResponse({ name: 'r', full_name: 'o/r', default_branch: 'main', html_url: 'https://github.com/o/r' });
      }
      if (url.startsWith('https://api.github.com/repos/o/r/commits?')) {
        return okResponse([
          { sha: 'a'.repeat(40), commit: { message: 'one', author: { name: 'A', date: '2026-01-02T00:00:00Z' } } },
          { sha: 'b'.repeat(40), commit: { message: 'two', author: { name: 'B', date: '2026-01-01T00:00:00Z' } } },
        ]);
      }
      if (url.endsWith(`/commits/${'a'.repeat(40)}`)) return okResponse({ sha: 'a'.repeat(40), stats: { total: 2, additions: 2, deletions: 0 }, files: [] });
      return errResponse(500);
    });
    try {
      const result = await analyzeRepo('o', 'r', 1, 100, '');
      assert.equal(result.summary.detailCoverage, '1/2 commits');
      assert.equal(result.commits[0].detailStatus, 'available');
      assert.equal(result.commits[1].detailStatus, 'unavailable');
    } finally {
      restore();
    }
  });

  it('surfaces rate limits without hiding them as upstream errors', async () => {
    const restore = stubFetch(async () => errResponse(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60) }));
    try {
      await assert.rejects(() => analyzeRepo('o', 'r', 1, 100, ''), (error) => {
        const mapped = analyzeErrorResponse(error, 'Repository');
        assert.equal(mapped.status, 429);
        assert.equal(mapped.body.code, 'rate_limit');
        assert.ok(mapped.body.retryAt);
        return true;
      });
    } finally {
      restore();
    }
  });
});
