import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownMessage } from './markdown-message.js';

describe('MarkdownMessage', () => {
  it('renders every heading level at the message size', () => {
    const { container } = render(
      <MarkdownMessage text={'# This site can’t be reached\n###### Small print'} />,
    );

    expect(container.firstElementChild).toHaveClass('text-message');
    for (const heading of container.querySelectorAll('h1, h6')) {
      expect(heading.className).not.toMatch(/\btext-(xs|sm|base|lg|xl)\b/);
      expect(heading).toHaveClass('font-bold');
    }
  });

  it('shows backslash-escaped punctuation as the literal character', () => {
    render(<MarkdownMessage text={'ERR\\_CONNECTION\\_REFUSED and \\*stars\\*'} />);

    expect(
      screen.getByText('ERR_CONNECTION_REFUSED and *stars*', {
        normalizer: (text) => text,
      }),
    ).toBeInTheDocument();
  });

  it('keeps the label of a link with nowhere safe to go', () => {
    const { container } = render(
      <MarkdownMessage
        text={'[Checking the proxy]() and [bad](javascript:alert(1))'}
      />,
    );

    expect(container.textContent).toContain('Checking the proxy');
    expect(container.textContent).not.toContain('[Checking the proxy]()');
    expect(container.querySelector('a')).toBeNull();
  });

  it('still links safe targets', () => {
    render(<MarkdownMessage text={'[Docs](https://example.com/docs)'} />);

    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'href',
      'https://example.com/docs',
    );
  });
});
