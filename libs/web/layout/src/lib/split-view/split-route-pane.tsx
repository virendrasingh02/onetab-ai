import { Button, Hint } from '@org/ui';
import { Maximize2, X } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createPath,
  NavigationType,
  parsePath,
  UNSAFE_LocationContext as LocationContext,
  UNSAFE_NavigationContext as NavigationContext,
  UNSAFE_RouteContext as RouteContext,
  useNavigate,
  type Location,
  type Navigator,
  type To,
} from 'react-router-dom';

interface PaneHistory {
  entries: Location[];
  index: number;
  action: NavigationType;
}

let keyCounter = 0;

function toLocation(to: To, state: unknown = null): Location {
  const path = typeof to === 'string' ? parsePath(to) : to;
  return {
    pathname: path.pathname ?? '/',
    search: path.search ?? '',
    hash: path.hash ?? '',
    state,
    key: `split-${keyCounter++}`,
  };
}

/**
 * A router of its own for the split pane.
 *
 * The pane hosts any page of the app, and a page's own links and `navigate()`
 * calls must move *the pane* — not the page beside it. React Router won't nest
 * a second `<Router>`, so this swaps the navigation and location contexts for
 * the subtree instead, backed by a small in-memory history. Route matching then
 * restarts from the root (empty `RouteContext`), which is why `pages` is a full
 * `<Routes>` with absolute paths.
 */
function PaneRouter({
  initialPath,
  history,
  setHistory,
  children,
}: {
  initialPath: string;
  history: PaneHistory;
  setHistory: React.Dispatch<React.SetStateAction<PaneHistory>>;
  children: ReactNode;
}) {
  void initialPath;
  const navigator = useMemo<Navigator>(() => {
    const push = (to: To, state?: unknown) =>
      setHistory((h) => ({
        entries: [...h.entries.slice(0, h.index + 1), toLocation(to, state)],
        index: h.index + 1,
        action: NavigationType.Push,
      }));
    const replace = (to: To, state?: unknown) =>
      setHistory((h) => {
        const entries = [...h.entries];
        entries[h.index] = toLocation(to, state);
        return { ...h, entries, action: NavigationType.Replace };
      });
    return {
      createHref: (to) => (typeof to === 'string' ? to : createPath(to)),
      go: (delta) =>
        setHistory((h) => ({
          ...h,
          index: Math.min(Math.max(h.index + delta, 0), h.entries.length - 1),
          action: NavigationType.Pop,
        })),
      push,
      replace,
    };
  }, [setHistory]);

  const location = history.entries[history.index];
  const nav = useMemo(
    () => ({
      basename: '/',
      navigator,
      static: false,
      future: { v7_relativeSplatPath: false },
    }),
    [navigator],
  );
  const loc = useMemo(
    () => ({ location, navigationType: history.action }),
    [location, history.action],
  );
  const route = useMemo(
    () => ({ outlet: null, matches: [], isDataRoute: false }),
    [],
  );

  return (
    <NavigationContext.Provider value={nav}>
      <LocationContext.Provider value={loc}>
        <RouteContext.Provider value={route}>{children}</RouteContext.Provider>
      </LocationContext.Provider>
    </NavigationContext.Provider>
  );
}

export interface SplitRoutePaneProps {
  /** Where the pane starts, e.g. `/w/acme/docs/abc?tab=x`. */
  initialPath: string;
  title: string;
  /** The app's full page table (`<Routes>` with absolute paths). */
  pages: ReactNode;
  onClose: () => void;
}

/**
 * Any page of the app in the split pane — a doc, a project, the inbox,
 * meetings, files… It adds no header of its own. Links inside it navigate the pane; "Open as main view"
 * promotes whatever the pane is showing to the routed page.
 */
export function SplitRoutePane({
  initialPath,
  title,
  pages,
  onClose,
}: SplitRoutePaneProps) {
  const mainNavigate = useNavigate();
  const [history, setHistory] = useState<PaneHistory>(() => ({
    entries: [toLocation(initialPath)],
    index: 0,
    action: NavigationType.Pop,
  }));
  const current = history.entries[history.index];
  const currentRef = useRef(current);
  currentRef.current = current;

  return (
    <section
      className="group/split min-h-0 relative flex h-full flex-col overflow-hidden"
      aria-label={`Split view: ${title}`}
    >
      {/* The page brings its own header, so the pane adds none: its two
          controls float over the corner, shown on hover or keyboard focus. */}
      <div className="top-1.5 right-1.5 gap-0.5 p-0.5 absolute z-30 flex rounded-lg border border-border bg-card/95 opacity-0 shadow-xs backdrop-blur-sm transition-opacity focus-within:opacity-100 group-hover/split:opacity-100 pointer-coarse:opacity-100">
        <Hint label="Open as main view">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open as main view"
            onClick={() => {
              mainNavigate(createPath(currentRef.current));
              onClose();
            }}
          >
            <Maximize2 className="size-3.5" />
          </Button>
        </Hint>
        <Hint label="Close split view">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close split view"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </Hint>
      </div>

      <div className="min-h-0 flex flex-1 flex-col overflow-y-auto">
        <PaneRouter
          initialPath={initialPath}
          history={history}
          setHistory={setHistory}
        >
          {pages}
        </PaneRouter>
      </div>
    </section>
  );
}
