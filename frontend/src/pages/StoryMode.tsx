import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleCheck, RotateCcw } from 'lucide-react';
import type { RepoResponse } from '../types';
import { churnFor, dateOnly, dateTime, commitActivitySeries, commitSubject } from '../lib/format';
import { Author } from '../components/commit';
import { CommitActivityChart } from '../components/Charts';
import { PageHeader, RiskScore, SeverityBadge as SeverityPill } from '../components/ui';

export const STORY_STEPS = [
  'Repository context',
  'Historical activity',
  'A high-ranked file',
  'Evidence in commits',
  'Suggested investigation',
] as const;

export function StoryModePage({
  data,
  storyStep,
  onSelectStep,
  onNext,
  onBack,
  onRestart,
  onOpenFile,
  onOpenCommit,
}: {
  data: RepoResponse;
  storyStep: number;
  onSelectStep: (index: number) => void;
  onNext: () => void;
  onBack: () => void;
  onRestart: () => void;
  onOpenFile: (path: string) => void;
  onOpenCommit: (sha: string) => void;
}) {
  const riskFile = data.fileDetails[0] ?? null;
  const latest = data.commits[0] ?? null;
  const oldest = data.commits[data.commits.length - 1] ?? null;
  const evidence = riskFile ? data.commits.filter((commit) => riskFile.commits?.includes(commit.sha)) : [];
  const filesObserved = data.summary.filesAnalyzed ?? data.fileDetails.length;
  const detailed = data.summary.commitsDetailed;
  const detailSummary =
    typeof detailed === 'number'
      ? `File details were fetched for ${detailed} of ${data.commits.length} commits`
      : 'File details were fetched for a subset of commits';

  const contentByStep: ReactNode[] = [
    <p key="context">
      This walkthrough uses <strong>{data.repository.full_name}</strong>, loaded from{' '}
      {data.source === 'live' ? 'live GitHub data' : 'the prepared demo fixture'}. The current analysis contains{' '}
      <strong>{data.commits.length}</strong> retrieved commits, <strong>{data.contributors.length}</strong>{' '}
      observed contributors, and <strong>{filesObserved}</strong> distinct changed-file paths, of which{' '}
      <strong>{data.fileDetails.length}</strong> are ranked.
    </p>,
    latest ? (
      <p key="history">
        The newest commit in this window is <strong>{commitSubject(latest.message)}</strong> by {latest.author} on{' '}
        {dateTime(latest.date)}.
        {oldest && oldest.sha !== latest.sha
          ? ` The window reaches back to ${commitSubject(oldest.message)} on ${dateOnly(oldest.date)}.`
          : ''}{' '}
        {detailSummary}, so file-level evidence is partial where details were not loaded.
      </p>
    ) : (
      <p key="history">
        There are no commits available in this analysis, so recent repository activity cannot be presented. Load a
        repository with commit history to continue the walkthrough.
      </p>
    ),
    riskFile ? (
      <p key="risk">
        <code>{riskFile.path}</code> is the highest-ranked file with a heuristic score of{' '}
        <strong>
          {riskFile.score}/100 ({riskFile.label})
        </strong>
        , {riskFile.changeCount ?? 'an unknown number of'} observed edits, and {churnFor(riskFile) ?? 'unavailable'}{' '}
        lines of churn. This is a review lead, not evidence of a confirmed bug.
      </p>
    ) : (
      <p key="risk">
        No file details were returned, so RepoRadar cannot select a highest-ranked file for this step. File rankings
        depend on changed-file details from the analyzed commits.
      </p>
    ),
    evidence.length && riskFile ? (
      <p key="evidence">
        {evidence.length} commit{evidence.length === 1 ? ' is' : 's are'} associated with <code>{riskFile.path}</code>:{' '}
        {evidence.map((commit) => `${commit.sha.slice(0, 7)} (${dateOnly(commit.date)})`).join(', ')}. Open a commit in
        Time Machine to inspect its actual file details when they have been loaded.
      </p>
    ) : (
      <p key="evidence">
        No supporting commit references are available for a ranked file in this dataset, so this step cannot present
        commit evidence.
      </p>
    ),
    riskFile ? (
      <p key="next">
        A reasonable next investigation is to inspect <code>{riskFile.path}</code> and compare its changes across{' '}
        {evidence.length} supporting commit{evidence.length === 1 ? '' : 's'}. Start with the latest dated evidence.
        This is a suggested workflow, not a claim about the cause or existence of a defect.
      </p>
    ) : (
      <p key="next">
        Without changed-file history, a specific investigation target cannot be recommended from this analysis.
      </p>
    ),
  ];

  const isLast = storyStep === STORY_STEPS.length - 1;

  return (
    <div className="page-body">
      <PageHeader
        eyebrow="Guided walkthrough"
        title="Story Mode"
        description="A five-step, data-grounded tour of what this analysis found — from repository context to a concrete review plan."
      />

      <section className="story-layout">
        <div className="story-rail" role="group" aria-label="Story steps">
          {STORY_STEPS.map((step, index) => (
            <button
              type="button"
              key={step}
              aria-current={index === storyStep ? 'step' : undefined}
              className={`story-step ${index === storyStep ? 'story-step-active' : ''} ${
                index < storyStep ? 'story-step-done' : ''
              }`}
              onClick={() => onSelectStep(index)}
            >
              <span className="story-step-index" aria-hidden="true">
                {index < storyStep ? <CircleCheck size={13} aria-hidden="true" /> : index + 1}
              </span>
              {step}
            </button>
          ))}
        </div>

        <article className="story-content" aria-label={STORY_STEPS[storyStep]}>
          <div className="story-topline">
            <span>
              Step {storyStep + 1} of {STORY_STEPS.length}
            </span>
            <span>{data.repository.full_name}</span>
          </div>
          <div
            className="story-progressbar"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STORY_STEPS.length}
            aria-valuenow={storyStep + 1}
            aria-label="Story progress"
          >
            <span style={{ width: `${((storyStep + 1) / STORY_STEPS.length) * 100}%` }} />
          </div>
          <h2 className="story-step-title">{STORY_STEPS[storyStep]}</h2>
          <div className="story-copy">{contentByStep[storyStep]}</div>

          <div className="story-evidence">{storyEvidence(storyStep, data, { riskFile, latest, evidence, onOpenCommit })}</div>
          {storyStep === 2 && riskFile && (
            <button type="button" className="text-action" onClick={() => onOpenFile(riskFile.path)}>
              Open file evidence in Risk Radar <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
          {storyStep === 3 && evidence[0] && (
            <button type="button" className="text-action" onClick={() => onOpenCommit(evidence[0].sha)}>
              Inspect supporting commit in Time Machine <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
          {storyStep === 4 && riskFile && (
            <button type="button" className="text-action" onClick={() => onOpenFile(riskFile.path)}>
              Review the ranked file in Risk Radar <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}

          {isLast && (
            <div className="story-complete" role="status">
              <CheckCircle2 size={14} aria-hidden="true" />
              Walkthrough complete — restart anytime to run it again
            </div>
          )}

          <div className="story-controls">
            <button type="button" className="btn btn-soft" disabled={storyStep === 0} onClick={onBack}>
              <ArrowLeft size={14} aria-hidden="true" /> Back
            </button>
            <button type="button" className="btn btn-soft" onClick={onRestart}>
              <RotateCcw size={14} aria-hidden="true" /> Restart
            </button>
            <button type="button" className="btn btn-primary lead" disabled={isLast} onClick={onNext}>
              Next <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </article>
      </section>

      {riskFile && (
        <div className="story-summary">
          <span className="quiet-label">Highest-ranked file in this dataset</span>
          <code>{riskFile.path}</code>
          <RiskScore score={riskFile.score} label={riskFile.label} />
        </div>
      )}
    </div>
  );
}

function storyEvidence(
  step: number,
  data: RepoResponse,
  ctx: {
    riskFile: RepoResponse['fileDetails'][number] | null;
    latest: RepoResponse['commits'][number] | null;
    evidence: RepoResponse['commits'];
    onOpenCommit: (sha: string) => void;
  },
): ReactNode {
  const { riskFile, latest, evidence, onOpenCommit } = ctx;
  if (step === 0) {
    return (
      <div className="story-stats">
        <div className="stat-pill">
          <b>{data.commits.length}</b> commits retrieved
        </div>
        <div className="stat-pill">
          <b>{data.contributors.length}</b> contributors
        </div>
        <div className="stat-pill">
          <b>{data.fileDetails.length}</b> files ranked
        </div>
      </div>
    );
  }
  if (step === 1) {
    return latest ? (
      <div className="mini-chart">
        <CommitActivityChart data={activityForStory(data)} granularity={activityGranularity(data)} compact />
      </div>
    ) : null;
  }
  if (step === 2) {
    return riskFile ? (
      <div className="story-card">
        <div className="story-card-head">
          <code>{riskFile.path}</code>
          <div className="story-card-score">
            <SeverityPill label={riskFile.label} />
            <RiskScore score={riskFile.score} label={riskFile.label} large />
          </div>
        </div>
        <div className="story-card-factors">
          {riskFile.factors.map((factor) => (
            <div className="factor-row" key={factor.label}>
              <dt className="factor-label">{factor.label}</dt>
              <dd className="factor-numbers">
                <span className="factor-contribution">
                  {factor.points ?? '—'}
                  {factor.maxPoints ? ` / ${factor.maxPoints}` : ''} pts
                </span>
              </dd>
              <dd className="factor-value">{factor.value}</dd>
              <span className="factor-meter" aria-hidden="true">
                <span style={{ width: `${factor.maxPoints ? Math.min(100, ((factor.points ?? 0) / factor.maxPoints) * 100) : 0}%` }} />
              </span>
            </div>
          ))}
        </div>
      </div>
    ) : null;
  }
  if (step === 3) {
    return evidence.length && riskFile ? (
      <div className="story-chips">
        {evidence.map((commit) => (
          <button
            key={commit.sha}
            type="button"
            className="story-chip"
            aria-label={`Open commit ${commit.sha.slice(0, 7)} in Time Machine`}
            onClick={() => onOpenCommit(commit.sha)}
          >
            <Author name={commit.author} login={commit.authorLogin} avatarSize="sm" />
            <code>{commit.sha.slice(0, 7)}</code>
            <span>{dateOnly(commit.date)}</span>
          </button>
        ))}
      </div>
    ) : null;
  }
  if (step === 4) {
    return riskFile ? (
      <ol className="story-checklist">
        <li>
          <CheckCircle2 size={15} aria-hidden="true" />
          Open the file&apos;s history for <code>{riskFile.path}</code> and read the most recent edits end to end.
        </li>
        <li>
          <CheckCircle2 size={15} aria-hidden="true" />
          Compare its factor breakdown with neighboring files before choosing review depth.
        </li>
        <li>
          <CheckCircle2 size={15} aria-hidden="true" />
          Decide what deserves a second look — the score ranks review priority, it does not prove a defect.
        </li>
      </ol>
    ) : null;
  }
  return null;
}

function activityForStory(data: RepoResponse) {
  return commitActivitySeries(data.commits).points;
}
function activityGranularity(data: RepoResponse) {
  return commitActivitySeries(data.commits).granularity;
}
