import type { CommitDetail, RepoResponse } from '../types';

export type ApiErrorKind =
  | 'invalid_url'
  | 'invalid_branch'
  | 'not_found'
  | 'rate_limit'
  | 'access_denied'
  | 'empty_repository'
  | 'upstream'
  | 'timeout'
  | 'network'
  | 'unknown';

/** Normalized API failure with a machine-readable kind and HTTP status. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly retryAt: string | null;

  constructor(
    message: string,
    options: { kind?: ApiErrorKind; status?: number; retryAt?: string | null } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = options.kind ?? 'unknown';
    this.status = options.status ?? 0;
    this.retryAt = options.retryAt ?? null;
  }
}

const KIND_BY_CODE: Record<string, ApiErrorKind> = {
  missing_url: 'invalid_url',
  invalid_url: 'invalid_url',
  invalid_sha: 'invalid_url',
  invalid_branch: 'invalid_branch',
  not_found: 'not_found',
  rate_limit: 'rate_limit',
  access_denied: 'access_denied',
  empty_repository: 'empty_repository',
  upstream: 'upstream',
  timeout: 'timeout',
};

function kindForStatus(status: number): ApiErrorKind {
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limit';
  if (status === 403) return 'access_denied';
  if (status === 504) return 'timeout';
  if (status >= 500) return 'upstream';
  return 'unknown';
}

export function isAbortError(error: unknown): boolean {
  return (error as Error | null)?.name === 'AbortError';
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError(
      'Could not reach the RepoRadar server. Confirm the backend is running and try again.',
      { kind: 'network' },
    );
  }
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const record = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
    const code = typeof record.code === 'string' ? record.code : '';
    const message =
      typeof record.error === 'string' && record.error
        ? record.error
        : `Request failed with status ${response.status}.`;
    const retryAt = typeof record.retryAt === 'string' ? record.retryAt : null;
    throw new ApiError(message, {
      kind: KIND_BY_CODE[code] ?? kindForStatus(response.status),
      status: response.status,
      retryAt,
    });
  }
  return payload as T;
}

export type BranchSummary = {
  branches: Array<{ name: string }>;
  default_branch: string | null;
};

export function fetchDemo(signal?: AbortSignal): Promise<RepoResponse> {
  return requestJson<RepoResponse>('/api/demo', { signal });
}

export function analyzeRepository(
  repoUrl: string,
  branch?: string | null,
  signal?: AbortSignal,
): Promise<RepoResponse> {
  return requestJson<RepoResponse>('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl, branch: branch || undefined }),
    signal,
  });
}

/** Non-fatal enhancement: list selectable branches for a live repository. */
export function fetchBranches(repoUrl: string, signal?: AbortSignal): Promise<BranchSummary> {
  return requestJson<BranchSummary>(`/api/branches?repoUrl=${encodeURIComponent(repoUrl)}`, { signal });
}

export function fetchCommitDetail(
  repoUrl: string,
  sha: string,
  signal?: AbortSignal,
): Promise<CommitDetail> {
  return requestJson<CommitDetail>('/api/commit-detail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl, sha }),
    signal,
  });
}
