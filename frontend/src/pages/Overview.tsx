import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Download,
  ExternalLink,
  GitBranch,
  GitFork,
  Info,
  Star,
} from 'lucide-react';
import type { CommitItem, RepoResponse } from '../types';
import {
  additionsDeletionsByCommit,
  churnFor,
  commitActivitySeries,
  commitSubject,
  commitsWithDetails,
  dateTime,
  formatCount,
  relativeTime,
} from '../lib/format';
import { exportAsCsv, exportAsJson, exportAsMarkdown, scoreTone } from '../lib/export';
import { Author, AuthorAvatar } from '../components/commit';
import { MetricTile, PageHeader, Panel, RiskScore, SeverityBadge, SourceLabel, DropdownMenu } from '../components/ui';
import { AdditionsDeletionsChart, ChartCard, CommitActivityChart } from '../components/Charts';

function RepositoryAvatar({ fullName }: { fullName: string }) {
  const owner = fullName.split('/')[0] ?? '';
  const [failed, setFailed] = useState(false);
  return (
    <span className="repository-avatar" aria-hidden="true">
      {owner && !failed ? (
        <img
          src={`https://github.com/${owner}.png?size=96`}
          alt=""
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <GitBranch size={19} aria-hidden="true" />
      )}
    </span>
  );
}

