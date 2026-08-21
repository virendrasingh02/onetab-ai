import type { TaskStatus } from '@org/types';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { flushSync } from 'react-dom';
import { createDragGhost, type DragGhost } from './drag-ghost.js';

/**
 * Dragging cards and columns around the board.
 *
 * The HTML5 drag-and-drop API this replaces could only ever be as smooth as the
 * browser's own drag image: a frozen bitmap that cannot tilt, arrives a frame
 * late, and on touch devices never arrives at all. Pointer events give the
 * gesture back, at the cost of having to do the three things the browser was
 * doing for us — hit-testing, auto-scrolling and painting the thing under the
 * cursor.
 *
 * Two decisions keep it cheap:
 *
 *  - **Nothing re-renders mid-drag.** React is told what was picked up and what
 *    was put down, and that is all. The gap that opens under the pointer is a
 *    transform on the neighbours and a transform on the placeholder, written
 *    straight to the DOM from a single rAF loop. A drag is two renders long no
 *    matter how far it travels.
 *  - **Geometry is measured once.** Transforms do not disturb layout, so the
 *    boxes taken at pick-up stay true for the whole drag. They are stored
 *    relative to the scroll *content* — the column's for cards, the board row's
 *    for columns — which makes them survive auto-scrolling too, so hit-testing
 *    never re-reads the DOM.
 *
 * Cards and columns are the same gesture at right angles: a card opens a
 * vertical gap in a column, a column opens a horizontal one in the row. The
 * keyboard path shares the slot model, minus the ghost — pick up with Space,
 * walk with the arrow keys, drop with Space.
 */

/** Vertical rhythm between tiles — the column's `space-y-2`. */
const CARD_GAP = 8;
/** Horizontal rhythm between columns — the board row's `gap-4`. */
const COLUMN_GAP = 16;
/** Pointer travel, in px, before a press becomes a drag. */
const MOUSE_ACTIVATION_DISTANCE = 5;
/** Hold time before a touch becomes a drag, and the travel that cancels it. */
const TOUCH_ACTIVATION_DELAY = 200;
const TOUCH_ACTIVATION_TOLERANCE = 10;
/** How close to a scroller's edge auto-scroll starts, and how fast it can get. */
const EDGE_ZONE = 88;
const EDGE_MAX_SPEED = 1200;
/** Frame time is clamped so a stalled tab cannot fling a scroller on resume. */
const MAX_FRAME = 0.05;

const SHIFT_TRANSITION = 'transform 200ms cubic-bezier(0.2, 0, 0, 1)';

/** A column is a much bigger thing to tilt than a card, so it tilts less. */
const COLUMN_LIFT = 'rotate(1.5deg) scale(1.02)';

/** Where a card would land: a column, and an index among that column's cards. */
export interface DragSlot {
  listId: TaskStatus;
  index: number;
}

/** The elements of one column the engine needs to reach. */
export interface ColumnNodes {
  /** The column as a whole — its horizontal extent is the card drop region. */
  section: HTMLElement;
  /** The element that scrolls the cards. */
  viewport: HTMLElement;
  /** The `<ul>` holding the tiles, the placeholder and the empty-state line. */
  list: HTMLElement;
}

export interface BoardDragColumn {
  listId: TaskStatus;
  /** How many cards the filter is currently showing, for keyboard bounds. */
  count: number;
  title: string;
}

export interface UseBoardDragOptions {
  /** The columns as drawn, in board order. */
  columns: BoardDragColumn[];
  /** The row of columns, which auto-scrolls sideways during a drag. */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** Commits a card drag. Not called when the card lands where it started. */
  onDrop: (cardId: string, slot: DragSlot) => void;
  /** Commits a column drag. `toIndex` is over the columns as drawn. */
  onColumnDrop: (listId: TaskStatus, toIndex: number) => void;
}

export interface DragHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

export interface BoardDrag {
  /** The card in the air, or `null`. Its tile is hidden while this is set. */
  activeCardId: string | null;
  /** The column in the air, or `null`. Its section is hidden while this is set. */
  activeListId: TaskStatus | null;
  /** Live-region text describing what the keyboard drag just did. */
  announcement: string;
  registerColumn: (listId: TaskStatus, nodes: ColumnNodes | null) => void;
  getCardHandlers: (
    cardId: string,
    listId: TaskStatus,
    index: number,
  ) => DragHandlers;
  getColumnHandlers: (listId: TaskStatus, index: number) => DragHandlers;
}

