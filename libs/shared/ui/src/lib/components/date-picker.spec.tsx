import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from './date-picker.js';

describe('DatePicker', () => {
  it('renders placeholder when no value is passed', () => {
    render(<DatePicker placeholder="Pick a due date" />);
    expect(screen.getByText('Pick a due date')).toBeInTheDocument();
  });

  it('formats given string value correctly', () => {
    render(<DatePicker value="2026-10-15" />);
    expect(screen.getByText('Oct 15, 2026')).toBeInTheDocument();
  });

  it('opens popover calendar on trigger click', async () => {
    render(<DatePicker value="2026-10-15" />);
    const trigger = screen.getByRole('button', {
      name: /Date selected: Oct 15, 2026/i,
    });
    await userEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('October 2026')).toBeInTheDocument();
  });
});
