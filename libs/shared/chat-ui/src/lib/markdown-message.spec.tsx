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

  it('renders fenced code blocks with unified CodeBlock and language header', () => {
    render(
      <MarkdownMessage
        text={'```typescript filename="config.ts"\nconst port: number = 8080;\n```'}
      />,
    );

    expect(screen.getByText('config.ts')).toBeInTheDocument();
    expect(screen.getByText(/8080/)).toBeInTheDocument();
    expect(screen.getByLabelText('Copy code to clipboard')).toBeInTheDocument();
  });

  it('handles unclosed streaming code blocks gracefully', () => {
    render(
      <MarkdownMessage
        text={'```python\ndef streaming_func():\n  print("in progress")'}
      />,
    );

    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText(/streaming_func/)).toBeInTheDocument();
  });

  it('renders inline code using unified CodeBlock', () => {
    render(<MarkdownMessage text={'Run `pnpm test` to verify'} />);
    const inlineElem = screen.getByText('pnpm test');
    expect(inlineElem.tagName.toLowerCase()).toBe('code');
  });

  it('wraps full multi-word mention names in a single mention chip', () => {
    const { container } = render(
      <MarkdownMessage
        text={'@Code Reviewer & Security Sentinel hi\ngive me list'}
        mentionNames={['Code Reviewer & Security Sentinel', 'Virendra Singh']}
      />,
    );

    const mentionChip = container.querySelector('span[data-mention]');
    expect(mentionChip).toBeInTheDocument();
    expect(mentionChip?.getAttribute('data-mention')).toBe('Code Reviewer & Security Sentinel');
    expect(mentionChip?.textContent).toBe('@Code Reviewer & Security Sentinel');
    expect(container.textContent).toContain('hi');
    expect(container.textContent).toContain('give me list');
  });

  it('automatically recognizes default AI agent names even if mentionNames is omitted', () => {
    const { container } = render(
      <MarkdownMessage text={'Hey @Code Reviewer & Security Sentinel please check this PR'} />,
    );

    const mentionChip = container.querySelector('span[data-mention]');
    expect(mentionChip).toBeInTheDocument();
    expect(mentionChip?.getAttribute('data-mention')).toBe('Code Reviewer & Security Sentinel');
    expect(mentionChip?.textContent).toBe('@Code Reviewer & Security Sentinel');
  });
});
