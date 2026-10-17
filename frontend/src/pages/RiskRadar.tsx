import { useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Search, Shield, Target } from 'lucide-react';
import type { RepoResponse, RiskEntry, RiskFactor } from '../types';
import { churnFor, commitSubject, dateOnly } from '../lib/format';
import { SeverityMix } from '../components/Charts';
import {
  EmptyState,
  InlineEmpty,
  PageHeader,
  Panel,
  RiskScore,
  SeverityBadge,
  TableShell,
} from '../components/ui';

type SortKey = 'path' | 'score' | 'changes' | 'churn' | 'lastChanged';
type SortState = { key: SortKey; dir: 'asc' | 'desc' };
type Severity = 'all' | 'High' | 'Medium' | 'Low';

const FACTOR_NOTES: Record<string, string> = {
  'Change frequency': 'how often the file was edited in the loaded commits',
  'Code churn': 'how many lines were added plus deleted',
  Recency: 'how recently the file was last changed',
  'Revert signals': 'whether a revert-related commit touched the file',
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
    <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="sort-button" onClick={() => onSort(sortKey)} aria-label={`Sort by ${label}`}>
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
  onOpenCommit,
}: {
  data: RepoResponse;
  selectedFilePath: string | null;
  onSelectFile: (path: string) => void;
  onOpenCommit?: (sha: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<Severity>('all');
  const [sort, setSort] = useState<SortState>({ key: 'score', dir: 'desc' });

  const handleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'path' ? 'asc' : 'desc' },
    );
  };

  const counts = useMemo(() => {
    const highs = data.fileDetails.filter((file) => file.score >= 80).length;
    const medium = data.fileDetails.filter((file) => file.score >= 55 && file.score < 80).length;
    return { all: data.fileDetails.length, High: highs, Medium: medium, Low: data.fileDetails.length - highs - medium };
  }, [data.fileDetails]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = data.fileDetails.filter((file) => {
      if (needle && !file.path.toLowerCase().includes(needle)) return false;
      if (severity !== 'all' && file.label !== severity) return false;
      return true;
    });
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
  }, [data.fileDetails, search, severity, sort]);

  const selectedFile =
    data.fileDetails.find((file) => file.path === selectedFilePath) ?? data.fileDetails[0] ?? null;

  const supportCommits = useMemo(() => {
    if (!selectedFile) return [];
    const commitSet = new Set(selectedFile.commits ?? []);
    return data.commits.filter((commit) => commitSet.has(commit.sha));
  }, [data.commits, selectedFile]);

  const hasFilters = search.trim() !== '' || severity !== 'all';

  return (
    <div className="page-body">
      <PageHeader
        eyebrow="Investigation · File quality"
        title="Risk Radar"
        description="Files ranked by observed edit frequency, line churn, recency, and revert signals — so review effort lands where change is concentrated."
      />

      <div className="method-note">
        <Shield size={15} aria-hidden="true" />
        <span>
          <strong>How this score works.</strong> Each file is scored 0–100 as a weighted sum of four normalized
          factors: change frequency (0.35), code churn (0.30), recency (0.20), and revert signals (0.15). The
          breakdown shows each factor&apos;s points, and those points add up to the displayed score. This is a{' '}
          <strong>review-priority heuristic</strong>, not a probability that a file contains a defect.
          {data.summary.detailCoverage ? ` Commit details were fetched for ${data.summary.detailCoverage}.` : ''}
        </span>
      </div>

      <div className="master-detail">
        <Panel
          className="risk-table-section"
          bodyClassName="panel-body-flush"
          kicker="Ranked files"
          title={`${counts.all} file${counts.all === 1 ? '' : 's'} with observed history`}
          actions={
            <div className="field-search search-box">
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
          }
          foot={
            counts.all > 0 ? (
              <div style={{ display: 'grid', gap: 8, padding: '10px 0' }}>
                <span className="quiet-label">Severity mix of the {counts.all} ranked files</span>
                <SeverityMix counts={{ high: counts.High, medium: counts.Medium, low: counts.Low }} />
              </div>
            ) : undefined
          }
        >
          <div className="severity-filter" role="group" aria-label="Filter by severity">
            <button
              type="button"
              className="chip chip-toggle"
              aria-pressed={severity === 'all'}
              onClick={() => setSeverity('all')}
            >
              All files <span className="chip-count">{counts.all}</span>
            </button>
            {(['High', 'Medium', 'Low'] as const).map((level) => (
              <button
                key={level}
                type="button"
                className="chip chip-toggle"
                aria-pressed={severity === level}
                onClick={() => setSeverity((current) => (current === level ? 'all' : level))}
              >
                {level} <span className="chip-count">{counts[level]}</span>
              </button>
            ))}
          </div>
          {rows.length ? (
            <TableShell caption="Ranked files with risk scores, change counts, churn, and last changed date" className="risk-table">
              <thead>
                <tr>
                  <SortableTh label="File" sortKey="path" sort={sort} onSort={handleSort} />
                  <SortableTh label="Score" sortKey="score" sort={sort} onSort={handleSort} />
                  <th scope="col">Severity</th>
                  <SortableTh label="Changes" sortKey="changes" sort={sort} onSort={handleSort} />
                  <SortableTh label="Churn" sortKey="churn" sort={sort} onSort={handleSort} />
                  <SortableTh label="Last changed" sortKey="lastChanged" sort={sort} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {rows.map((file) => (
                  <tr
                    key={file.path}
                    className={`${file.path === selectedFile?.path ? 'row-selected' : ''} clickable`}
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
                    <td className="td-file">
                      <code title={file.path}>{file.path}</code>
                    </td>
                    <td>
                      <RiskScore score={file.score} label={file.label} />
                    </td>
                    <td>
                      <SeverityBadge label={file.label} />
                    </td>
                    <td className="num">{file.changeCount ?? '—'}</td>
                    <td className="num">{churnFor(file) ?? <span className="dim">unavailable</span>}</td>
                    <td className="dim">{dateOnly(file.lastChanged)}</td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          ) : (
            <EmptyState
              title={hasFilters ? 'No matching files' : 'File data unavailable'}
              detail={
                hasFilters
                  ? 'No ranked file matches the current search and severity filter.'
                  : 'The analyzed commits did not provide changed-file details, so no files can be ranked.'
              }
              icon={hasFilters ? 'search' : 'inbox'}
              action={
                hasFilters ? (
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    onClick={() => {
                      setSearch('');
                      setSeverity('all');
                    }}
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          )}
        </Panel>

        <aside className="detail-panel panel" aria-label="Selected file details">
          {selectedFile ? (
            <div className="detail-inner">
              <div className="detail-heading">
                <div className="detail-heading-text">
                  <p className="panel-kicker">Selected file</p>
                  <span className="path" title={selectedFile.path}>
                    {selectedFile.path}
                  </span>
                </div>
                <RiskScore score={selectedFile.score} label={selectedFile.label} large />
              </div>
              <div className="detail-badges">
                <SeverityBadge label={selectedFile.label} />
                <span className="quiet-label">
                  {selectedFile.changeCount ?? '—'} observed edits ·{' '}
                  {churnFor(selectedFile) ?? 'churn unavailable'}
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
                  const meter = factor.maxPoints ? Math.min(100, ((points ?? 0) / factor.maxPoints) * 100) : 0;
                  return (
                    <div className="factor-row" key={factor.label}>
                      <dt className="factor-label" title={FACTOR_NOTES[factor.label]}>
                        {factor.label}
                      </dt>
                      <dd className="factor-numbers">
                        <span className="factor-score">{factor.score ?? '—'}</span>
                        <span className="factor-weight">× {factor.weight ?? '—'}</span>
                        <span className="factor-contribution">
                          {points === null ? '—' : `${points}${factor.maxPoints ? ` / ${factor.maxPoints}` : ''} pts`}
                        </span>
                      </dd>
                      <dd className="factor-value">{factor.value}</dd>
                      <span className="factor-meter" aria-hidden="true">
                        <span style={{ width: `${meter}%` }} />
                      </span>
                    </div>
                  );
                })}
                <div className="factor-row factor-total">
                  <dt className="factor-label">Weighted total</dt>
                  <dd className="factor-numbers">
                    <span className="factor-score factor-total-value">
                      {pointsTotal(selectedFile) ?? selectedFile.score}
                    </span>
                    <span className="factor-weight">/ 100</span>
                  </dd>
                  <dd className="factor-value">Sum of the factor contributions</dd>
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

              <div className="evidence-head">
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
                          {commit.sha.slice(0, 7)} <ArrowUpRightSvg />
                        </a>
                        <span>{dateOnly(commit.date)}</span>
                      </div>
                      <p>{commitSubject(commit.message)}</p>
                      <small>
                        {commit.author}
                        {fileChange ? ` · ${fileChange.status} · +${fileChange.additions}/-${fileChange.deletions}` : ''}
                      </small>
                      {onOpenCommit && (
                        <button type="button" className="text-action" style={{ marginTop: 6 }} onClick={() => onOpenCommit(commit.sha)}>
                          Open in Time Machine <ArrowRight size={12} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {!supportCommits.length && (
                  <InlineEmpty>Supporting commit records are unavailable for this file.</InlineEmpty>
                )}
              </div>

              <div className="next-step">
                <strong>
                  <Target size={13} aria-hidden="true" /> Suggested next check
                </strong>
                <p>
                  Review this file alongside the listed commits, paying attention to the latest edit and adjacent
                  code paths.
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Select a file"
              detail="Choose a ranked file to inspect its score and supporting commit evidence."
            />
          )}
        </aside>
      </div>

      {!data.fileDetails.length && <InlineEmpty>No file data to inspect for this analysis window.</InlineEmpty>}
    </div>
  );
}

function ArrowUpRightSvg() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}
