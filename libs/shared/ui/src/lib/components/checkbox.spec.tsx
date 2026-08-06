import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './checkbox.js';

describe('Checkbox', () => {
  it('renders and responds to click events', async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox id="terms" onCheckedChange={onCheckedChange} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    await userEvent.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
