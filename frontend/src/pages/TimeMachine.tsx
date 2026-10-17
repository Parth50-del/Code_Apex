import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AlertTriangle, Bot, CalendarRange, FilterX, LoaderCircle, RotateCcw, Search, Users } from 'lucide-react';
import type { CommitItem, RepoResponse } from '../types';
import { commitBody, commitSubject, dateTime, isBotCommit } from '../lib/format';
import { AuthorAvatar, CommitRow, StatChips } from '../components/commit';
import {
  CopyButton,
  EmptyState,
  InlineEmpty,
  PageHeader,
  Panel,
  TableShell,
} from '../components/ui';

const PAGE_SIZE = 20;

function botOf(commit: CommitItem): boolean {
  return isBotCommit(commit);
}

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
  const [hideBots, setHideBots] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, authorFilter, fromDate, toDate, hideBots]);

  const authorOptions = useMemo(() => {
    const authors = new Set(data.commits.map((commit) => commit.author).filter(Boolean));
    return [...authors].sort((a, b) => a.localeCompare(b));
  }, [data.commits]);

  const botsObserved = useMemo(() => data.commits.filter(botOf).length, [data.commits]);

  const filteredCommits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() : null;
    return data.commits.filter((commit) => {
      if (hideBots && botOf(commit)) return false;
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
  }, [data.commits, query, authorFilter, fromDate, toDate, hideBots]);

  const visibleCommits = filteredCommits.slice(0, visibleCount);
  const remaining = filteredCommits.length - visibleCommits.length;

  const currentCommit =
    data.commits.find((commit) => commit.sha === selectedSha) ?? data.commits[0] ?? null;

  const hasActiveFilters = Boolean(query.trim() || authorFilter !== 'all' || fromDate || toDate || hideBots);
  const currentVisible = visibleCommits.some((commit) => commit.sha === currentCommit?.sha);
  const tabStopSha = currentVisible ? currentCommit?.sha : visibleCommits[0]?.sha;
  const activeDetailError = detailError && detailError.sha === currentCommit?.sha ? detailError : null;
  const body = currentCommit ? commitBody(currentCommit.message) : '';

  const clearFilters = () => {
    setQuery('');
    setAuthorFilter('all');
    setFromDate('');
    setToDate('');
    setHideBots(false);
  };

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
    <div className="page-body">
      <PageHeader
        eyebrow="History · Commit browser"
        title="Time Machine"
        description="Browse the analyzed commit window, filter it, and inspect what each commit changed."
      />

      <div className="history-toolbar">
        <div className="field-search search-box grow">
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
        <label className="control-field">
          <span>Author</span>
          <select value={authorFilter} onChange={(event) => setAuthorFilter(event.target.value)}>
            <option value="all">All authors</option>
            {authorOptions.map((author) => (
              <option key={author} value={author}>
                {author}
              </option>
            ))}
          </select>
        </label>
        <label className="control-field">
          <span>From</span>
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </label>
        <label className="control-field">
          <span>To</span>
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </label>
        <button
          type="button"
          className="chip chip-toggle"
          aria-pressed={hideBots}
          onClick={() => setHideBots((value) => !value)}
          disabled={botsObserved === 0}
          title={botsObserved === 0 ? 'No bot commits in this window' : undefined}
        >
          <Bot size={12} aria-hidden="true" /> Hide bots
        </button>
        {hasActiveFilters && (
          <button type="button" className="chip chip-toggle" onClick={clearFilters}>
            <FilterX size={12} aria-hidden="true" /> Clear filters
          </button>
        )}
        <span className="quiet-label toolbar-count" role="status" aria-live="polite">
          {filteredCommits.length} of {data.commits.length} commits
        </span>
      </div>

      <div className="master-detail">
        <Panel
          className="history-list"
          bodyClassName="panel-body-flush"
          kicker="Commit history"
          title="Newest first"
          sub="Click a commit or use the arrow keys to inspect it"
          actions={
            <span className="quiet-label">
              <CalendarRange size={12} aria-hidden="true" /> {visibleCommits.length} shown
            </span>
          }
        >
          <div className="commit-browser" ref={listRef} onKeyDown={onListKeyDown}>
            {visibleCommits.map((commit) => (
              <CommitRow
                key={commit.sha}
                commit={commit}
                dataSha={commit.sha}
                tabIndex={commit.sha === tabStopSha ? 0 : -1}
                selected={currentCommit?.sha === commit.sha}
                onClick={() => onSelectCommit(commit.sha)}
                showTimeline
                showDetailStatus
                sideTop={<StatChips stats={commit.stats} />}
              />
            ))}
            {!visibleCommits.length && (
              <EmptyState
                title={hasActiveFilters ? 'No commits match the filters' : 'No commits found'}
                detail={
                  hasActiveFilters
                    ? 'Adjust the search, author, date, or bot filters to see more commits.'
                    : 'The repository has no commits in this analysis window.'
                }
                icon={hasActiveFilters ? 'search' : 'inbox'}
                action={
                  hasActiveFilters ? (
                    <button type="button" className="btn btn-soft btn-sm" onClick={clearFilters}>
                      Clear filters
                    </button>
                  ) : undefined
                }
              />
            )}
          </div>
          {remaining > 0 && (
            <div className="load-more">
              <button type="button" className="btn btn-soft" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                Show more ({remaining} remaining)
              </button>
            </div>
          )}
        </Panel>

        <section className="panel commit-inspector" aria-label="Selected commit details">
          {currentCommit ? (
            <>
              <div className="panel-head commit-detail-title">
                <div className="panel-titles">
                  <span className="panel-kicker commit-detail-kicker">
                    Commit <code>{currentCommit.sha.slice(0, 12)}</code>
                  </span>
                  <h2>{commitSubject(currentCommit.message)}</h2>
                </div>
                <div className="panel-actions">
                  {currentCommit.html_url && (
                    <a className="link-quiet" href={currentCommit.html_url} target="_blank" rel="noreferrer">
                      GitHub
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M7 17 17 7M8 7h9v9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  )}
                  <CopyButton value={currentCommit.sha} label="Copy SHA" compact />
                </div>
              </div>

              <div className="inspector-body">
                {body && <p className="commit-body">{body}</p>}

                <div className="commit-metadata">
                  <span>
                    <AuthorAvatar name={currentCommit.author} login={currentCommit.authorLogin} size="sm" />
                    {currentCommit.author}
                    {currentCommit.authorType === 'Bot' && (
                      <span className="bot-badge">
                        <Users size={9} aria-hidden="true" /> Bot
                      </span>
                    )}
                  </span>
                  <span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 3" strokeLinecap="round" />
                    </svg>
                    {dateTime(currentCommit.date)}
                  </span>
                  <code className="sha-full">{currentCommit.sha}</code>
                </div>

                {currentCommit.stats ? (
                  <div className="change-summary">
                    <span className="stat-pill add">
                      <b>{currentCommit.stats.additions ?? '—'}</b> added
                    </span>
                    <span className="stat-pill del">
                      <b>{currentCommit.stats.deletions ?? '—'}</b> removed
                    </span>
                    <span className="stat-pill">
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
                    <TableShell caption="Changed files in this commit with status and diffstat" className="commit-files-table">
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
                              <code title={file.path}>{file.path}</code>
                            </td>
                            <td>
                              <span className="status-chip">{file.status}</span>
                            </td>
                            <td>
                              <span className="addition">+{file.additions}</span> /{' '}
                              <span className="deletion">−{file.deletions}</span>
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
                        <button type="button" className="btn btn-soft btn-sm" onClick={onRetryDetail}>
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
              </div>
            </>
          ) : (
            <EmptyState
              title="No commit selected"
              detail="Select a commit in the history list to inspect its metadata."
            />
          )}
        </section>
      </div>

      <p className="coverage-line">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
        This browser shows the {data.commits.length} commits captured in the analysis window. The full
        repository history is not analyzed, so counts and charts cover this window only.
      </p>
    </div>
  );
}
