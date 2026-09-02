import { render, screen, fireEvent } from '@testing-library/react';
import { Combobox, type ComboboxOption } from './combobox.js';

const mockOptions: ComboboxOption[] = [
  { value: 'apple', label: 'Apple', description: 'Fresh fruit' },
  { value: 'banana', label: 'Banana', description: 'Tropical fruit' },
  { value: 'cherry', label: 'Cherry', disabled: true },
  { value: 'durian', label: 'Durian', group: 'Exotic' },
  { value: 'elderberry', label: 'Elderberry', group: 'Berries' },
];

describe('Combobox Component', () => {
  it('renders with placeholder and closed popover initially', () => {
    render(<Combobox options={mockOptions} placeholder="Pick a fruit" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Pick a fruit');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens listbox when trigger is clicked and renders options', async () => {
    render(<Combobox options={mockOptions} placeholder="Pick a fruit" />);
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('selects single option and calls onChange', async () => {
    const onChange = vi.fn();
    render(<Combobox options={mockOptions} onChange={onChange} />);

    fireEvent.click(screen.getByRole('combobox'));
    const appleOption = await screen.findByText('Apple');
    fireEvent.click(appleOption);

    expect(onChange).toHaveBeenCalledWith('apple');
  });

  it('filters options when typing into search input', async () => {
    render(<Combobox options={mockOptions} />);

    fireEvent.click(screen.getByRole('combobox'));
    const searchInput = await screen.findByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Ban' } });

    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  });

  it('shows empty text when no options match query', async () => {
    render(<Combobox options={mockOptions} emptyText="No fruits found" />);

    fireEvent.click(screen.getByRole('combobox'));
    const searchInput = await screen.findByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Watermelon' } });

    expect(screen.getByText('No fruits found')).toBeInTheDocument();
  });

  it('supports multi-selection and badge removal', async () => {
    const onChange = vi.fn();
    render(
      <Combobox
        options={mockOptions}
        multiple
        value={['apple']}
        onChange={onChange}
      />,
    );

    const removeBtn = screen.getByRole('button', { name: 'Remove Apple' });
    fireEvent.click(removeBtn);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('displays loading state spinner and text when loading is true', async () => {
    render(<Combobox options={[]} loading loadingText="Fetching fruits..." />);

    fireEvent.click(screen.getByRole('combobox'));
    expect(await screen.findByText('Fetching fruits...')).toBeInTheDocument();
  });

  it('supports allowCreate and creates a new option', async () => {
    const onCreateOption = vi.fn();
    const onChange = vi.fn();
    render(
      <Combobox
        options={mockOptions}
        allowCreate
        onCreateOption={onCreateOption}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('combobox'));
    const searchInput = await screen.findByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Mango' } });

    const createButton = await screen.findByText('Create “Mango”');
    fireEvent.click(createButton);

    expect(onCreateOption).toHaveBeenCalledWith('Mango');
    expect(onChange).toHaveBeenCalledWith('mango');
  });

  it('clears selection when clear button is clicked', () => {
    const onChange = vi.fn();
    render(<Combobox options={mockOptions} value="apple" clearable onChange={onChange} />);

    const clearButton = screen.getByRole('button', { name: 'Clear selection' });
    fireEvent.click(clearButton);

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('disables interactions when disabled prop is true', () => {
    render(<Combobox options={mockOptions} disabled />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
  });
});
