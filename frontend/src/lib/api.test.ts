import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeRepository, ApiError, fetchDemo, isAbortError } from './api';

/** Minimal fetch Response stand-in so the tests do not depend on jsdom fetch. */
function fakeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('API error mapping', () => {
  it('maps the backend not_found code with the server message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        fakeResponse({ code: 'not_found', error: 'Repository not found. It may be private.' }, 404),
      ),
    );
    await expect(fetchDemo()).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'not_found',
      status: 404,
      message: 'Repository not found. It may be private.',
    });
  });

  it('keeps the rate-limit reset time for the UI hint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        fakeResponse(
          { code: 'rate_limit', error: 'GitHub API rate limit reached.', retryAt: '2026-01-01T00:00:00.000Z' },
          429,
        ),
      ),
    );
    let thrown: unknown;
    try {
      await fetchDemo();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).kind).toBe('rate_limit');
    expect((thrown as ApiError).retryAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('falls back to status mapping when the body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse('<html>Bad gateway</html>', 502)));
    await expect(analyzeRepository('https://github.com/a/b')).rejects.toMatchObject({
      kind: 'upstream',
      status: 502,
    });
  });

  it('reports a backend that cannot be reached as a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    await expect(fetchDemo()).rejects.toMatchObject({ kind: 'network', status: 0 });
  });

  it('lets abort errors propagate untouched so callers can ignore them', async () => {
    const abortError = Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw abortError;
      }),
    );
    await expect(fetchDemo()).rejects.toBe(abortError);
    expect(isAbortError(abortError)).toBe(true);
    expect(isAbortError(new ApiError('nope'))).toBe(false);
  });

  it('returns the parsed payload on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse({ source: 'demo' })));
    await expect(fetchDemo()).resolves.toEqual({ source: 'demo' });
  });
});
