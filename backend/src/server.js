import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

dotenv.config({ path: '../.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3001);
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));

const DEMO_DATA = {
  source: 'demo',
  repository: {
    id: 1,
    full_name: 'demo/reporadar-sample',
    name: 'reporadar-sample',
    description: 'A sample project used to demonstrate RepoRadar heuristics and historical analysis.',
    default_branch: 'main',
    html_url: 'https://github.com/demo/reporadar-sample',
    stargazers_count: 482,
    forks_count: 71,
    open_issues_count: 18,
    size: 214,
    created_at: '2023-01-17T10:00:00Z',
    updated_at: '2025-10-01T15:30:00Z',
  },
  commits: [
    { sha: 'abc1231', message: 'Add risk-scoring service and file ranking', author: 'Ava Chen', date: '2025-09-30T09:15:00Z', html_url: 'https://github.com/demo/reporadar-sample/commit/abc1231', stats: { total: 177, additions: 112, deletions: 65 }, files: [{ path: 'src/services/risk-scoring.ts', status: 'modified', additions: 92, deletions: 50 }, { path: 'src/components/RiskRadar.tsx', status: 'modified', additions: 20, deletions: 15 }] },
    { sha: 'abc1232', message: 'Refactor commit timeline and author filters', author: 'Liam Patel', date: '2025-09-28T13:45:00Z', html_url: 'https://github.com/demo/reporadar-sample/commit/abc1232', stats: { total: 118, additions: 61, deletions: 57 }, files: [{ path: 'src/api/github.ts', status: 'modified', additions: 30, deletions: 25 }, { path: 'src/components/Timeline.tsx', status: 'modified', additions: 31, deletions: 32 }] },
    { sha: 'abc1233', message: 'Fix regression in risk parser for large diffs', author: 'Noah Kim', date: '2025-09-20T11:02:00Z', html_url: 'https://github.com/demo/reporadar-sample/commit/abc1233', stats: { total: 97, additions: 44, deletions: 53 }, files: [{ path: 'src/services/risk-scoring.ts', status: 'modified', additions: 44, deletions: 53 }] },
    { sha: 'abc1234', message: 'Normalize contributor graph and shared-file ownership', author: 'Ava Chen', date: '2025-09-12T09:42:00Z', html_url: 'https://github.com/demo/reporadar-sample/commit/abc1234', stats: { total: 120, additions: 68, deletions: 52 }, files: [{ path: 'src/components/Timeline.tsx', status: 'modified', additions: 48, deletions: 37 }, { path: 'src/components/RiskRadar.tsx', status: 'modified', additions: 20, deletions: 15 }] },
    { sha: 'abc1235', message: 'Revert accidental config changes in deployment', author: 'Maya Singh', date: '2025-09-01T16:38:00Z', html_url: 'https://github.com/demo/reporadar-sample/commit/abc1235', stats: { total: 66, additions: 18, deletions: 48 }, files: [{ path: 'src/services/risk-scoring.ts', status: 'modified', additions: 18, deletions: 48 }] },
    { sha: 'abc1236', message: 'Add file-level change summary endpoint', author: 'Liam Patel', date: '2025-08-25T08:20:00Z', html_url: 'https://github.com/demo/reporadar-sample/commit/abc1236', stats: { total: 158, additions: 109, deletions: 49 }, files: [{ path: 'src/api/github.ts', status: 'modified', additions: 51, deletions: 31 }, { path: 'src/lib/commit-summary.ts', status: 'added', additions: 58, deletions: 18 }] },
    { sha: 'abc1237', message: 'Improve error handling and inaccessible repo messaging', author: 'Nina Ross', date: '2025-08-14T11:18:00Z', html_url: 'https://github.com/demo/reporadar-sample/commit/abc1237', stats: { total: 71, additions: 35, deletions: 36 }, files: [{ path: 'src/api/github.ts', status: 'modified', additions: 35, deletions: 36 }] }
  ],
  fileHistory: [
    { path: 'src/services/risk-scoring.ts', score: 92, commits: ['abc1231','abc1233','abc1235'], additions: 154, deletions: 151, changeCount: 3, lastChanged: '2025-09-30T09:15:00Z', contributors: ['Ava Chen', 'Noah Kim', 'Maya Singh'], revertRelated: true },
    { path: 'src/api/github.ts', score: 87, commits: ['abc1232','abc1236','abc1237'], additions: 116, deletions: 92, changeCount: 3, lastChanged: '2025-09-28T13:45:00Z', contributors: ['Liam Patel', 'Nina Ross'] },
    { path: 'src/components/Timeline.tsx', score: 74, commits: ['abc1232','abc1234'], additions: 79, deletions: 69, changeCount: 2, lastChanged: '2025-09-28T13:45:00Z', contributors: ['Liam Patel', 'Ava Chen'] },
    { path: 'src/components/RiskRadar.tsx', score: 66, commits: ['abc1231','abc1234'], additions: 40, deletions: 30, changeCount: 2, lastChanged: '2025-09-30T09:15:00Z', contributors: ['Ava Chen'] },
    { path: 'src/lib/commit-summary.ts', score: 58, commits: ['abc1236'], additions: 58, deletions: 18, changeCount: 1, lastChanged: '2025-08-25T08:20:00Z', contributors: ['Liam Patel'] }
  ],
  contributors: [
    { login: 'ava-chen', name: 'Ava Chen', commit_count: 3, recent_activity: '2025-09-30', files: ['src/services/risk-scoring.ts','src/components/RiskRadar.tsx'] },
    { login: 'liam-patel', name: 'Liam Patel', commit_count: 2, recent_activity: '2025-09-28', files: ['src/api/github.ts','src/components/Timeline.tsx','src/lib/commit-summary.ts'] },
    { login: 'noah-kim', name: 'Noah Kim', commit_count: 1, recent_activity: '2025-09-20', files: ['src/services/risk-scoring.ts'] },
    { login: 'maya-singh', name: 'Maya Singh', commit_count: 1, recent_activity: '2025-09-01', files: ['src/services/risk-scoring.ts'] },
    { login: 'nina-ross', name: 'Nina Ross', commit_count: 1, recent_activity: '2025-08-14', files: ['src/api/github.ts'] }
  ]
};

function makeGitHubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'RepoRadar/1.0',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

function getGitHubApiUrl(owner, repo, path = '') {
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  return path ? `${base}/${path}` : base;
}

function parseRepositoryUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') return null;
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length !== 2) return null;
    const owner = segments[0];
    const repo = segments[1].replace(/\.git$/i, '');
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...makeGitHubHeaders(), ...(options.headers || {}) },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${text || response.statusText}`);
  }
  return response.json();
}

function normalizeCommit(commit) {
  return {
    sha: commit.sha,
    message: commit.commit?.message || commit.message || 'Untitled commit',
    author: commit.commit?.author?.name || commit.author?.login || 'Unknown author',
    authorLogin: commit.author?.login || null,
    date: commit.commit?.author?.date || commit.committer?.date || commit.date || new Date().toISOString(),
    html_url: commit.html_url || `https://github.com/${commit.author?.login || 'unknown'}/${commit.sha}`,
    stats: commit.stats || {
      total: 0,
      additions: 0,
      deletions: 0,
    },
  };
}

function normalizeFile(changedFile, commitMeta = {}) {
  return {
    path: changedFile.filename || changedFile.path || 'unknown',
    additions: Number(changedFile.additions || 0),
    deletions: Number(changedFile.deletions || 0),
    status: changedFile.status || 'modified',
    changes: Number(changedFile.changes || 0),
    commitSha: commitMeta.sha || null,
    commitMessage: commitMeta.message || null,
    commitAuthor: commitMeta.author || null,
    commitAuthorLogin: commitMeta.authorLogin || null,
    commitAuthorLogin: commitMeta.authorLogin || null,
    commitDate: commitMeta.date || null,
    html_url: commitMeta.html_url || null,
  };
}

