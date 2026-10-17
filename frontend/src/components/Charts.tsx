import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Contributor, RiskEntry } from '../types';
import { EmptyState } from './ui';

const C = {
  accent: '#5b9bd5',
  additions: '#7fb98a',
  deletions: '#d98b8b',
  grid: '#232b35',
  axis: '#78838f',
  text: '#a7b1bc',
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

export function ChartCard({
  title,
  description,
  children,
  footnote,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footnote?: string;
}) {
  return (
    <section className="chart-card">
      <div className="chart-card-heading">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      <div className="chart-canvas">{children}</div>
      {footnote && <p className="chart-footnote">{footnote}</p>}
    </section>
  );
}

export function CommitActivityChart({
  data,
}: {
  data: Array<{ key: string; label: string; count: number }>;
}) {
  const { ref, width } = useMeasure();
  const height = 190;

  if (!data.length) {
    return (
      <EmptyState
        title="No dated commits"
        detail="None of the analyzed commits have a parseable date, so activity over time cannot be charted."
      />
    );
  }

  const pad = { top: 14, right: 10, bottom: 26, left: 30 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((point) => point.count));
  const slot = data.length ? plotW / data.length : 0;
  const barW = Math.max(4, Math.min(42, slot * 0.62));
  const ticks = Array.from(new Set([0, Math.round(max / 2), max])).sort((a, b) => a - b);
  const summary = data
    .map((point) => `${point.label}: ${point.count} commit${point.count === 1 ? '' : 's'}`)
    .join(', ');

  return (
    <div
      className="chart-figure"
      ref={ref}
      style={{ height }}
      role="img"
      aria-label={`Commit activity over time. ${summary}`}
    >
      {width > 0 && (
        <svg width={width} height={height} aria-hidden="true">
          {ticks.map((tick, index) => {
            const y = pad.top + plotH - (tick / max) * plotH;
            return (
              <g key={tick}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y}
                  y2={y}
                  stroke={C.grid}
                  strokeDasharray={index === 0 ? undefined : '3 3'}
                />
                <text x={pad.left - 7} y={y + 3} textAnchor="end" fontSize="10" fill={C.axis}>
                  {tick}
                </text>
              </g>
            );
          })}
          {data.map((point, index) => {
            const barHeight = Math.max(2, (point.count / max) * plotH);
            const x = pad.left + index * slot + (slot - barW) / 2;
            const y = pad.top + plotH - barHeight;
            return (
              <g key={point.key}>
                <rect x={x} y={y} width={barW} height={barHeight} rx="2" fill={C.accent}>
                  <title>{`${point.label}: ${point.count} commit${point.count === 1 ? '' : 's'}`}</title>
                </rect>
                {index % labelInterval(data.length) === 0 && (
                  <text
                    x={x + barW / 2}
                    y={height - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill={C.axis}
                  >
                    {point.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export function AdditionsDeletionsChart({
  data,
}: {
  data: Array<{ key: string; label: string; additions: number; deletions: number }>;
}) {
  const { ref, width } = useMeasure();
  const height = 190;

  if (!data.length) {
    return (
      <EmptyState
        title="No line statistics"
        detail="Line statistics were not returned for any commit, so additions versus deletions cannot be charted."
      />
    );
  }

  const pad = { top: 26, right: 10, bottom: 26, left: 30 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((point) => Math.max(point.additions, point.deletions)));
  const slot = data.length ? plotW / data.length : 0;
  const groupW = Math.min(44, slot * 0.72);
  const barW = Math.max(3, groupW / 2 - 2);
  const ticks = Array.from(new Set([0, Math.round(max / 2), max])).sort((a, b) => a - b);

  return (
    <div
      className="chart-figure"
      ref={ref}
      style={{ height }}
      role="img"
      aria-label={`Additions versus deletions for ${data.length} commits with fetched line statistics.`}
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
        <svg width={width} height={height - 18} aria-hidden="true">
          {ticks.map((tick, index) => {
            const y = pad.top + plotH - (tick / max) * plotH;
            return (
              <g key={tick}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y}
                  y2={y}
                  stroke={C.grid}
                  strokeDasharray={index === 0 ? undefined : '3 3'}
                />
                <text x={pad.left - 7} y={y + 3} textAnchor="end" fontSize="10" fill={C.axis}>
                  {tick}
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
                <rect
                  x={groupX}
                  y={pad.top + plotH - addH}
                  width={barW}
                  height={Math.max(1, addH)}
                  rx="2"
                  fill={C.additions}
                >
                  <title>{`${point.label}: +${point.additions}`}</title>
                </rect>
                <rect
                  x={groupX + barW + 2}
                  y={pad.top + plotH - delH}
                  width={barW}
                  height={Math.max(1, delH)}
                  rx="2"
                  fill={C.deletions}
                >
                  <title>{`${point.label}: -${point.deletions}`}</title>
                </rect>
                {index % labelInterval(data.length) === 0 && (
                  <text
                    x={groupX + groupW / 2}
                    y={height - 26}
                    textAnchor="middle"
                    fontSize="10"
                    fill={C.axis}
                  >
                    {point.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export function FileChurnChart({ files }: { files: RiskEntry[] }) {
  const data = [...files]
    .map((file) => ({
      name: file.path,
      value: (file.additions ?? 0) + (file.deletions ?? 0),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .reverse();

  if (!data.length) {
    return (
      <EmptyState
        title="No file churn"
        detail="No changed-file history is available, so file churn cannot be charted."
      />
    );
  }

  return <HorizontalBarChart data={data} ariaLabel="Lines changed by file" />;
}

export function ContributorActivityChart({ contributors }: { contributors: Contributor[] }) {
  const data = contributors.map((contributor) => ({
    name: contributor.name || contributor.login,
    value: contributor.commit_count,
  }));

  if (!data.length) {
    return (
      <EmptyState
        title="No contributors"
        detail="No contributor records were returned for this repository."
      />
    );
  }

  return <HorizontalBarChart data={data} ariaLabel="Commits per contributor" />;
}

type HBarPoint = { name: string; value: number };

/** Show at most `max` evenly spaced x-axis labels so they never overlap. */
function labelInterval(count: number, max = 8): number {
  return Math.max(1, Math.ceil(count / max));
}

/** Truncate long labels from the left so the most specific part stays visible. */
function fitLabel(name: string, maxChars: number): string {
  if (name.length <= maxChars) return name;
  return `…${name.slice(-(maxChars - 1))}`;
}

function HorizontalBarChart({
  data,
  ariaLabel,
}: {
  data: HBarPoint[];
  ariaLabel: string;
}) {
  const { ref, width } = useMeasure();
  const rowH = 30;
  const height = Math.max(150, data.length * rowH + 28);
  const labelW = Math.min(190, Math.max(90, width * 0.42));
  const valueW = 44;
  const plotW = Math.max(0, width - labelW - valueW);
  const max = Math.max(1, ...data.map((point) => point.value));
  const summary = data.map((point) => `${point.name}: ${point.value}`).join(', ');

  return (
    <div
      className="chart-figure"
      ref={ref}
      style={{ height }}
      role="img"
      aria-label={`${ariaLabel}. ${summary}`}
    >
      {width > 0 && (
        <svg width={width} height={height} aria-hidden="true">
          {data.map((point, index) => {
            const y = index * rowH + 8;
            const barWidth = Math.max(2, (point.value / max) * plotW);
            return (
              <g key={point.name}>
                <text
                  x={labelW - 8}
                  y={y + rowH / 2 - 2}
                  textAnchor="end"
                  fontSize="11"
                  fill={C.text}
                >
                  {fitLabel(point.name, 26)}
                </text>
                <rect
                  x={labelW}
                  y={y}
                  width={barWidth}
                  height={rowH - 12}
                  rx="2"
                  fill={C.accent}
                >
                  <title>{`${point.name}: ${point.value}`}</title>
                </rect>
                <text x={labelW + barWidth + 6} y={y + rowH / 2 - 2} fontSize="11" fill={C.text}>
                  {point.value}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
