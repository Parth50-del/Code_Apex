import { useState, type ReactNode } from 'react';
import type { CommitItem } from '../types';
import { commitSubject, dateTime, isBot, relativeTime } from '../lib/format';

/* ------------------------------------------------------- author identity */

function initialsFor(name: string): string {
  const parts = name.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || '?').toUpperCase();
}

/**
 * GitHub avatars resolve from the login directly and never count against the
 * API rate limit. When the login is synthetic (demo data) the image fails to
 * load and we fall back to initials.
 */
export function AuthorAvatar({
  name,
  login,
  size,
}: {
  name: string;
  login?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const src = login ? `https://github.com/${login}.png?size=64` : null;
  const showImage = Boolean(src) && !failed;
  const initials = initialsFor(name || login || '?');
  return (
    <span className={`avatar ${size ?? ''}`} aria-hidden="true">
      {showImage ? (
        <img src={src ?? undefined} alt="" loading="lazy" onError={() => setFailed(true)} referrerPolicy="no-referrer" />
      ) : (
        initials
      )}
    </span>
  );
}

export function Author({
  name,
  login,
  avatarSize,
  showBot,
  children,
}: {
  name: string;
  login?: string | null;
  avatarSize?: 'sm' | 'md' | 'lg';
  showBot?: boolean;
  children?: ReactNode;
}) {
  const bot = isBot({ login: login ?? '', name, commit_count: 0, recent_activity: null, files: [] });
  return (
    <span className="author">
      <AuthorAvatar name={name} login={login} size={avatarSize ?? 'sm'} />
      <span className="author-name">
        {name || login || 'Unknown author'}
        {showBot && bot && (
          <span className="bot-badge">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <rect x="4" y="8" width="16" height="12" rx="3" />
              <path d="M12 8V4M8 4h8" />
            </svg>
            Bot
          </span>
        )}
      </span>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------ commit row */

function detailChip(commit: CommitItem): { text: string; className: string } {
  const files = commit.files?.length ?? 0;
  if (commit.detailStatus === 'available' && commit.files) {
    return { text: `${files} file${files === 1 ? '' : 's'}`, className: 'ok' };
  }
  if (commit.detailStatus === 'unavailable') return { text: 'Details unavailable', className: 'warn' };
  return { text: 'Details pending', className: 'pending' };
}

/**
 * One commit row used by the overview feed and the Time Machine browser.
 * `sideTop` lets callers add context chips (file counts, stat chips).
 */
export function CommitRow({
  commit,
  selected,
  onClick,
  tabIndex,
  dataSha,
  sideTop,
  showTimeline,
  showDetailStatus,
}: {
  commit: CommitItem;
  selected?: boolean;
  onClick?: () => void;
  tabIndex?: number;
  dataSha?: string;
  sideTop?: ReactNode;
  showTimeline?: boolean;
  showDetailStatus?: boolean;
}) {
  const chip = detailChip(commit);
  return (
    <button
      type="button"
      className={`commit-row ${selected ? 'row-selected' : ''}`}
      onClick={onClick}
      tabIndex={tabIndex}
      data-sha={dataSha}
      aria-current={selected ? 'true' : undefined}
    >
      {showTimeline && <span className="timeline-mark" aria-hidden="true" />}
      <AuthorAvatar name={commit.author} login={commit.authorLogin} size="sm" />
      <span className="commit-main">
        <span className="commit-subject">{commitSubject(commit.message)}</span>
        <span className="commit-meta">
          <span>{commit.author}</span>
          <span className="dot" aria-hidden="true">
            ·
          </span>
          <time dateTime={commit.date} title={dateTime(commit.date)}>
            {relativeTime(commit.date)}
          </time>
          <span className="dot" aria-hidden="true">
            ·
          </span>
          <code>{commit.sha.slice(0, 7)}</code>
        </span>
      </span>
      <span className="commit-side">
        {sideTop}
        {showDetailStatus && <span className={`status-chip ${chip.className}`}>{chip.text}</span>}
      </span>
    </button>
  );
}

/** Compact +/− chips derived from real commit statistics when present. */
export function StatChips({ stats }: { stats?: { additions?: number; deletions?: number } | null }) {
  if (!stats || typeof stats.additions !== 'number') return null;
  return (
    <>
      <span className="stat-chip add">+{stats.additions}</span>
      <span className="stat-chip del">−{stats.deletions ?? 0}</span>
    </>
  );
}