/* Compact feed row for the overview: absolute date + SHA chip. */
function FeedCommitRow({ commit, onClick }: { commit: CommitItem; onClick: () => void }) {
  return (
    <button type="button" className="commit-row" onClick={onClick} aria-label={`Open commit ${commit.sha.slice(0, 7)} in Time Machine`}>
      <span className="timeline-mark" aria-hidden="true" />
      <AuthorAvatar name={commit.author} login={commit.authorLogin} size="sm" />
      <span className="commit-main">
        <span className="commit-subject">{commitSubject(commit.message)}</span>
        <span className="commit-meta">
          <span>{commit.author}</span>
          <span className="dot" aria-hidden="true">·</span>
          <time dateTime={commit.date} title={dateTime(commit.date)}>{dateTime(commit.date)}</time>
          <span className="dot" aria-hidden="true">·</span>
          <code>{commit.sha.slice(0, 7)}</code>
        </span>
      </span>
      <span className="commit-side">
        <span className="status-chip"><ArrowUpRight size={11} aria-hidden="true" /></span>
      </span>
    </button>
  );
}

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
  const commitCount = data.commits.length;
  const detailCount = commitsWithDetails(data.commits).length;
  const filesObserved = data.summary.filesAnalyzed ?? data.fileDetails.length;
  const activity = commitActivitySeries(data.commits);
  const addDel = additionsDeletionsByCommit(data.commits);
  const timeRange = data.summary.timeRange;
  const highest = data.fileDetails[0] ?? null;
  const bots = data.contributors.filter(
    (contributor) => contributor.isBot || /\[bot\]$/i.test(contributor.login),
  );
  const churnTop = [...data.fileDetails]
    .map((file) => ({ name: file.path, value: (file.additions ?? 0) + (file.deletions ?? 0) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  return (
    <div className="page-body">
      <PageHeader
        eyebrow="Workbench · Analysis"
        title="Overview"
        description="What the analysis observed: recent history, code churn, and the files that deserve review first."
        actions={
          <>
            <SourceLabel source={data.source} />
            <DropdownMenu
              label="Export"
              icon={<Download size={13} aria-hidden="true" />}
              items={[
                { label: 'Export Markdown report', hint: '.md', onClick: () => exportAsMarkdown(data) },
                { label: 'Export ranked files', hint: '.csv', onClick: () => exportAsCsv(data) },
                { label: 'Export raw analysis', hint: '.json', onClick: () => exportAsJson(data) },
              ]}
            />
          </>
        }
      />

      {/* 1 — repository identity */}
      <section className="repo-hero">
        <div className="repo-hero-ident">
          <RepositoryAvatar fullName={data.repository.full_name} />
          <div className="repo-hero-title">
            <span className="repo-hero-name">
              <a href={data.repository.html_url} target="_blank" rel="noreferrer">
                {data.repository.full_name}
              </a>
              <ExternalLink size={13} aria-hidden="true" className="dim" />
            </span>
            {data.repository.description && <p className="repo-hero-desc">{data.repository.description}</p>}
            <div className="repo-hero-meta">
              <span className="meta-item">
                <GitBranch size={13} aria-hidden="true" />
                {data.repository.default_branch}
              </span>
              {data.repository.language && <span className="meta-item">{data.repository.language}</span>}
              {typeof data.repository.stars === 'number' && (
                <span className="meta-item">
                  <Star size={13} aria-hidden="true" />
                  {formatCount(data.repository.stars)}
                </span>
              )}
              {typeof data.repository.forks === 'number' && (
                <span className="meta-item">
                  <GitFork size={13} aria-hidden="true" />
                  {formatCount(data.repository.forks)}
                </span>
              )}
              {timeRange?.newest && (
                <span className="meta-item">
                  <Info size={13} aria-hidden="true" />
                  Newest commit {relativeTime(timeRange.newest)}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2 — the KPIs this window supports */}
      <div className="metric-grid">
        <MetricTile
          label="Commits retrieved"
          value={formatCount(commitCount)}
          sub={
            timeRange?.oldest && timeRange?.newest
              ? `Window ${timeRange.oldest.slice(0, 10)} → ${timeRange.newest.slice(0, 10)}`
              : undefined
          }
          tone="accent"
        />
        <MetricTile
          label="With file details"
          value={`${detailCount}/${commitCount}`}
          sub={
            detailCount === commitCount
              ? 'Full detail coverage for this window'
              : 'Partial detail coverage in this window'
          }
          tone={detailCount === commitCount ? 'success' : 'warning'}
        />
        <MetricTile
          label="Contributors observed"
          value={formatCount(data.contributors.length)}
          sub={bots.length ? `${bots.length} bot account${bots.length === 1 ? '' : 's'} identified` : 'No bot accounts observed'}
        />
        <MetricTile
          label="Files ranked"
          value={formatCount(data.fileDetails.length)}
          sub={`${formatCount(filesObserved)} distinct paths observed`}
        />
        <MetricTile
          label="Highest file score"
          value={highest ? highest.score : '—'}
          sub={highest ? highest.path : 'No files ranked'}
          tone={highest ? scoreTone(highest.score) : undefined}
          small={false}
        />
      </div>

      {/* 3 + 4 — the two big time-based visuals */}
      <div className="grid-12">
        <div className="col-7">
          <ChartCard
            title="Commit activity"
            description={
              activity.granularity === 'week'
                ? 'Commits per week in the analyzed window'
                : 'Commits per day in the analyzed window'
            }
            footnote={
              timeRange?.oldest && timeRange?.newest
                ? `Window: ${timeRange.oldest.slice(0, 10)} – ${timeRange.newest.slice(0, 10)} · only dated commits are charted`
                : 'Only dated commits are charted'
            }
          >
            <CommitActivityChart data={activity.points} granularity={activity.granularity} />
          </ChartCard>
        </div>
        <div className="col-5">
          <ChartCard
            title="Line flow per commit"
            description="Additions and deletions where GitHub returned statistics"
            footnote={
              addDel.length !== commitCount
                ? `Statistics returned for ${addDel.length} of ${commitCount} commits.`
                : undefined
            }
          >
            <AdditionsDeletionsChart data={addDel} />
          </ChartCard>
        </div>
      </div>

      {/* 5 + 6 — the two ranked lists */}
      <div className="split-2">
        <Panel
          kicker="History"
          title="Recent commits"
          sub="Newest first · up to six shown"
          bodyClassName="panel-body-flush"
          actions={
            <button type="button" className="text-action" onClick={() => onOpenCommit(data.commits[0]?.sha ?? '')}>
              Open history <ArrowRight size={14} aria-hidden="true" />
            </button>
          }
        >
          <div className="commit-list">
            {recentCommits.length ? (
              recentCommits.map((commit) => (
                <FeedCommitRow
                  key={commit.sha}
                  commit={commit}
                  onClick={() => onOpenCommit(commit.sha)}
                />
              ))
            ) : (
              <p className="inline-empty">The repository has no commits in this analysis window.</p>
            )}
          </div>
        </Panel>

        <Panel
          kicker="Investigation"
          title="Ranked file hotspots"
          sub="Review-priority signals, not defect predictions"
          bodyClassName="panel-body-flush"
          actions={
            <button type="button" className="text-action" onClick={() => onOpenFile(data.fileDetails[0]?.path ?? '')}>
              Investigate <ArrowRight size={14} aria-hidden="true" />
            </button>
          }
        >
          <div className="hotspot-list">
            {data.fileDetails.slice(0, 6).map((file, index) => (              <button type="button" className="hotspot-row" key={file.path} onClick={() => onOpenFile(file.path)}>
                <span className="hotspot-rank" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="hotspot-cell">
                  <code className="hotspot-path">{file.path.split('/').slice(-1)[0]}</code>
                  <span className="hotspot-sub">
                    {file.path.split('/').slice(0, -1).join('/') || 'root'} · {file.changeCount ?? '—'} edits ·{' '}
                    {churnTop.some((row) => row.name === file.path)
                      ? `${churnFor(file)} lines changed`
                      : `${file.additions ?? '—'}+/−${file.deletions ?? '—'}`}
                  </span>
                </span>
                <SeverityBadge label={file.label} />
                <RiskScore score={file.score} label={file.label} />
              </button>
            ))}
            {!data.fileDetails.length && (
              <p className="inline-empty">No changed-file details were returned for this analysis.</p>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid-12">
        <div className="col-8">
          <Panel
            kicker="Analysis coverage"
            title="What this analysis does and does not include"
            sub={data.summary.detailCoverage ? `Detail coverage: ${data.summary.detailCoverage}` : undefined}
          >
            <ul className="coverage-list">
              <li>
                <strong>Commit window:</strong> the newest {formatCount(commitCount)} commits reachable from{' '}
                {data.repository.default_branch} are analyzed. Commits beyond that were not fetched.
              </li>
              <li>
                <strong>File details:</strong> changed-file details were loaded for {detailCount} of{' '}
                {formatCount(commitCount)} commits{data.source === 'live' ? ' (the newest few are fetched eagerly)' : ''}.
                {addDel.length !== commitCount
                  ? ` Line statistics are available for ${addDel.length} of them.`
                  : ' Line statistics are available for all of them.'}
              </li>
              <li>
                <strong>File rankings:</strong> scores cover the {formatCount(data.fileDetails.length)} paths with
                observed history, of {formatCount(filesObserved)} distinct paths seen in loaded details.
              </li>
              <li>
                <strong>Scores:</strong> weighted heuristics over change frequency, churn, recency, and revert signals —
                not predictors of defects.
              </li>
            </ul>
          </Panel>
        </div>
        <div className="col-4">
          <Panel kicker="People" title="Observed contributors" sub="Commits per author in the window">
            <div className="contributor-mini">
              {data.contributors.slice(0, 5).map((contributor) => (
                <div className="mini-row" key={contributor.login}>
                  <Author
                    name={contributor.name || contributor.login}
                    login={contributor.login}
                    avatarSize="sm"
                    showBot
                  />
                  <span className="mini-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${Math.min(100, (contributor.commit_count / Math.max(1, data.contributors[0]?.commit_count ?? 1)) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="mini-value num">{contributor.commit_count}</span>
                </div>
              ))}
              {!data.contributors.length && <p className="inline-empty" style={{ margin: 0 }}>No contributor records were returned.</p>}
              {!bots.length && data.contributors.length > 0 && (
                <p className="quiet-label" style={{ margin: '8px 0 0' }}>
                  <Bot size={11} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> No bot accounts in this window
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
