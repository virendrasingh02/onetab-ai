import type { DateRangeValue } from '@org/utils';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DateRangeFilter } from './date-range-filter.js';

function openMenu(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
  fireEvent.click(trigger);
}

function Harness({
  initial = { preset: 'last_30_days' },
  onChange,
}: {
  initial?: DateRangeValue;
  onChange?: (value: DateRangeValue) => void;
}) {
  const [value, setValue] = useState<DateRangeValue>(initial);
  return (
    <DateRangeFilter
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('DateRangeFilter', () => {
  it('labels the trigger with the active preset', () => {
    render(<Harness />);
    expect(
      screen.getByRole('button', { name: 'Date range: Last 30 days' }),
    ).toBeInTheDocument();
  });

  it('marks the active preset as checked and switches on select', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    openMenu(screen.getByRole('button', { name: /Date range/ }));

    expect(
      screen.getByRole('menuitemradio', { name: 'Last 30 days' }),
    ).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Last 7 days' }));
    expect(onChange).toHaveBeenCalledWith({ preset: 'last_7_days' });
    expect(
      screen.getByRole('button', { name: 'Date range: Last 7 days' }),
    ).toBeInTheDocument();
  });

  it('offers every preset plus custom', () => {
    render(<Harness />);
    openMenu(screen.getByRole('button', { name: /Date range/ }));
    for (const label of [
      'Today',
      'Yesterday',
      'Last 7 days',
      'Last 30 days',
      'Last 90 days',
      'This week',
      'Last week',
      'This month',
      'Last month',
      'Custom range…',
    ]) {
      expect(screen.getByRole('menuitemradio', { name: label })).toBeInTheDocument();
    }
  });

  it('applies a custom range only after both ends are picked', async () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={{ preset: 'custom', from: '2026-09-01', to: '2026-09-24' }}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByRole('button', {
        name: 'Date range: Sep 1, 2026 – Sep 24, 2026',
      }),
    ).toBeInTheDocument();

    openMenu(screen.getByRole('button', { name: /Date range/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Custom range…' }));

    const apply = await screen.findByRole('button', { name: 'Apply' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Thursday, September 3, 2026' }),
    );
    expect(apply).toBeDisabled();

    await userEvent.click(
      screen.getByRole('button', { name: 'Thursday, September 10, 2026' }),
    );
    expect(apply).toBeEnabled();
    await userEvent.click(apply);

    expect(onChange).toHaveBeenCalledWith({
      preset: 'custom',
      from: '2026-09-03',
      to: '2026-09-10',
    });
  });
});
