import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  GitBranch,
  GitCommitHorizontal,
  Home,
  Radar,
  Shield,
  Users,
  X,
} from 'lucide-react';
import type { PageName, RepoResponse } from '../types';
import { AuthorAvatar } from './commit';
import { SourceLabel } from './ui';

export const NAV_ITEMS = [
  { label: 'Overview', icon: Home },
  { label: 'Risk Radar', icon: Shield },
  { label: 'Time Machine', icon: GitCommitHorizontal },
  { label: 'Contributors', icon: Users },
  { label: 'Story Mode', icon: BookOpen },
] as const;

/** RepoRadar brand mark: radar rings with a sweep and a blip. */
export function BrandMark({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.6" />
      <path d="M12 12 18.2 5.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

function ownerOf(fullName: string): string {
  return fullName.split('/')[0] ?? '';
}

function SidebarContent({
  activePage,
  data,
  branches,
  branch,
  onNavigate,
  onLoadDemo,
  onBranchChange,
}: {
  activePage: PageName;
  data: RepoResponse | null;
  branches: string[];
  branch: string;
  onNavigate: (page: PageName) => void;
  onLoadDemo: () => void;
  onBranchChange?: (branch: string) => void;
}) {
  return (
    <>
      <div className="sidebar-brand">
        <span className="brand-mark">
          <BrandMark size={19} />
        </span>
        <span className="brand-text">
          <strong>RepoRadar</strong>
          <small>Repository intelligence</small>
        </span>
      </div>
      <div className="nav-label">Workspace</div>
      <nav className="nav" aria-label="Workspace pages">
        {NAV_ITEMS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className={`nav-link ${activePage === label ? 'is-active' : ''}`}
            aria-current={activePage === label ? 'page' : undefined}
            onClick={() => onNavigate(label)}
          >
            <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="nav-label">Current repository</div>
        <div className="repo-card">
          {data ? (
            <>
              <div className="repo-card-ident">
                <AuthorAvatar name={ownerOf(data.repository.full_name)} login={ownerOf(data.repository.full_name)} size="sm" />
                <a
                  className="repo-card-name"
                  href={data.repository.html_url}
                  target="_blank"
                  rel="noreferrer"
                  title={data.repository.full_name}
                >
                  {data.repository.full_name}
                </a>
              </div>
              <div className="repo-card-meta">
                <span>
                  <GitBranch size={11} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />
                  {data.repository.analyzed_branch ?? data.repository.default_branch}
                </span>
                {data.repository.language && <span>{data.repository.language}</span>}
              </div>
              {data.source === 'live' && branches.length > 0 && onBranchChange && (
                <label className="control-field repo-card-branch">
                  <span className="sr-only">Branch</span>
                  <select value={branch} onChange={(event) => onBranchChange(event.target.value)}>
                    {branches.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <SourceLabel source={data.source} />
            </>
          ) : (
            <span className="quiet-label">No repository selected</span>
          )}
        </div>
        <button
          type="button"
          className="btn btn-soft btn-block btn-sm"
          onClick={() => {
            void onLoadDemo();
          }}
        >
          Load demo repository
        </button>
      </div>
    </>
  );
}

function MobileMenu({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="mobile-menu-backdrop" onClick={onClose}>
      <aside
        ref={panelRef}
        id="mobile-nav"
        className="mobile-sidebar"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        onClick={(event) => event.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="mobile-close" aria-label="Close navigation" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
        {children}
      </aside>
    </div>
  );
}

export function Layout({
  activePage,
  data,
  analyzing,
  menuOpen,
  repoUrl,
  loadedRepo,
  branches,
  branch,
  onOpenMenu,
  onCloseMenu,
  onNavigate,
  onRepoUrlChange,
  onAnalyze,
  onLoadDemo,
  onBranchChange,
  children,
}: {
  activePage: PageName;
  data: RepoResponse | null;
  analyzing: boolean;
  menuOpen: boolean;
  repoUrl: string;
  loadedRepo: string | null;
  branches: string[];
  branch: string;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onNavigate: (page: PageName) => void;
  onRepoUrlChange: (value: string) => void;
  onAnalyze: (event: FormEvent<HTMLFormElement>) => void;
  onLoadDemo: () => void;
  onBranchChange?: (branch: string) => void;
  children: ReactNode;
}) {
  const sidebar = (
    <SidebarContent
      activePage={activePage}
      data={data}
      branches={branches}
      branch={branch}
      onNavigate={(page) => {
        onNavigate(page);
        onCloseMenu();
      }}
      onLoadDemo={onLoadDemo}
      onBranchChange={onBranchChange}
    />
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="app-sidebar" aria-label="Workspace navigation">
        {sidebar}
      </aside>
      <MobileMenu open={menuOpen} onClose={onCloseMenu}>
        {sidebar}
      </MobileMenu>

      <div className="app-column">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={onOpenMenu}
          >
            <MenuIcon />
          </button>
          <div className="topbar-repo">
            <small>Repository</small>
            <strong>{loadedRepo ?? data?.repository.full_name ?? 'Select a repository'}</strong>
          </div>
          {data && (
            <a className="topbar-github" href={data.repository.html_url} target="_blank" rel="noreferrer">
              View on GitHub <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          )}
          <form className="repo-form" onSubmit={onAnalyze} role="search">
            <label className="sr-only" htmlFor="repository-url">
              GitHub repository URL
            </label>
            <input
              id="repository-url"
              value={repoUrl}
              onChange={(event) => onRepoUrlChange(event.target.value)}
              placeholder="github.com/owner/repository"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="btn btn-primary" disabled={analyzing}>
              {analyzing ? <SpinnerInline /> : <RadarMarkIcon />}
              {analyzing ? 'Analyzing' : 'Analyze'}
            </button>
          </form>
        </header>

        <main className="app-main" id="main-content" tabIndex={-1}>
          {children}
        </main>

        <footer className="app-footer">
          <span>
            <strong>RepoRadar</strong> · Heuristic repository intelligence
          </span>
          <span>Risk scores are review-priority heuristics, not defect predictions.</span>
        </footer>
      </div>
    </div>
  );
}

function SpinnerInline() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" className="spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function RadarMarkIcon() {
  return <BrandMark size={14} />;
}

function MenuIcon() {
  return (
    <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
