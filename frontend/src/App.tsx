import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Braces,
  Clock3,
  GitBranch,
  GitCommitHorizontal,
  Github,
  Home,
  LoaderCircle,
  Menu,
  RotateCcw,
  Shield,
  Users,
  X,
} from 'lucide-react';

type FileChange = {
  path: string;
  additions: number;
  deletions: number;
  status: string;
  changes: number;
  commitSha?: string;
  commitMessage?: string;
  commitAuthor?: string;
  commitDate?: string;
  html_url?: string;
};

type CommitItem = {
  sha: string;
  message: string;
  author: string;
  authorLogin?: string | null;
  date: string;
  html_url: string;
  stats?: { total?: number; additions?: number; deletions?: number } | null;
  files?: FileChange[] | null;
  detailStatus?: 'available' | 'unavailable' | 'not-fetched';
};

type Contributor = {
  login: string;
  name: string;
  commit_count: number;
  recent_activity: string | null;
  files: string[];
};

type RiskFactor = { label: string; value: string; weight?: number };
type RiskEntry = {
  path: string;
  score: number;
  label: string;
  factors: RiskFactor[];
  additions?: number;
  deletions?: number;
  changeCount?: number;
  contributors?: string[];
  commits?: string[];
  lastChanged?: string;
  revertRelated?: boolean;
};

type RepoResponse = {
  source: 'live' | 'demo';
  repository: {
    name: string;
    full_name: string;
    description: string;
    default_branch: string;
    stars: number | null;
    forks: number | null;
    html_url: string;
    last_updated: string | null;
  };
  commits: CommitItem[];
  contributors: Contributor[];
  risk: RiskEntry[];
  fileDetails: RiskEntry[];
  summary: {
    commitCount: number;
    contributorCount: number;
    filesAnalyzed?: number;
    detailCoverage?: string;
    highestRiskFile: string | null;
    timeRange: { oldest: string | null; newest: string | null } | null;
  };
  story?: { steps: string[] };
};

const navigation = [
  { label: 'Overview', icon: Home },
  { label: 'Risk Radar', icon: Shield },
  { label: 'Time Machine', icon: GitCommitHorizontal },
  { label: 'Contributors', icon: Users },
  { label: 'Story Mode', icon: BookOpen },
];

const dateTime = (value?: string | null) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const dateOnly = (value?: string | null) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
};

const churnFor = (entry: Pick<RiskEntry, 'additions' | 'deletions'>) => {
  if (entry.additions === undefined || entry.deletions === undefined) return null;
  return entry.additions + entry.deletions;
};

function SourceLabel({ source }: { source: 'live' | 'demo' }) {
  return (
    <span className={`source-label ${source === 'live' ? 'source-live' : 'source-demo'}`}>
      <span className="source-dot" />
      {source === 'live' ? 'Live GitHub data' : 'Demo data'}
    </span>
  );
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <header className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {description && <p className="page-description">{description}</p>}
    </header>
  );
}

