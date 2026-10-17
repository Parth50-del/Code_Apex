import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Search, Shield } from 'lucide-react';
import type { RepoResponse, RiskEntry, RiskFactor } from '../types';
import { churnFor, commitSubject, dateOnly } from '../lib/format';
import {
  EmptyState,
  InlineEmpty,
  PageHeading,
  RiskScore,
  SectionHeading,
  SeverityBadge,
  TableShell,
} from '../components/ui';

type SortKey = 'path' | 'score' | 'changes' | 'churn' | 'lastChanged';
type SortState = { key: SortKey; dir: 'asc' | 'desc' };

const SORT_LABELS: Record<SortKey, string> = {
  path: 'File',
  score: 'Score',
  changes: 'Changes',
  churn: 'Churn',
  lastChanged: 'Last changed',
};

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

function factorPoints(factor: RiskFactor): number | null {
  if (typeof factor.points === 'number') return factor.points;
  if (typeof factor.score === 'number' && typeof factor.weight === 'number') {
    return Math.round(factor.score * factor.weight);
  }
  return null;
}

/** Sum of the factor points; equals the file score when every factor reports points. */
function pointsTotal(entry: RiskEntry): number | null {
  let sum = 0;
  for (const factor of entry.factors) {
    const points = factorPoints(factor);
    if (points === null) return null;
    sum += points;
  }
  return sum;
}

