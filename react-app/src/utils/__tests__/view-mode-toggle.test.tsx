import { fireEvent, render, screen } from '@testing-library/react';
import { ViewModeToggle } from '../../components/charts/ViewModeToggle';

describe('ViewModeToggle', () => {
  const now = new Date(2026, 7, 16);

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('shows the four privacy-safe range labels and wraps them in a responsive grid', () => {
    const onViewModeChange = jest.fn();
    const { container } = render(
      <ViewModeToggle
        viewMode="next2years"
        onViewModeChange={onViewModeChange}
        config={{ planned_monthly_contributions_until: '2028-12-31' }}
        now={now}
      />
    );

    expect(screen.getByRole('button', { name: 'Recorded' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next 2 years' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Planned end plus 1 year' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Full range' })).toBeInTheDocument();
    expect(container.querySelector('.grid-cols-2')).toHaveClass('sm:grid-cols-4');

    fireEvent.click(screen.getByRole('button', { name: 'Planned end plus 1 year' }));
    expect(onViewModeChange).toHaveBeenCalledWith('planned');
  });

  it('omits the planned view when the buffered end is not in the future', () => {
    const { container } = render(
      <ViewModeToggle
        viewMode="next2years"
        onViewModeChange={jest.fn()}
        config={{ planned_monthly_contributions_until: '2024-01-01' }}
        now={now}
      />
    );

    expect(screen.queryByRole('button', { name: 'Planned end plus 1 year' })).not.toBeInTheDocument();
    expect(container.querySelector('.grid-cols-2')).toHaveClass('sm:grid-cols-3');
  });

  it('does not expose the exact configured date in privacy mode', () => {
    window.history.replaceState({}, '', '/?privacy=true');
    const { container } = render(
      <ViewModeToggle
        viewMode="planned"
        onViewModeChange={jest.fn()}
        config={{ planned_monthly_contributions_until: '2028-12-31' }}
        now={now}
      />
    );

    expect(screen.getByRole('button', { name: 'Planned end plus 1 year' })).toHaveAttribute('aria-pressed', 'true');
    expect(container).not.toHaveTextContent('2028-12-31');
  });
});
