import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Contributor, RiskEntry } from '../types';
import { EmptyState } from './ui';

const C = {
  accent: '#918cff',
  // The area fill uses a vertical gradient (solid at the line, fading toward
  // the baseline) so a flat series — e.g. one commit per day — still reads as
  // a line instead of a flooded block.
  area: 'url(#chart-area-fade)',
  additions: '#3fc98f',
  deletions: '#ef6a6a',
  grid: '#202732',
  axis: '#758093',
  dim: '#4d5666',
};

type Size = { ref: React.RefObject<HTMLDivElement>; width: number };

/** Measure an element's width so SVG charts can use real pixel coordinates. */
function useMeasure(): Size {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/* ---------------------------------------------------------------- wrappers */

export function ChartCard({
  title,
  description,
  children,
  footnote,
  badge,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footnote?: string;
  badge?: ReactNode;
}) {
  return (
    <section className="chart-card">
      <div className="chart-card-heading">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
        {badge && <div>{badge}</div>}
      </div>
      <div className="chart-canvas">{children}</div>
      {footnote && <p className="chart-footnote">{footnote}</p>}
    </section>
  );
}

type TooltipState = { x: number; y: number; index?: number; body: ReactNode } | null;

function ChartTooltip({ state }: { state: TooltipState }) {
  if (!state) return null;
  return (
    <div className="chart-tooltip" style={{ left: state.x, top: state.y }} aria-hidden="true">
      {state.body}
    </div>
  );
}

/* -------------------------------------------------- commit activity chart */

export function CommitActivityChart({
  data,
  granularity,
  compact,
}: {
  data: Array<{ key: string; label: string; count: number }>;
  granularity?: 'day' | 'week';
  compact?: boolean;
}) {
  const { ref, width } = useMeasure();
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const height = compact ? 150 : 210;

  if (!data.length) {
    return (
      <EmptyState
        title="No dated commits"
        detail="None of the analyzed commits have a parseable date, so activity over time cannot be charted."
      />
    );
  }

  const pad = { top: 16, right: compact ? 12 : 16, bottom: 26, left: 34 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  // Scale with ~25% headroom so a peak — or a completely flat series, like the
  // demo's one-commit-per-day window — never touches the top of the plot.
  const max = Math.max(1, ...data.map((point) => point.count)) * 1.25;
  const n = data.length;
  const x = (index: number) => (n === 1 ? pad.left + plotW / 2 : pad.left + (index * plotW) / (n - 1));
  const y = (value: number) => pad.top + plotH - (value / max) * plotH;

  const linePath = data.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.count).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${x(n - 1).toFixed(1)},${(pad.top + plotH).toFixed(1)} L${x(0).toFixed(1)},${(pad.top + plotH).toFixed(1)} Z`;

  const ticks = Array.from(new Set([0, Math.round((max / 1.25 / 2) * 2) / 2, Math.round(max / 1.25)])).sort((a, b) => a - b);
  // Show x labels only when there is pixel room for them (labels are ~7 chars wide).
  const labelEvery = Math.max(1, Math.ceil((n * 64) / Math.max(1, plotW)));
  const summary = data.map((point) => `${point.label}: ${point.count}`).join(', ');

  return (
    <div
      className="chart-figure"
      ref={ref}
      style={{ height, position: 'relative' }}
      role="img"
      aria-label={`Commit activity${granularity === 'week' ? ' by week' : ' by day'}. ${summary}`}
      onMouseLeave={() => setTooltip(null)}
    >
      {granularity && <span className="chart-axis-note">{granularity === 'week' ? 'Weekly' : 'Daily'}</span>}
      {width > 0 && (
        <svg width={width} height={height} aria-hidden="true">
          <defs>
            <linearGradient id="chart-area-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#918cff" stopOpacity="0.30" />
              <stop offset="55%" stopColor="#918cff" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#918cff" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {ticks.map((tick, index) => (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={C.grid}
                strokeDasharray={index === 0 ? undefined : '2 4'}
              />
              <text x={pad.left - 8} y={y(tick) + 3} textAnchor="end" fontSize="10" fill={C.axis}>
                {Number.isInteger(tick) ? tick : tick.toFixed(1)}
              </text>
            </g>
          ))}
          <path d={areaPath} fill={C.area} stroke="none" />
          <path d={linePath} fill="none" stroke={C.accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {data.map((point, index) => (
            <g key={point.key}>
              <circle
                cx={x(index)}
                cy={y(point.count)}
                r={tooltip && tooltip.index !== undefined && data[tooltip.index] === point ? 3.4 : 2.4}
                fill={C.accent}
                stroke="#10141d"
                strokeWidth="1.4"
              />
              {index % labelEvery === 0 && (
                <text x={x(index)} y={height - 8} textAnchor="middle" fontSize="10" fill={C.axis}>
                  {point.label}
                </text>
              )}
            </g>
          ))}
          {/* Hover zones across the full plot height, one per bucket. */}
          {data.map((point, index) => {
            const half = (n === 1 ? plotW : plotW / (n - 1)) / 2;
            const zoneLeft = Math.max(pad.left, x(index) - half);
            const zoneRight = Math.min(width - pad.right, x(index) + half);
            return (
              <rect
                key={`zone-${point.key}`}
                x={zoneLeft}
                y={pad.top}
                width={zoneRight - zoneLeft}
                height={plotH}
                fill="transparent"
                onMouseEnter={() =>
                  setTooltip({
                    index,
                    x: Math.min(Math.max(zoneLeft, 4), width - 150),
                    y: Math.max(4, y(point.count) - 58),
                    body: (
                      <>
                        <div className="tt-title">{granularity === 'week' ? `Week of ${point.label}` : point.label}</div>
                        <div className="tt-row">
                          <i style={{ background: C.accent }} />
                          Commits <b>{point.count}</b>
                        </div>
                      </>
                    ),
                  })
                }
              />
            );
          })}
        </svg>
      )}
      <ChartTooltip state={tooltip} />
    </div>
  );
}

/* ------------------------------------------ additions vs deletions chart */

export function AdditionsDeletionsChart({
  data,
}: {
  data: Array<{ key: string; label: string; additions: number; deletions: number }>;
}) {
  const { ref, width } = useMeasure();
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const height = 210;

  if (!data.length) {
    return (
      <EmptyState
        title="No line statistics"
        detail="Line statistics were not returned for any commit, so additions versus deletions cannot be charted."
      />
    );
  }

  const pad = { top: 16, right: 16, bottom: 26, left: 34 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((point) => Math.max(point.additions, point.deletions)));
  const n = data.length;
  const slot = n ? plotW / n : 0;
  const groupW = Math.min(46, slot * 0.74);
  const barW = Math.max(3, groupW / 2 - 2);
  const ticks = Array.from(new Set([0, Math.round((max / 2) * 10) / 10, Math.round(max)])).sort((a, b) => a - b);
  // Same width-aware label budget as the activity chart: keep labels legible
  // no matter how many points or how narrow the plot is.
  const labelEvery = Math.max(1, Math.ceil((n * 64) / Math.max(1, plotW)));

  return (
    <div
      className="chart-figure"
      ref={ref}
      style={{ height, position: 'relative' }}
      role="img"
      aria-label={`Additions versus deletions for ${n} commit${n === 1 ? '' : 's'} with fetched line statistics.`}
      onMouseLeave={() => setTooltip(null)}
    >
      <div className="chart-legend">
        <span>
          <i style={{ background: C.additions }} aria-hidden="true" /> Additions
        </span>
        <span>
          <i style={{ background: C.deletions }} aria-hidden="true" /> Deletions
        </span>
      </div>
      {width > 0 && (
        <svg width={width} height={height - 20} aria-hidden="true">
          {ticks.map((tick, index) => {
            const yv = pad.top + plotH - (tick / max) * plotH;
            return (
              <g key={tick}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={yv}
                  y2={yv}
                  stroke={C.grid}
                  strokeDasharray={index === 0 ? undefined : '2 4'}
                />
                <text x={pad.left - 8} y={yv + 3} textAnchor="end" fontSize="10" fill={C.axis}>
                  {Number.isInteger(tick) ? tick : tick.toFixed(1)}
                </text>
              </g>
            );
          })}
          {data.map((point, index) => {
            const groupX = pad.left + index * slot + (slot - groupW) / 2;
            const addH = (point.additions / max) * plotH;
            const delH = (point.deletions / max) * plotH;
            return (
              <g key={point.key}>
                <rect x={groupX} y={pad.top + plotH - addH} width={barW} height={Math.max(1, addH)} rx="2.5" fill={C.additions} />
                <rect x={groupX + barW + 2} y={pad.top + plotH - delH} width={barW} height={Math.max(1, delH)} rx="2.5" fill={C.deletions} />
                {index % labelEvery === 0 && (
                  <text x={groupX + groupW / 2} y={height - 26} textAnchor="middle" fontSize="10" fill={C.axis}>
                    {point.label}
                  </text>
                )}
              </g>
            );
          })}
          {data.map((point, index) => {
            const zoneLeft = Math.max(pad.left, pad.left + index * slot);
            const zoneRight = Math.min(width - pad.right, pad.left + (index + 1) * slot);
            return (
              <rect
                key={`zone-${point.key}`}
                x={zoneLeft}
                y={pad.top}
                width={Math.max(0, zoneRight - zoneLeft)}
                height={plotH}
                fill="transparent"
                onMouseEnter={() =>
                  setTooltip({
                    index,
                    x: Math.min(Math.max(zoneLeft, 4), width - 150),
                    y: Math.max(4, pad.top + plotH - (point.additions / max) * plotH - 52),
                    body: (
                      <>
                        <div className="tt-title">Commit {point.label}</div>
                        <div className="tt-row">
                          <i style={{ background: C.additions }} />
                          Added <b>{point.additions}</b>
                        </div>
                        <div className="tt-row">
                          <i style={{ background: C.deletions }} />
                          Removed <b>{point.deletions}</b>
                        </div>
                      </>
                    ),
                  })
                }
              />
            );
          })}
        </svg>
      )}
      <ChartTooltip state={tooltip} />
    </div>
  );
}

/* ------------------------------------------- horizontal value rows (HTML) */

export function RowBars({
  points,
  ariaLabel,
  unit = 'commits',
  emptyDetail,
}: {
  points: Array<{ name: string; value: number; login?: string | null }>;
  ariaLabel: string;
  unit?: string;
  emptyDetail: string;
}) {
  const rows = [...points].sort((a, b) => b.value - a.value).slice(0, 8);
  if (!rows.length) {
    return <EmptyState title="Nothing to chart" detail={emptyDetail} />;
  }
  const max = Math.max(1, ...rows.map((row) => row.value));
  const summary = rows.map((row) => `${row.name}: ${row.value}`).join(', ');
  return (
    <div
      className="row-bars"
      role="img"
      aria-label={`${ariaLabel}: ${summary}`}
      style={{ display: 'grid' }}
    >
      {rows.map((row) => (
        <div className="row-bar" key={row.name} title={`${row.name}: ${row.value} ${row.value === 1 ? unit.replace(/s$/, '') : unit}`}>
          <span className="row-bar-name">
            <span>{row.name}</span>
          </span>
          <span className="row-bar-track">
            <span style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <span className="row-bar-value">
            {row.value} {row.value === 1 ? unit.replace(/s$/, '') : unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ContributorActivityChart({ contributors }: { contributors: Contributor[] }) {
  return (
    <RowBars
      points={contributors.map((contributor) => ({
        name: contributor.name || contributor.login,
        value: contributor.commit_count,
      }))}
      ariaLabel="Observed commits per contributor"
      emptyDetail="No contributor records were returned for this repository."
    />
  );
}

/* -------------------------------------------------- file churn top list */

export function FileChurnList({
  files,
  max = 6,
}: {
  files: RiskEntry[];
  max?: number;
}) {
  const data = [...files]
    .map((file) => ({
      name: file.path,
      value: (file.additions ?? 0) + (file.deletions ?? 0),
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  const shown = data.slice(0, max);
  if (!shown.length) {
    return <EmptyState title="No file churn" detail="No changed-file line statistics are available, so churn cannot be charted." />;
  }
  const top = shown[0].value;
  return (
    <div className="row-bars" role="img" aria-label={`Lines changed for the most-churned files: ${shown.map((row) => `${row.name}: ${row.value}`).join(', ')}`}>
      {shown.map((row) => (
        <div className="row-bar" key={row.name} title={`${row.name}: ${row.value} lines changed`}>
          <span className="row-bar-name" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            <span>{row.name.split('/').slice(-1)[0]}</span>
          </span>
          <span className="row-bar-track">
            <span style={{ width: `${Math.max(4, (row.value / top) * 100)}%` }} />
          </span>
          <span className="row-bar-value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------- severity mix bar */

export function SeverityMix({
  counts,
}: {
  counts: { high: number; medium: number; low: number };
}) {
  const total = counts.high + counts.medium + counts.low;
  if (!total) {
    return <EmptyState title="No ranked files" detail="Once files are ranked their severity mix appears here." />;
  }
  const pct = (value: number) => `${(value / total) * 100}%`;
  return (
    <div className="severity-mix">
      <div className="mix-track" role="img" aria-label={`Severity mix: ${counts.high} high, ${counts.medium} medium, ${counts.low} low of ${total} ranked files`}>
        {counts.high > 0 && <span className="mix-high" style={{ width: pct(counts.high) }} />}
        {counts.medium > 0 && <span className="mix-medium" style={{ width: pct(counts.medium) }} />}
        {counts.low > 0 && <span className="mix-low" style={{ width: pct(counts.low) }} />}
      </div>
      <div className="mix-legend">
        <span>
          <i style={{ background: 'var(--danger)' }} aria-hidden="true" /> High · {counts.high}
        </span>
        <span>
          <i style={{ background: 'var(--warning)' }} aria-hidden="true" /> Medium · {counts.medium}
        </span>
        <span>
          <i style={{ background: 'var(--success)' }} aria-hidden="true" /> Low · {counts.low}
        </span>
      </div>
    </div>
  );
}
