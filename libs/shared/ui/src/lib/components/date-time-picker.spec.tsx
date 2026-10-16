import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DateTimePicker,
  buildTimeOptions,
  parseDateTimeValue,
  toDateTimeValue,
} from './date-time-picker.js';

describe('date-time value helpers', () => {
  it('round-trips the datetime-local string format', () => {
    const d = parseDateTimeValue('2026-10-21T18:45');
    expect(d?.getHours()).toBe(18);
    expect(d?.getMinutes()).toBe(45);
    expect(toDateTimeValue(d as Date)).toBe('2026-10-21T18:45');
  });

  it('treats empty and garbage values as unset', () => {
    expect(parseDateTimeValue('')).toBeUndefined();
    expect(parseDateTimeValue('not a date')).toBeUndefined();
  });
});

describe('buildTimeOptions', () => {
  it('builds one option per step across the day', () => {
    expect(buildTimeOptions({ step: 15 })).toHaveLength(96);
    expect(buildTimeOptions({ step: 30 })).toHaveLength(48);
  });

  it('keeps an off-grid current value selectable', () => {
    const values = buildTimeOptions({ step: 30, current: '10:07' }).map(
      (o) => o.value,
    );
    expect(values).toContain('10:07');
    expect(values.indexOf('10:07')).toBe(values.indexOf('10:00') + 1);
  });

  it('disables past slots on today when disablePast is set', () => {
    const now = new Date();
    const options = buildTimeOptions({ day: now, disablePast: true });
    const firstEnabled = options.find((o) => !o.disabled);
    if (firstEnabled) {
      const [h, m] = firstEnabled.value.split(':').map(Number);
      const slot = new Date(now);
      slot.setHours(h, m, 0, 0);
      expect(slot.getTime()).toBeGreaterThan(Date.now());
    }
    expect(options[0].disabled).toBe(now.getHours() > 0 || now.getMinutes() > 0);
  });

  it('enables every slot on a future day', () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    expect(
      buildTimeOptions({ day: future, disablePast: true }).every(
        (o) => !o.disabled,
      ),
    ).toBe(true);
  });
});

describe('DateTimePicker', () => {
  it('renders the placeholder when empty', () => {
    render(<DateTimePicker placeholder="Pick a launch time" />);
    expect(screen.getByText('Pick a launch time')).toBeInTheDocument();
  });

  it('opens a calendar and time select for the current value', async () => {
    render(<DateTimePicker value="2026-10-21T18:45" />);
    await userEvent.click(screen.getByRole('button', { name: /Date and time/ }));
    expect(screen.getByText('October 2026')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Time' })).toBeInTheDocument();
  });

  it('clears through the inline clear button', async () => {
    const onChange = vi.fn();
    render(
      <DateTimePicker clearable value="2026-10-21T18:45" onChange={onChange} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Clear date and time' }),
    );
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
