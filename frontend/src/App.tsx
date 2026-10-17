import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Github, Radar } from 'lucide-react';
import type { PageName, RepoResponse } from './types';
import {
  analyzeRepository as analyzeRepositoryApi,
  ApiError,
  fetchBranches,
  fetchCommitDetail,
  fetchDemo,
  isAbortError,
} from './lib/api';
import { relativeTime } from './lib/format';
import { Layout } from './components/Layout';
import { ErrorBanner, LoadingState } from './components/ui';
import { OverviewPage } from './pages/Overview';
import { RiskRadarPage } from './pages/RiskRadar';
import { TimeMachinePage } from './pages/TimeMachine';
import { ContributorsPage } from './pages/Contributors';
import { STORY_STEPS, StoryModePage } from './pages/StoryMode';

const PAGES = [
  { label: 'Overview' as PageName, route: 'overview' },
  { label: 'Risk Radar' as PageName, route: 'risk' },
  { label: 'Time Machine' as PageName, route: 'history' },
  { label: 'Contributors' as PageName, route: 'contributors' },
  { label: 'Story Mode' as PageName, route: 'story' },
];

type BusyKind = 'demo' | 'analyze' | 'branch';

type FailureNotice = {
  message: string;
  hint?: string;
  /** Present when repeating the failed action is a sensible next step. */
  retry?: (() => void) | null;
};

type DetailFailure = { sha: string; message: string };

const STORY_STEP_KEY = 'reporadar.storyStep';

function routeFromHash(): string {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return PAGES.some((page) => page.route === hash) ? hash : 'overview';
}

/** Extract owner/name from a GitHub URL (or bare owner/name) as typed by the user. */
function slugOf(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!/(^|\.)github\.com$/i.test(url.hostname)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  } catch {
    return null;
  }
}

function loadInitialStoryStep(): number {
  try {
    const raw = window.localStorage.getItem(STORY_STEP_KEY);
    const parsed = raw === null ? 0 : Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 && parsed < STORY_STEPS.length ? parsed : 0;
  } catch {
    return 0;
  }
}

