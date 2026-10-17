import { ArrowRight, ArrowUpRight, GitBranch, Github, Star, GitFork } from 'lucide-react';
import type { RepoResponse } from '../types';
import {
  additionsDeletionsByCommit,
  churnFor,
  commitActivitySeries,
  commitSubject,
  commitsWithDetails,
  dateTime,
  dateOnly,
  formatCount,
  relativeTime,
  RISK_HIGH_THRESHOLD,
  RISK_MEDIUM_THRESHOLD,
} from '../lib/format';
import { EmptyState, MetricCard, MetricStrip, PageHeading, RiskScore, SectionHeading, SourceLabel, TableShell } from '../components/ui';
import { AdditionsDeletionsChart, ChartCard, CommitActivityChart, FileChurnChart } from '../components/Charts';

export function OverviewPage({
  data,
  onOpenFile,
  onOpenCommit,
}: {
  data: RepoResponse;
  onOpenFile: (path: string) => void;
  onOpenCommit: (sha: string) => void;
}) {
  const recentCommits = data.commits.slice(0, 6);
  const tableRows = data.fileDetails.slice(0, 8);
  const highest = data.fileDetails[0] ?? null;
  const commitCount = data.commits.length;
  const detailCount = commitsWithDetails(data.commits).length;
  const filesObserved = data.summary.filesAnalyzed ?? data.fileDetails.length;
  const activity = commitActivitySeries(data.commits);
  const addDel = additionsDeletionsByCommit(data.commits);
  const timeRange = data.summary.timeRange;
  const weeklyActivity = activity.granularity === 'week';

  return (
    <div className="workspace-page">
      <PageHeading
        eyebrow="Repository intelligence"
        title="Overview"
        description="Recent history, observed code churn, and files worth investigating."
      />

      <section className="repo-summary">
        <div className="repo-ident">
          <span className="repo-avatar">
            <Github size={17} aria-hidden="true" />
          </span>
          <div className="repo-title">
            <a href={data.repository.html_url} target="_blank" rel="noreferrer">
              {data.repository.full_name}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <p>{data.repository.description || 'No repository description provided.'}</p>
          </div>
        </div>
        <div className="repo-metadata">
          <span>
            <GitBranch size={14} aria-hidden="true" />
            {data.repository.default_branch}
          </span>
          {data.repository.language && <span>{data.repository.language}</span>}
          {typeof data.repository.stars === 'number' && (
            <span>
              <Star size={14} aria-hidden="true" />
              {formatCount(data.repository.stars)}
            </span>
          )}
          {typeof data.repository.forks === 'number' && (
            <span>
              <GitFork size={14} aria-hidden="true" />
              {formatCount(data.repository.forks)}
            </span>
          )}
          {timeRange?.newest && (
            <span>Newest commit {relativeTime(timeRange.newest)}</span>
          )}
          <SourceLabel source={data.source} />
        </div>
      </section>

      <MetricStrip>
        <MetricCard
          label="Commits retrieved"
          value={formatCount(commitCount)}
          subtext={data.summary.detailCoverage ?? `${commitCount} commits`}
        />
        <MetricCard
          label="With file details"
          value={`${detailCount}/${commitCount}`}
          subtext={detailCount === commitCount ? 'Full detail coverage' : 'Partial detail coverage'}
          tone={detailCount === commitCount ? 'success' : 'warning'}
        />
        <MetricCard label="Contributors observed" value={formatCount(data.contributors.length)} />
        <MetricCard
          label="Files ranked"
          value={formatCount(data.fileDetails.length)}
          subtext={`${formatCount(filesObserved)} distinct paths observed`}
        />
        <MetricCard
          label="Highest file score"
          value={highest ? highest.score : '—'}
          subtext={highest ? highest.path : 'No files ranked'}
          tone={
            highest && highest.score >= RISK_HIGH_THRESHOLD
              ? 'danger'
              : highest && highest.score >= RISK_MEDIUM_THRESHOLD
                ? 'warning'
                : 'default'
          }
        />
      </MetricStrip>

      <div className="chart-grid">
        <ChartCard
          title="Commit activity"
          description={weeklyActivity ? 'Commits per week in the analyzed window' : 'Commits per day in the analyzed window'}
          footnote={
            timeRange?.oldest && timeRange?.newest
              ? `Window: ${dateOnly(timeRange.oldest)} – ${dateOnly(timeRange.newest)}`
              : undefined
          }
        >
          <CommitActivityChart data={activity.points} />
        </ChartCard>
        <ChartCard
          title="Additions vs deletions"
          description="Line changes per commit"
          footnote={
            addDel.length !== commitCount
              ? `Only ${addDel.length} of ${commitCount} commits returned line statistics.`
              : undefined
          }
        >
          <AdditionsDeletionsChart data={addDel} />
        </ChartCard>
        <ChartCard title="Lines changed by file" description="Top files by added plus deleted lines">
          <FileChurnChart files={data.fileDetails} />
        </ChartCard>
      </div>

      <div className="overview-columns">
        <section className="work-section">
          <SectionHeading title="Recent commits" description="Newest first · up to six shown">
            <button type="button" className="text-action" onClick={() => onOpenCommit(data.commits[0]?.sha ?? '')}>
              Open history <ArrowRight size={14} aria-hidden="true" />
            </button>
          </SectionHeading>
          <div className="commit-list compact-list">
            {recentCommits.length ? (
              recentCommits.map((commit) => (
                <button
                  type="button"
                  className="commit-row"
                  key={commit.sha}
                  onClick={() => onOpenCommit(commit.sha)}
                >
                  <span className="commit-marker" aria-hidden="true" />
                  <span className="commit-row-main">
                    <strong>{commitSubject(commit.message)}</strong>
                    <small>
                      {commit.author} · {dateTime(commit.date)}
                    </small>
                  </span>
                  <code>{commit.sha.slice(0, 7)}</code>
                </button>
              ))
            ) : (
              <EmptyState
                title="No commits found"
                detail="The repository has no commits in this analysis window."
              />
            )}
          </div>
        </section>

        <section className="work-section">
          <SectionHeading
            title="Highest-ranked files"
            description="Review-priority signals, not defect predictions"
          >
            <button
              type="button"
              className="text-action"
              onClick={() => onOpenFile(data.fileDetails[0]?.path ?? '')}
            >
              Investigate <ArrowRight size={14} aria-hidden="true" />
            </button>
          </SectionHeading>
          <div className="hotspot-list">
            {data.fileDetails.slice(0, 5).map((file) => (
              <button
                type="button"
                className="hotspot-row"
                key={file.path}
                onClick={() => onOpenFile(file.path)}
              >
                <code>{file.path}</code>
                <span>{file.changeCount ?? '—'} edits</span>
                <RiskScore score={file.score} label={file.label} />
              </button>
            ))}
            {!data.fileDetails.length && (
              <EmptyState
                title="No file history available"
                detail="No changed-file details were returned for this analysis."
              />
            )}
          </div>
        </section>
      </div>

      <section className="work-section table-section">
        <SectionHeading title="Changed files" description="Top files in the analyzed history">
          <span className="quiet-label">{data.fileDetails.length} ranked</span>
        </SectionHeading>
        <TableShell caption="Top changed files with edit counts, churn, risk score, and last observed change">
          <thead>
            <tr>
              <th scope="col">File path</th>
              <th scope="col">Changes</th>
              <th scope="col">Churn</th>
              <th scope="col">Risk</th>
              <th scope="col">Last observed</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((file) => (
              <tr
                key={file.path}
                onClick={() => onOpenFile(file.path)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenFile(file.path);
                  }
                }}
              >
                <td>
                  <code>{file.path}</code>
                </td>
                <td>{file.changeCount ?? '—'}</td>
                <td>{churnFor(file) === null ? '—' : `${churnFor(file)} lines`}</td>
                <td>
                  <RiskScore score={file.score} label={file.label} />
                </td>
                <td>{dateOnly(file.lastChanged)}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
        {!tableRows.length && (
          <EmptyState
            title="No changed files to rank"
            detail="GitHub did not return usable file history for the commits analyzed."
          />
        )}
      </section>
    </div>
  );
}
