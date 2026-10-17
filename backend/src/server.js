import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the workspace .env from this file's location so the server reads the
// same configuration no matter which directory it is started from.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));

const DEMO_DATA = {
  source: 'demo',
  repository: {
    name: 'reporadar-sample',
    full_name: 'demo/reporadar-sample',
    description: 'A sample project used to demonstrate RepoRadar heuristics and historical analysis.',
    default_branch: 'main',
    html_url: 'https://github.com/demo/reporadar-sample',
    language: 'TypeScript',
    stargazers_count: 482,
    forks_count: 71,
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

class GitHubError extends Error {
  constructor(message, { status = null, rateLimited = false, retryAt = null } = {}) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.rateLimited = rateLimited;
    this.retryAt = retryAt;
  }
}

async function fetchJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { ...makeGitHubHeaders(), ...(options.headers || {}) },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new GitHubError(
      error?.name === 'TimeoutError'
        ? 'The GitHub API did not respond within 15 seconds.'
        : `The GitHub API could not be reached (${error?.message || 'network error'}).`,
    );
  }
  if (!response.ok) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const resetSeconds = Number(response.headers.get('x-ratelimit-reset')) || 0;
    const retryAfterSeconds = Number(response.headers.get('retry-after')) || 0;
    const retryAt = retryAfterSeconds
      ? new Date(Date.now() + retryAfterSeconds * 1000).toISOString()
      : resetSeconds
        ? new Date(resetSeconds * 1000).toISOString()
        : null;
    // GitHub reports rate limiting as 429, or as 403 with an exhausted
    // x-ratelimit-remaining header. A plain 403 is an access problem instead.
    const rateLimited = response.status === 429 || (response.status === 403 && remaining === '0');
    throw new GitHubError(`GitHub API request failed with status ${response.status}.`, {
      status: response.status,
      rateLimited,
      retryAt,
    });
  }
  return response.json();
}

function analyzeErrorResponse(error, subject = 'Repository') {
  if (error instanceof GitHubError) {
    if (error.rateLimited) {
      return {
        status: 429,
        body: {
          code: 'rate_limit',
          error:
            'GitHub API rate limit reached for unauthenticated requests. Wait for the limit to reset or add GITHUB_TOKEN to .env for a higher limit.',
          retryAt: error.retryAt,
        },
      };
    }
    if (error.status === 404) {
      return {
        status: 404,
        body: {
          code: 'not_found',
          error: `${subject} not found. It may be private, renamed, or the URL may be incorrect.`,
        },
      };
    }
    if (error.status === 401 || error.status === 403) {
      return {
        status: 403,
        body: {
          code: 'access_denied',
          error: `GitHub refused access to this ${subject.toLowerCase()}. It may be private or the configured GITHUB_TOKEN may lack access.`,
        },
      };
    }
    if (error.status === 422) {
      return {
        status: 422,
        body: {
          code: 'empty_repository',
          error: 'GitHub could not list commits for this repository. It may be empty or still initializing.',
        },
      };
    }
    return {
      status: 502,
      body: { code: 'upstream', error: 'GitHub returned an unexpected response. Try again in a moment.' },
    };
  }
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
    return { status: 504, body: { code: 'timeout', error: 'The GitHub API took too long to respond. Try again.' } };
  }
  return { status: 500, body: { code: 'internal', error: 'Something went wrong while analyzing the repository.' } };
}

function normalizeCommit(commit, repoSlug = '') {
  return {
    sha: commit.sha,
    message: commit.commit?.message || commit.message || 'Untitled commit',
    author: commit.commit?.author?.name || commit.author?.login || 'Unknown author',
    authorLogin: commit.author?.login || null,
    date: commit.commit?.author?.date || commit.committer?.date || commit.date || new Date().toISOString(),
    html_url: commit.html_url || (repoSlug ? `https://github.com/${repoSlug}/commit/${commit.sha}` : null),
    // Only trust stats that GitHub actually returned. A missing stat must stay
    // null so the UI reports it as unavailable instead of as zero.
    stats: commit.stats || null,
    // "Bot" for GitHub app accounts (dependabot[bot], github-actions[bot], ...).
    authorType: commit.author?.type === 'Bot' ? 'Bot' : commit.author?.type === 'User' ? 'User' : null,
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
    commitDate: commitMeta.date || null,
    html_url: commitMeta.html_url || null,
  };
}

