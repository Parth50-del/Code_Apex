import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Search, Users } from 'lucide-react';
import type { Contributor, RepoResponse } from '../types';
import { dateTime, formatCount, isBot } from '../lib/format';
import { ContributorActivityChart } from '../components/Charts';
import {
  EmptyState,
  InlineEmpty,
  PageHeading,
  SectionHeading,
  TableShell,
} from '../components/ui';

type SortKey = 'name' | 'commits' | 'recent' | 'files';
type SortState = { key: SortKey; dir: 'asc' | 'desc' };

function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="sort-button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
      >
        {label}
        <span className="sort-icon" aria-hidden="true">
          {active ? (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : '↕'}
        </span>
      </button>
    </th>
  );
}

export function ContributorsPage({ data }: { data: RepoResponse }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'commits', dir: 'desc' });

  const handleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' },
    );
  };

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? data.contributors.filter(
          (person) =>
            (person.name || person.login).toLowerCase().includes(needle) ||
            person.login.toLowerCase().includes(needle),
        )
      : data.contributors;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case 'name':
          return dir * (a.name || a.login).localeCompare(b.name || b.login);
        case 'commits':
          return dir * (a.commit_count - b.commit_count);
        case 'recent':
          return dir * (a.recent_activity ?? '').localeCompare(b.recent_activity ?? '');
        case 'files':
          return dir * (a.files.length - b.files.length);
        default:
          return 0;
      }
    });
  }, [data.contributors, search, sort]);

  const collaborationRows = useMemo(() => {
    const result: Array<{ left: string; right: string; files: string[] }> = [];
    for (let i = 0; i < data.contributors.length; i += 1) {
      for (let j = i + 1; j < data.contributors.length; j += 1) {
        const left = data.contributors[i];
        const right = data.contributors[j];
        const shared = left.files.filter((file) => right.files.includes(file));
        if (shared.length) {
          result.push({
            left: left.name || left.login,
            right: right.name || right.login,
            files: shared,
          });
        }
      }
    }
    return result;
  }, [data.contributors]);

  const totalCommits = data.contributors.reduce((sum, person) => sum + person.commit_count, 0);
  const topContributor = data.contributors[0] ?? null;
  // A percentage from a couple of commits would be noise; require a minimal sample.
  const MIN_COMMITS_FOR_CONCENTRATION = 5;
  const concentration =
    topContributor && totalCommits >= MIN_COMMITS_FOR_CONCENTRATION
      ? Math.round((topContributor.commit_count / totalCommits) * 100)
      : null;

  return (
    <div className="workspace-page">
      <PageHeading
        eyebrow="People and collaboration"
        title="Contributors"
        description="Authors and shared file paths observed in this repository history."
      />

      <section className="work-section">
        <SectionHeading
          title="Observed contributors"
          description="Counts cover the commit window; file lists come from commits with loaded details"
        >
          <div className="field-search">
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
        </SectionHeading>
        <TableShell
          caption="Contributors with observed commit counts, last activity, and files touched"
          className="contributor-table"
        >
          <thead>
            <tr>
              <SortableTh label="Author" sortKey="name" sort={sort} onSort={handleSort} />
              <SortableTh label="Commits" sortKey="commits" sort={sort} onSort={handleSort} />
              <SortableTh label="Last activity" sortKey="recent" sort={sort} onSort={handleSort} />
              <SortableTh label="Files observed" sortKey="files" sort={sort} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {rows.map((contributor) => (
              <tr key={contributor.login}>
                <td>
                  <span className="author-cell">
                    <span className="author-avatar" aria-hidden="true">
                      {(contributor.name || contributor.login || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      {contributor.name || contributor.login}
                      {isBot(contributor) && (
                        <span className="bot-badge">
                          <Users size={10} aria-hidden="true" /> Bot
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td>{formatCount(contributor.commit_count)}</td>
                <td>{dateTime(contributor.recent_activity)}</td>
                <td>
                  {contributor.files.length ? (
                    <div className="file-tags">
                      {contributor.files.slice(0, 4).map((file) => (
                        <code key={file}>{file}</code>
                      ))}
                      {contributor.files.length > 4 && (
                        <span>+{contributor.files.length - 4} more</span>
                      )}
                    </div>
                  ) : (
                    'No file details observed'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
        {!rows.length && (
          <EmptyState
            title={search ? 'No matching contributors' : 'Contributor data unavailable'}
            detail={
              search
                ? 'No contributor matches the current search.'
                : 'No contributor records were returned for this repository.'
            }
          />
        )}
      </section>

      <section className="work-section">
        <SectionHeading
          title="Contributor activity"
          description="Observed commits per author in the analyzed window"
        />
        <div className="chart-card-body">
          <ContributorActivityChart contributors={data.contributors} />
        </div>
      </section>

      <section className="work-section shared-work">
        <SectionHeading
          title="Shared file ownership"
          description="Pairs of contributors observed modifying the same file paths"
        />
        {collaborationRows.length ? (
          <div className="shared-list">
            {collaborationRows.map((row) => (
              <div
                className="shared-row"
                key={`${row.left}-${row.right}-${row.files.join('|')}`}
              >
                <span>{row.left}</span>
                <span className="shared-link">worked on</span>
                <code>{row.files.join(', ')}</code>
                <span className="shared-link">with</span>
                <span>{row.right}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No shared files observed"
            detail="No pair of contributors in the analyzed data modified the same reported file."
          />
        )}
      </section>

      <p className="data-caveat">
        File lists are based on the commits whose details were loaded, so attribution is partial when
        coverage is incomplete. Commit counts describe observed repository history only; they are not a
        measure of productivity, skill, or contribution quality.
        {concentration !== null && data.contributors.length >= 2
          ? ` The most active author accounts for ${concentration}% of observed commits, which reflects commit concentration in this window rather than ownership.`
          : ''}
      </p>

      {!data.contributors.length && <InlineEmpty>No contributor data to summarize.</InlineEmpty>}
    </div>
  );
}
