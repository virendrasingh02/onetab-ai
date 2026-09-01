import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIDEBAR_ACTIVITY_CONFIG,
  hasSidebarActivity,
  resolveSidebarActivity,
  SidebarActivityConfigProvider,
  SidebarActivityIndicator,
  type SidebarActivityConfig,
} from './sidebar-activity-indicator.js';

function config(
  overrides: Partial<SidebarActivityConfig> = {},
): SidebarActivityConfig {
  return {
    ...DEFAULT_SIDEBAR_ACTIVITY_CONFIG,
    ...overrides,
    surfaces: {
      ...DEFAULT_SIDEBAR_ACTIVITY_CONFIG.surfaces,
      ...overrides.surfaces,
    },
  };
}

describe('resolveSidebarActivity', () => {
  it('shows nothing for an empty / undefined state', () => {
    expect(resolveSidebarActivity(undefined, config(), 'channels').render).toBe(
      'none',
    );
    expect(resolveSidebarActivity({}, config(), 'channels').render).toBe(
      'none',
    );
    expect(
      resolveSidebarActivity({ unreadCount: 0 }, config(), 'channels').render,
    ).toBe('none');
  });

  it('never renders for a disabled / hidden row', () => {
    expect(
      resolveSidebarActivity(
        { unreadCount: 9, disabled: true },
        config(),
        'channels',
      ).render,
    ).toBe('none');
  });

  it('respects the master switch and per-surface toggles', () => {
    const state = { unreadCount: 3 };
    expect(
      resolveSidebarActivity(state, config({ enabled: false }), 'channels')
        .render,
    ).toBe('none');
    expect(
      resolveSidebarActivity(
        state,
        config({ surfaces: { channels: false } }),
        'channels',
      ).render,
    ).toBe('none');
    // A different surface stays on.
    expect(
      resolveSidebarActivity(
        state,
        config({ surfaces: { channels: false } }),
        'dms',
      ).render,
    ).toBe('badge');
  });

  it('keeps a mention on a muted row but drops ambient activity', () => {
    expect(
      resolveSidebarActivity(
        { hasActivity: true, isMuted: true },
        config(),
        'channels',
      ).render,
    ).toBe('none');
    const muted = resolveSidebarActivity(
      { activityType: 'mention', unreadCount: 2, isMuted: true },
      config(),
      'channels',
    );
    expect(muted.render).toBe('badge');
    expect(muted.tone).toBe('mention');
  });

  it('auto style: badge when a count is available, dot otherwise', () => {
    expect(
      resolveSidebarActivity(
        { unreadCount: 5 },
        config({ style: 'auto' }),
        'channels',
      ).render,
    ).toBe('badge');
    expect(
      resolveSidebarActivity(
        { hasActivity: true },
        config({ style: 'auto' }),
        'channels',
      ).render,
    ).toBe('dot');
  });

  it('dot style is always a dot; badge style degrades to a dot with no count', () => {
    expect(
      resolveSidebarActivity(
        { unreadCount: 12 },
        config({ style: 'dot' }),
        'channels',
      ).render,
    ).toBe('dot');
    expect(
      resolveSidebarActivity(
        { hasActivity: true },
        config({ style: 'badge' }),
        'channels',
      ).render,
    ).toBe('dot');
  });

  it('collapses badges to dots when counts are turned off', () => {
    expect(
      resolveSidebarActivity(
        { unreadCount: 7 },
        config({ style: 'badge', showCounts: false }),
        'channels',
      ).render,
    ).toBe('dot');
  });

  it('a per-row indicatorType overrides the global style', () => {
    expect(
      resolveSidebarActivity(
        { unreadCount: 4, indicatorType: 'dot' },
        config({ style: 'badge' }),
        'channels',
      ).render,
    ).toBe('dot');
  });

  it('clamps the display count at maxCount', () => {
    expect(
      resolveSidebarActivity({ unreadCount: 150 }, config(), 'channels')
        .display,
    ).toBe('99+');
    expect(
      resolveSidebarActivity(
        { unreadCount: 1500 },
        config({ maxCount: 999 }),
        'channels',
      ).display,
    ).toBe('999+');
  });

  it('builds an accessible label', () => {
    expect(
      resolveSidebarActivity({ unreadCount: 3 }, config(), 'channels', {
        itemLabel: '#general',
      }).label,
    ).toBe('3 unread messages in #general');
    expect(
      resolveSidebarActivity(
        { activityType: 'mention' },
        config(),
        'channels',
        { itemLabel: '#general' },
      ).label,
    ).toBe('You were mentioned in #general');
  });
});

describe('hasSidebarActivity', () => {
  it('is true whenever the resolver would draw a mark', () => {
    expect(hasSidebarActivity({ unreadCount: 1 }, config(), 'channels')).toBe(
      true,
    );
    expect(hasSidebarActivity({ unreadCount: 0 }, config(), 'channels')).toBe(
      false,
    );
    expect(
      hasSidebarActivity(
        { unreadCount: 1 },
        config({ enabled: false }),
        'channels',
      ),
    ).toBe(false);
  });
});

describe('<SidebarActivityIndicator />', () => {
  it('renders nothing when there is no activity', () => {
    const { container } = render(
      <SidebarActivityIndicator
        state={{ unreadCount: 0 }}
        surface="channels"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a labelled dot for ambient activity', () => {
    render(
      <SidebarActivityIndicator
        state={{ hasActivity: true }}
        surface="channels"
        itemLabel="#general"
      />,
    );
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Unread activity in #general',
    );
  });

  it('renders a count badge for unread items', () => {
    render(
      <SidebarActivityIndicator
        state={{ unreadCount: 5 }}
        surface="dms"
        itemLabel="Ada Lovelace"
      />,
    );
    const badge = screen.getByRole('img');
    expect(badge).toHaveTextContent('5');
    expect(badge).toHaveAttribute(
      'aria-label',
      '5 unread messages in Ada Lovelace',
    );
  });

  it('obeys a provided config (preferences off)', () => {
    const { container } = render(
      <SidebarActivityConfigProvider value={config({ enabled: false })}>
        <SidebarActivityIndicator
          state={{ unreadCount: 9 }}
          surface="channels"
        />
      </SidebarActivityConfigProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
