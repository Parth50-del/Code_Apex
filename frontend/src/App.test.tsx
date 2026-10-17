import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { makeRepo } from './test/fixtures';

/** Minimal fetch Response stand-in so the tests do not depend on jsdom fetch. */
function fakeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

describe('App', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the demo dataset and renders the Overview workspace', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(makeRepo())));
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getAllByText('demo/sample').length).toBeGreaterThan(0);
    expect(screen.getByText('Commits retrieved')).toBeInTheDocument();
  });

  it('keeps Story Mode Next/Back/Restart inside the story instead of navigating away', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(makeRepo())));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Story Mode' }));
    expect(await screen.findByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Story Mode' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(await screen.findByRole('heading', { name: 'Historical activity' })).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
    // Regression: advancing the story must not trigger page navigation.
    expect(screen.getByRole('button', { name: 'Story Mode' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(await screen.findByText('Step 1 of 5')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /restart/i }));
    expect(await screen.findByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('keeps the current dataset when an analysis fails and offers recovery actions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/demo')) return fakeResponse(makeRepo());
        if (url.includes('/api/analyze')) {
          return fakeResponse(
            {
              code: 'not_found',
              error: 'Repository not found. It may be private, renamed, or the URL may be incorrect.',
            },
            404,
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('GitHub repository URL'), 'github.com/nope/nope');
    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Repository not found. It may be private, renamed');
    // The previous (demo) dataset is still what the user sees.
    expect(screen.getAllByText('demo/sample').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    // Recovery actions are offered instead of a dead end.
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use demo data' })).toBeInTheDocument();
  });

  it('explains a rate limit and keeps the retry available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/demo')) return fakeResponse(makeRepo());
        if (url.includes('/api/analyze')) {
          return fakeResponse(
            {
              code: 'rate_limit',
              error: 'GitHub API rate limit reached for unauthenticated requests.',
              retryAt: new Date(Date.now() + 10 * 60_000).toISOString(),
            },
            429,
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('GitHub repository URL'), 'github.com/a/b');
    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('GitHub API rate limit reached');
    await waitFor(() => {
      expect(alert).toHaveTextContent(/limit is expected to reset/);
    });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
