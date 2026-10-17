import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { StoryModePage } from './StoryMode';
import { makeRepo } from '../test/fixtures';

function renderStory(step = 0, overrides: Partial<React.ComponentProps<typeof StoryModePage>> = {}) {
  const props = {
    data: makeRepo(),
    storyStep: step,
    onSelectStep: vi.fn(),
    onNext: vi.fn(),
    onBack: vi.fn(),
    onRestart: vi.fn(),
    onOpenFile: vi.fn(),
    onOpenCommit: vi.fn(),
    ...overrides,
  };
  render(<StoryModePage {...props} />);
  return props;
}

describe('Story Mode navigation', () => {
  it('renders five steps and starts on step one', () => {
    renderStory();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Repository context' })).toBeInTheDocument();
    const steps = within(screen.getByRole('group', { name: 'Story steps' })).getAllByRole(
      'button',
    );
    expect(steps).toHaveLength(5);
    expect(steps[0]).toHaveAttribute('aria-current', 'step');
  });

  it('selects a step without navigating away', () => {
    const props = renderStory();
    fireEvent.click(screen.getByRole('button', { name: /A high-ranked file/ }));
    expect(props.onSelectStep).toHaveBeenCalledWith(2);
    expect(props.onOpenFile).not.toHaveBeenCalled();
    expect(props.onOpenCommit).not.toHaveBeenCalled();
  });

  it('keeps the user inside Story Mode when advancing', () => {
    const props = renderStory();
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect(props.onSelectStep).not.toHaveBeenCalled();
    expect(props.onOpenFile).not.toHaveBeenCalled();
  });

  it('disables Back on the first step', () => {
    renderStory();
    expect(screen.getByRole('button', { name: /Back/ })).toBeDisabled();
  });

  it('enables Back after advancing', () => {
    renderStory(1);
    expect(screen.getByRole('button', { name: /Back/ })).toBeEnabled();
  });

  it('restarts the walkthrough', () => {
    const props = renderStory(3);
    fireEvent.click(screen.getByRole('button', { name: /Restart/ }));
    expect(props.onRestart).toHaveBeenCalledTimes(1);
  });

  it('uses an explicit action to open file evidence in Risk Radar', () => {
    const props = renderStory(2);
    fireEvent.click(screen.getByRole('button', { name: /Open file evidence/ }));
    expect(props.onOpenFile).toHaveBeenCalledWith('src/risk.ts');
  });

  it('uses an explicit action to open commit evidence in Time Machine', () => {
    const props = renderStory(3);
    fireEvent.click(screen.getByRole('button', { name: /Inspect supporting commit/ }));
    expect(props.onOpenCommit).toHaveBeenCalledWith('abc1231');
  });

  it('renders an empty dataset without crashing', () => {
    renderStory(0, { data: makeRepo({ commits: [], fileDetails: [], contributors: [] }) });
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Repository context' })).toBeInTheDocument();
  });
});
