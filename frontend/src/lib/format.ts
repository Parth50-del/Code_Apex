import type { CommitItem, Contributor, RiskEntry } from '../types';

const dateTimeFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

const shortDateFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
});

export const RISK_HIGH_THRESHOLD = 80;
export const RISK_MEDIUM_THRESHOLD = 55;

/** The label the backend assigns to a score (kept in one place for the UI). */
export function riskLabelForScore(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= RISK_HIGH_THRESHOLD) return 'High';
  if (score >= RISK_MEDIUM_THRESHOLD) return 'Medium';
  return 'Low';
}

export function dateTime(value?: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : dateTimeFormatter.format(date);
}

export function dateOnly(value?: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : dateFormatter.format(date);
}

/** Compact label used on dense chart axes. */
export function shortDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : shortDateFormatter.format(date);
}

/** The first line of a commit message, trimmed. Handles multiline messages. */
export function commitSubject(message?: string | null): string {
  const subject = (message ?? '').split('\n')[0]?.trim();
  return subject || 'Untitled commit';
}

/** Everything after the subject line, trimmed. */
export function commitBody(message?: string | null): string {
  const lines = (message ?? '').split('\n');
  return lines.slice(1).join('\n').trim();
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en').format(value);
}

export function relativeTime(value?: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const units: Array<[number, string]> = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.345, 'week'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ];
  let amount = abs;
  let unit = 'second';
  for (const [size, name] of units) {
    if (amount < size) {
      unit = name;
      break;
    }
    amount = Math.round(amount / size);
    unit = name;
  }
  const suffix = seconds < 0 ? ' ago' : ' from now';
  return `${amount} ${unit}${amount === 1 ? '' : 's'}${suffix}`;
}

export function churnFor(entry: Pick<RiskEntry, 'additions' | 'deletions'>): number | null {
  if (entry.additions === undefined || entry.deletions === undefined) return null;
  return entry.additions + entry.deletions;
}

/**
 * GitHub reports app accounts as "Bot" and bot logins end with "[bot]". The
 * server sets `isBot` from that data; the login check is only a fallback for
 * older payloads.
 */
export function isBot(contributor: Contributor): boolean {
  if (typeof contributor.isBot === 'boolean') return contributor.isBot;
  const login = (contributor.login || '').toLowerCase();
  return login.endsWith('[bot]') || login === 'github-actions';
}

/** Commit-level variant used by the Time Machine bot filter. */
export function isBotCommit(commit: Pick<CommitItem, 'author' | 'authorLogin' | 'authorType'>): boolean {
  if (commit.authorType === 'Bot') return true;
  const login = (commit.authorLogin || '').toLowerCase();
  const name = (commit.author || '').toLowerCase();
  return login.endsWith('[bot]') || name.endsWith('[bot]') || login === 'github-actions';
}

export function commitsWithDetails(commits: CommitItem[]): CommitItem[] {
  return commits.filter((commit) => commit.detailStatus === 'available');
}

function dayKey(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

/** Monday-based week key, so weekly buckets line up with work weeks. */
function weekKey(value: string): string {
  const date = new Date(value);
  const diff = (date.getUTCDay() + 6) % 7;
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff);
  return new Date(start).toISOString().slice(0, 10);
}

export type ActivityPoint = { key: string; label: string; count: number };

/**
 * Commit activity grouped by day, or by week once a day-level chart would have
 * too many bars to read. Only commits with parseable dates are counted.
 */
export function commitActivitySeries(commits: CommitItem[]): {
  granularity: 'day' | 'week';
  points: ActivityPoint[];
} {
  const dated = commits.filter((commit) => !Number.isNaN(new Date(commit.date).getTime()));
  const distinctDays = new Set(dated.map((commit) => dayKey(commit.date)));
  const granularity: 'day' | 'week' = distinctDays.size > 42 ? 'week' : 'day';
  const buckets = new Map<string, number>();
  for (const commit of dated) {
    const key = granularity === 'day' ? dayKey(commit.date) : weekKey(commit.date);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return {
    granularity,
    points: [...buckets.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, count]) => ({ key, label: shortDate(key), count })),
  };
}

export type AddDelPoint = {
  key: string;
  label: string;
  additions: number;
  deletions: number;
  date?: string | null;
};

/** Additions/deletions per commit, only for commits with fetched stats. */
export function additionsDeletionsByCommit(commits: CommitItem[]): AddDelPoint[] {
  return commits
    .filter((commit) => commit.stats && typeof commit.stats.additions === 'number')
    .map((commit) => ({
      key: commit.sha,
      label: commit.sha.slice(0, 7),
      additions: commit.stats?.additions ?? 0,
      deletions: commit.stats?.deletions ?? 0,
      date: commit.date,
    }));
}