/* ------------------------------------------------------------- internals --- */

/**
 * One tile's box, in its column's scroll-content coordinates.
 *
 * Content coordinates rather than viewport ones so that auto-scrolling — the
 * one thing that moves tiles during a drag without a layout change — does not
 * invalidate them.
 */
interface CardMetric {
  id: string;
  el: HTMLElement;
  top: number;
  height: number;
}

interface ColumnMetrics {
  listId: TaskStatus;
  nodes: ColumnNodes;
  /** Where the `<ul>` starts, so a slot's top can be expressed relative to it. */
  listOffset: number;
  /** Every tile except the one being dragged, in draw order. */
  cards: CardMetric[];
}

/** One column's box, in the board row's scroll-content coordinates. */
interface RowMetric {
  listId: TaskStatus;
  el: HTMLElement;
  left: number;
  width: number;
}

interface SessionBase {
  mode: 'pointer' | 'keyboard';
  /**
   * The element that is lifted: hidden for the duration, cloned into the ghost,
   * and measured for the gap it leaves. A card is grabbed by its whole tile, but
   * a column is grabbed by its header and lifted as a whole — the body belongs
   * to the cards, which have a drag of their own.
   */
  source: HTMLElement;
  /** Where the press landed, and where focus goes back to on drop. */
  handle: HTMLElement;
  /** The space the lifted thing leaves behind: its own size plus the gap. */
  gap: number;
  /** Its size, for the placeholder that stands in for it. */
  width: number;
  height: number;

  pointerId: number;
  /** Where inside the element the pointer took hold. */
  grabX: number;
  grabY: number;
  pointerX: number;
  pointerY: number;
  ghost: DragGhost | null;
  frame: number;
  lastTick: number;
}

interface CardSession extends SessionBase {
  kind: 'card';
  cardId: string;
  origin: DragSlot;
  slot: DragSlot;
  metrics: Map<TaskStatus, ColumnMetrics>;
}

interface ColumnSession extends SessionBase {
  kind: 'column';
  listId: TaskStatus;
  originIndex: number;
  index: number;
  /** Every column except the one being dragged, left to right. */
  row: RowMetric[];
}

type Session = CardSession | ColumnSession;

/** A press that has not yet travelled far enough (or been held long enough). */
interface Pending {
  kind: 'card' | 'column';
  cardId: string;
  listId: TaskStatus;
  index: number;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  source: HTMLElement;
  handle: HTMLElement;
  timer: number | null;
}

function query(root: HTMLElement, selector: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(selector);
}

/** Speed away from an edge: nothing until the zone, then quadratic to the rim. */
function edgeVelocity(position: number, min: number, max: number): number {
  if (position < min + EDGE_ZONE) {
    const depth = Math.min((min + EDGE_ZONE - position) / EDGE_ZONE, 1);
    return -depth * depth * EDGE_MAX_SPEED;
  }
  if (position > max - EDGE_ZONE) {
    const depth = Math.min((position - (max - EDGE_ZONE)) / EDGE_ZONE, 1);
    return depth * depth * EDGE_MAX_SPEED;
  }
  return 0;
}

/** Top of the free slot at `index`, in the column's content coordinates. */
function slotTop(column: ColumnMetrics, index: number): number {
  if (column.cards.length === 0) return column.listOffset;
  if (index >= column.cards.length) {
    const last = column.cards[column.cards.length - 1];
    return last.top + last.height + CARD_GAP;
  }
  return column.cards[index].top;
}

/** Left of the free slot at `index`, in the row's content coordinates. */
function slotLeft(row: RowMetric[], index: number): number {
  if (row.length === 0) return 0;
  if (index >= row.length) {
    const last = row[row.length - 1];
    return last.left + last.width + COLUMN_GAP;
  }
  return row[index].left;
}

/**
 * Moves a placeholder to `offset` along `axis`.
 *
 * A placeholder that is only now being shown is put in place with no
 * transition: it would otherwise slide in from wherever it was left the last
 * time, which is not a move the reader has any way to make sense of.
 */
function placeMarker(
  marker: HTMLElement,
  axis: 'x' | 'y',
  offset: number,
  size: { width?: number; height?: number },
): void {
  const transform =
    axis === 'y'
      ? `translate3d(0, ${offset}px, 0)`
      : `translate3d(${offset}px, 0, 0)`;

  if (marker.hidden) {
    marker.hidden = false;
    marker.style.transition = 'none';
    if (size.width !== undefined) marker.style.width = `${size.width}px`;
    if (size.height !== undefined) marker.style.height = `${size.height}px`;
    marker.style.transform = transform;
    void marker.offsetHeight;
    marker.style.transition = SHIFT_TRANSITION;
    return;
  }
  marker.style.transform = transform;
}

