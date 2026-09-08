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
      <button type="button" aria-label="set-dark" onClick={() => setTheme('dark')} />
      <button type="button" aria-label="set-green" onClick={() => setAccent('green')} />
    </div>
  );
}

const clickDark = () => act(() => screen.getByLabelText('set-dark').click());
const clickGreen = () => act(() => screen.getByLabelText('set-green').click());

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

    clickDark();

    expect(localStorage.getItem('onetab.theme::wsA')).toBe('dark');
    // The unscoped key is a "last painted" mirror for the pre-paint script.
    expect(localStorage.getItem('onetab.theme')).toBe('dark');
  });

  it('does not persist one workspace\'s choice into another', () => {
    const { rerender } = render(
      <ThemeProvider scopeKey="wsA">
        <Probe />
      </ThemeProvider>,
    );
    clickGreen();
    expect(localStorage.getItem('onetab.accent::wsA')).toBe('green');

    // Switch to a never-visited workspace: the provider holds the current paint
    // (no white-flash) but writes NOTHING to wsB's namespace — Workspace
    // AppearanceSync supplies wsB's real value moments later.
    rerender(
      <ThemeProvider scopeKey="wsB">
        <Probe />
      </ThemeProvider>,
    );
    expect(localStorage.getItem('onetab.accent::wsB')).toBeNull();

    // An explicit change under wsB writes only to wsB.
    clickGreen();
    expect(localStorage.getItem('onetab.accent::wsB')).toBe('green');
    // wsA's stored value is untouched throughout.
    expect(localStorage.getItem('onetab.accent::wsA')).toBe('green');
  });

  it('re-hydrates a cached value from the workspace namespace on switch', () => {
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
