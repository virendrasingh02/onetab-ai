import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageSelect } from './language-select.js';

describe('LanguageSelect', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders current language correctly in standard mode', () => {
    render(<LanguageSelect value="en" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('renders native name in compact mode', () => {
    render(<LanguageSelect value="hi" compact onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('हिन्दी')).toBeInTheDocument();
  });

  it('allows opening dropdown and selecting another language', async () => {
    const onChange = vi.fn();
    render(<LanguageSelect value="en" onChange={onChange} />);

    await userEvent.click(screen.getByRole('combobox'));

    const frenchOption = screen.getByRole('option', { name: /Français/i });
    expect(frenchOption).toBeInTheDocument();

    await userEvent.click(frenchOption);
    expect(onChange).toHaveBeenCalledWith('fr');
  });

  it('supports Arabic with RTL marker', async () => {
    render(<LanguageSelect value="en" onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole('combobox'));

    const arabicOption = screen.getByRole('option', { name: /العربية/i });
    expect(arabicOption).toBeInTheDocument();
    expect(screen.getByText('RTL')).toBeInTheDocument();
  });
});

