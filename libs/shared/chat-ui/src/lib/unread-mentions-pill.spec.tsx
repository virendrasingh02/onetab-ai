import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnreadMentionsPill } from './indicators.js';

describe('UnreadMentionsPill', () => {
  const noop = () => undefined;

  it('renders nothing when there is no direction (a mention is in view / none left)', () => {
    const { container } = render(
      <UnreadMentionsPill direction={null} count={3} onJump={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the count is zero', () => {
    const { container } = render(
      <UnreadMentionsPill direction="down" count={0} onJump={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('says "Unread mention" for a single mention and "N unread mentions" beyond', () => {
    const { rerender } = render(
      <UnreadMentionsPill direction="down" count={1} onJump={noop} />,
    );
    expect(screen.getByRole('button')).toHaveTextContent('Unread mention');

    rerender(<UnreadMentionsPill direction="down" count={4} onJump={noop} />);
    expect(screen.getByRole('button')).toHaveTextContent('4 unread mentions');
  });

  it('carries the remaining count in its accessible name', () => {
    render(
      <UnreadMentionsPill
        direction="up"
        count={5}
        remaining={3}
        onJump={noop}
      />,
    );
    expect(
      screen.getByRole('button', {
        name: 'Jump to next unread mention, 3 remaining',
      }),
    ).toBeInTheDocument();
  });

  it('activates on click and on the keyboard (Enter / Space)', async () => {
    const onJump = vi.fn();
    const user = userEvent.setup();
    render(<UnreadMentionsPill direction="down" count={2} onJump={onJump} />);

    const button = screen.getByRole('button');
    await user.click(button);
    button.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onJump).toHaveBeenCalledTimes(3);
  });

  it('does not rely on colour alone — the direction is in the markup', () => {
    const { rerender, container } = render(
      <UnreadMentionsPill direction="down" count={2} onJump={noop} />,
    );
    const iconClass = () =>
      container.querySelector('svg')?.getAttribute('class') ?? '';
    expect(iconClass()).toMatch(/arrow-down/);

    rerender(<UnreadMentionsPill direction="up" count={2} onJump={noop} />);
    expect(iconClass()).toMatch(/arrow-up/);
  });

  it('opts out of motion for reduced-motion users', () => {
    render(<UnreadMentionsPill direction="down" count={2} onJump={noop} />);
    expect(screen.getByRole('button').className).toContain(
      'motion-reduce:animate-none',
    );
  });
});