// ---------------------------------------------------------------------------
// Risk scoring
//
// The score is a documented, weighted combination of four factors. Every
// factor is normalized to a 0-100 scale so the weighted contributions sum to
// the displayed score and the factor breakdown genuinely explains it.
//
//   changeFrequency  0.35  ->  30 points per observed edit (caps at 100)
//   codeChurn        0.30  ->  1 point per 6 added+deleted lines (caps at 100)
//   recency          0.20  ->  100 within 7 days of the newest analyzed
//                              commit, decaying linearly to 0 at 180 days
//   revertSignals    0.15  ->  100 when a revert-related commit is observed,
//                              otherwise 0
//
// This is a review-priority heuristic, NOT a probability of a defect.
// ---------------------------------------------------------------------------
const SCORE_WEIGHTS = {
  changeFrequency: 0.35,
  codeChurn: 0.3,
  recency: 0.2,
  revertSignals: 0.15,
};

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function recencyScoreFor(lastChanged, referenceDate) {
  if (!lastChanged || !referenceDate) return 0;
  const last = new Date(lastChanged);
  const reference = new Date(referenceDate);
  if (Number.isNaN(last.getTime()) || Number.isNaN(reference.getTime())) return 0;
  const days = Math.max(0, (reference.getTime() - last.getTime()) / 86400000);
  if (days <= 7) return 100;
  return clampScore(100 * (1 - (days - 7) / 173));
}

