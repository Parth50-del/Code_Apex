import type { ReactNode } from 'react';
import { AlertTriangle, Braces, Inbox, LoaderCircle } from 'lucide-react';
import type { DataSource } from '../types';
import { riskLabelForScore, RISK_HIGH_THRESHOLD, RISK_MEDIUM_THRESHOLD } from '../lib/format';

export function Spinner({ size = 16 }: { size?: number }) {
  return <LoaderCircle size={size} className="spin" aria-hidden="true" />;
}

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {description && <p className="page-description">{description}</p>}
    </header>
  );
}

export function SectionHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div className="section-heading-text">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function MetricStrip({ children }: { children: ReactNode }) {
  return (
    <section className="metric-strip" aria-label="Repository metrics">
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  subtext,
  tone,
}: {
  label: string;
  value: ReactNode;
  subtext?: string;
  tone?: 'default' | 'risk' | 'success' | 'warning' | 'danger';
}) {
  return (
    <div className="metric-cell">
      <span className="metric-label">{label}</span>
      <strong className={tone && tone !== 'default' ? `metric-value metric-${tone}` : 'metric-value'}>
        {value}
      </strong>
      {subtext && <span className="metric-subtext">{subtext}</span>}
    </div>
  );
}

export function RiskScore({ score, label }: { score: number; label?: string }) {
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
      className={`risk-score ${tone}`}
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
    <span className={`source-label ${source === 'live' ? 'source-live' : 'source-demo'}`}>
      <span className="source-dot" aria-hidden="true" />
      {source === 'live' ? 'Live GitHub data' : 'Demo data'}
    </span>
  );
}

export function EmptyState({
  title,
  detail,
  icon = 'braces',
  action,
}: {
  title: string;
  detail: string;
  icon?: 'braces' | 'inbox';
  action?: ReactNode;
}) {
  const Icon = icon === 'inbox' ? Inbox : Braces;
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
            <button
              key={action.label}
              type="button"
              className="error-banner-action"
              onClick={action.onClick}
            >
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
      <Spinner size={19} />
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