/* ------------------------------------------------------------------ hook --- */

export function useBoardDrag({
  columns,
  scrollerRef,
  onDrop,
  onColumnDrop,
}: UseBoardDragOptions): BoardDrag {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeListId, setActiveListId] = useState<TaskStatus | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const nodesRef = useRef(new Map<TaskStatus, ColumnNodes>());
  const sessionRef = useRef<Session | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  /* Read from inside the gesture, which outlives the render that set it up. */
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const onColumnDropRef = useRef(onColumnDrop);
  onColumnDropRef.current = onColumnDrop;

  const registerColumn = useCallback(
    (listId: TaskStatus, nodes: ColumnNodes | null) => {
      if (nodes) nodesRef.current.set(listId, nodes);
      else nodesRef.current.delete(listId);
    },
    [],
  );

  /* ----------------------------------------------------- painting: cards --- */

  /** Puts a column's tiles back the way they were found. */
  const clearColumn = useCallback((session: CardSession, listId: TaskStatus) => {
    const column = session.metrics.get(listId);
    if (!column) return;

    for (const card of column.cards) {
      // Transition off first: closing the gap is a correction, not a move.
      card.el.style.transition = '';
      card.el.style.transform = '';
    }
    column.nodes.list.style.paddingBottom = '';
    delete column.nodes.section.dataset.dropTarget;

    const marker = query(column.nodes.list, '[data-kanban-placeholder]');
    if (marker) {
      marker.hidden = true;
      marker.style.transition = 'none';
      marker.style.transform = '';
    }

    const empty = query(column.nodes.list, '[data-kanban-empty]');
    if (empty) empty.style.display = '';
  }, []);

  /**
   * Opens the gap at `slot`: everything from that index down slides one card
   * height out of the way, and the placeholder takes the space they left.
   */
  const renderSlot = useCallback(
    (session: CardSession, slot: DragSlot) => {
      for (const listId of session.metrics.keys()) {
        if (listId !== slot.listId) clearColumn(session, listId);
      }

      const column = session.metrics.get(slot.listId);
      if (!column) return;

      const index = Math.min(Math.max(slot.index, 0), column.cards.length);

      column.cards.forEach((card, at) => {
        const next = at >= index ? `translate3d(0, ${session.gap}px, 0)` : '';
        if (card.el.style.transform !== next) card.el.style.transform = next;
      });

      // The last card is now a card-height lower than the content used to end,
      // so the column needs that much more to scroll through.
      column.nodes.list.style.paddingBottom = `${session.gap}px`;
      column.nodes.section.dataset.dropTarget = 'true';

      const empty = query(column.nodes.list, '[data-kanban-empty]');
      if (empty) empty.style.display = 'none';

      const marker = query(column.nodes.list, '[data-kanban-placeholder]');
      if (marker) {
        placeMarker(marker, 'y', slotTop(column, index) - column.listOffset, {
          height: session.height,
        });
      }
    },
    [clearColumn],
  );

  /**
   * Re-reads every tile's box.
   *
   * Runs with the shift transforms stripped: `getBoundingClientRect` reports the
   * transformed box, and these measurements have to describe the layout the
   * transforms are applied *to*.
   */
  const measureCards = useCallback(
    (session: CardSession) => {
      for (const listId of session.metrics.keys()) clearColumn(session, listId);
      session.metrics.clear();

      for (const [listId, nodes] of nodesRef.current) {
        const viewportRect = nodes.viewport.getBoundingClientRect();
        const offset = nodes.viewport.scrollTop - viewportRect.top;

        const cards: CardMetric[] = [];
        for (const el of nodes.list.querySelectorAll<HTMLElement>(
          '[data-kanban-card]',
        )) {
          const id = el.dataset.kanbanCard;
          if (!id || id === session.cardId) continue;
          const rect = el.getBoundingClientRect();
          cards.push({ id, el, top: rect.top + offset, height: rect.height });
          el.style.transition = SHIFT_TRANSITION;
        }

        session.metrics.set(listId, {
          listId,
          nodes,
          listOffset: nodes.list.getBoundingClientRect().top + offset,
          cards,
        });
      }
    },
    [clearColumn],
  );

  const resolveSlot = useCallback(
    (session: CardSession, x: number, y: number): DragSlot => {
      let hit: ColumnMetrics | undefined;
      for (const column of session.metrics.values()) {
        const rect = column.nodes.section.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right) {
          hit = column;
          break;
        }
      }
      // Held out past the last column, or over a gutter: the placeholder stays
      // where it was rather than snapping back to the card's old home.
      if (!hit) return session.slot;

      const viewportRect = hit.nodes.viewport.getBoundingClientRect();
      const contentY = y - viewportRect.top + hit.nodes.viewport.scrollTop;

      let index = hit.cards.length;
      for (let i = 0; i < hit.cards.length; i += 1) {
        if (contentY < hit.cards[i].top + hit.cards[i].height / 2) {
          index = i;
          break;
        }
      }
      return { listId: hit.listId, index };
    },
    [],
  );

  /* --------------------------------------------------- painting: columns --- */

  const clearRow = useCallback(
    (session: ColumnSession) => {
      for (const column of session.row) {
        column.el.style.transition = '';
        column.el.style.transform = '';
      }
      const scroller = scrollerRef.current;
      const marker = scroller
        ? query(scroller, '[data-kanban-column-placeholder]')
        : null;
      if (marker) {
        marker.hidden = true;
        marker.style.transition = 'none';
        marker.style.transform = '';
      }
    },
    [scrollerRef],
  );

  const renderColumnSlot = useCallback(
    (session: ColumnSession, index: number) => {
      const at = Math.min(Math.max(index, 0), session.row.length);

      session.row.forEach((column, seat) => {
        const next = seat >= at ? `translate3d(${session.gap}px, 0, 0)` : '';
        if (column.el.style.transform !== next) column.el.style.transform = next;
      });

      const scroller = scrollerRef.current;
      const marker = scroller
        ? query(scroller, '[data-kanban-column-placeholder]')
        : null;
      if (marker) {
        placeMarker(marker, 'x', slotLeft(session.row, at), {
          width: session.width,
          height: session.height,
        });
      }
    },
    [scrollerRef],
  );

  const measureRow = useCallback(
    (session: ColumnSession) => {
      clearRow(session);
      session.row = [];

      const scroller = scrollerRef.current;
      if (!scroller) return;

      const rect = scroller.getBoundingClientRect();
      const offset = scroller.scrollLeft - rect.left;

      for (const [listId, nodes] of nodesRef.current) {
        if (listId === session.listId) continue;
        const box = nodes.section.getBoundingClientRect();
        session.row.push({
          listId,
          el: nodes.section,
          left: box.left + offset,
          width: box.width,
        });
        nodes.section.style.transition = SHIFT_TRANSITION;
      }
      session.row.sort((a, b) => a.left - b.left);
    },
    [clearRow, scrollerRef],
  );

  const resolveColumnSlot = useCallback(
    (session: ColumnSession, x: number): number => {
      const scroller = scrollerRef.current;
      if (!scroller) return session.index;

      const rect = scroller.getBoundingClientRect();
      const contentX = x - rect.left + scroller.scrollLeft;

      for (let i = 0; i < session.row.length; i += 1) {
        if (contentX < session.row[i].left + session.row[i].width / 2) return i;
      }
      return session.row.length;
    },
    [scrollerRef],
  );

  /* ------------------------------------------------------- auto-scroll --- */

  const autoScroll = useCallback(
    (session: Session, seconds: number) => {
      const scroller = scrollerRef.current;
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        const speed = edgeVelocity(session.pointerX, rect.left, rect.right);
        if (speed) scroller.scrollLeft += speed * seconds;
      }

      // A column only ever travels sideways; only a card can scroll a column.
      if (session.kind !== 'card') return;
      const column = session.metrics.get(session.slot.listId);
      if (!column) return;
      const viewport = column.nodes.viewport;
      const rect = viewport.getBoundingClientRect();
      const speed = edgeVelocity(session.pointerY, rect.top, rect.bottom);
      if (speed) viewport.scrollTop += speed * seconds;
    },
    [scrollerRef],
  );

  /* -------------------------------------------------------- the gesture --- */

  /** Everything the active drag listens to, torn down together. */
  const detachRef = useRef<(() => void) | null>(null);

  const measure = useCallback(
    (session: Session) => {
      if (session.kind === 'card') measureCards(session);
      else measureRow(session);
    },
    [measureCards, measureRow],
  );

  const paint = useCallback(
    (session: Session) => {
      if (session.kind === 'card') renderSlot(session, session.slot);
      else renderColumnSlot(session, session.index);
    },
    [renderColumnSlot, renderSlot],
  );

  /**
   * Hands the board back to React.
   *
   * Order matters twice over. The shift transitions come off first, so closing
   * the gap is instant rather than a 200ms slide against a board that has
   * already moved on. And what was lifted is revealed in the same synchronous
   * block that removes the gap, so the two changes — one card (or column) of
   * size added, one taken away — land in a single paint and cancel out.
   */
  const releaseDom = useCallback(
    (session: Session) => {
      if (session.kind === 'card') {
        for (const column of session.metrics.values()) {
          for (const card of column.cards) card.el.style.transition = '';
        }
        flushSync(() => setActiveCardId(null));
        for (const listId of session.metrics.keys()) clearColumn(session, listId);
        session.metrics.clear();
      } else {
        for (const column of session.row) column.el.style.transition = '';
        flushSync(() => setActiveListId(null));
        clearRow(session);
        session.row = [];
      }
      sessionRef.current = null;
    },
    [clearColumn, clearRow],
  );

  /** Where the lifted thing comes to rest, in viewport coordinates. */
  const restingPlace = useCallback(
    (session: Session, commit: boolean): { x: number; y: number } | null => {
      if (session.kind === 'card') {
        const slot = commit ? session.slot : session.origin;
        const column = session.metrics.get(slot.listId);
        if (!column) return null;
        const viewportRect = column.nodes.viewport.getBoundingClientRect();
        return {
          x: column.nodes.list.getBoundingClientRect().left,
          y:
            slotTop(column, slot.index) -
            column.nodes.viewport.scrollTop +
            viewportRect.top,
        };
      }

      const scroller = scrollerRef.current;
      if (!scroller) return null;
      const rect = scroller.getBoundingClientRect();
      const index = commit ? session.index : session.originIndex;
      return {
        x: slotLeft(session.row, index) - scroller.scrollLeft + rect.left,
        y: rect.top,
      };
    },
    [scrollerRef],
  );

  const finish = useCallback(
    (session: Session, commit: boolean) => {
      cancelAnimationFrame(session.frame);
      detachRef.current?.();
      detachRef.current = null;

      // What was dragged is placed before the ghost has finished flying, so the
      // board underneath is already correct when it lands. What it lands on
      // stays hidden until then, so only one copy is ever visible.
      if (commit) {
        if (session.kind === 'card') {
          const moved =
            session.slot.listId !== session.origin.listId ||
            session.slot.index !== session.origin.index;
          if (moved) onDropRef.current(session.cardId, session.slot);
        } else if (session.index !== session.originIndex) {
          onColumnDropRef.current(session.listId, session.index);
        }
      }

      const teardown = () => {
        session.ghost?.destroy();
        releaseDom(session);
      };

      const rest = session.ghost ? restingPlace(session, commit) : null;
      if (!session.ghost || !rest) {
        teardown();
        return;
      }
      session.ghost.settleTo(rest.x, rest.y, teardown);
    },
    [releaseDom, restingPlace],
  );

  const tick = useCallback(
    (now: number) => {
      const session = sessionRef.current;
      if (!session) return;

      const seconds = Math.min((now - session.lastTick) / 1000, MAX_FRAME);
      session.lastTick = now;

      autoScroll(session, seconds);
      session.ghost?.moveTo(
        session.pointerX - session.grabX,
        session.pointerY - session.grabY,
      );

      if (session.kind === 'card') {
        const slot = resolveSlot(session, session.pointerX, session.pointerY);
        if (
          slot.listId !== session.slot.listId ||
          slot.index !== session.slot.index
        ) {
          session.slot = slot;
          renderSlot(session, slot);
        }
      } else {
        const index = resolveColumnSlot(session, session.pointerX);
        if (index !== session.index) {
          session.index = index;
          renderColumnSlot(session, index);
        }
      }

      session.frame = requestAnimationFrame(tick);
    },
    [autoScroll, renderColumnSlot, renderSlot, resolveColumnSlot, resolveSlot],
  );

  const clearPending = useCallback(() => {
    const pending = pendingRef.current;
    if (pending?.timer) window.clearTimeout(pending.timer);
    pendingRef.current = null;
  }, []);

  /** Builds the session for a press that has proved itself. */
  const sessionFor = useCallback(
    (
      pending: Pending,
      mode: 'pointer' | 'keyboard',
      x: number,
      y: number,
    ): Session => {
      const source = pending.source;
      const rect = source.getBoundingClientRect();
      const base: SessionBase = {
        mode,
        source,
        handle: pending.handle,
        gap:
          pending.kind === 'card'
            ? rect.height + CARD_GAP
            : rect.width + COLUMN_GAP,
        width: rect.width,
        height: rect.height,
        pointerId: pending.pointerId,
        grabX: x - rect.left,
        grabY: y - rect.top,
        pointerX: x,
        pointerY: y,
        ghost: null,
        frame: 0,
        lastTick: performance.now(),
      };

      return pending.kind === 'card'
        ? {
            ...base,
            kind: 'card',
            cardId: pending.cardId,
            origin: { listId: pending.listId, index: pending.index },
            slot: { listId: pending.listId, index: pending.index },
            metrics: new Map(),
          }
        : {
            ...base,
            kind: 'column',
            listId: pending.listId,
            originIndex: pending.index,
            index: pending.index,
            row: [],
          };
    },
    [],
  );

  /**
   * Lifts what was grabbed out of the layout and takes the measurements.
   *
   * The hide comes first so the remaining boxes are read where they actually
   * sit once it has gone. React is told after, and sets the same attribute to
   * the same value — nothing flickers in between.
   */
  const lift = useCallback(
    (session: Session) => {
      session.source.hidden = true;
      sessionRef.current = session;
      measure(session);
      paint(session);
      if (session.kind === 'card') setActiveCardId(session.cardId);
      else setActiveListId(session.listId);
    },
    [measure, paint],
  );

  const activate = useCallback(
    (pending: Pending, x: number, y: number) => {
      clearPending();
      if (sessionRef.current) return;
      if (!pending.source.isConnected) return;

      const session = sessionFor(pending, 'pointer', x, y);
      const rect = pending.source.getBoundingClientRect();
      session.ghost = createDragGhost(pending.source, {
        width: rect.width,
        // A column's height has to be pinned: its `max-h-full` has nothing to
        // resolve against once the clone is out of the board's layout.
        height: pending.kind === 'column' ? rect.height : undefined,
        lift: pending.kind === 'column' ? COLUMN_LIFT : undefined,
      });
      session.ghost.moveTo(rect.left, rect.top);

      lift(session);

      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      const onMove = (event: PointerEvent) => {
        if (event.pointerId !== session.pointerId) return;
        session.pointerX = event.clientX;
        session.pointerY = event.clientY;
      };
      const onUp = (event: PointerEvent) => {
        if (event.pointerId !== session.pointerId) return;
        finish(session, true);
      };
      const onCancel = () => finish(session, false);
      const onKey = (event: globalThis.KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        finish(session, false);
      };
      // `touch-action` cannot be changed once a gesture is under way, so a held
      // card is kept from also scrolling the column the only way left.
      const blockTouch = (event: TouchEvent) => event.preventDefault();

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey);
      window.addEventListener('blur', onCancel);
      document.addEventListener('touchmove', blockTouch, { passive: false });

      detachRef.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('blur', onCancel);
        document.removeEventListener('touchmove', blockTouch);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // The press that ended the drag still has a click to deliver, and it
        // would land on whatever was dropped over.
        const swallow = (event: MouseEvent) => {
          event.stopPropagation();
          event.preventDefault();
        };
        window.addEventListener('click', swallow, { capture: true, once: true });
        window.setTimeout(
          () => window.removeEventListener('click', swallow, { capture: true }),
          0,
        );
      };

      session.frame = requestAnimationFrame(tick);
    },
    [clearPending, finish, lift, sessionFor, tick],
  );

  /* --------------------------------------------------------- keyboard --- */

  const titleOf = useCallback(
    (listId: TaskStatus) =>
      columnsRef.current.find((entry) => entry.listId === listId)?.title ??
      listId,
    [],
  );

  const describe = useCallback(
    (session: Session) =>
      session.kind === 'card'
        ? `${titleOf(session.slot.listId)}, position ${session.slot.index + 1}`
        : `column position ${session.index + 1} of ${session.row.length + 1}`,
    [titleOf],
  );

  const keyboardMove = useCallback(
    (session: Session, next: DragSlot | number) => {
      if (session.kind === 'card' && typeof next !== 'number') {
        const column = session.metrics.get(next.listId);
        const limit = column ? column.cards.length : 0;
        session.slot = {
          listId: next.listId,
          index: Math.min(Math.max(next.index, 0), limit),
        };
        renderSlot(session, session.slot);

        const marker = column
          ? query(column.nodes.list, '[data-kanban-placeholder]')
          : null;
        marker?.scrollIntoView({ block: 'nearest' });
        column?.nodes.section.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
        });
      } else if (session.kind === 'column' && typeof next === 'number') {
        session.index = Math.min(Math.max(next, 0), session.row.length);
        renderColumnSlot(session, session.index);

        const scroller = scrollerRef.current;
        const marker = scroller
          ? query(scroller, '[data-kanban-column-placeholder]')
          : null;
        marker?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } else {
        return;
      }

      setAnnouncement(`Moved to ${describe(session)}.`);
    },
    [describe, renderColumnSlot, renderSlot, scrollerRef],
  );

  const finishKeyboard = useCallback(
    (session: Session, commit: boolean) => {
      detachRef.current?.();
      detachRef.current = null;

      const moved =
        session.kind === 'card'
          ? session.slot.listId !== session.origin.listId ||
            session.slot.index !== session.origin.index
          : session.index !== session.originIndex;

      if (commit && moved) {
        if (session.kind === 'card') {
          onDropRef.current(session.cardId, session.slot);
        } else {
          onColumnDropRef.current(session.listId, session.index);
        }
      }

      setAnnouncement(
        commit && moved
          ? `Dropped in ${describe(session)}.`
          : 'Drag cancelled, returned to its place.',
      );

      const handle = session.handle;
      releaseDom(session);
      handle.focus({ preventScroll: true });
    },
    [describe, releaseDom],
  );

  /**
   * Starts a keyboard drag.
   *
   * The keys are then read from the window rather than from the element: what
   * was lifted is hidden, and a hidden element cannot hold focus, so it stops
   * hearing anything the moment the drag begins. Focus goes back to it on drop.
   */
  const startKeyboard = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>, pending: Pending) => {
      if (sessionRef.current) return;
      if (event.key !== ' ' && event.key !== 'Enter') return;
      // Space on a button inside is that button's business.
      if (event.target !== event.currentTarget) return;
      event.preventDefault();

      const session = sessionFor(pending, 'keyboard', 0, 0);
      lift(session);
      setAnnouncement(
        `Picked up ${session.kind === 'card' ? 'card' : `the ${titleOf(pending.listId)} column`}. Use the arrow keys to move it, space to drop, escape to cancel. Currently at ${describe(session)}.`,
      );

      // The press that lifted it is still on its way up to the window, and
      // space is also the key that drops it.
      const trigger = event.nativeEvent;

      const onKey = (keyEvent: globalThis.KeyboardEvent) => {
        if (keyEvent === trigger) return;

        const order = columnsRef.current;

        if (keyEvent.key === ' ' || keyEvent.key === 'Enter') {
          finishKeyboard(session, true);
        } else if (keyEvent.key === 'Escape' || keyEvent.key === 'Tab') {
          finishKeyboard(session, false);
        } else if (session.kind === 'column') {
          if (keyEvent.key === 'ArrowLeft') {
            keyboardMove(session, session.index - 1);
          } else if (keyEvent.key === 'ArrowRight') {
            keyboardMove(session, session.index + 1);
          } else {
            return;
          }
        } else {
          const at = order.findIndex(
            (entry) => entry.listId === session.slot.listId,
          );
          switch (keyEvent.key) {
            case 'ArrowUp':
              keyboardMove(session, {
                listId: session.slot.listId,
                index: session.slot.index - 1,
              });
              break;
            case 'ArrowDown':
              keyboardMove(session, {
                listId: session.slot.listId,
                index: session.slot.index + 1,
              });
              break;
            case 'ArrowLeft':
              if (at > 0) {
                keyboardMove(session, {
                  listId: order[at - 1].listId,
                  index: session.slot.index,
                });
              }
              break;
            case 'ArrowRight':
              if (at !== -1 && at < order.length - 1) {
                keyboardMove(session, {
                  listId: order[at + 1].listId,
                  index: session.slot.index,
                });
              }
              break;
            default:
              return;
          }
        }
        // Arrows and space would otherwise scroll the page out from under the
        // drag, and Tab would walk focus away mid-gesture.
        keyEvent.preventDefault();
      };

      window.addEventListener('keydown', onKey);
      detachRef.current = () => window.removeEventListener('keydown', onKey);
    },
    [describe, finishKeyboard, keyboardMove, lift, sessionFor, titleOf],
  );

  /* ---------------------------------------------------------- pointer --- */

  const startPointer = useCallback(
    (event: ReactPointerEvent<HTMLElement>, pending: Pending) => {
      if (sessionRef.current) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      // Menu triggers, pickers and anything else that owns its own press.
      if ((event.target as HTMLElement).closest('[data-no-drag]')) return;

      const onMove = (moveEvent: PointerEvent) => {
        const current = pendingRef.current;
        if (!current || moveEvent.pointerId !== current.pointerId) return;

        const distance = Math.hypot(
          moveEvent.clientX - current.startX,
          moveEvent.clientY - current.startY,
        );

        if (current.pointerType === 'mouse') {
          if (distance < MOUSE_ACTIVATION_DISTANCE) return;
          detach();
          activate(current, moveEvent.clientX, moveEvent.clientY);
          return;
        }
        // A finger that travels before the hold elapses is scrolling, not
        // picking anything up.
        if (distance > TOUCH_ACTIVATION_TOLERANCE) {
          detach();
          clearPending();
        }
      };

      const onEnd = () => {
        detach();
        clearPending();
      };

      const detach = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);
      };

      if (event.pointerType !== 'mouse') {
        pending.timer = window.setTimeout(() => {
          const current = pendingRef.current;
          if (!current) return;
          detach();
          activate(current, current.startX, current.startY);
        }, TOUCH_ACTIVATION_DELAY);
      }

      pendingRef.current = pending;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
    },
    [activate, clearPending],
  );

  const pendingFrom = (
    kind: 'card' | 'column',
    event: ReactPointerEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>,
    cardId: string,
    listId: TaskStatus,
    index: number,
  ): Pending | null => {
    const handle = event.currentTarget;
    // A card is its own handle; a column is grabbed by the header and lifted
    // whole, so the press has to walk up to the section it belongs to.
    const source =
      kind === 'card' ? handle : handle.closest<HTMLElement>('[data-kanban-list]');
    if (!source) return null;

    return {
      kind,
      cardId,
      listId,
      index,
      pointerId: 'pointerId' in event ? event.pointerId : -1,
      pointerType: 'pointerType' in event ? event.pointerType : 'keyboard',
      startX: 'clientX' in event ? event.clientX : 0,
      startY: 'clientY' in event ? event.clientY : 0,
      source,
      handle,
      timer: null,
    };
  };

  const handlersFor = useCallback(
    (
      kind: 'card' | 'column',
      cardId: string,
      listId: TaskStatus,
      index: number,
    ): DragHandlers => ({
      onPointerDown: (event) => {
        const pending = pendingFrom(kind, event, cardId, listId, index);
        if (pending) startPointer(event, pending);
      },
      onKeyDown: (event) => {
        const pending = pendingFrom(kind, event, cardId, listId, index);
        if (pending) startKeyboard(event, pending);
      },
    }),
    [startKeyboard, startPointer],
  );

  const getCardHandlers = useCallback(
    (cardId: string, listId: TaskStatus, index: number) =>
      handlersFor('card', cardId, listId, index),
    [handlersFor],
  );

  const getColumnHandlers = useCallback(
    (listId: TaskStatus, index: number) =>
      handlersFor('column', '', listId, index),
    [handlersFor],
  );

  /* ----------------------------------------------------------- upkeep --- */

  /**
   * The board can change underneath a drag — a filter edit, or the tasks query
   * settling a mutation someone else made — and the cached geometry goes stale
   * with it. Re-reading it is cheap next to getting the drop index wrong.
   */
  const signature = useMemo(
    () => columns.map((column) => `${column.listId}:${column.count}`).join('|'),
    [columns],
  );

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    measure(session);
    paint(session);
  }, [signature, measure, paint]);

  useEffect(() => {
    const onResize = () => {
      const session = sessionRef.current;
      if (!session) return;
      measure(session);
      paint(session);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure, paint]);

  /** A board that unmounts mid-drag must not leave a ghost pinned to the page. */
  useEffect(
    () => () => {
      const session = sessionRef.current;
      if (!session) return;
      cancelAnimationFrame(session.frame);
      detachRef.current?.();
      session.ghost?.destroy();
      sessionRef.current = null;
    },
    [],
  );

  return {
    activeCardId,
    activeListId,
    announcement,
    registerColumn,
    getCardHandlers,
    getColumnHandlers,
  };
}