function computeRisk(fileHistory, referenceDate) {
  const items = Array.isArray(fileHistory) ? fileHistory : [];
  return items
    .map((item) => {
      const changeCount = Number(item.changeCount) || 0;
      const churnLines = (Number(item.additions) || 0) + (Number(item.deletions) || 0);
      const changeFrequency = clampScore(changeCount * 30);
      const codeChurn = clampScore(churnLines / 6);
      const recency = recencyScoreFor(item.lastChanged, referenceDate);
      const revertSignals = item.revertRelated ? 100 : 0;
      const score = clampScore(
        changeFrequency * SCORE_WEIGHTS.changeFrequency +
          codeChurn * SCORE_WEIGHTS.codeChurn +
          recency * SCORE_WEIGHTS.recency +
          revertSignals * SCORE_WEIGHTS.revertSignals,
      );
      return {
        path: item.path,
        score,
        changeFrequency,
        codeChurn,
        recency,
        revertSignals,
        additions: Number(item.additions) || 0,
        deletions: Number(item.deletions) || 0,
        changeCount,
        contributors: item.contributors || [],
        commits: item.commits || [],
        lastChanged: item.lastChanged,
        revertRelated: item.revertRelated || false,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function riskLabelFor(score) {
  return score >= 80 ? 'High' : score >= 55 ? 'Medium' : 'Low';
}

// Each factor carries its own 0-100 score and weight so the UI can show the
// weighted contribution that adds up to the total. Contributions are rounded
// with a largest-remainder pass so their integer points sum to the displayed
// score exactly.
function factorPoints(factors, score) {
  const exact = factors.map((factor) => factor.score * factor.weight);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = Math.round(score) - floors.reduce((sum, value) => sum + value, 0);
  const points = [...floors];
  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction);
  for (let cursor = 0; remainder > 0 && byFraction.length; cursor += 1) {
    points[byFraction[cursor % byFraction.length].index] += 1;
    remainder -= 1;
  }
  return points;
}

function describeFactors(item, score) {
  const factors = [
    {
      label: 'Change frequency',
      value: `${item.changeCount} changes`,
      score: item.changeFrequency,
      weight: SCORE_WEIGHTS.changeFrequency,
    },
    {
      label: 'Code churn',
      value: `${item.additions + item.deletions} lines`,
      score: item.codeChurn,
      weight: SCORE_WEIGHTS.codeChurn,
    },
    {
      label: 'Recency',
      value: item.lastChanged ? new Date(item.lastChanged).toLocaleDateString() : 'Unknown',
      score: item.recency,
      weight: SCORE_WEIGHTS.recency,
    },
    {
      label: 'Revert signals',
      value: item.revertRelated ? 'Revert-related commit observed' : 'No revert-related commit observed',
      score: item.revertSignals,
      weight: SCORE_WEIGHTS.revertSignals,
    },
  ];
  const points = factorPoints(factors, score);
  return factors.map((factor, index) => ({
    ...factor,
    points: points[index],
    maxPoints: Math.round(factor.weight * 100),
  }));
}

// Matches "Revert …", "Reverts #123", "Reverted …" and messages that carry a
// leading bracketed tag such as "[release] Revert …".
const REVERT_PATTERN = /^(?:\s*\[[^\]]*\]\s*)*revert(?:ed|s|ing)?\b/i;

function buildFileHistory(changedFiles, fallbackDate) {
  const filesByPath = new Map();
  for (const file of changedFiles) {
    if (!file.path || file.path === 'unknown') continue;
    const key = file.path;
    const existing = filesByPath.get(key) || {
      path: key,
      additions: 0,
      deletions: 0,
      changeCount: 0,
      commits: new Set(),
      contributors: new Set(),
      lastChanged: null,
      revertRelated: false,
    };
    existing.additions += file.additions || 0;
    existing.deletions += file.deletions || 0;
    existing.changeCount += 1;
    existing.commits.add(file.commitSha);
    if (file.commitAuthor) existing.contributors.add(file.commitAuthor);
    if (REVERT_PATTERN.test(file.commitMessage || '')) existing.revertRelated = true;
    if (file.commitDate && (!existing.lastChanged || new Date(file.commitDate) > new Date(existing.lastChanged))) {
      existing.lastChanged = file.commitDate;
    }
    filesByPath.set(key, existing);
  }

  return [...filesByPath.values()].map((item) => ({
    path: item.path,
    additions: item.additions,
    deletions: item.deletions,
    changeCount: item.changeCount,
    contributors: [...item.contributors],
    commits: [...item.commits].filter(Boolean),
    lastChanged: item.lastChanged || fallbackDate || null,
    revertRelated: item.revertRelated,
  }));
}

// Contributor file attribution is built from fetched commit details only, so
// the file lists stay partial whenever detail coverage is partial.
function buildContributors(commits, changedFiles) {
  const filesByAuthor = new Map();
  for (const file of changedFiles) {
    if (!file.path || file.path === 'unknown') continue;
    const key = file.commitAuthorLogin || file.commitAuthor;
    if (!key) continue;
    if (!filesByAuthor.has(key)) filesByAuthor.set(key, new Set());
    filesByAuthor.get(key).add(file.path);
  }

  const contributors = new Map();
  for (const commit of commits) {
    const key = commit.authorLogin || commit.author;
    if (!key) continue;
    const contributor = contributors.get(key) || {
      login: key,
      name: commit.author || 'Unknown author',
      commit_count: 0,
      recent_activity: null,
      isBot: /\[bot\]$/i.test(key) || key === 'github-actions',
    };
    contributor.commit_count += 1;
    if (commit.authorType === 'Bot') contributor.isBot = true;
    if (!contributor.recent_activity || new Date(commit.date) > new Date(contributor.recent_activity)) {
      contributor.recent_activity = commit.date;
    }
    contributors.set(key, contributor);
  }

  return [...contributors.values()]
    .map((contributor) => ({ ...contributor, files: [...(filesByAuthor.get(contributor.login) || [])] }))
    .sort((left, right) => right.commit_count - left.commit_count);
}

function fileDetailsFor(item) {
  return {
    path: item.path,
    score: item.score,
    label: riskLabelFor(item.score),
    additions: item.additions,
    deletions: item.deletions,
    changeCount: item.changeCount,
    contributors: item.contributors,
    commits: item.commits,
    lastChanged: item.lastChanged,
    revertRelated: item.revertRelated,
    factors: describeFactors(item, item.score),
  };
}

async function analyzeRepo(owner, repo, requestedPage = 1, perPage = 100) {
  const repoUrl = getGitHubApiUrl(owner, repo);
  const repoData = await fetchJson(repoUrl);

  const commitPage = Math.max(1, Number(requestedPage) || 1);
  const commitsUrl = `${repoUrl}/commits?per_page=${perPage}&page=${commitPage}`;
  const commits = await fetchJson(commitsUrl);
  const repoSlug = `${owner}/${repo}`;
  const normalizedCommits = (Array.isArray(commits) ? commits : []).map((commit) => normalizeCommit(commit, repoSlug));

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
    language: repoData.language ?? null,
    stars: repoData.stargazers_count ?? null,
    forks: repoData.forks_count ?? null,
    html_url: repoData.html_url || `https://github.com/${owner}/${repo}`,
    last_updated: repoData.updated_at ?? null,
  };

  const fileHistory = buildFileHistory(changedFiles, normalizedCommits[0]?.date);
  const risk = computeRisk(fileHistory, normalizedCommits[0]?.date).slice(0, 8);
  const observedContributors = buildContributors(normalizedCommits, changedFiles);
  const commitsDetailed = normalizedCommits.filter((commit) => commit.detailStatus === 'available').length;

  return {
    repository: repoInfo,
    commits: normalizedCommits,
    contributors: observedContributors,
    fileDetails: risk.map(fileDetailsFor),
    summary: {
      commitCount: normalizedCommits.length,
      commitsDetailed,
      contributorCount: observedContributors.length,
      filesAnalyzed: fileHistory.length,
      detailCoverage: `${commitsDetailed}/${normalizedCommits.length} commits`,
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
  const commits = DEMO_DATA.commits.map((commit) => ({ ...commit, detailStatus: 'available' }));
  const changedFiles = commits.flatMap((commit) =>
    (Array.isArray(commit.files) ? commit.files : []).map((file) => normalizeFile(file, commit)),
  );
  // Demo history is derived with the exact same pipeline as live analyses so
  // the fixture can never disagree with the scoring model.
  const fileHistory = buildFileHistory(changedFiles, commits[0]?.date);
  const risk = computeRisk(fileHistory, commits[0]?.date);
  const contributors = buildContributors(commits, changedFiles);

  res.json({
    source: 'demo',
    repository: {
      name: DEMO_DATA.repository.name,
      full_name: DEMO_DATA.repository.full_name,
      description: DEMO_DATA.repository.description,
      default_branch: DEMO_DATA.repository.default_branch,
      language: DEMO_DATA.repository.language ?? null,
      stars: DEMO_DATA.repository.stargazers_count ?? null,
      forks: DEMO_DATA.repository.forks_count ?? null,
      html_url: DEMO_DATA.repository.html_url,
      last_updated: DEMO_DATA.repository.updated_at ?? null,
    },
    commits,
    contributors,
    fileDetails: risk.map(fileDetailsFor),
    summary: {
      commitCount: commits.length,
      commitsDetailed: commits.length,
      contributorCount: contributors.length,
      filesAnalyzed: fileHistory.length,
      detailCoverage: `${commits.length}/${commits.length} commits`,
      highestRiskFile: risk[0]?.path || null,
      timeRange: {
        oldest: commits[commits.length - 1]?.date ?? null,
        newest: commits[0]?.date ?? null,
      },
    },
  });
});

app.post('/api/commit-detail', async (req, res) => {
  const repoUrl = String(req.body?.repoUrl || '').trim();
  const sha = String(req.body?.sha || '').trim();
  const repository = parseRepositoryUrl(repoUrl);
  if (!repository) {
    return res.status(400).json({ code: 'invalid_url', error: 'A valid GitHub repository URL is required.' });
  }
  if (!/^[a-f0-9]{7,40}$/i.test(sha)) {
    return res.status(400).json({ code: 'invalid_sha', error: 'A valid commit SHA is required.' });
  }

  try {
    const details = await fetchJson(`${getGitHubApiUrl(repository.owner, repository.repo)}/commits/${sha}`);
    const commit = normalizeCommit(details, `${repository.owner}/${repository.repo}`);
    const files = Array.isArray(details.files)
      ? details.files.map((file) => normalizeFile(file, commit))
      : null;
    return res.json({ stats: details.stats || null, files, detailStatus: files ? 'available' : 'unavailable' });
  } catch (error) {
    const mapped = analyzeErrorResponse(error, 'Commit');
    return res.status(mapped.status).json(mapped.body);
  }
});

app.post('/api/analyze', async (req, res) => {
  const repoUrl = String(req.body?.repoUrl || '').trim();
  if (!repoUrl) {
    return res.status(400).json({ code: 'missing_url', error: 'Repository URL is required.' });
  }

  const repository = parseRepositoryUrl(repoUrl);
  if (!repository) {
    return res.status(400).json({
      code: 'invalid_url',
      error: 'Please provide a valid public GitHub repository URL (https://github.com/owner/repository).',
    });
  }

  try {
    const result = await analyzeRepo(repository.owner, repository.repo, 1, 100);
    return res.json(result);
  } catch (error) {
    const mapped = analyzeErrorResponse(error, 'Repository');
    return res.status(mapped.status).json(mapped.body);
  }
});

// Unknown API routes must answer with JSON rather than the SPA fallback HTML.
app.use('/api', (req, res) => {
  res.status(404).json({ code: 'not_found', error: `Unknown API route: ${req.method} ${req.originalUrl}` });
});

// Serve the production build whenever it exists, in every environment. In dev
// the Vite dev server usually serves the frontend, but the backend can do it
// too (and production has no other server).
const distDir = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distDir, 'index.html'), (error) => {
    if (error) next(error);
  });
});

app.listen(PORT, () => {
  console.log(`RepoRadar backend running on http://localhost:${PORT}`);
});
