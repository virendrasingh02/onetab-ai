import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppSelect, type AppSelectOption } from './app-select.js';

const OPTIONS: AppSelectOption[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

describe('AppSelect', () => {
  it('renders the placeholder in the listbox variant', () => {
    render(<AppSelect options={OPTIONS} placeholder="Select status" />);
    expect(screen.getByText('Select status')).toBeInTheDocument();
  });

  it('shows a disabled loading trigger while options resolve', () => {
    render(<AppSelect options={[]} loading aria-label="Status" />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('filters and selects through the searchable variant', async () => {
    const onValueChange = vi.fn();
    render(
      <AppSelect
        options={OPTIONS}
        searchable
        placeholder="Select status"
        onValueChange={onValueChange}
      />,
    );

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByText('In progress'));
    expect(onValueChange).toHaveBeenCalledWith('in-progress');
  });

  it('shows the empty text when a search matches nothing', async () => {
    render(
      <AppSelect
        options={OPTIONS}
        searchable
        searchPlaceholder="Search status…"
        emptyText="No statuses found."
      />,
    );

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.type(screen.getByPlaceholderText('Search status…'), 'zzz');
    expect(screen.getByText('No statuses found.')).toBeInTheDocument();
  });
});
