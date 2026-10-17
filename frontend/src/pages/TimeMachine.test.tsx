import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TimeMachinePage } from './TimeMachine';
import { makeRepo } from '../test/fixtures';
import type { RepoResponse } from '../types';

const commits = [
  {
    sha: 'aaa1111',
    message: 'Add scoring service',
    author: 'Ava Chen',
    date: '2025-09-30T09:15:00Z',
    html_url: null,
    detailStatus: 'available' as const,
    stats: { additions: 5, deletions: 3, total: 8 },
    files: [{ path: 'src/risk.ts', additions: 5, deletions: 3, status: 'modified', changes: 8 }],
  },
  {
    sha: 'bbb2222',
    message: 'Refactor timeline',
    author: 'Liam Patel',
    date: '2025-09-29T09:15:00Z',
    html_url: null,
    detailStatus: 'not-fetched' as const,
    stats: null,
    files: null,
  },
];

function renderTimeMachine(
  overrides: Partial<RepoResponse> = {},
  props: Partial<Parameters<typeof TimeMachinePage>[0]> = {},
) {
  const onSelectCommit = vi.fn();
  const onRetryDetail = vi.fn();
  render(
    <TimeMachinePage
      data={makeRepo({ commits, ...overrides })}
      selectedSha="bbb2222"
      onSelectCommit={onSelectCommit}
      detailLoading={null}
      detailError={null}
      onRetryDetail={onRetryDetail}
      {...props}
    />,
  );
  return { onSelectCommit, onRetryDetail };
}

describe('TimeMachinePage', () => {
  it('reports unavailable statistics instead of showing fabricated zeros', () => {
    renderTimeMachine();
    expect(
      screen.getByText('Line statistics are unavailable for this commit.'),
    ).toBeInTheDocument();
    // The selected commit has no stats, so no additions/deletions block is rendered.
    expect(screen.queryByText(/additions/)).not.toBeInTheDocument();
    // The row itself is labelled as pending rather than as zero files.
    expect(screen.getByText('Details pending')).toBeInTheDocument();
  });

  it('offers to load details for commits whose details were not fetched', async () => {
    const user = userEvent.setup();
    const { onRetryDetail } = renderTimeMachine({ source: 'live' });
    expect(
      screen.getByText('Detailed file changes have not been loaded for this commit.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /load details/i }));
    expect(onRetryDetail).toHaveBeenCalledTimes(1);
  });

  it('shows a scoped error with a retry for the selected commit only', () => {
    renderTimeMachine(
      { source: 'live' },
      { detailError: { sha: 'bbb2222', message: 'GitHub returned an unexpected response.' } },
    );
    expect(screen.getByText('GitHub returned an unexpected response.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

    // An error that belongs to another commit must not be shown.
    renderTimeMachine(
      { source: 'live' },
      { detailError: { sha: 'ccc3333', message: 'Stale failure from another commit.' } },
    );
    expect(screen.queryByText('Stale failure from another commit.')).not.toBeInTheDocument();
  });

  it('moves the inspected commit with arrow keys instead of requiring one tab stop per row', async () => {
    const user = userEvent.setup();
    const { onSelectCommit } = renderTimeMachine({}, { selectedSha: 'aaa1111' });
    await user.click(screen.getByRole('button', { name: /Add scoring service/ }));
    onSelectCommit.mockClear();

    await user.keyboard('{ArrowDown}');
    expect(onSelectCommit).toHaveBeenCalledWith('bbb2222');

    onSelectCommit.mockClear();
    await user.keyboard('{Home}');
    expect(onSelectCommit).toHaveBeenCalledWith('aaa1111');
  });

  it('filters the commit list by message search', async () => {
    const user = userEvent.setup();
    renderTimeMachine();
    await user.type(screen.getByLabelText('Search commits by message'), 'timeline');
    expect(screen.getByText('1 of 2 commits')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refactor timeline/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add scoring service/ })).not.toBeInTheDocument();
  });
});
