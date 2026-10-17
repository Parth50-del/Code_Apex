import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  LoaderCircle,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import type { RepoResponse } from '../types';
import { commitBody, commitSubject, dateTime } from '../lib/format';
import {
  EmptyState,
  InlineEmpty,
  PageHeading,
  SectionHeading,
  TableShell,
} from '../components/ui';

const PAGE_SIZE = 20;

export function TimeMachinePage({
  data,
  selectedSha,
  onSelectCommit,
  detailLoading,
  detailError,
  onRetryDetail,
}: {
  data: RepoResponse;
  selectedSha: string | null;
  onSelectCommit: (sha: string) => void;
  detailLoading: string | null;
  detailError: { sha: string; message: string } | null;
  onRetryDetail: () => void;
}) {
  const [query, setQuery] = useState('');
  const [authorFilter, setAuthorFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, authorFilter, fromDate, toDate]);

  const authorOptions = useMemo(() => {
    const authors = new Set(data.commits.map((commit) => commit.author).filter(Boolean));
    return [...authors].sort((a, b) => a.localeCompare(b));
  }, [data.commits]);

  const filteredCommits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() : null;
    return data.commits.filter((commit) => {
      if (authorFilter !== 'all' && commit.author !== authorFilter) return false;
      if (needle && !commit.message.toLowerCase().includes(needle)) return false;
      if (from !== null || to !== null) {
        const timestamp = new Date(commit.date).getTime();
        if (Number.isNaN(timestamp)) return false;
        if (from !== null && timestamp < from) return false;
        if (to !== null && timestamp > to + 86399999) return false;
      }
      return true;
    });
  }, [data.commits, query, authorFilter, fromDate, toDate]);

  const visibleCommits = filteredCommits.slice(0, visibleCount);
  const remaining = filteredCommits.length - visibleCommits.length;

  const currentCommit =
    data.commits.find((commit) => commit.sha === selectedSha) ?? data.commits[0] ?? null;

  const hasActiveFilters = Boolean(query.trim() || authorFilter !== 'all' || fromDate || toDate);
  const currentVisible = visibleCommits.some((commit) => commit.sha === currentCommit?.sha);
  const tabStopSha = currentVisible ? currentCommit?.sha : visibleCommits[0]?.sha;
  const activeDetailError = detailError && detailError.sha === currentCommit?.sha ? detailError : null;
  const body = currentCommit ? commitBody(currentCommit.message) : '';

  // Arrow keys move the inspected commit without leaving the list, so the
  // history is one tab stop instead of one per row.
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (!visibleCommits.length) return;
    event.preventDefault();
    const currentIndex = visibleCommits.findIndex((commit) => commit.sha === tabStopSha);
    let nextIndex = currentIndex < 0 ? 0 : currentIndex;
    if (event.key === 'ArrowDown') nextIndex = Math.min(visibleCommits.length - 1, nextIndex + 1);
    if (event.key === 'ArrowUp') nextIndex = Math.max(0, nextIndex - 1);
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = visibleCommits.length - 1;
    const target = visibleCommits[nextIndex];
    if (!target) return;
    onSelectCommit(target.sha);
    listRef.current?.querySelector<HTMLElement>(`[data-sha="${target.sha}"]`)?.focus();
  };

  return (
    <div className="workspace-page">
      <PageHeading
        eyebrow="History browser"
        title="Time Machine"
        description="Browse the analyzed commit window and inspect available changed-file details."
      />

      <div className="history-toolbar">
        <div className="field-search grow">
          <Search size={14} aria-hidden="true" />
          <label className="sr-only" htmlFor="commit-search">
            Search commits by message
          </label>
          <input
            id="commit-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commit messages"
          />
        </div>
        <label className="select-field">
          <span>Author</span>
          <select
            value={authorFilter}
            onChange={(event) => setAuthorFilter(event.target.value)}
          >
            <option value="all">All authors</option>
            {authorOptions.map((author) => (
              <option key={author} value={author}>
                {author}
              </option>
            ))}
          </select>
        </label>
        <label className="date-field">
          <span>From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </label>
        <label className="date-field">
          <span>To</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </label>
        <span className="quiet-label" role="status" aria-live="polite">
          {filteredCommits.length} of {data.commits.length} commits
        </span>
      </div>

      <div className="history-layout">
        <section className="work-section history-list">
          <SectionHeading
            title="Commit history"
            description="Newest first · arrow keys move the selection"
          />
          <div className="commit-browser" ref={listRef} onKeyDown={onListKeyDown}>
            {visibleCommits.map((commit) => (
              <button
                type="button"
                key={commit.sha}
                data-sha={commit.sha}
                tabIndex={commit.sha === tabStopSha ? 0 : -1}
                className={`history-row ${currentCommit?.sha === commit.sha ? 'row-selected' : ''}`}
                aria-current={currentCommit?.sha === commit.sha ? 'true' : undefined}
                onClick={() => onSelectCommit(commit.sha)}
              >
                <span className="timeline-mark" aria-hidden="true" />
                <span className="history-main">
                  <strong>{commitSubject(commit.message)}</strong>
                  <small>
                    {commit.author} · {dateTime(commit.date)}
                  </small>
                </span>
                <span className="history-meta">
                  <code>{commit.sha.slice(0, 7)}</code>
                  <small>
                    {commit.detailStatus === 'available' && commit.files
                      ? `${commit.files.length} file${commit.files.length === 1 ? '' : 's'}`
                      : commit.detailStatus === 'unavailable'
                        ? 'Details unavailable'
                        : 'Details pending'}
                  </small>
                </span>
              </button>
            ))}
            {!visibleCommits.length && (
              <EmptyState
                title={hasActiveFilters ? 'No commits match the filters' : 'No commits found'}
                detail={
                  hasActiveFilters
                    ? 'Adjust the search, author, or date filters to see more commits.'
                    : 'The repository has no commits in this analysis window.'
                }
              />
            )}
          </div>
          {remaining > 0 && (
            <div className="load-more">
              <button
                type="button"
                className="button-muted"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                Show more ({remaining} remaining)
              </button>
            </div>
          )}
        </section>

        <section className="work-section commit-inspector" aria-label="Selected commit details">
          {currentCommit ? (
            <>
              <div className="section-heading commit-detail-title">
                <div className="section-heading-text">
                  <p className="eyebrow">Commit {currentCommit.sha.slice(0, 12)}</p>
                  <h2>{commitSubject(currentCommit.message)}</h2>
                </div>
                {currentCommit.html_url && (
                  <a
                    className="quiet-link"
                    href={currentCommit.html_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub <ArrowUpRight size={13} aria-hidden="true" />
                  </a>
                )}
              </div>

              {body && <p className="commit-body">{body}</p>}

              <div className="commit-metadata">
                <span>
                  <Users size={14} aria-hidden="true" /> {currentCommit.author}
                </span>
                <span>
                  <Clock3 size={14} aria-hidden="true" /> {dateTime(currentCommit.date)}
                </span>
                <span>
                  <code>{currentCommit.sha}</code>
                </span>
              </div>

              {currentCommit.stats ? (
                <div className="change-summary">
                  <span>
                    <b>{currentCommit.stats.additions ?? '—'}</b> additions
                  </span>
                  <span>
                    <b>{currentCommit.stats.deletions ?? '—'}</b> deletions
                  </span>
                  <span>
                    <b>{currentCommit.files?.length ?? '—'}</b> changed files
                  </span>
                </div>
              ) : (
                <p className="inline-empty">Line statistics are unavailable for this commit.</p>
              )}

              {detailLoading === currentCommit.sha && (
                <p className="detail-loading" role="status" aria-live="polite">
                  <LoaderCircle size={15} className="spin" aria-hidden="true" />
                  Loading commit file details…
                </p>
              )}

              {activeDetailError && detailLoading !== currentCommit.sha && (
                <div className="inline-error" role="alert">
                  <AlertTriangle size={14} aria-hidden="true" />
                  <span>{activeDetailError.message}</span>
                  {data.source === 'live' && (
                    <button type="button" className="inline-retry" onClick={onRetryDetail}>
                      <RotateCcw size={12} aria-hidden="true" /> Retry
                    </button>
                  )}
                </div>
              )}

              {currentCommit.detailStatus === 'available' && currentCommit.files ? (
                currentCommit.files.length ? (
                  <TableShell caption="Changed files in this commit with status and diffstat">
                    <thead>
                      <tr>
                        <th scope="col">Changed file</th>
                        <th scope="col">Status</th>
                        <th scope="col">Diffstat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentCommit.files.map((file) => (
                        <tr key={`${file.path}-${file.commitSha ?? ''}`}>
                          <td>
                            <code>{file.path}</code>
                          </td>
                          <td>{file.status}</td>
                          <td>
                            <span className="addition">+{file.additions}</span> /{' '}
                            <span className="deletion">-{file.deletions}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </TableShell>
                ) : (
                  <p className="inline-empty">GitHub reported no changed files for this commit.</p>
                )
              ) : currentCommit.detailStatus === 'unavailable' ? (
                <EmptyState
                  title="Commit details unavailable"
                  detail="GitHub did not provide the changed-file list for this commit."
                  action={
                    data.source === 'live' ? (
                      <button type="button" className="button-muted" onClick={onRetryDetail}>
                        <RotateCcw size={13} aria-hidden="true" /> Retry loading details
                      </button>
                    ) : undefined
                  }
                />
              ) : currentCommit.detailStatus === 'not-fetched' && detailLoading !== currentCommit.sha ? (
                <InlineEmpty>
                  Detailed file changes have not been loaded for this commit.
                  {data.source === 'live' && (
                    <>
                      {' '}
                      <button type="button" className="inline-retry" onClick={onRetryDetail}>
                        <RotateCcw size={12} aria-hidden="true" /> Load details
                      </button>
                    </>
                  )}
                </InlineEmpty>
              ) : !detailLoading ? (
                <EmptyState
                  title="No file detail"
                  detail="This commit has no available changed-file metadata."
                />
              ) : null}
            </>
          ) : (
            <EmptyState
              title="No commit selected"
              detail="Select a commit in the history list to inspect its metadata."
            />
          )}
        </section>
      </div>
    </div>
  );
}