function RiskScore({ score }: { score: number }) {
  const tone = score >= 80 ? 'risk-high' : score >= 55 ? 'risk-medium' : 'risk-low';
  return (
    <span className={`risk-score ${tone}`}>
      <span className="risk-track"><span style={{ width: `${Math.min(100, Math.max(0, score))}%` }} /></span>
      <span className="risk-number">{score}</span>
    </span>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <Braces size={19} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState('Overview');
  const [repoUrl, setRepoUrl] = useState('');
  const [data, setData] = useState<RepoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [detailError, setDetailError] = useState('');
  const [authorFilter, setAuthorFilter] = useState('all');
  const [storyStep, setStoryStep] = useState(0);

  const setDataset = (next: RepoResponse) => {
    setData(next);
    setSelectedFilePath(next.fileDetails[0]?.path ?? null);
    setSelectedSha(next.commits[0]?.sha ?? null);
    setAuthorFilter('all');
    setStoryStep(0);
    setError('');
    setDetailError('');
  };

  const loadDemo = async () => {
    setLoading(true);
    setAnalyzing(false);
    setError('');
    setData(null);
    try {
      const response = await fetch('/api/demo');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Unable to load demo data.');
      setDataset(payload as RepoResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load demo data.');
    } finally {
      setLoading(false);
    }
  };

  const analyzeRepository = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUrl = repoUrl.trim();
    if (!trimmedUrl) {
      setError('Enter a public GitHub repository URL to analyze.');
      return;
    }

    setAnalyzing(true);
    setLoading(true);
    setData(null);
    setSelectedFilePath(null);
    setSelectedSha(null);
    setError('');
    setDetailError('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: trimmedUrl }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Repository analysis failed.');
      setDataset(payload as RepoResponse);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Repository analysis failed.');
    } finally {
      setAnalyzing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDemo();
  }, []);

  const currentCommit = useMemo(
    () => data?.commits.find((commit) => commit.sha === selectedSha) ?? data?.commits[0] ?? null,
    [data, selectedSha],
  );
  const selectedFile = useMemo(
    () => data?.fileDetails.find((file) => file.path === selectedFilePath) ?? data?.fileDetails[0] ?? null,
    [data, selectedFilePath],
  );

  useEffect(() => {
    if (!data || data.source !== 'live' || !currentCommit || currentCommit.detailStatus !== 'not-fetched') return;
    let cancelled = false;
    setDetailLoading(currentCommit.sha);
    setDetailError('');
    void fetch('/api/commit-detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: data.repository.html_url, sha: currentCommit.sha }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Could not retrieve commit details.');
        if (cancelled) return;
        setData((previous) => previous ? {
          ...previous,
          commits: previous.commits.map((commit) => commit.sha === currentCommit.sha
            ? { ...commit, files: payload.files, stats: payload.stats, detailStatus: payload.detailStatus }
            : commit),
        } : previous);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setDetailError(loadError instanceof Error ? loadError.message : 'Could not retrieve commit details.');
        setData((previous) => previous ? {
          ...previous,
          commits: previous.commits.map((commit) => commit.sha === currentCommit.sha
            ? { ...commit, detailStatus: 'unavailable' }
            : commit),
        } : previous);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(null);
      });
    return () => { cancelled = true; };
  }, [currentCommit, data?.repository.html_url, data?.source]);

  const authorOptions = useMemo(() => {
    const authors = new Set((data?.commits ?? []).map((commit) => commit.author).filter(Boolean));
    return [...authors];
  }, [data]);

  const visibleCommits = useMemo(
    () => (data?.commits ?? []).filter((commit) => authorFilter === 'all' || commit.author === authorFilter),
    [authorFilter, data],
  );

  const selectedSupportCommits = useMemo(() => {
    if (!data || !selectedFile) return [];
    const commitSet = new Set(selectedFile.commits ?? []);
    return data.commits.filter((commit) => commitSet.has(commit.sha));
  }, [data, selectedFile]);

  const collaborationRows = useMemo(() => {
    if (!data) return [];
    const rows: Array<{ left: string; right: string; files: string[] }> = [];
    for (let i = 0; i < data.contributors.length; i += 1) {
      for (let j = i + 1; j < data.contributors.length; j += 1) {
        const left = data.contributors[i];
        const right = data.contributors[j];
        const shared = left.files.filter((file) => right.files.includes(file));
        if (shared.length) rows.push({ left: left.name || left.login, right: right.name || right.login, files: shared });
      }
    }
    return rows;
  }, [data]);

  const openStoryStep = (index: number) => {
    setStoryStep(index);
    if (index === 0) setActivePage('Overview');
    if (index === 1 || index === 3) setActivePage('Time Machine');
    if (index === 2 || index === 4) setActivePage('Risk Radar');
  };

  const renderOverview = () => {
    if (!data) return null;
    const mostRecent = data.commits.slice(0, 6);
    const tableRows = data.fileDetails.slice(0, 8);
    const highest = data.fileDetails[0];
    const commitCount = data.summary.commitCount ?? data.commits.length;
    return (
      <div className="workspace-page">
        <PageHeading eyebrow="Repository intelligence" title="Overview" description="Recent history, observed code churn, and files to investigate." />

        <section className="repo-summary">
          <div className="repo-ident">
            <span className="repo-avatar"><Github size={17} /></span>
            <div className="repo-title">
              <a href={data.repository.html_url} target="_blank" rel="noreferrer">
                {data.repository.full_name}<ArrowUpRight size={14} />
              </a>
              <p>{data.repository.description || 'No repository description provided.'}</p>
            </div>
          </div>
          <div className="repo-metadata">
            <span><GitBranch size={14} /> {data.repository.default_branch}</span>
            <span>{data.summary.detailCoverage || `${commitCount} commits in analysis window`}</span>
            <SourceLabel source={data.source} />
          </div>
        </section>

        <section className="metric-strip" aria-label="Repository metrics">
          <div className="metric-cell"><span>Commits analyzed</span><strong>{commitCount}</strong></div>
          <div className="metric-cell"><span>Contributors observed</span><strong>{data.contributors.length}</strong></div>
          <div className="metric-cell"><span>Files analyzed</span><strong>{data.summary.filesAnalyzed ?? data.fileDetails.length}</strong></div>
          <div className="metric-cell"><span>Highest file score</span><strong className={highest ? 'metric-risk' : ''}>{highest?.score ?? '—'}</strong></div>
        </section>

        <div className="overview-columns">
          <section className="work-section">
            <div className="section-heading">
              <div><h2>Recent commits</h2><p>Newest first · up to six shown</p></div>
              <button className="text-action" onClick={() => setActivePage('Time Machine')}>Open history <ArrowRight size={14} /></button>
            </div>
            <div className="commit-list compact-list">
              {mostRecent.length ? mostRecent.map((commit) => (
                <button className="commit-row" key={commit.sha} onClick={() => { setSelectedSha(commit.sha); setActivePage('Time Machine'); }}>
                  <span className="commit-marker" />
                  <span className="commit-row-main">
                    <strong>{commit.message.split('\n')[0]}</strong>
                    <small>{commit.author} · {dateTime(commit.date)}</small>
                  </span>
                  <code>{commit.sha.slice(0, 7)}</code>
                </button>
              )) : <EmptyState title="No commits found" detail="The repository has no commits in this analysis window." />}
            </div>
          </section>

          <section className="work-section">
            <div className="section-heading">
              <div><h2>Highest-ranked files</h2><p>Heuristic signals, not defect predictions</p></div>
              <button className="text-action" onClick={() => setActivePage('Risk Radar')}>Investigate <ArrowRight size={14} /></button>
            </div>
            <div className="hotspot-list">
              {data.fileDetails.slice(0, 5).map((file) => (
                <button className="hotspot-row" key={file.path} onClick={() => { setSelectedFilePath(file.path); setActivePage('Risk Radar'); }}>
                  <code>{file.path}</code>
                  <span>{file.changeCount ?? '—'} edits</span>
                  <RiskScore score={file.score} />
                </button>
              ))}
              {!data.fileDetails.length && <EmptyState title="No file history available" detail="No changed-file details were returned for this analysis." />}
            </div>
          </section>
        </div>

        <section className="work-section table-section">
          <div className="section-heading">
            <div><h2>Changed files</h2><p>Top files in the analyzed history</p></div>
            <span className="quiet-label">{data.fileDetails.length} ranked</span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>File path</th><th>Changes</th><th>Churn</th><th>Risk</th><th>Last observed</th></tr></thead>
              <tbody>
                {tableRows.map((file) => (
                  <tr key={file.path} onClick={() => { setSelectedFilePath(file.path); setActivePage('Risk Radar'); }} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') { setSelectedFilePath(file.path); setActivePage('Risk Radar'); } }}>
                    <td><code>{file.path}</code></td>
                    <td>{file.changeCount ?? '—'}</td>
                    <td>{churnFor(file) ?? 'Unavailable'}</td>
                    <td><RiskScore score={file.score} /></td>
                    <td>{dateOnly(file.lastChanged)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!tableRows.length && <EmptyState title="No changed files to rank" detail="GitHub did not return usable file history for the commits analyzed." />}
          </div>
        </section>
      </div>
    );
  };

  const renderRiskRadar = () => {
    if (!data) return null;
    return (
      <div className="workspace-page">
        <PageHeading eyebrow="File investigation" title="Risk Radar" description="Ranked by observed edit frequency, line churn, recency, and revert-related commit messages." />
        <div className="method-note"><Shield size={15} /><span>Heuristic score from 0–100. This is a review-priority signal, not a probability that a file contains a bug.</span></div>
        <div className="risk-layout">
          <section className="work-section risk-table-section">
            <div className="section-heading"><div><h2>Ranked files</h2><p>{data.fileDetails.length} files with observed history</p></div></div>
            <div className="table-scroll">
              <table className="data-table risk-table">
                <thead><tr><th>File</th><th>Score</th><th>Changes</th><th>Churn</th><th>Last changed</th></tr></thead>
                <tbody>
                  {data.fileDetails.map((file) => (
                    <tr key={file.path} className={file.path === selectedFile?.path ? 'row-selected' : ''} onClick={() => setSelectedFilePath(file.path)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') setSelectedFilePath(file.path); }}>
                      <td><code>{file.path}</code></td>
                      <td><RiskScore score={file.score} /></td>
                      <td>{file.changeCount ?? '—'}</td>
                      <td>{churnFor(file) ?? 'Unavailable'}</td>
                      <td>{dateOnly(file.lastChanged)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.fileDetails.length && <EmptyState title="File data unavailable" detail="The analyzed commits did not provide changed-file details, so no files can be ranked." />}
            </div>
          </section>

          <aside className="detail-panel">
            {selectedFile ? (
              <>
                <div className="detail-heading">
                  <div><p className="eyebrow">Selected file</p><h2>{selectedFile.path}</h2></div>
                  <RiskScore score={selectedFile.score} />
                </div>
                <p className="detail-explainer">
                  Ranked {selectedFile.label.toLowerCase()} because it has {selectedFile.changeCount ?? 'an unavailable number of'} observed edits and {churnFor(selectedFile) === null ? 'unavailable churn data' : `${churnFor(selectedFile)} lines of churn`}.
                  {selectedFile.revertRelated ? ' A revert-related commit message is also present in its evidence.' : ''}
                  {' '}This highlights where to review; it does not establish a defect.
                </p>
                <dl className="factor-list">
                  {selectedFile.factors.map((factor) => (
                    <div key={factor.label}><dt>{factor.label}</dt><dd>{factor.value}</dd></div>
                  ))}
                </dl>
                <div className="detail-stats">
                  <span><b>{selectedFile.additions ?? '—'}</b> additions</span>
                  <span><b>{selectedFile.deletions ?? '—'}</b> deletions</span>
                  <span><b>{selectedFile.contributors?.length ?? '—'}</b> observed authors</span>
                </div>
                <div className="evidence-heading"><h3>Supporting commits</h3><span>{selectedSupportCommits.length}</span></div>
                <div className="evidence-list">
                  {selectedSupportCommits.map((commit) => {
                    const fileChange = commit.files?.find((file) => file.path === selectedFile.path);
                    return (
                      <div className="evidence-row" key={commit.sha}>
                        <div className="evidence-title">
                          <a href={commit.html_url} target="_blank" rel="noreferrer">{commit.sha.slice(0, 7)} <ArrowUpRight size={12} /></a>
                          <span>{dateOnly(commit.date)}</span>
                        </div>
                        <p>{commit.message.split('\n')[0]}</p>
                        <small>{commit.author}{fileChange ? ` · ${fileChange.status} · +${fileChange.additions}/-${fileChange.deletions}` : ''}</small>
                      </div>
                    );
                  })}
                  {!selectedSupportCommits.length && <p className="inline-empty">Supporting commit records are unavailable for this file.</p>}
                </div>
                <div className="next-step"><strong>Suggested next check</strong><p>Review this file alongside the listed commits, paying attention to the latest edit and adjacent code paths.</p></div>
              </>
            ) : (
              <EmptyState title="Select a file" detail="Choose a ranked file to inspect its score and supporting commit evidence." />
            )}
          </aside>
        </div>
      </div>
    );
  };

  const renderTimeMachine = () => {
    if (!data) return null;
    return (
      <div className="workspace-page">
        <PageHeading eyebrow="History browser" title="Time Machine" description="Browse the analyzed commit window and inspect available changed-file details." />
        <div className="history-toolbar">
          <label htmlFor="author-filter">Author</label>
          <select id="author-filter" value={authorFilter} onChange={(event) => setAuthorFilter(event.target.value)}>
            <option value="all">All authors</option>
            {authorOptions.map((author) => <option key={author} value={author}>{author}</option>)}
          </select>
          <span className="quiet-label">{visibleCommits.length} of {data.commits.length} commits</span>
        </div>
        <div className="history-layout">
          <section className="work-section history-list">
            <div className="section-heading"><div><h2>Commit history</h2><p>Newest first</p></div></div>
            <div className="commit-browser">
              {visibleCommits.map((commit) => (
                <button key={commit.sha} className={`history-row ${currentCommit?.sha === commit.sha ? 'row-selected' : ''}`} onClick={() => { setSelectedSha(commit.sha); setDetailError(''); }}>
                  <span className="timeline-mark" />
                  <span className="history-main">
                    <strong>{commit.message.split('\n')[0]}</strong>
                    <small>{commit.author} · {dateTime(commit.date)}</small>
                  </span>
                  <span className="history-meta"><code>{commit.sha.slice(0, 7)}</code><small>{commit.files ? `${commit.files.length} files` : 'Details pending'}</small></span>
                </button>
              ))}
              {!visibleCommits.length && <EmptyState title="No commits for this author" detail="Choose another author or show all commits." />}
            </div>
          </section>

          <section className="work-section commit-inspector">
            {currentCommit ? (
              <>
                <div className="section-heading commit-detail-title">
                  <div><p className="eyebrow">Commit {currentCommit.sha.slice(0, 12)}</p><h2>{currentCommit.message.split('\n')[0]}</h2></div>
                  <a className="quiet-link" href={currentCommit.html_url} target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={13} /></a>
                </div>
                <div className="commit-metadata">
                  <span><Users size={14} /> {currentCommit.author}</span>
                  <span><Clock3 size={14} /> {dateTime(currentCommit.date)}</span>
                  <span><code>{currentCommit.sha}</code></span>
                </div>
                {currentCommit.stats ? (
                  <div className="change-summary"><span>{currentCommit.stats.additions ?? '—'} additions</span><span>{currentCommit.stats.deletions ?? '—'} deletions</span><span>{currentCommit.files?.length ?? '—'} changed files</span></div>
                ) : <p className="inline-empty">Line statistics are unavailable for this commit.</p>}
                {detailLoading === currentCommit.sha && <p className="detail-loading"><LoaderCircle size={15} className="spin" /> Loading commit file details…</p>}
                {detailError && <p className="inline-error"><AlertTriangle size={14} /> {detailError}</p>}
                {currentCommit.files ? (
                  <div className="table-scroll commit-files-scroll">
                    <table className="data-table commit-files-table">
                      <thead><tr><th>Changed file</th><th>Status</th><th>Diffstat</th></tr></thead>
                      <tbody>
                        {currentCommit.files.map((file) => (
                          <tr key={file.path}><td><code>{file.path}</code></td><td>{file.status}</td><td><span className="addition">+{file.additions}</span> / <span className="deletion">-{file.deletions}</span></td></tr>
                        ))}
                      </tbody>
                    </table>
                    {!currentCommit.files.length && <EmptyState title="No changed files returned" detail="GitHub did not return a file list for this commit." />}
                  </div>
                ) : currentCommit.detailStatus === 'unavailable' ? (
                  <EmptyState title="Commit details unavailable" detail="GitHub did not provide the changed-file list for this commit." />
                ) : currentCommit.detailStatus === 'not-fetched' ? (
                  <p className="inline-empty">Detailed file changes have not been loaded for this commit.</p>
                ) : (
                  <EmptyState title="No file detail" detail="This commit has no available changed-file metadata." />
                )}
              </>
            ) : <EmptyState title="No commit selected" detail="Select a commit in the history list to inspect its metadata." />}
          </section>
        </div>
      </div>
    );
  };

  const renderContributors = () => {
    if (!data) return null;
    return (
      <div className="workspace-page">
        <PageHeading eyebrow="People and ownership" title="Contributors" description="Authors and shared file paths observed in this repository history." />
        <section className="work-section">
          <div className="section-heading"><div><h2>Observed contributors</h2><p>Counts cover the commit window; file lists come from commits with loaded details.</p></div><span className="quiet-label">{data.contributors.length} contributors</span></div>
          <div className="table-scroll">
            <table className="data-table contributor-table">
              <thead><tr><th>Author</th><th>Commits observed</th><th>Last activity</th><th>Files in detailed commits</th></tr></thead>
              <tbody>
                {data.contributors.map((contributor) => (
                  <tr key={contributor.login}>
                    <td><span className="author-cell"><span className="author-avatar">{(contributor.name || contributor.login || '?').slice(0, 1).toUpperCase()}</span>{contributor.name || contributor.login}</span></td>
                    <td>{contributor.commit_count}</td>
                    <td>{dateTime(contributor.recent_activity)}</td>
                    <td>{contributor.files.length ? <div className="file-tags">{contributor.files.slice(0, 4).map((file) => <code key={file}>{file}</code>)}{contributor.files.length > 4 && <span>+{contributor.files.length - 4} more</span>}</div> : 'No file details observed'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.contributors.length && <EmptyState title="Contributor data unavailable" detail="No contributor records were returned for this repository." />}
          </div>
        </section>

        <section className="work-section shared-work">
          <div className="section-heading"><div><h2>Shared file ownership</h2><p>Connections indicate contributors observed modifying the same file paths.</p></div></div>
          {collaborationRows.length ? (
            <div className="shared-list">
              {collaborationRows.map((row) => (
                <div className="shared-row" key={`${row.left}-${row.right}-${row.files.join('|')}`}>
                  <span>{row.left}</span><span className="shared-link">worked on</span><code>{row.files.join(', ')}</code><span className="shared-link">with</span><span>{row.right}</span>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No shared files observed" detail="No pair of contributors in the analyzed data modified the same reported file." />}
        </section>
        <p className="data-caveat">File lists are based on the commits whose details were loaded. Commit counts describe observed repository history only; they are not a measure of productivity, skill, or contribution quality.</p>
      </div>
    );
  };

  const renderStory = () => {
    if (!data) return null;
    const steps = [
      { title: 'Repository context', page: 'Overview' },
      { title: 'Historical activity', page: 'Time Machine' },
      { title: 'A high-ranked file', page: 'Risk Radar' },
      { title: 'Evidence in commits', page: 'Time Machine' },
      { title: 'Suggested investigation', page: 'Risk Radar' },
    ];
    const riskFile = data.fileDetails[0] ?? null;
    const evidence = riskFile ? data.commits.filter((commit) => riskFile.commits?.includes(commit.sha)) : [];
    const latest = data.commits[0] ?? null;
    const selectedStep = steps[storyStep];
    const contentByStep = [
      <p key="context">This view uses <strong>{data.repository.full_name}</strong> ({data.source === 'live' ? 'live GitHub data' : 'the prepared demo fixture'}). The current analysis contains <strong>{data.summary.commitCount}</strong> commits, <strong>{data.contributors.length}</strong> observed contributors, and <strong>{data.summary.filesAnalyzed ?? data.fileDetails.length}</strong> ranked files.</p>,
      latest
        ? <p key="history">The newest commit in this window is <strong>{latest.message.split('\\n')[0]}</strong> by {latest.author} on {dateTime(latest.date)}. The analysis window includes {data.commits.length} commits.</p>
        : <p key="history">There are no commits available in this analysis, so recent repository activity cannot be presented.</p>,
      riskFile
        ? <p key="risk"><code>{riskFile.path}</code> is the highest-ranked file with a heuristic score of <strong>{riskFile.score}/100</strong>, {riskFile.changeCount} observed edits, and {churnFor(riskFile) ?? 'unavailable'} lines of churn. This is a review lead, not evidence of a confirmed bug.</p>
        : <p key="risk">No file details were returned, so RepoRadar cannot select a highest-ranked file for this step.</p>,
      evidence.length
        ? <p key="evidence">{evidence.length} commit(s) are associated with <code>{riskFile?.path}</code>: {evidence.map((commit) => `${commit.sha.slice(0, 7)} (${dateOnly(commit.date)})`).join(', ')}. Select the step to inspect their actual file details when available.</p>
        : <p key="evidence">No supporting commit references are available for a ranked file in this dataset.</p>,
      riskFile
        ? <p key="next">A reasonable next investigation is to inspect <code>{riskFile.path}</code> and compare its changes across {evidence.length} supporting commits. Start with the latest dated evidence; this is a suggested workflow, not a claim about the cause or existence of a defect.</p>
        : <p key="next">Without changed-file history, a specific investigation target cannot be recommended from this analysis.</p>,
    ];
    return (
      <div className="workspace-page story-page">
        <PageHeading eyebrow="Guided investigation" title="Story Mode" description="A short, data-grounded walkthrough for a project review." />
        <section className="story-workspace">
          <div className="story-progress" aria-label={`Step ${storyStep + 1} of ${steps.length}`}>
            {steps.map((step, index) => (
              <button key={step.title} className={`story-step ${index === storyStep ? 'story-step-active' : ''} ${index < storyStep ? 'story-step-done' : ''}`} onClick={() => openStoryStep(index)}>
                <span>{String(index + 1).padStart(2, '0')}</span>{step.title}
              </button>
            ))}
          </div>
          <article className="story-content">
            <div className="story-topline"><span>Step {storyStep + 1} / {steps.length}</span><span>{data.repository.full_name}</span></div>
            <h2>{selectedStep.title}</h2>
            <div className="story-copy">{contentByStep[storyStep]}</div>
            {storyStep === 2 && riskFile && <button className="text-action" onClick={() => { setSelectedFilePath(riskFile.path); setActivePage('Risk Radar'); }}>Open file evidence <ArrowRight size={14} /></button>}
            {storyStep === 3 && evidence[0] && <button className="text-action" onClick={() => { setSelectedSha(evidence[0].sha); setActivePage('Time Machine'); }}>Inspect supporting commit <ArrowRight size={14} /></button>}
            <div className="story-controls">
              <button className="button-muted" disabled={storyStep === 0} onClick={() => openStoryStep(Math.max(0, storyStep - 1))}><ArrowLeft size={14} /> Back</button>
              <button className="button-muted" onClick={() => openStoryStep(0)}><RotateCcw size={14} /> Restart</button>
              <button className="button-strong" disabled={storyStep === steps.length - 1} onClick={() => openStoryStep(Math.min(steps.length - 1, storyStep + 1))}>Next <ArrowRight size={14} /></button>
            </div>
          </article>
        </section>
      </div>
    );
  };

  const pageContent = activePage === 'Overview'
    ? renderOverview()
    : activePage === 'Risk Radar'
      ? renderRiskRadar()
      : activePage === 'Time Machine'
        ? renderTimeMachine()
        : activePage === 'Contributors'
          ? renderContributors()
          : renderStory();

  const sidebar = (
    <>
      <div className="brand-lockup">
        <span className="brand-symbol"><Activity size={18} /></span>
        <span>RepoRadar<small>Repository intelligence</small></span>
      </div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="sidebar-nav" aria-label="Workspace pages">
        {navigation.map(({ label, icon: Icon }) => (
          <button key={label} className={`nav-item ${activePage === label ? 'nav-item-active' : ''}`} aria-current={activePage === label ? 'page' : undefined} onClick={() => { setActivePage(label); setMenuOpen(false); }}>
            <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-repo-label">CURRENT REPOSITORY</div>
        {data ? <><strong>{data.repository.full_name}</strong><SourceLabel source={data.source} /></> : <span className="quiet-label">No repository selected</span>}
        <button className="sidebar-demo-button" onClick={() => { void loadDemo(); setMenuOpen(false); }}>Load demo repository</button>
      </div>
    </>
  );

  return (
    <div className="app-frame">
      <aside className="desktop-sidebar">{sidebar}</aside>
      {menuOpen && (
        <div className="mobile-menu-backdrop" onClick={() => setMenuOpen(false)}>
          <aside className="mobile-sidebar" onClick={(event) => event.stopPropagation()}>
            <button className="mobile-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={18} /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={19} /></button>
          <div className="topbar-repo">
            <span className="topbar-kicker">REPOSITORY</span>
            <strong>{data?.repository.full_name ?? 'Select a repository'}</strong>
          </div>
          {data && <a className="topbar-github" href={data.repository.html_url} target="_blank" rel="noreferrer">View on GitHub <ArrowUpRight size={13} /></a>}
          <form className="repo-form" onSubmit={analyzeRepository}>
            <label className="sr-only" htmlFor="repository-url">GitHub repository URL</label>
            <input id="repository-url" value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="github.com/owner/repository" />
            <button type="submit" disabled={analyzing}>{analyzing ? <LoaderCircle className="spin" size={14} /> : null}{analyzing ? 'Analyzing' : 'Analyze'}</button>
          </form>
        </header>
        <main className="main-content">
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={16} /><span>{error}</span>
              <button onClick={() => void loadDemo()}>Switch to demo data</button>
            </div>
          )}
          {loading ? (
            <div className="loading-state"><LoaderCircle className="spin" size={19} /><span>{analyzing ? 'Analyzing repository history…' : 'Loading repository data…'}</span></div>
          ) : data ? pageContent : (
            <div className="no-repository">
              <Github size={26} />
              <h1>Choose a repository to begin</h1>
              <p>Paste a public GitHub repository URL above. Repository data stays separate from the prepared demo dataset.</p>
              <button className="button-muted" onClick={() => void loadDemo()}>Load demo data</button>
            </div>
          )}
        </main>
        <footer className="app-footer"><span>RepoRadar</span><span>Risk scores are heuristic signals, not defect predictions.</span></footer>
      </div>
    </div>
  );
}

export default App;