export default function App() {
  const [route, setRoute] = useState<string>(() => routeFromHash());
  const [data, setData] = useState<RepoResponse | null>(null);
  const [busy, setBusy] = useState<BusyKind | null>('demo');
  const [error, setError] = useState<FailureNotice | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [storyStep, setStoryStep] = useState(() => loadInitialStoryStep());
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<DetailFailure | null>(null);
  const [detailRequestId, setDetailRequestId] = useState(0);
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState('');
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastAnalyzedUrlRef = useRef<string | null>(null);
  const firstRouteRef = useRef(true);

  const activePage = PAGES.find((page) => page.route === route)?.label ?? 'Overview';

  const navigate = useCallback((page: PageName) => {
    const target = PAGES.find((item) => item.label === page);
    const nextRoute = target?.route ?? 'overview';
    setRoute(nextRoute);
    if (routeFromHash() !== nextRoute) {
      window.location.hash = `/${nextRoute}`;
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Keep the document title and keyboard focus in sync with the active page.
  useEffect(() => {
    document.title = `${activePage} · RepoRadar`;
    if (firstRouteRef.current) {
      firstRouteRef.current = false;
      return;
    }
    document.getElementById('main-content')?.focus();
  }, [activePage]);

  // A harmless preference: remember where the user left the story walkthrough.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORY_STEP_KEY, String(storyStep));
    } catch {
      /* storage may be unavailable; the preference is optional */
    }
  }, [storyStep]);

  const setDataset = useCallback((next: RepoResponse) => {
    setData(next);
    setSelectedFilePath(next.fileDetails[0]?.path ?? null);
    setSelectedSha(next.commits[0]?.sha ?? null);
    setStoryStep((step) => (step >= 0 && step < STORY_STEPS.length ? step : 0));
    setDetailLoading(null);
    setDetailError(null);
    setError(null);
  }, []);

  const loadBranches = useCallback(async (url: string, analyzedBranch?: string | null) => {
    try {
      const payload = await fetchBranches(url);
      const names = [
        ...new Set(
          [payload.default_branch, ...payload.branches.map((item) => item.name)].filter(
            (name): name is string => Boolean(name),
          ),
        ),
      ];
      setBranches(names);
      // Select the branch GitHub actually analyzed (server echoes it as
      // analyzed_branch) so the dropdown never claims a different branch.
      if (analyzedBranch && names.includes(analyzedBranch)) {
        setBranch(analyzedBranch);
      } else if (payload.default_branch && names.includes(payload.default_branch)) {
        setBranch(payload.default_branch);
      } else {
        setBranch(names[0] ?? '');
      }
    } catch {
      // Branch listing is an enhancement; hide the control when it is
      // unavailable (rate limits, protected URLs, offline).
      setBranches([]);
    }
  }, []);

  // Both loaders share the same stale-response guard: a new request aborts the
  // previous one, and only the newest request id may write state.
  const loadDemo = useCallback(async function loadDemoRun() {
    abortRef.current?.abort();
    setBranches([]);
    setBranch('');
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setBusy('demo');
    setError(null);
    try {
      const payload = await fetchDemo(controller.signal);
      if (requestId !== requestRef.current) return;
      setDataset(payload);
    } catch (loadError) {
      if (requestId !== requestRef.current || isAbortError(loadError)) return;
      setError({
        message:
          loadError instanceof ApiError
            ? loadError.message
            : 'Unable to load the demo dataset. Confirm the backend is running.',
        retry: () => void loadDemoRun(),
      });
    } finally {
      if (requestId === requestRef.current) setBusy(null);
    }
  }, [setDataset]);

  const runAnalysis = useCallback(
    async function runAnalysisNow(url: string, requestedBranch?: string) {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      // Keep the current analysis visible while a new one runs so a failed
      // request never wipes results the user is already looking at.
      setBusy('analyze');
      setError(null);
      try {
        const payload = await analyzeRepositoryApi(url, requestedBranch, controller.signal);
        if (requestId !== requestRef.current) return;
        lastAnalyzedUrlRef.current = payload.repository.html_url;
        setDataset(payload);
        if (payload.source === 'live') {
          void loadBranches(payload.repository.html_url, payload.repository.analyzed_branch);
        } else {
          setBranches([]);
        }
        navigate('Overview');
      } catch (analysisError) {
        if (requestId !== requestRef.current || isAbortError(analysisError)) return;
        if (analysisError instanceof ApiError) {
          setError({
            message: analysisError.message,
            hint:
              analysisError.kind === 'rate_limit' && analysisError.retryAt
                ? `GitHub's limit is expected to reset ${relativeTime(analysisError.retryAt)}.`
                : analysisError.kind === 'invalid_branch'
                  ? 'Pick one of the listed branches (or clear the selection to use the default branch) and try again.'
                  : analysisError.kind === 'invalid_url'
                    ? 'Use the format https://github.com/owner/repository (no trailing punctuation).'
                    : analysisError.kind === 'not_found'
                      ? 'Check the owner/name spelling — the repository may be renamed, private, or deleted.'
                      : undefined,
            retry: () => void runAnalysisNow(url, requestedBranch),
          });
        } else {
          setError({ message: 'Repository analysis failed.', retry: () => void runAnalysisNow(url, requestedBranch) });
        }
      } finally {
        if (requestId === requestRef.current) setBusy(null);
      }
    },
    [loadBranches, navigate, setDataset],
  );

  const analyze = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedUrl = repoUrl.trim();
      if (!trimmedUrl) {
        setError({ message: 'Enter a public GitHub repository URL to analyze.' });
        return;
      }
      void runAnalysis(trimmedUrl, branch || undefined);
    },
    [repoUrl, branch, runAnalysis],
  );

  const changeBranch = useCallback(
    (nextBranch: string) => {
      setBranch(nextBranch);
      const url =
        lastAnalyzedUrlRef.current ?? (data && data.source === 'live' ? data.repository.html_url : null);
      if (url) {
        void runAnalysis(url, nextBranch || undefined);
      }
    },
    [data, runAnalysis],
  );

  const cancelBusy = useCallback(() => {
    abortRef.current?.abort();
    setBusy(null);
  }, []);

  const openFile = useCallback(
    (path: string) => {
      if (!path) return;
      setSelectedFilePath(path);
      navigate('Risk Radar');
    },
    [navigate],
  );

  const openCommit = useCallback(
    (sha: string) => {
      if (!sha) return;
      setSelectedSha(sha);
      navigate('Time Machine');
    },
    [navigate],
  );

  // Lazily load file details for the selected commit on live analyses. Only
  // commits whose details were not already fetched trigger a request, so
  // opening the page never fetches every commit.
  useEffect(() => {
    if (!data || data.source !== 'live') return;
    const commit = data.commits.find((item) => item.sha === selectedSha);
    if (!commit || commit.detailStatus !== 'not-fetched') return;
    const controller = new AbortController();
    setDetailLoading(commit.sha);
    setDetailError(null);
    fetchCommitDetail(data.repository.html_url, commit.sha, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        setData((previous) =>
          previous && previous.source === 'live'
            ? {
                ...previous,
                commits: previous.commits.map((item) =>
                  item.sha === commit.sha
                    ? { ...item, files: payload.files, stats: payload.stats, detailStatus: payload.detailStatus }
                    : item,
                ),
              }
            : previous,
        );
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted || isAbortError(loadError)) return;
        setDetailError({
          sha: commit.sha,
          message: loadError instanceof ApiError ? loadError.message : 'Could not retrieve commit details.',
        });
        setData((previous) =>
          previous && previous.source === 'live'
            ? {
                ...previous,
                commits: previous.commits.map((item) =>
                  item.sha === commit.sha ? { ...item, detailStatus: 'unavailable' } : item,
                ),
              }
            : previous,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(null);
      });
    return () => controller.abort();
  }, [data?.repository.html_url, data?.source, selectedSha, detailRequestId]);

  const retryDetail = useCallback(() => {
    if (!data || data.source !== 'live') return;
    const commit = data.commits.find((item) => item.sha === selectedSha);
    if (!commit) return;
    setDetailError(null);
    setData((previous) =>
      previous && previous.source === 'live'
        ? {
            ...previous,
            commits: previous.commits.map((item) =>
              item.sha === commit.sha ? { ...item, detailStatus: 'not-fetched' } : item,
            ),
          }
        : previous,
    );
    setDetailRequestId((value) => value + 1);
  }, [data, selectedSha]);

  const selectedFilePathForPage = useMemo(
    () => data?.fileDetails.find((file) => file.path === selectedFilePath)?.path ?? null,
    [data, selectedFilePath],
  );

  useEffect(() => {
    void loadDemo();
    // The demo load intentionally runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pageContent = !data ? null : activePage === 'Overview'
    ? (
      <OverviewPage data={data} onOpenFile={openFile} onOpenCommit={openCommit} />
    )
    : activePage === 'Risk Radar'
      ? (
        <RiskRadarPage
          data={data}
          selectedFilePath={selectedFilePathForPage}
          onSelectFile={setSelectedFilePath}
          onOpenCommit={openCommit}
        />
      )
      : activePage === 'Time Machine'
        ? (
          <TimeMachinePage
            data={data}
            selectedSha={selectedSha}
            onSelectCommit={setSelectedSha}
            detailLoading={detailLoading}
            detailError={detailError}
            onRetryDetail={retryDetail}
          />
        )
        : activePage === 'Contributors'
          ? <ContributorsPage data={data} onOpenCommit={openCommit} />
          : (
            <StoryModePage
              data={data}
              storyStep={storyStep}
              onSelectStep={setStoryStep}
              onNext={() => setStoryStep((step) => Math.min(STORY_STEPS.length - 1, step + 1))}
              onBack={() => setStoryStep((step) => Math.max(0, step - 1))}
              onRestart={() => setStoryStep(0)}
              onOpenFile={openFile}
              onOpenCommit={openCommit}
            />
          );

  const analyzing = busy === 'analyze';
  const analyzingSlug = analyzing ? slugOf(repoUrl) : null;

  return (
    <Layout
      activePage={activePage}
      data={data}
      analyzing={analyzing}
      menuOpen={menuOpen}
      repoUrl={repoUrl}
      loadedRepo={analyzingSlug}
      branches={branches}
      branch={branch}
      onOpenMenu={() => setMenuOpen(true)}
      onCloseMenu={() => setMenuOpen(false)}
      onNavigate={navigate}
      onRepoUrlChange={setRepoUrl}
      onAnalyze={analyze}
      onLoadDemo={() => void loadDemo()}
      onBranchChange={changeBranch}
    >
      {data && busy && (
        <div className="busy-banner" role="status" aria-live="polite">
          {busy === 'analyze' ? 'Analyzing repository history…' : 'Loading repository data…'}
          <button type="button" className="text-action" onClick={cancelBusy} style={{ marginLeft: 'auto' }}>
            Cancel
          </button>
        </div>
      )}
      {error && (
        <ErrorBanner
          message={error.message}
          hint={error.hint}
          actions={[
            ...(error.retry ? [{ label: 'Try again', onClick: error.retry }] : []),
            { label: 'Use demo data', onClick: () => void loadDemo() },
          ]}
        />
      )}
      {!data ? (
        busy ? (
          <LoadingState
            label={busy === 'analyze' ? 'Analyzing repository history…' : 'Loading repository data…'}
          />
        ) : (
          <div className="no-repository">
            <div className="no-repository-plate">
              <span className="brand-mark" style={{ width: 44, height: 44, borderRadius: 13 }}>
                <Radar size={22} aria-hidden="true" />
              </span>
              <h1>Choose a repository to begin</h1>
              <p>
                Paste a public GitHub repository URL above. Repository data stays separate from the prepared demo
                dataset.
              </p>
              <button type="button" className="btn btn-soft" onClick={() => void loadDemo()}>
                <Github size={14} aria-hidden="true" /> Load demo data
              </button>
              <span className="demo-hint">Demo data is a static sample used for exploration and testing.</span>
            </div>
          </div>
        )
      ) : (
        pageContent
      )}
    </Layout>
  );
}
