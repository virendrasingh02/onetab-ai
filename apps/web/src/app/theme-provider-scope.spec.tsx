import { ThemeProvider, useTheme } from '@org/design-system';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Appearance is stored per workspace. `<ThemeProvider scopeKey>` namespaces
 * every localStorage key with the active workspace id, so a change in one
 * workspace can never surface in another and a reload lands on the right theme.
 */

function Probe() {
  const { theme, accent, setTheme, setAccent } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="accent">{accent}</span>
      <button type="button" onClick={() => setTheme('dark')}>
        dark
      </button>
      <button type="button" onClick={() => setAccent('green')}>
        green
      </button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('ThemeProvider scopeKey', () => {
  it('writes appearance to a workspace-namespaced key (mirrored unscoped)', () => {
    render(
      <ThemeProvider scopeKey="wsA">
        <Probe />
      </ThemeProvider>,
    );

    act(() => {
      screen.getByText('dark').click();
    });

    expect(localStorage.getItem('onetab.theme::wsA')).toBe('dark');
    // The unscoped key is a "last painted" mirror for the pre-paint script.
    expect(localStorage.getItem('onetab.theme')).toBe('dark');
  });

  it('does not leak one workspace\'s choice into another', () => {
    const { rerender } = render(
      <ThemeProvider scopeKey="wsA">
        <Probe />
      </ThemeProvider>,
    );
    act(() => {
      screen.getByText('green').click();
    });
    expect(localStorage.getItem('onetab.accent::wsA')).toBe('green');

    // Switch workspace: the provider re-hydrates from wsB's (empty) namespace,
    // so it shows the design-system default, not wsA's green.
    rerender(
      <ThemeProvider scopeKey="wsB">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('accent').textContent).toBe('mint');

    act(() => {
      screen.getByText('green').click();
    });
    expect(localStorage.getItem('onetab.accent::wsB')).toBe('green');
    // wsA's stored value is untouched.
    expect(localStorage.getItem('onetab.accent::wsA')).toBe('green');
  });

  it('re-hydrates from the workspace namespace on switch', () => {
    localStorage.setItem('onetab.theme::wsB', 'dark');

    const { rerender } = render(
      <ThemeProvider scopeKey="wsA">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme').textContent).toBe('light');

    rerender(
      <ThemeProvider scopeKey="wsB">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });
});
