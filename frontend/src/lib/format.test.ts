import { describe, expect, it } from 'vitest';
import {
  additionsDeletionsByCommit,
  commitActivitySeries,
  commitBody,
  commitSubject,
  isBot,
  riskLabelForScore,
} from './format';
import type { CommitItem, Contributor } from '../types';

function commit(overrides: Partial<CommitItem> = {}): CommitItem {
  return {
    sha: 'a'.repeat(40),
    message: 'Subject line',
    author: 'Ava Chen',
    date: '2025-09-30T09:15:00Z',
    html_url: null,
    ...overrides,
  };
}

const daysAgo = (days: number) =>
  new Date(Date.UTC(2025, 8, 30) - days * 86_400_000).toISOString();

describe('commitSubject / commitBody', () => {
  it('takes only the first line of a multiline commit message', () => {
    expect(commitSubject('Fix the build\n\nMore detail in the body')).toBe('Fix the build');
    expect(commitSubject('Single line')).toBe('Single line');
  });

  it('falls back when the message has no usable subject', () => {
    expect(commitSubject('')).toBe('Untitled commit');
    expect(commitSubject(null)).toBe('Untitled commit');
    expect(commitSubject('\n\nOnly a body')).toBe('Untitled commit');
  });

  it('keeps the body separate from the subject', () => {
    expect(commitBody('Fix the build\n\nExplanation text')).toBe('Explanation text');
    expect(commitBody('Single line')).toBe('');
  });
});

describe('commitActivitySeries', () => {
  it('groups by day while the window is small enough to read', () => {
    const series = commitActivitySeries([
      commit({ date: daysAgo(0) }),
      commit({ date: daysAgo(0) }),
      commit({ date: daysAgo(1) }),
    ]);
    expect(series.granularity).toBe('day');
    expect(series.points).toEqual([
      { key: '2025-09-29', label: 'Sep 29', count: 1 },
      { key: '2025-09-30', label: 'Sep 30', count: 2 },
    ]);
  });

  it('switches to weekly buckets when a day-level chart would be unreadable', () => {
    const commits = Array.from({ length: 50 }, (_, index) => commit({ date: daysAgo(index) }));
    const series = commitActivitySeries(commits);
    expect(series.granularity).toBe('week');
    expect(series.points.reduce((sum, point) => sum + point.count, 0)).toBe(50);
    expect(series.points.length).toBeLessThan(50);
  });

  it('ignores commits with unparseable dates', () => {
    const series = commitActivitySeries([commit({ date: 'not-a-date' }), commit({ date: daysAgo(0) })]);
    expect(series.points.reduce((sum, point) => sum + point.count, 0)).toBe(1);
  });
});

describe('additionsDeletionsByCommit', () => {
  it('only includes commits whose stats were actually fetched', () => {
    const points = additionsDeletionsByCommit([
      commit({ sha: 'has-stats', stats: { additions: 7, deletions: 2 } }),
      commit({ sha: 'no-stats', stats: null }),
      commit({ sha: 'undefined-stats' }),
    ]);
    // The series carries each commit's date so charts can aggregate honestly by week.
    expect(points).toEqual([
      { key: 'has-stats', label: 'has-sta', additions: 7, deletions: 2, date: '2025-09-30T09:15:00Z' },
    ]);
  });
});

describe('isBot', () => {
  const contributor = (overrides: Partial<Contributor> = {}): Contributor => ({
    login: 'ava',
    name: 'Ava Chen',
    commit_count: 1,
    recent_activity: null,
    files: [],
    ...overrides,
  });

  it('trusts the flag reported by the backend', () => {
    expect(isBot(contributor({ isBot: true }))).toBe(true);
    expect(isBot(contributor({ login: 'dependabot[bot]', isBot: false }))).toBe(false);
  });

  it('falls back to the GitHub bot login convention instead of substring matching', () => {
    expect(isBot(contributor({ login: 'dependabot[bot]' }))).toBe(true);
    expect(isBot(contributor({ login: 'github-actions' }))).toBe(true);
    expect(isBot(contributor({ login: 'abbot' }))).toBe(false);
    expect(isBot(contributor({ login: 'robotica' }))).toBe(false);
  });
});

describe('riskLabelForScore', () => {
  it('maps scores to the same labels as the backend', () => {
    expect(riskLabelForScore(80)).toBe('High');
    expect(riskLabelForScore(100)).toBe('High');
    expect(riskLabelForScore(79)).toBe('Medium');
    expect(riskLabelForScore(55)).toBe('Medium');
    expect(riskLabelForScore(54)).toBe('Low');
    expect(riskLabelForScore(0)).toBe('Low');
  });
});
