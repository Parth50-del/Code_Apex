import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Github } from 'lucide-react';
import type { PageName, RepoResponse } from './types';
import {
  analyzeRepository as analyzeRepositoryApi,
  ApiError,
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

type BusyKind = 'demo' | 'analyze';

type FailureNotice = {
  message: string;
  hint?: string;
  /** Present when repeating the failed action is a sensible next step. */
  retry?: (() => void) | null;
};

type DetailFailure = { sha: string; message: string };

function routeFromHash(): string {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return PAGES.some((page) => page.route === hash) ? hash : 'overview';
}

export default function App() {
  const [route, setRoute] = useState<string>(() => routeFromHash());
  const [data, setData] = useState<RepoResponse | null>(null);
  const [busy, setBusy] = useState<BusyKind | null>('demo');
  const [error, setError] = useState<FailureNotice | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [storyStep, setStoryStep] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<DetailFailure | null>(null);
  const [detailRequestId, setDetailRequestId] = useState(0);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
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

  const setDataset = useCallback((next: RepoResponse) => {
    setData(next);
    setSelectedFilePath(next.fileDetails[0]?.path ?? null);
    setSelectedSha(next.commits[0]?.sha ?? null);
    setStoryStep(0);
    setDetailLoading(null);
    setDetailError(null);
    setError(null);
  }, []);

  // Both loaders share the same stale-response guard: a new request aborts the
  // previous one, and only the newest request id may write state.
  const loadDemo = useCallback(async function loadDemoRun() {
    abortRef.current?.abort();
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
    async function runAnalysisNow(url: string) {
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
        const payload = await analyzeRepositoryApi(url, controller.signal);
        if (requestId !== requestRef.current) return;
        setDataset(payload);
        navigate('Overview');
      } catch (analysisError) {
        if (requestId !== requestRef.current || isAbortError(analysisError)) return;
        if (analysisError instanceof ApiError) {
          setError({
            message: analysisError.message,
            hint:
              analysisError.kind === 'rate_limit' && analysisError.retryAt
                ? `GitHub's limit is expected to reset ${relativeTime(analysisError.retryAt)}.`
                : undefined,
            retry: () => void runAnalysisNow(url),
          });
        } else {
          setError({ message: 'Repository analysis failed.', retry: () => void runAnalysisNow(url) });
        }
      } finally {
        if (requestId === requestRef.current) setBusy(null);
      }
    },
    [navigate, setDataset],
  );

  const analyze = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedUrl = repoUrl.trim();
      if (!trimmedUrl) {
        setError({ message: 'Enter a public GitHub repository URL to analyze.' });
        return;
      }
      void runAnalysis(trimmedUrl);
    },
    [repoUrl, runAnalysis],
  );

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
                    ? {
                        ...item,
                        files: payload.files,
                        stats: payload.stats,
                        detailStatus: payload.detailStatus,
                      }
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
          message:
            loadError instanceof ApiError
              ? loadError.message
              : 'Could not retrieve commit details.',
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
  }, [loadDemo]);

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
          ? <ContributorsPage data={data} />
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

  return (
    <Layout
      activePage={activePage}
      data={data}
      analyzing={busy === 'analyze'}
      menuOpen={menuOpen}
      repoUrl={repoUrl}
      onOpenMenu={() => setMenuOpen(true)}
      onCloseMenu={() => setMenuOpen(false)}
      onNavigate={navigate}
      onRepoUrlChange={setRepoUrl}
      onAnalyze={analyze}
      onLoadDemo={() => void loadDemo()}
    >
      {data && busy && (
        <div className="busy-banner" role="status" aria-live="polite">
          {busy === 'analyze' ? 'Analyzing repository history…' : 'Loading repository data…'}
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
            <Github size={26} aria-hidden="true" />
            <h1>Choose a repository to begin</h1>
            <p>
              Paste a public GitHub repository URL above. Repository data stays separate from the
              prepared demo dataset.
            </p>
            <button type="button" className="button-muted" onClick={() => void loadDemo()}>
              Load demo data
            </button>
          </div>
        )
      ) : (
        pageContent
      )}
    </Layout>
  );
}
