import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button.js';

describe('Button', () => {
  it('renders its label and fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save changes</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('blocks interaction and marks itself busy while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );

    const button = screen.getByRole('button', { name: /saving/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('merges a caller className over the variant classes', () => {
    render(<Button className="w-full">Wide</Button>);
    expect(screen.getByRole('button', { name: 'Wide' })).toHaveClass('w-full');
  });

  it('renders as its child element when asChild is set', () => {
    render(
      <Button asChild>
        <a href="/somewhere">Go</a>
      </Button>,
    );

    // Should be an anchor, not a button wrapping an anchor.
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute(
      'href',
      '/somewhere',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
