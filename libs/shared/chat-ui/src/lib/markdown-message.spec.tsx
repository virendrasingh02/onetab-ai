import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownMessage } from './markdown-message.js';
import { MentionAliasesProvider } from './mention-aliases.js';

describe('MarkdownMessage', () => {
  it('renders every heading level at the message size', () => {
    const { container } = render(
      <MarkdownMessage
        text={'# This site can’t be reached\n###### Small print'}
      />,
    );

    expect(container.firstElementChild).toHaveClass('text-message');
    for (const heading of container.querySelectorAll('h1, h6')) {
      expect(heading.className).not.toMatch(/\btext-(xs|sm|base|lg|xl)\b/);
      expect(heading).toHaveClass('font-bold');
    }
  });

  it('shows backslash-escaped punctuation as the literal character', () => {
    render(
      <MarkdownMessage text={'ERR\\_CONNECTION\\_REFUSED and \\*stars\\*'} />,
    );

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

  it('shows a labelled link’s real destination on hover, for bare URLs too', async () => {
    const user = userEvent.setup();
    render(
      <MarkdownMessage
        text={
          '[url](https://files.example.com/clip.mp4) and https://example.com/page'
        }
      />,
    );

    await user.hover(screen.getByRole('link', { name: 'url' }));
    expect(await screen.findByText('files.example.com')).toBeInTheDocument();
    expect(screen.getByText('MP4')).toBeInTheDocument();
    await user.unhover(screen.getByRole('link', { name: 'url' }));

    await user.hover(screen.getByRole('link', { name: 'example.com/page' }));
    expect(
      await screen.findByRole('button', { name: 'Copy link' }),
    ).toBeInTheDocument();
  });

  it('renders fenced code blocks with unified CodeBlock and language header', () => {
    render(
      <MarkdownMessage
        text={
          '```typescript filename="config.ts"\nconst port: number = 8080;\n```'
        }
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
    expect(mentionChip?.getAttribute('data-mention')).toBe(
      'Code Reviewer & Security Sentinel',
    );
    expect(mentionChip?.textContent).toBe('@Code Reviewer & Security Sentinel');
    expect(container.textContent).toContain('hi');
    expect(container.textContent).toContain('give me list');
  });

  it('automatically recognizes default AI agent names even if mentionNames is omitted', () => {
    const { container } = render(
      <MarkdownMessage
        text={'Hey @Code Reviewer & Security Sentinel please check this PR'}
      />,
    );

    const mentionChip = container.querySelector('span[data-mention]');
    expect(mentionChip).toBeInTheDocument();
    expect(mentionChip?.getAttribute('data-mention')).toBe(
      'Code Reviewer & Security Sentinel',
    );
    expect(mentionChip?.textContent).toBe('@Code Reviewer & Security Sentinel');
  });

  it('renders link pills with badge styling and link icon', () => {
    const { container } = render(
      <MarkdownMessage
        text={
          'Join call at meet.google.com/ogd-tbmv-yxp or [Google Meet](https://meet.google.com/ogd-tbmv-yxp)'
        }
      />,
    );

    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(2);

    expect(links[0]).toHaveAttribute(
      'href',
      'https://meet.google.com/ogd-tbmv-yxp',
    );
    expect(links[0].className).toContain('text-info-text');
    expect(links[0].querySelector('svg')).toBeInTheDocument();

    expect(links[1]).toHaveAttribute(
      'href',
      'https://meet.google.com/ogd-tbmv-yxp',
    );
    expect(links[1].textContent).toContain('Google Meet');
    expect(links[1].querySelector('svg')).toBeInTheDocument();
  });

  it('renders markdown inside a link label instead of the raw syntax', () => {
    const { container } = render(
      <MarkdownMessage
        text={
          'See [**~~identifies~~**](https://example.com) and [`Link`](https://example.com/b)'
        }
      />,
    );

    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toBe('identifies');
    expect(links[0].querySelector('strong')).toBeInTheDocument();
    expect(links[0].querySelector('.line-through')).toBeInTheDocument();
    expect(links[1].textContent).not.toContain('`');
    expect(links[1].textContent).toContain('Link');
  });

  it('draws blank lines as compacted half-line breaks', () => {
    const { container } = render(
      <MarkdownMessage text={'\n\na' + '\n'.repeat(21) + 'b\n\nc\n\n'} />,
    );

    const spacers = container.querySelectorAll<HTMLElement>('.msg-blank-line');
    // Leading/trailing blanks and single paragraph breaks draw no spacer;
    // 20 blanks cap at 3, of which one is the normal paragraph gap.
    expect(spacers).toHaveLength(1);
    expect(spacers[0].style.height).toBe('1lh');
  });

  it('only treats asterisks on word boundaries as emphasis', () => {
    const { container } = render(
      <MarkdownMessage
        text={
          'autom***atically. Your job is a*b and 2 * 3 * 4, but *this* and **that** count.'
        }
      />,
    );

    expect(container.textContent).toContain(
      'autom***atically. Your job is a*b and 2 * 3 * 4',
    );
    expect(container.querySelectorAll('em')).toHaveLength(1);
    expect(container.querySelector('em')).toHaveTextContent('this');
    expect(container.querySelectorAll('strong')).toHaveLength(1);
    expect(container.querySelector('strong')).toHaveTextContent('that');
  });

  it('folds a legacy "@App · account" mention into one app chip', () => {
    const { container } = render(
      <MarkdownMessage
        text={'@Asana · balram give me list of tickets'}
        mentionNames={['Asana']}
        mentionProfiles={{
          asana: { userId: 'app-1', name: 'Asana', entityKind: 'app' },
        }}
      />,
    );

    const chip = container.querySelector('span[data-mention]');
    expect(chip).toHaveTextContent(/^@Asana$/);
    expect(chip).toHaveAttribute('title', '@Asana · connected as balram');
    expect(container.textContent).toBe('@Asana give me list of tickets');
  });

  it('opens profile in rightbar when mention is clicked', () => {
    const onMentionClick = vi.fn();
    const { container } = render(
      <MarkdownMessage
        text={'Hello @Virendra Singh'}
        mentionNames={['Virendra Singh']}
        onMentionClick={onMentionClick}
      />,
    );

    const mentionChip = container.querySelector('span[data-mention]');
    expect(mentionChip).toBeInTheDocument();
    fireEvent.click(mentionChip!);
    expect(onMentionClick).toHaveBeenCalledWith('@Virendra Singh');
  });

  it("renders a short handle as the member's current full name", () => {
    const onMentionClick = vi.fn();
    const { container } = render(
      <MarkdownMessage
        text={'@Virendra Hi'}
        mentionProfiles={{
          'virendra singh': {
            userId: 'u1',
            name: 'Virendra Singh',
            entityKind: 'user',
          },
        }}
        onMentionClick={onMentionClick}
      />,
    );

    const chip = container.querySelector('span[data-mention]');
    expect(chip).toHaveTextContent('@Virendra Singh');
    fireEvent.click(chip!);
    expect(onMentionClick).toHaveBeenCalledWith('@Virendra Singh');
  });

  it('follows a rename when the message carries the mentioned user id', () => {
    const { container } = render(
      <MarkdownMessage
        text={'@Old Name Hi'}
        mentionNames={['Old Name']}
        mentionRefs={[{ userId: '@onetab_u1:hs', label: 'Old Name' }]}
        mentionProfiles={{
          'new name': { userId: 'u1', name: 'New Name', entityKind: 'user' },
        }}
      />,
    );
    expect(container.querySelector('span[data-mention]')).toHaveTextContent(
      '@New Name',
    );
  });

  it('resolves a former name from the alias history (old messages, no ids)', () => {
    const { container } = render(
      <MentionAliasesProvider aliases={[{ userId: 'u1', alias: 'Old Name' }]}>
        <MarkdownMessage
          text={'@Old Name Hi'}
          mentionProfiles={{
            'new name': {
              userId: '@onetab_u1:hs',
              name: 'New Name',
              entityKind: 'user',
            },
          }}
        />
      </MentionAliasesProvider>,
    );
    expect(container.querySelector('span[data-mention]')).toHaveTextContent(
      '@New Name',
    );
  });

  it('leaves an ambiguous handle as typed', () => {
    const { container } = render(
      <MarkdownMessage
        text={'@Ana Hi'}
        mentionProfiles={{
          'ana ruiz': { userId: 'u1', name: 'Ana Ruiz', entityKind: 'user' },
          'ana lee': { userId: 'u2', name: 'Ana Lee', entityKind: 'user' },
        }}
      />,
    );
    expect(container.querySelector('span[data-mention]')).toHaveTextContent(
      '@Ana',
    );
  });
});
