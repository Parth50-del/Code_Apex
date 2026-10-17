import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  GitCommitHorizontal,
  Home,
  Menu,
  Shield,
  Users,
  X,
} from 'lucide-react';
import type { PageName, RepoResponse } from '../types';
import { SourceLabel, Spinner } from './ui';

export const NAV_ITEMS = [
  { label: 'Overview', icon: Home },
  { label: 'Risk Radar', icon: Shield },
  { label: 'Time Machine', icon: GitCommitHorizontal },
  { label: 'Contributors', icon: Users },
  { label: 'Story Mode', icon: BookOpen },
] as const;

function SidebarContent({
  activePage,
  data,
  onNavigate,
  onLoadDemo,
}: {
  activePage: PageName;
  data: RepoResponse | null;
  onNavigate: (page: PageName) => void;
  onLoadDemo: () => void;
}) {
  return (
    <>
      <div className="brand-lockup">
        <span className="brand-symbol">
          <Activity size={18} aria-hidden="true" />
        </span>
        <span className="brand-text">
          RepoRadar
          <small>Repository intelligence</small>
        </span>
      </div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="sidebar-nav" aria-label="Workspace pages">
        {NAV_ITEMS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className={`nav-item ${activePage === label ? 'nav-item-active' : ''}`}
            aria-current={activePage === label ? 'page' : undefined}
            onClick={() => onNavigate(label)}
          >
            <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-repo-label">CURRENT REPOSITORY</div>
        {data ? (
          <>
            <strong className="sidebar-repo-name" title={data.repository.full_name}>
              {data.repository.full_name}
            </strong>
            <SourceLabel source={data.source} />
          </>
        ) : (
          <span className="quiet-label">No repository selected</span>
        )}
        <button
          type="button"
          className="sidebar-demo-button"
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

function MobileMenu({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
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
        <button
          ref={closeRef}
          type="button"
          className="mobile-close"
          aria-label="Close navigation"
          onClick={onClose}
        >
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
  onOpenMenu,
  onCloseMenu,
  onNavigate,
  onRepoUrlChange,
  onAnalyze,
  onLoadDemo,
  children,
}: {
  activePage: PageName;
  data: RepoResponse | null;
  analyzing: boolean;
  menuOpen: boolean;
  repoUrl: string;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onNavigate: (page: PageName) => void;
  onRepoUrlChange: (value: string) => void;
  onAnalyze: (event: FormEvent<HTMLFormElement>) => void;
  onLoadDemo: () => void;
  children: ReactNode;
}) {
  const sidebar = (
    <SidebarContent
      activePage={activePage}
      data={data}
      onNavigate={(page) => {
        onNavigate(page);
        onCloseMenu();
      }}
      onLoadDemo={onLoadDemo}
    />
  );

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="desktop-sidebar" aria-label="Workspace navigation">
        {sidebar}
      </aside>
      <MobileMenu open={menuOpen} onClose={onCloseMenu}>
        {sidebar}
      </MobileMenu>

      <div className="main-column">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={onOpenMenu}
          >
            <Menu size={19} aria-hidden="true" />
          </button>
          <div className="topbar-repo">
            <span className="topbar-kicker">REPOSITORY</span>
            <strong>{data?.repository.full_name ?? 'Select a repository'}</strong>
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
            <button type="submit" disabled={analyzing}>
              {analyzing ? <Spinner size={14} /> : null}
              {analyzing ? 'Analyzing' : 'Analyze'}
            </button>
          </form>
        </header>

        <main className="main-content" id="main-content" tabIndex={-1}>
          {children}
        </main>

        <footer className="app-footer">
          <span>RepoRadar</span>
          <span>Risk scores are review-priority heuristics, not defect predictions.</span>
        </footer>
      </div>
    </div>
  );
}
