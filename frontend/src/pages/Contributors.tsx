import { useMemo, useState } from 'react';
import { Bot, ChevronDown, Info, Search, Users } from 'lucide-react';
import type { Contributor, RepoResponse } from '../types';
import { dateTime, formatCount, isBot, relativeTime } from '../lib/format';
import { CommitRow, StatChips } from '../components/commit';
import { ContributorActivityChart } from '../components/Charts';
import { EmptyState, InlineEmpty, PageHeader, MetricTile, Panel } from '../components/ui';

type SortKey = 'commits' | 'name' | 'recent' | 'files';

export function ContributorsPage({
  data,
  onOpenCommit,
}: {
  data: RepoResponse;
  onOpenCommit?: (sha: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('commits');
  const [hideBots, setHideBots] = useState(false);
  const [expandedLogin, setExpandedLogin] = useState<string | null>(null);

  const botCount = useMemo(() => data.contributors.filter((person) => isBot(person)).length, [data.contributors]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = data.contributors.filter((person) => {
      if (hideBots && isBot(person)) return false;
      if (!needle) return true;
      return (
        (person.name || person.login).toLowerCase().includes(needle) ||
        person.login.toLowerCase().includes(needle)
      );
    });
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return (a.name || a.login).localeCompare(b.name || b.login);
        case 'recent':
          return (b.recent_activity ?? '').localeCompare(a.recent_activity ?? '');
        case 'files':
          return b.files.length - a.files.length;
        case 'commits':
        default:
          return b.commit_count - a.commit_count;
      }
    });
  }, [data.contributors, search, sortKey, hideBots]);

  const commitsFor = (contributor: Contributor) =>
    data.commits.filter(
      (commit) =>
        (commit.authorLogin ?? commit.author) === contributor.login || commit.author === contributor.name,
    );

  const totalCommits = data.contributors.reduce((sum, person) => sum + person.commit_count, 0);
  const topContributor = rows[0] ?? null;

  // A percentage from a couple of commits would be noise; require a minimal sample.
  const MIN_COMMITS_FOR_CONCENTRATION = 5;
  const concentration =
    topContributor && totalCommits >= MIN_COMMITS_FOR_CONCENTRATION
      ? Math.round((topContributor.commit_count / totalCommits) * 100)
      : null;

  return (
    <div className="page-body">
      <PageHeader
        eyebrow="People · Collaboration patterns"
        title="Contributors"
        description="Who changes this repository, how concentrated the work is, and which paths people touch in this window."
      />

      <div className="metric-grid">
        <MetricTile
          label="Contributors observed"
          value={formatCount(data.contributors.filter((person) => !isBot(person)).length)}
          sub="Authors detected in the analyzed commits"
          tone="accent"
        />
        <MetricTile
          label="Bots identified"
          value={formatCount(botCount)}
          sub={botCount ? 'GitHub app accounts are marked below' : 'No app accounts in this window'}
        />
        <MetricTile
          label="Observed commits"
          value={formatCount(totalCommits)}
          sub="Sum of detected author counts in the window"
        />
        <MetricTile
          label="Most active share"
          value={concentration !== null ? `${concentration}%` : '—'}
          sub={
            concentration !== null
              ? `${topContributor?.name || topContributor?.login} · window not ownership`
              : 'Needs at least 5 observed commits'
          }
        />
      </div>

      <Panel
        className="contributor-section table-section"
        bodyClassName="panel-body-flush"
        kicker="Ranking"
        title="Contributor leaderboard"
        sub="Counts cover the commits in this window; file lists come from the details that were loaded"
        actions={
          <>
            <div className="field-search search-box">
              <Search size={14} aria-hidden="true" />
              <label className="sr-only" htmlFor="contributor-search">
                Search contributors
              </label>
              <input
                id="contributor-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search contributors"
              />
            </div>
            <button
              type="button"
              className="chip chip-toggle"
              aria-pressed={hideBots}
              onClick={() => setHideBots((value) => !value)}
              disabled={botCount === 0}
              title={botCount === 0 ? 'No bot accounts in this window' : undefined}
            >
              <Bot size={12} aria-hidden="true" /> Hide bots
            </button>
            <label className="control-field">
              <span className="sr-only">Sort contributors</span>
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} aria-label="Sort contributors">
                <option value="commits">Sort: commits</option>
                <option value="name">Sort: name</option>
                <option value="recent">Sort: last activity</option>
                <option value="files">Sort: files touched</option>
              </select>
            </label>
          </>
        }
      >
        {rows.length ? (
          <div className="contrib-list">
            {rows.map((contributor, index) => {
              const expanded = expandedLogin === contributor.login;
              const share = totalCommits ? Math.round((contributor.commit_count / totalCommits) * 100) : 0;
              const theirCommits = commitsFor(contributor);
              return (
                <div className="contrib-item" key={contributor.login}>
                  <div className={`contrib-row ${expanded ? 'contrib-row-open' : ''}`}>
                    <span className="contributor-rank" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="author">
                      <span className="avatar sm" aria-hidden="true">
                        {(contributor.name || contributor.login || '?').slice(0, 1).toUpperCase()}
                      </span>
                      <span className="author-name">
                        {contributor.name || contributor.login}
                        {isBot(contributor) && (
                          <span className="bot-badge">
                            <Users size={9} aria-hidden="true" /> Bot
                          </span>
                        )}
                      </span>
                      {contributor.login !== contributor.name && (
                        <span className="dim" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>
                          {contributor.login}
                        </span>
                      )}
                    </span>
                    <span className="share-bar" title={`${contributor.commit_count} of ${totalCommits} observed commits`}>
                      <span className="share-track">
                        <span style={{ width: `${share}%` }} />
                      </span>
                      <span className="share-value">{share}%</span>
                    </span>
                    <span className="num">{formatCount(contributor.commit_count)}</span>
                    <span className="dim" title={contributor.recent_activity ? dateTime(contributor.recent_activity) : undefined}>
                      {relativeTime(contributor.recent_activity)}
                    </span>
                    <span className="file-tags">
                      {contributor.files.length ? (
                        <>
                          {contributor.files.slice(0, 3).map((file) => (
                            <code key={file} title={file}>
                              {file}
                            </code>
                          ))}
                          {contributor.files.length > 3 && <span>+{contributor.files.length - 3}</span>}
                        </>
                      ) : (
                        <span className="dim">No details observed</span>
                      )}
                    </span>
                    <button
                      type="button"
                      className={`icon-btn detail-toggle ${expanded ? 'is-open' : ''}`}
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Hide' : 'Show'} commits by ${contributor.name || contributor.login}`}
                      onClick={() => setExpandedLogin((value) => (value === contributor.login ? null : contributor.login))}
                    >
                      <ChevronDown size={15} aria-hidden="true" />
                    </button>
                  </div>
                  {expanded && (
                    <div className="contributor-detail">
                      {theirCommits.length ? (
                        <>
                          <h4>
                            {formatCount(theirCommits.length)} commit{theirCommits.length === 1 ? '' : 's'} in this
                            window
                          </h4>
                          <div>
                            {theirCommits.slice(0, 8).map((commit) => (
                              <CommitRow
                                key={commit.sha}
                                commit={commit}
                                onClick={() => onOpenCommit?.(commit.sha)}
                                sideTop={<StatChips stats={commit.stats} />}
                                showDetailStatus={false}
                              />
                            ))}
                            {theirCommits.length > 8 && (
                              <p className="inline-empty">… and {theirCommits.length - 8} more in the window.</p>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="inline-empty">
                          No commits in this window are attributed to this author, though their count covers the
                          analysis window.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={search || hideBots ? 'No matching contributors' : 'Contributor data unavailable'}
            detail={
              search || hideBots
                ? 'No contributor matches the current search and filters.'
                : 'No contributor records were returned for this repository.'
            }
            icon={search ? 'search' : 'inbox'}
            action={
              search || hideBots ? (
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={() => {
                    setSearch('');
                    setHideBots(false);
                  }}
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        )}
      </Panel>

      <div className="split-2">
        <Panel
          kicker="Activity"
          title="Observed commits per author"
          sub="Bar length is relative to the most active author in the window"
        >
          <ContributorActivityChart contributors={rows} />
        </Panel>

        <Panel
          className="shared-work"
          kicker="Overlap"
          title="Shared file paths"
          sub="Pairs of contributors observed modifying the same paths"
        >
          <SharedWork data={data} />
        </Panel>
      </div>

      <p className="data-caveat">
        <Info size={14} aria-hidden="true" />
        <span>
          File lists are based on the commits whose details were loaded, so attribution is partial when coverage is
          incomplete. Commit counts describe observed repository history only — they are not a measure of
          productivity, skill, or contribution quality.
          {concentration !== null && data.contributors.length >= 2
            ? ` The most active author accounts for ${concentration}% of observed commits, which reflects commit concentration in this window rather than ownership.`
            : ''}
        </span>
      </p>

      {!data.contributors.length && <InlineEmpty>No contributor data to summarize.</InlineEmpty>}
    </div>
  );
}

function SharedWork({ data }: { data: RepoResponse }) {
  const rows: Array<{ left: Contributor; right: Contributor; files: string[] }> = [];
  for (let i = 0; i < data.contributors.length; i += 1) {
    for (let j = i + 1; j < data.contributors.length; j += 1) {
      const left = data.contributors[i];
      const right = data.contributors[j];
      const shared = left.files.filter((file) => right.files.includes(file));
      if (shared.length) rows.push({ left, right, files: shared });
    }
  }
  if (!rows.length) {
    return (
      <EmptyState
        title="No shared files observed"
        detail="No pair of contributors in the analyzed data modified the same reported file."
      />
    );
  }
  return (
    <div className="shared-list">
      {rows.map((row) => (
        <div className="shared-row" key={`${row.left.login}-${row.right.login}-${row.files.join('|')}`}>
          <span className="author-name">{row.left.name || row.left.login}</span>
          <span className="shared-link">and</span>
          <span className="author-name">{row.right.name || row.right.login}</span>
          <span className="shared-link">both edited</span>
          <span className="file-tags">
            {row.files.slice(0, 4).map((file) => (
              <code key={file} title={file}>
                {file.split('/').slice(-1)[0]}
              </code>
            ))}
            {row.files.length > 4 && <span>+{row.files.length - 4}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
