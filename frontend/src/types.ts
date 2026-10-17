export type DataSource = 'live' | 'demo';

export type FileChange = {
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

export type DetailStatus = 'available' | 'unavailable' | 'not-fetched';

export type CommitItem = {
  sha: string;
  message: string;
  author: string;
  authorLogin?: string | null;
  authorType?: 'Bot' | 'User' | null;
  date: string;
  html_url: string | null;
  /** GitHub only returns this for commits whose full details were fetched. */
  stats?: { total?: number; additions?: number; deletions?: number } | null;
  files?: FileChange[] | null;
  detailStatus?: DetailStatus;
};

export type Contributor = {
  login: string;
  name: string;
  commit_count: number;
  recent_activity: string | null;
  files: string[];
  isBot?: boolean;
};

export type RiskFactor = {
  label: string;
  value: string;
  /** The 0-100 score for this factor. */
  score?: number;
  weight?: number;
  /** Integer weighted contribution; points across factors sum to the score. */
  points?: number;
  /** Maximum points this factor can contribute (weight * 100). */
  maxPoints?: number;
};

export type RiskEntry = {
  path: string;
  score: number;
  label: string;
  factors: RiskFactor[];
  additions?: number;
  deletions?: number;
  changeCount?: number;
  contributors?: string[];
  commits?: string[];
  lastChanged?: string | null;
  revertRelated?: boolean;
};

export type RepoInfo = {
  name: string;
  full_name: string;
  description: string;
  default_branch: string;
  language?: string | null;
  stars: number | null;
  forks: number | null;
  html_url: string;
  last_updated: string | null;
};

export type CommitDetail = {
  stats: { total?: number; additions?: number; deletions?: number } | null;
  files: FileChange[] | null;
  detailStatus: 'available' | 'unavailable';
};

export type RepoSummary = {
  commitCount: number;
  /** Commits whose changed-file details were actually fetched. */
  commitsDetailed?: number;
  contributorCount: number;
  filesAnalyzed?: number;
  detailCoverage?: string;
  highestRiskFile: string | null;
  timeRange: { oldest: string | null; newest: string | null } | null;
};

export type RepoResponse = {
  source: DataSource;
  repository: RepoInfo;
  commits: CommitItem[];
  contributors: Contributor[];
  fileDetails: RiskEntry[];
  summary: RepoSummary;
};

export type PageName =
  | 'Overview'
  | 'Risk Radar'
  | 'Time Machine'
  | 'Contributors'
  | 'Story Mode';
