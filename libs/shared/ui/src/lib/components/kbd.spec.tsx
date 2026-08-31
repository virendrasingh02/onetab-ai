import { render, screen } from '@testing-library/react';
import {
  Kbd,
  KbdGroup,
  KbdShortcut,
  formatKey,
  parseShortcutString,
  useKeyboardShortcut,
  SHORTCUTS,
} from './kbd.js';
import { useState } from 'react';

describe('Kbd Component', () => {
  it('renders semantic <kbd> tag with children', () => {
    render(<Kbd>⌘</Kbd>);
    const kbdEl = screen.getByText('⌘');
    expect(kbdEl.tagName.toLowerCase()).toBe('kbd');
    expect(kbdEl).toHaveAttribute('data-slot', 'kbd');
  });

  it('applies variant and size classes correctly', () => {
    const { rerender } = render(
      <Kbd variant="outline" size="lg">
        Enter
      </Kbd>,
    );
    const kbdEl = screen.getByText('Enter');
    expect(kbdEl).toHaveClass('border', 'bg-transparent', 'text-xs');

    rerender(
      <Kbd variant="muted" size="xs">
        ESC
      </Kbd>,
    );
    expect(kbdEl).toHaveClass('text-[9px]', 'bg-muted/60');
  });

  it('supports disabled appearance', () => {
    render(<Kbd disabled>K</Kbd>);
    const kbdEl = screen.getByText('K');
    expect(kbdEl).toHaveClass('opacity-50', 'pointer-events-none');
  });

  it('supports custom className and tooltip title', () => {
    render(
      <Kbd className="custom-class" tooltip="Command key">
        ⌘
      </Kbd>,
    );
    const kbdEl = screen.getByText('⌘');
    expect(kbdEl).toHaveClass('custom-class');
    expect(kbdEl).toHaveAttribute('title', 'Command key');
  });
});

describe('KbdGroup Component', () => {
  it('renders a group of keys with semantic markup', () => {
    render(
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>,
    );
    expect(screen.getByText('⌘')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
    expect(screen.getByText('⌘').closest('[data-slot="kbd-group"]')).toBeInTheDocument();
  });
});

describe('KbdShortcut Component', () => {
  it('resolves key array', () => {
    render(<KbdShortcut keys={['mod', 'K']} />);
    expect(screen.getByText('K')).toBeInTheDocument();
    const shortcut = document.querySelector('[data-slot="kbd-shortcut"]');
    expect(shortcut).toBeInTheDocument();
  });

  it('resolves shortcut string format "Ctrl+Shift+P"', () => {
    render(<KbdShortcut shortcut="Ctrl+Shift+P" />);
    expect(screen.getByText('P')).toBeInTheDocument();
    expect(screen.getAllByText('+')).toHaveLength(2);
  });

  it('resolves sequence string "G then U"', () => {
    render(<KbdShortcut shortcut="G then U" />);
    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.getByText('then')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument();
  });

  it('sets accessible aria-keyshortcuts', () => {
    render(<KbdShortcut keys={['mod', 'K']} />);
    const shortcut = document.querySelector('[data-slot="kbd-shortcut"]');
    expect(shortcut).toHaveAttribute('aria-keyshortcuts');
  });
});

describe('formatKey and parseShortcutString', () => {
  it('formats modifier keys according to platform', () => {
    expect(formatKey('mod', 'mac')).toBe('⌘');
    expect(formatKey('mod', 'windows')).toBe('Ctrl');
    expect(formatKey('shift', 'mac')).toBe('⇧');
    expect(formatKey('shift', 'windows')).toBe('Shift');
    expect(formatKey('alt', 'mac')).toBe('⌥');
    expect(formatKey('alt', 'windows')).toBe('Alt');
    expect(formatKey('enter', 'mac')).toBe('↵');
    expect(formatKey('enter', 'windows')).toBe('Enter');
    expect(formatKey('escape', 'mac')).toBe('Esc');
    expect(formatKey('up', 'mac')).toBe('↑');
    expect(formatKey('f2', 'windows')).toBe('F2');
  });

  it('parses various shortcut string notations', () => {
    const plusParsed = parseShortcutString('mod+shift+k');
    expect(plusParsed).toEqual([
      { type: 'key', value: 'mod' },
      { type: 'separator', value: '+' },
      { type: 'key', value: 'shift' },
      { type: 'separator', value: '+' },
      { type: 'key', value: 'k' },
    ]);

    const spaceParsed = parseShortcutString('G then T');
    expect(spaceParsed).toEqual([
      { type: 'key', value: 'G' },
      { type: 'separator', value: 'then' },
      { type: 'key', value: 'T' },
    ]);
  });
});

describe('useKeyboardShortcut Hook', () => {
  function TestShortcutComponent({ onTrigger }: { onTrigger: () => void }) {
    useKeyboardShortcut('mod+k', onTrigger);
    const [text, setText] = useState('');

    return (
      <div>
        <input
          data-testid="test-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button data-testid="test-btn">Action</button>
      </div>
    );
  }

  it('fires callback on matching keydown with modifiers', async () => {
    const onTrigger = vi.fn();
    render(<TestShortcutComponent onTrigger={onTrigger} />);

    // Dispatch synthetic keydown
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(onTrigger).toHaveBeenCalledOnce();
  });

  it('does not fire when typing inside an input element if enableOnInput is false', async () => {
    const onTrigger = vi.fn();
    render(<TestShortcutComponent onTrigger={onTrigger} />);

    const input = screen.getByTestId('test-input');
    input.focus();

    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('unmounts listener cleanly', () => {
    const onTrigger = vi.fn();
    const { unmount } = render(<TestShortcutComponent onTrigger={onTrigger} />);
    unmount();

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
      }),
    );

    expect(onTrigger).not.toHaveBeenCalled();
  });
});

describe('SHORTCUTS registry', () => {
  it('contains expected standard shortcuts', () => {
    expect(SHORTCUTS.search).toEqual(['mod', 'K']);
    expect(SHORTCUTS.commandPalette).toEqual(['mod', 'K']);
    expect(SHORTCUTS.help).toEqual(['?']);
    expect(SHORTCUTS.save).toEqual(['mod', 'S']);
  });
});
