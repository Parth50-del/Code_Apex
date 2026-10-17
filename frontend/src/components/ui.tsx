import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Inbox,
  SearchX,
} from 'lucide-react';
import type { DataSource } from '../types';
import { riskLabelForScore, RISK_HIGH_THRESHOLD, RISK_MEDIUM_THRESHOLD } from '../lib/format';

/* ------------------------------------------------------------ feedback */

export function Spinner({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" className="spin" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
    <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>;
}

/* ------------------------------------------------------- page scaffolding */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <p className="page-eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Panel({
  kicker,
  title,
  sub,
  actions,
  children,
  foot,
  className,
  bodyClassName,
}: {
  kicker?: string;
  title?: string;
  sub?: string;
  actions?: ReactNode;
  children?: ReactNode;
  foot?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {(title || actions) && (
        <div className="panel-head">
          <div className="panel-titles">
            {kicker && <span className="panel-kicker">{kicker}</span>}
            {title && <h2>{title}</h2>}
            {sub && <p className="panel-sub">{sub}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      <div className={`panel-body ${bodyClassName ?? ''}`}>{children}</div>
      {foot && <div className="panel-foot">{foot}</div>}
    </section>
  );
}

export function SectionHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div className="section-head-text">
        <h2>{title}</h2>
        {sub && <p className="section-sub">{sub}</p>}
      </div>
      {actions}
    </div>
  );
}

/* -------------------------------------------------------------- metrics */

export function MetricTile({
  label,
  value,
  sub,
  tone,
  className,
  span,
  small,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  className?: string;
  span?: 3 | 4 | 6;
  small?: boolean;
}) {
  return (
    <div
      className={[
        'metric-tile',
        tone ? `tone-${tone}` : '',
        className ?? '',
        span ? `span-${span}` : 'span-3',
      ].join(' ')}
    >
      <span className="metric-label">{label}</span>
      <strong className={`metric-value ${small ? 'metric-value-sm' : ''}`}>{value}</strong>
      {sub && <span className="metric-sub">{sub}</span>}
    </div>
  );
}

/* ---------------------------------------------------------- risk pieces */

export function RiskScore({
  score,
  label,
  large,
}: {
  score: number;
  label?: string;
  large?: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, score));
  const severity = label ?? riskLabelForScore(score);
  const tone =
    score >= RISK_HIGH_THRESHOLD
      ? 'risk-high'
      : score >= RISK_MEDIUM_THRESHOLD
        ? 'risk-medium'
        : 'risk-low';
  return (
    <span
      className={`risk-meter ${tone} ${large ? 'lg' : ''}`}
      role="img"
      aria-label={`Review-priority score ${score} out of 100, severity ${severity}`}
    >
      <span className="risk-track">
        <span style={{ width: `${clamped}%` }} />
      </span>
      <span className="risk-number">{score}</span>
    </span>
  );
}

export function SeverityBadge({ label }: { label: string }) {
  const tone = label === 'High' ? 'badge-high' : label === 'Medium' ? 'badge-medium' : 'badge-low';
  return <span className={`severity-badge ${tone}`}>{label}</span>;
}

export function SourceLabel({ source }: { source: DataSource }) {
  return (
    <span className={`source-pill ${source === 'live' ? 'source-live' : 'source-demo'}`}>
      <span className="source-dot" aria-hidden="true" />
      {source === 'live' ? 'Live GitHub data' : 'Demo data'}
    </span>
  );
}

/* -------------------------------------------------------- interactions */

export function CopyButton({
  value,
  label = 'Copy to clipboard',
  compact,
}: {
  value: string;
  label?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      // Fallback for environments without the async clipboard API.
      const area = document.createElement('textarea');
      area.value = value;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      area.remove();
    }
    if (ok) {
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm ${compact ? '' : ''}`}
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
    >
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      <span aria-hidden="true" className={compact ? 'sr-only' : undefined}>
        {copied ? 'Copied' : label}
      </span>
    </button>
  );
}

export type MenuItem = {
  label: string;
  hint?: string;
  icon?: ReactNode;
  onClick: () => void;
};

export function DropdownMenu({ label, icon, items }: { label: string; icon?: ReactNode; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  return (
    <div className="menu-anchor" ref={ref}>
      <button
        type="button"
        className="btn btn-soft"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
        {label}
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div id={menuId} className="menu" role="menu" aria-label={label}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.hint && <small>{item.hint}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- states */

export function EmptyState({
  title,
  detail,
  icon = 'braces',
  action,
}: {
  title: string;
  detail: string;
  icon?: 'braces' | 'inbox' | 'search';
  action?: ReactNode;
}) {
  const Icon = icon === 'inbox' ? Inbox : icon === 'search' ? SearchX : Inbox;
  return (
    <div className="empty-state">
      <Icon size={20} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{detail}</span>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

export function InlineEmpty({ children }: { children: ReactNode }) {
  return <p className="inline-empty">{children}</p>;
}

export function ErrorBanner({
  message,
  hint,
  actions,
}: {
  message: string;
  hint?: string;
  actions?: Array<{ label: string; onClick: () => void }>;
}) {
  return (
    <div className="error-banner" role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <div className="error-banner-text">
        <span>{message}</span>
        {hint && <small>{hint}</small>}
      </div>
      {actions && actions.length > 0 && (
        <div className="error-banner-actions">
          {actions.map((action) => (
            <button key={action.label} type="button" className="error-banner-action" onClick={action.onClick}>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <Spinner size={22} />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ height = 16, width }: { height?: number; width?: string }) {
  return <span className="skeleton" style={{ height, width }} aria-hidden="true" />;
}

export function TableShell({
  caption,
  className,
  children,
}: {
  caption: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table className={`data-table ${className ?? ''}`}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}
