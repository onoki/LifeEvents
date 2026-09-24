import React from 'react';
import { render, screen } from '@testing-library/react';
import { FocusedSavingsCard } from '../../components/kpi/FocusedSavingsCard';

const mockKpiCalculations = {
  currentTime: new Date(2026, 8, 23),
};

jest.mock('../../hooks/use-kpi-calculations', () => ({
  useKPICalculations: () => mockKpiCalculations,
}));

jest.mock('../../hooks/use-privacy-mode', () => ({
  usePrivacyMode: () => ({ isPrivacyMode: false }),
}));

describe('FocusedSavingsCard progress fill', () => {
  afterEach(() => {
    mockKpiCalculations.currentTime = new Date(2026, 8, 23);
  });

  it('keeps a very small non-zero fill proportional at the full track height', () => {
    render(
      <FocusedSavingsCard
        config={{ planned_monthly_contributions_until: '2030-12-01' }}
      />
    );

    const track = screen.getByTestId('focused-savings-progress-track');
    const fill = screen.getByTestId('focused-savings-progress-fill');

    expect(fill.style.width).toMatch(/^0\.[0-9]+%$/);
    expect(fill.style.minWidth).toBe('');
    expect(fill.style.height).toBe('');
    expect(fill).toHaveClass('h-full');
    expect(fill).toHaveStyle({ borderRadius: 'inherit' });
    expect(track).toHaveClass('rounded-lg', 'overflow-hidden');
  });

  it('does not display a minimum fill at zero progress', () => {
    mockKpiCalculations.currentTime = new Date(2026, 8, 14);

    render(
      <FocusedSavingsCard
        config={{ planned_monthly_contributions_until: '2030-12-01' }}
      />
    );

    const fill = screen.getByTestId('focused-savings-progress-fill');

    expect(fill).toHaveStyle({ width: '0%' });
    expect(fill.style.minWidth).toBe('');
  });
});