export function RiskRadarPage({
  data,
  selectedFilePath,
  onSelectFile,
}: {
  data: RepoResponse;
  selectedFilePath: string | null;
  onSelectFile: (path: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'score', dir: 'desc' });

  const handleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'path' ? 'asc' : 'desc' },
    );
  };

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? data.fileDetails.filter((file) => file.path.toLowerCase().includes(needle))
      : data.fileDetails;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const churnOf = (file: RiskEntry) => (file.additions ?? 0) + (file.deletions ?? 0);
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case 'path':
          return dir * a.path.localeCompare(b.path);
        case 'score':
          return dir * (a.score - b.score);
        case 'changes':
          return dir * ((a.changeCount ?? -1) - (b.changeCount ?? -1));
        case 'churn':
          return dir * (churnOf(a) - churnOf(b));
        case 'lastChanged':
          return dir * (a.lastChanged ?? '').localeCompare(b.lastChanged ?? '');
        default:
          return 0;
      }
    });
  }, [data.fileDetails, search, sort]);

  const selectedFile =
    data.fileDetails.find((file) => file.path === selectedFilePath) ?? data.fileDetails[0] ?? null;

  const supportCommits = useMemo(() => {
    if (!selectedFile) return [];
    const commitSet = new Set(selectedFile.commits ?? []);
    return data.commits.filter((commit) => commitSet.has(commit.sha));
  }, [data.commits, selectedFile]);

  const coverage = data.summary.detailCoverage;

  return (
    <div className="workspace-page">
      <PageHeading
        eyebrow="File investigation"
        title="Risk Radar"
        description="Ranked by observed edit frequency, line churn, recency, and revert-related commit messages."
      />

      <div className="method-note">
        <Shield size={15} aria-hidden="true" />
        <span>
          Each file is scored 0–100 as a weighted sum of four normalized factors: change frequency
          (0.35), code churn (0.30), recency (0.20), and revert signals (0.15). The breakdown below
          shows each factor&apos;s points, and those points add up to the displayed score. This is a
          review-priority heuristic, not a probability that a file contains a defect.
          {coverage ? ` Commit details were fetched for ${coverage}.` : ''}
        </span>
      </div>

      <div className="risk-layout">
        <section className="work-section risk-table-section">
          <SectionHeading title="Ranked files" description={`${data.fileDetails.length} files with observed history`}>
            <div className="field-search">
              <Search size={14} aria-hidden="true" />
              <label className="sr-only" htmlFor="file-search">
                Search files by path
              </label>
              <input
                id="file-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search file path"
              />
            </div>
          </SectionHeading>
          <TableShell
            caption="Ranked files with risk scores, change counts, churn, and last changed date"
            className="risk-table"
          >
            <thead>
              <tr>
                <SortableTh label="File" sortKey="path" sort={sort} onSort={handleSort} />
                <SortableTh label="Score" sortKey="score" sort={sort} onSort={handleSort} />
                <SortableTh label="Changes" sortKey="changes" sort={sort} onSort={handleSort} />
                <SortableTh label="Churn" sortKey="churn" sort={sort} onSort={handleSort} />
                <SortableTh label="Last changed" sortKey="lastChanged" sort={sort} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((file) => (
                <tr
                  key={file.path}
                  className={file.path === selectedFile?.path ? 'row-selected' : ''}
                  aria-current={file.path === selectedFile?.path ? 'true' : undefined}
                  onClick={() => onSelectFile(file.path)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectFile(file.path);
                    }
                  }}
                >
                  <td>
                    <code>{file.path}</code>
                  </td>
                  <td>
                    <RiskScore score={file.score} label={file.label} />
                  </td>
                  <td>{file.changeCount ?? '—'}</td>
                  <td>{churnFor(file) ?? 'Unavailable'}</td>
                  <td>{dateOnly(file.lastChanged)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
          {!rows.length && (
            <EmptyState
              title={search ? 'No matching files' : 'File data unavailable'}
              detail={
                search
                  ? 'No ranked file path matches the current search.'
                  : 'The analyzed commits did not provide changed-file details, so no files can be ranked.'
              }
            />
          )}
        </section>

        <aside className="detail-panel" aria-label="Selected file details">
          {selectedFile ? (
            <>
              <div className="detail-heading">
                <div className="detail-heading-text">
                  <p className="eyebrow">Selected file</p>
                  <h2>{selectedFile.path}</h2>
                </div>
                <RiskScore score={selectedFile.score} label={selectedFile.label} />
              </div>
              <div className="detail-badges">
                <SeverityBadge label={selectedFile.label} />
                <span className="quiet-label">
                  {selectedFile.changeCount ?? '—'} observed edits · {churnFor(selectedFile) ?? 'unavailable'} lines
                </span>
              </div>
              <p className="detail-explainer">
                Ranked <strong>{selectedFile.label.toLowerCase()}</strong> with a heuristic score of{' '}
                {selectedFile.score}/100. This highlights where to review; it does not establish a defect.
              </p>

              <h3 className="detail-subheading">Score breakdown</h3>
              <dl className="factor-list">
                {selectedFile.factors.map((factor) => {
                  const points = factorPoints(factor);
                  return (
                    <div className="factor-row" key={factor.label}>
                      <dt>{factor.label}</dt>
                      <dd className="factor-value">{factor.value}</dd>
                      <dd className="factor-numbers">
                        <span className="factor-score">{factor.score ?? '—'}</span>
                        <span className="factor-weight">× {factor.weight ?? '—'}</span>
                        <span className="factor-contribution">
                          {points === null
                            ? '—'
                            : `${points}${factor.maxPoints ? ` / ${factor.maxPoints}` : ''} pts`}
                        </span>
                      </dd>
                    </div>
                  );
                })}
                <div className="factor-row factor-total">
                  <dt>Weighted total</dt>
                  <dd className="factor-value">Sum of the factor contributions</dd>
                  <dd className="factor-numbers">
                    <span className="factor-score factor-total-value">
                      {pointsTotal(selectedFile) ?? selectedFile.score}
                    </span>
                    <span className="factor-weight">/ 100</span>
                  </dd>
                </div>
              </dl>

              <div className="detail-stats">
                <span>
                  <b>{selectedFile.additions ?? '—'}</b> additions
                </span>
                <span>
                  <b>{selectedFile.deletions ?? '—'}</b> deletions
                </span>
                <span>
                  <b>{selectedFile.contributors?.length ?? '—'}</b> observed authors
                </span>
              </div>

              <div className="evidence-heading">
                <h3>Supporting commits</h3>
                <span>{supportCommits.length}</span>
              </div>
              <div className="evidence-list">
                {supportCommits.map((commit) => {
                  const fileChange = commit.files?.find((file) => file.path === selectedFile.path);
                  return (
                    <div className="evidence-row" key={commit.sha}>
                      <div className="evidence-title">
                        <a href={commit.html_url ?? undefined} target="_blank" rel="noreferrer">
                          {commit.sha.slice(0, 7)} <ArrowUpRight size={12} aria-hidden="true" />
                        </a>
                        <span>{dateOnly(commit.date)}</span>
                      </div>
                      <p>{commitSubject(commit.message)}</p>
                      <small>
                        {commit.author}
                        {fileChange
                          ? ` · ${fileChange.status} · +${fileChange.additions}/-${fileChange.deletions}`
                          : ''}
                      </small>
                    </div>
                  );
                })}
                {!supportCommits.length && (
                  <p className="inline-empty">Supporting commit records are unavailable for this file.</p>
                )}
              </div>

              <div className="next-step">
                <strong>Suggested next check</strong>
                <p>
                  Review this file alongside the listed commits, paying attention to the latest edit
                  and adjacent code paths.
                </p>
              </div>
            </>
          ) : (
            <EmptyState
              title="Select a file"
              detail="Choose a ranked file to inspect its score and supporting commit evidence."
            />
          )}
        </aside>
      </div>
    </div>
  );
}