function computeRisk(fileHistory) {
  return fileHistory
    .map((item) => {
      const recencyBoost = Math.min(100, item.changeCount * 8 + (item.commits?.length || 0) * 10);
      const churn = Math.min(100, (item.additions + item.deletions) / 10);
      const revertPenalty = item.revertRelated ? 18 : 0;
      return {
        path: item.path,
        score: Math.min(100, Math.round(Math.max(0, recencyBoost + churn + (item.changeCount * 4) + revertPenalty - 20))),
        additions: item.additions,
        deletions: item.deletions,
        changeCount: item.changeCount,
        contributors: item.contributors || [],
        commits: item.commits || [],
        lastChanged: item.lastChanged,
        revertRelated: item.revertRelated || false,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function buildRiskBreakdown(fileHistory) {
  return fileHistory.map((item) => ({
    path: item.path,
    score: item.score,
    label: item.score >= 80 ? 'High' : item.score >= 55 ? 'Medium' : 'Low',
    factors: [
      { label: 'Change frequency', value: `${item.changeCount} recent edits`, weight: 0.35 },
      { label: 'Code churn', value: `${item.additions + item.deletions} lines touched`, weight: 0.3 },
      { label: 'Recency', value: `Last change ${new Date(item.lastChanged).toLocaleDateString()}`, weight: 0.2 },
      { label: 'Revert signals', value: item.revertRelated ? 'Revert-related commit observed' : 'No revert-related commit observed', weight: 0.15 },
    ],
  }));
}

async function analyzeRepo(owner, repo, requestedPage = 1, perPage = 100) {
  const repoUrl = getGitHubApiUrl(owner, repo);
  let repoData;
  try {
    repoData = await fetchJson(repoUrl);
  } catch (error) {
    throw new Error(`Repository not accessible: ${error.message}`);
  }

  const commitPage = Math.max(1, Number(requestedPage) || 1);
  const commitsUrl = `${repoUrl}/commits?per_page=${perPage}&page=${commitPage}`;
  const commits = await fetchJson(commitsUrl);
  const normalizedCommits = (Array.isArray(commits) ? commits : []).map(normalizeCommit);

  const changedFiles = [];
  const detailLimit = Math.min(normalizedCommits.length, 10);
  for (const [index, commit] of normalizedCommits.entries()) {
    if (index >= detailLimit) {
      commit.files = null;
      commit.detailStatus = 'not-fetched';
      continue;
    }
    try {
      const details = await fetchJson(`${repoUrl}/commits/${commit.sha}`);
      commit.stats = details.stats || null;
      commit.files = Array.isArray(details.files) ? details.files.map((file) => normalizeFile(file, commit)) : null;
      commit.detailStatus = Array.isArray(details.files) ? 'available' : 'unavailable';
      commit.files?.forEach((file) => changedFiles.push(file));
    } catch (error) {
      commit.files = null;
      commit.detailStatus = 'unavailable';
    }
  }

  const repoInfo = {
    name: repoData.name,
    full_name: repoData.full_name,
    description: repoData.description || 'No description provided.',
    default_branch: repoData.default_branch || 'main',
    stars: repoData.stargazers_count ?? null,
    forks: repoData.forks_count ?? null,
    html_url: repoData.html_url || `https://github.com/${owner}/${repo}`,
    last_updated: repoData.updated_at,
    source: 'live',
    available: true,
  };

  const filesByPath = new Map();
  for (const file of changedFiles) {
    if (!file.path || file.path === 'unknown') continue;
    const key = file.path;
    const existing = filesByPath.get(key) || { path: key, additions: 0, deletions: 0, changeCount: 0, commits: new Set(), contributors: new Set(), lastChanged: null, revertRelated: false };
    existing.additions += file.additions || 0;
    existing.deletions += file.deletions || 0;
    existing.changeCount += 1;
    existing.commits.add(file.commitSha);
    if (file.commitAuthor) existing.contributors.add(file.commitAuthor);
    if (/^\s*revert\b/i.test(file.commitMessage || '')) existing.revertRelated = true;
    if (file.commitDate && (!existing.lastChanged || new Date(file.commitDate) > new Date(existing.lastChanged))) {
      existing.lastChanged = file.commitDate;
    }
    filesByPath.set(key, existing);
  }

  const fileHistory = [...filesByPath.values()].map((item) => ({
    path: item.path,
    additions: item.additions,
    deletions: item.deletions,
    changeCount: item.changeCount,
    contributors: [...item.contributors],
    commits: [...item.commits].filter(Boolean),
    lastChanged: item.lastChanged || normalizedCommits[0]?.date || new Date().toISOString(),
    revertRelated: item.revertRelated,
  }));

  const risk = computeRisk(fileHistory).slice(0, 8);
  const contributorMap = new Map();
  for (const commit of normalizedCommits) {
    const key = commit.authorLogin || commit.author;
    const contributor = contributorMap.get(key) || {
      login: key,
      name: commit.author || 'Unknown author',
      commit_count: 0,
      recent_activity: null,
      files: new Set(),
    };
    contributor.commit_count += 1;
    if (!contributor.recent_activity || new Date(commit.date) > new Date(contributor.recent_activity)) {
      contributor.recent_activity = commit.date;
    }
    for (const file of changedFiles) {
      if ((commit.authorLogin && file.commitAuthorLogin === commit.authorLogin) || file.commitAuthor === commit.author) {
        contributor.files.add(file.path);
      }
    }
    contributorMap.set(key, contributor);
  }
  const observedContributors = [...contributorMap.values()]
    .map((contributor) => ({ ...contributor, files: [...contributor.files] }))
    .sort((left, right) => right.commit_count - left.commit_count);
  return {
    repository: repoInfo,
    commits: normalizedCommits,
    contributors: observedContributors,
    risk: buildRiskBreakdown(risk),
    fileDetails: risk.map((item) => ({
      path: item.path,
      score: item.score,
      label: item.score >= 80 ? 'High' : item.score >= 55 ? 'Medium' : 'Low',
      additions: item.additions,
      deletions: item.deletions,
      changeCount: item.changeCount,
      contributors: item.contributors,
      commits: item.commits,
      lastChanged: item.lastChanged,
      revertRelated: item.revertRelated,
      factors: [
        { label: 'Change frequency', value: `${item.changeCount} changes`, weight: 0.35 },
        { label: 'Code churn', value: `${item.additions + item.deletions} lines`, weight: 0.3 },
        { label: 'Recency', value: new Date(item.lastChanged).toLocaleDateString(), weight: 0.2 },
        { label: 'Revert signals', value: item.revertRelated ? 'Revert-related commit observed' : 'No revert-related commit observed', weight: 0.15 },
      ],
    })),
    summary: {
      commitCount: normalizedCommits.length,
      contributorCount: observedContributors.length,
      filesAnalyzed: filesByPath.size,
      detailCoverage: `${normalizedCommits.filter((commit) => commit.detailStatus === 'available').length}/${normalizedCommits.length} commits`,
      highestRiskFile: risk[0]?.path || null,
      timeRange: normalizedCommits.length ? {
        oldest: normalizedCommits[normalizedCommits.length - 1]?.date,
        newest: normalizedCommits[0]?.date,
      } : null,
    },
    source: 'live',
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mode: 'live', timestamp: new Date().toISOString() });
});

app.get('/api/demo', (req, res) => {
  const riskEntries = computeRisk(DEMO_DATA.fileHistory).map((item) => ({ ...item, label: item.score >= 80 ? 'High' : item.score >= 55 ? 'Medium' : 'Low' }));
  const demoContributors = new Map();
  for (const commit of DEMO_DATA.commits) {
    const contributor = demoContributors.get(commit.author) || {
      login: commit.author,
      name: commit.author,
      commit_count: 0,
      recent_activity: commit.date,
      files: new Set(),
    };
    contributor.commit_count += 1;
    for (const file of commit.files) contributor.files.add(file.path);
    demoContributors.set(commit.author, contributor);
  }
  const contributors = [...demoContributors.values()]
    .map((contributor) => ({ ...contributor, files: [...contributor.files] }))
    .sort((left, right) => right.commit_count - left.commit_count);
  const demo = {
    source: 'demo',
    repository: {
      name: DEMO_DATA.repository.name,
      full_name: DEMO_DATA.repository.full_name,
      description: DEMO_DATA.repository.description,
      default_branch: DEMO_DATA.repository.default_branch,
      stars: DEMO_DATA.repository.stargazers_count,
      forks: DEMO_DATA.repository.forks_count,
      html_url: DEMO_DATA.repository.html_url,
      last_updated: DEMO_DATA.repository.updated_at,
    },
    commits: DEMO_DATA.commits.map((commit) => ({ ...commit, detailStatus: 'available' })),
    contributors,
    risk: buildRiskBreakdown(riskEntries),
    fileDetails: riskEntries.map((item) => ({
      path: item.path,
      score: item.score,
      label: item.score >= 80 ? 'High' : item.score >= 55 ? 'Medium' : 'Low',
      additions: item.additions,
      deletions: item.deletions,
      changeCount: item.changeCount,
      contributors: item.contributors,
      commits: item.commits,
      lastChanged: item.lastChanged,
      revertRelated: item.revertRelated || false,
      factors: [
        { label: 'Change frequency', value: `${item.changeCount} changes`, weight: 0.35 },
        { label: 'Code churn', value: `${item.additions + item.deletions} lines`, weight: 0.3 },
        { label: 'Recency', value: new Date(item.lastChanged).toLocaleDateString(), weight: 0.2 },
        { label: 'Revert signals', value: item.revertRelated ? 'Revert-related commit observed' : 'No revert-related commit observed', weight: 0.15 },
      ],
    })),
    summary: {
      commitCount: DEMO_DATA.commits.length,
      contributorCount: contributors.length,
      filesAnalyzed: DEMO_DATA.fileHistory.length,
      detailCoverage: `${DEMO_DATA.commits.length}/${DEMO_DATA.commits.length} commits`,
      highestRiskFile: riskEntries[0]?.path || null,
      timeRange: {
        oldest: DEMO_DATA.commits[DEMO_DATA.commits.length - 1]?.date,
        newest: DEMO_DATA.commits[0]?.date,
      },
    },
    story: {
      steps: [
        'Repository overview',
        'Recent project history',
        'Highest-risk file',
        'Commits and evidence',
        'Recommended investigation'
      ]
    },
  };
  res.json(demo);
});

app.post('/api/commit-detail', async (req, res) => {
  const repoUrl = String(req.body?.repoUrl || '').trim();
  const sha = String(req.body?.sha || '').trim();
  const repository = parseRepositoryUrl(repoUrl);
  if (!repository) {
    return res.status(400).json({ error: 'A valid GitHub repository URL is required.' });
  }
  if (!/^[a-f0-9]{7,40}$/i.test(sha)) {
    return res.status(400).json({ error: 'A valid commit SHA is required.' });
  }

  try {
    const details = await fetchJson(`${getGitHubApiUrl(repository.owner, repository.repo)}/commits/${sha}`);
    const commit = normalizeCommit(details);
    const files = Array.isArray(details.files)
      ? details.files.map((file) => normalizeFile(file, commit))
      : null;
    return res.json({ stats: details.stats || null, files, detailStatus: files ? 'available' : 'unavailable' });
  } catch (error) {
    return res.status(502).json({ error: `Unable to load commit details: ${error.message}` });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const repoUrl = String(req.body?.repoUrl || '').trim();
    if (!repoUrl) {
      return res.status(400).json({ error: 'Repository URL is required.' });
    }

    const repository = parseRepositoryUrl(repoUrl);
    if (!repository) {
      return res.status(400).json({ error: 'Please provide a valid public GitHub repository URL.' });
    }

    const result = await analyzeRepo(repository.owner, repository.repo, 1, 100);
    return res.json(result);
  } catch (error) {
    const message = error?.message || 'Unable to analyze repository.';
    if (/rate limit|403|API request failed|Repository not accessible/i.test(message)) {
      return res.status(429).json({ error: 'GitHub API access is limited or the repository is unavailable. Try Demo Mode.', data: DEMO_DATA });
    }
    return res.status(500).json({ error: message || 'Something went wrong while analyzing the repository.' });
  }
});

if (!isProd) {
  const distDir = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'))
  });
}

app.listen(PORT, () => {
  console.log(`RepoRadar backend running on http://localhost:${PORT}`);
});
