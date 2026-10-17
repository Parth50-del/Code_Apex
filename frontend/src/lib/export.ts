import type { RepoResponse } from '../types';
import { churnFor, RISK_HIGH_THRESHOLD, RISK_MEDIUM_THRESHOLD } from '../lib/format';

/**
 * Export builders produce plain-text snapshots of the analysis that is
 * currently loaded. Nothing is invented: every line comes from the payload.
 */

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function download(filename: string, mime: string, text: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.replace(/[^\w.-]+/g, '_');
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportAsMarkdown(data: RepoResponse) {
  const { repository, commits, contributors, fileDetails, summary } = data;
  const lines: string[] = [];
  lines.push(`# RepoRadar analysis — ${repository.full_name}`);
  lines.push('');
  lines.push(`- Source: ${data.source === 'live' ? 'live GitHub data' : 'demo dataset'}`);
  if (repository.description) lines.push(`- Description: ${repository.description}`);
  if (repository.language) lines.push(`- Language: ${repository.language}`);
  if (repository.default_branch) lines.push(`- Default branch: ${repository.default_branch}`);
  if (summary.timeRange?.oldest && summary.timeRange?.newest) {
    lines.push(`- Analyzed window: ${summary.timeRange.oldest.slice(0, 10)} → ${summary.timeRange.newest.slice(0, 10)}`);
  }
  lines.push(`- Commits retrieved: ${summary.commitCount}`);
  if (summary.detailCoverage) lines.push(`- Detail coverage: ${summary.detailCoverage}`);
  lines.push(`- Contributors observed: ${summary.contributorCount}`);
  lines.push(`- Files ranked: ${fileDetails.length}${summary.filesAnalyzed ? ` of ${summary.filesAnalyzed} distinct paths observed` : ''}`);
  lines.push('');
  lines.push('> Risk scores are review-priority heuristics (change frequency, churn, recency, revert signals), not defect predictions.');

  if (fileDetails.length) {
    lines.push('');
    lines.push('## Ranked files');
    lines.push('');
    lines.push('| Path | Score | Severity | Changes | Churn | Last changed |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const file of fileDetails) {
      const churn = churnFor(file);
      lines.push(
        `| \`${file.path}\` | ${file.score} | ${file.label} | ${file.changeCount ?? '—'} | ${churn ?? '—'} | ${file.lastChanged ? file.lastChanged.slice(0, 10) : '—'} |`,
      );
    }
  }

  if (contributors.length) {
    lines.push('');
    lines.push('## Contributors (observed in this window)');
    lines.push('');
    lines.push('| Author | Commits | Bot | Last activity |');
    lines.push('| --- | --- | --- | --- |');
    for (const contributor of contributors) {
      const bot = contributor.isBot || /\[bot\]$/i.test(contributor.login) ? 'yes' : 'no';
      lines.push(`| ${contributor.name || contributor.login} | ${contributor.commit_count} | ${bot} | ${contributor.recent_activity ? contributor.recent_activity.slice(0, 10) : '—'} |`);
    }
    lines.push('');
    lines.push('Commit counts describe observed history only; they are not a productivity measure.');
  }

  if (commits.length) {
    lines.push('');
    lines.push('## Recent commits');
    lines.push('');
    for (const commit of commits.slice(0, 20)) {
      const subject = commit.message.split('\n')[0]?.trim() || 'Untitled commit';
      const stats =
        commit.stats && typeof commit.stats.additions === 'number'
          ? ` (+${commit.stats.additions}/−${commit.stats.deletions})`
          : '';
      lines.push(`- \`${commit.sha.slice(0, 7)}\` ${subject}${stats} — ${commit.author}, ${commit.date.slice(0, 10)}`);
    }
    if (commits.length > 20) {
      lines.push(`- … and ${commits.length - 20} more commits in the analysis window`);
    }
  }

  download(`${repository.full_name.replace('/', '-')}-reporadar-${stamp()}.md`, 'text/markdown', lines.join('\n'));
}

export function exportAsCsv(data: RepoResponse) {
  const escape = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = 'path,score,severity,changes,additions,deletions,churn,last_changed,revert_related';
  const rows = data.fileDetails.map((file) => {
    const churn = churnFor(file);
    return [
      file.path,
      file.score,
      file.label,
      file.changeCount ?? '',
      file.additions ?? '',
      file.deletions ?? '',
      churn ?? '',
      file.lastChanged?.slice(0, 10) ?? '',
      file.revertRelated ? 'yes' : 'no',
    ]
      .map(escape)
      .join(',');
  });
  const text = [header, ...rows].join('\n');
  download(`${data.repository.full_name.replace('/', '-')}-files-${stamp()}.csv`, 'text/csv', text);
}

export function exportAsJson(data: RepoResponse) {
  // Pass through the exact payload the application analyzed; no reshaping,
  // no fabricated numbers.
  const text = JSON.stringify(
    { exportedAt: new Date().toISOString(), application: 'RepoRadar', analysis: data },
    null,
    2,
  );
  download(`${data.repository.full_name.replace('/', '-')}-analysis-${stamp()}.json`, 'application/json', text);
}

/** Small helper reused on dashboards to tint the highest score. */
export function scoreTone(score: number): 'accent' | 'danger' | 'warning' {
  if (score >= RISK_HIGH_THRESHOLD) return 'danger';
  if (score >= RISK_MEDIUM_THRESHOLD) return 'warning';
  return 'accent';
}
