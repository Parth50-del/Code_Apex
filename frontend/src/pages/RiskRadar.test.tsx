import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RiskRadarPage } from './RiskRadar';
import { makeRepo } from '../test/fixtures';

function renderRadar(onSelectFile = vi.fn()) {
  render(
    <RiskRadarPage
      data={makeRepo()}
      selectedFilePath="src/risk.ts"
      onSelectFile={onSelectFile}
    />,
  );
  return { onSelectFile };
}

describe('RiskRadarPage', () => {
  it('renders factor points that add up to the displayed score', () => {
    renderRadar();
    const panel = screen.getByRole('complementary', { name: 'Selected file details' });
    expect(within(panel).getByText('Weighted total')).toBeInTheDocument();
    // Each factor shows its weighted points out of the factor maximum.
    expect(within(panel).getByText('21 / 35 pts')).toBeInTheDocument();
    expect(within(panel).getByText('10 / 30 pts')).toBeInTheDocument();
    expect(within(panel).getByText('20 / 20 pts')).toBeInTheDocument();
    expect(within(panel).getByText('0 / 15 pts')).toBeInTheDocument();
    // 21 + 10 + 20 + 0 = the file score, so the breakdown explains the total.
    expect(within(panel).getByText('51', { selector: '.factor-total-value' })).toBeInTheDocument();
  });

  it('filters ranked files by path without changing the selection', async () => {
    const user = userEvent.setup();
    const { onSelectFile } = renderRadar();
    const table = screen.getByRole('table');

    expect(within(table).getByText('src/risk.ts')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search files by path'), 'radar');

    expect(within(table).queryByText('src/risk.ts')).not.toBeInTheDocument();
    expect(within(table).getByText('src/radar.tsx')).toBeInTheDocument();
    // Filtering is presentation only; the inspected file stays selected.
    expect(onSelectFile).not.toHaveBeenCalled();
  });

  it('sorts by score descending by default and toggles direction through the column header', async () => {
    const user = userEvent.setup();
    renderRadar();
    const table = screen.getByRole('table');
    const firstRow = () => within(table).getAllByRole('row')[1];

    expect(within(firstRow()).getByText('src/risk.ts')).toBeInTheDocument();
    await user.click(within(table).getByRole('button', { name: 'Sort by Score' }));
    expect(within(firstRow()).getByText('src/radar.tsx')).toBeInTheDocument();
  });
});
