import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Pencil, Trash2 } from 'lucide-react';
import { ConfirmRoot } from '../confirm-dialog.js';
import {
  ActionDropdownMenu,
  EntityContextMenu,
} from './action-menu.js';
import {
  collectEntityActions,
  registerEntityActions,
  resolveActionSections,
  runEntityAction,
  usePendingActions,
  type EntityAction,
} from './action-model.js';

describe('resolveActionSections', () => {
  it('drops hidden actions and groups the rest in first-seen order', () => {
    const sections = resolveActionSections([
      { id: 'a', label: 'A', group: 'one' },
      { id: 'b', label: 'B', group: 'two' },
      { id: 'c', label: 'C', group: 'one' },
      { id: 'd', label: 'D', group: 'two', hidden: true },
      null,
      false,
    ]);
    expect(sections.map((s) => s.key)).toEqual(['one', 'two']);
    expect(sections[0].items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(sections[1].items.map((i) => i.id)).toEqual(['b']);
  });

  it('drops a submenu whose children are all hidden', () => {
    const sections = resolveActionSections([
      { id: 'sub', label: 'Sub', children: [{ id: 'x', label: 'X', hidden: true }] },
      { id: 'keep', label: 'Keep' },
    ]);
    expect(sections[0].items.map((i) => i.id)).toEqual(['keep']);
  });
});

describe('runEntityAction', () => {
  afterEach(() => usePendingActions.setState({ pending: {} }));

  it('does not run disabled actions', async () => {
    const run = vi.fn();
    expect(await runEntityAction({ id: 'x', label: 'X', disabled: true, run })).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses a second run while the first is in flight', async () => {
    let resolve!: () => void;
    const run = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const action: EntityAction = { id: 'save', label: 'Save', run };
    const first = runEntityAction(action, 'doc-1');
    await Promise.resolve();
    expect(usePendingActions.getState().pending['doc-1:save']).toBe(true);
    expect(await runEntityAction(action, 'doc-1')).toBe(false);
    resolve();
    expect(await first).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(usePendingActions.getState().pending['doc-1:save']).toBeUndefined();
  });

  it('reports a rejected handler as failed and clears the pending flag', async () => {
    const run = vi.fn(() => Promise.reject(new Error('nope')));
    expect(await runEntityAction({ id: 'x', label: 'X', run, errorMessage: false })).toBe(false);
    expect(usePendingActions.getState().pending).toEqual({});
  });

  it('asks for confirmation and skips the handler when cancelled', async () => {
    render(<ConfirmRoot />);
    const run = vi.fn();
    const pending = runEntityAction({
      id: 'del',
      label: 'Delete task',
      destructive: true,
      confirm: { title: 'Delete “Ship it”?', destructive: true },
      run,
    });
    expect(await screen.findByText('Delete “Ship it”?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await pending).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('runs the handler once confirmed', async () => {
    render(<ConfirmRoot />);
    const run = vi.fn();
    const pending = runEntityAction({
      id: 'del',
      label: 'Delete task',
      destructive: true,
      confirm: { title: 'Delete it?', confirmLabel: 'Delete', destructive: true },
      run,
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await pending).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('registry', () => {
  it('appends registered actions without duplicating ids', () => {
    const off = registerEntityActions<{ id: string }>('message', (m) => [
      { id: 'extra', label: `Extra ${m.id}` },
      { id: 'edit', label: 'Shadowed' },
    ]);
    const list = collectEntityActions('message', { id: '1' }, [{ id: 'edit', label: 'Edit' }]);
    expect(list.map((a) => a && a.label)).toEqual(['Edit', 'Extra 1']);
    off();
    expect(collectEntityActions('message', { id: '1' }, [])).toEqual([]);
  });
});

describe('EntityContextMenu', () => {
  const actions = (onEdit = vi.fn(), onDelete = vi.fn()): EntityAction[] => [
    { id: 'edit', label: 'Edit', icon: Pencil, shortcut: 'E', run: onEdit },
    { id: 'secret', label: 'Secret', hidden: true },
    { id: 'delete', label: 'Delete', icon: Trash2, destructive: true, group: 'danger', run: onDelete },
  ];

  it('opens on right-click with the visible actions only', async () => {
    render(
      <EntityContextMenu actions={actions()}>
        <li data-testid="row">Row</li>
      </EntityContextMenu>,
    );
    fireEvent.contextMenu(screen.getByTestId('row'), { clientX: 40, clientY: 40 });
    expect(await screen.findByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('keeps the child element (no wrapper) and runs the chosen action', async () => {
    const onEdit = vi.fn();
    render(
      <ul>
        <EntityContextMenu actions={actions(onEdit)}>
          <li data-testid="row">Row</li>
        </EntityContextMenu>
      </ul>,
    );
    const row = screen.getByTestId('row');
    expect(row.parentElement?.tagName).toBe('UL');
    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    fireEvent.click(await screen.findByRole('menuitem', { name: /Edit/ }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('runs an action from its single-key shortcut while open', async () => {
    const onEdit = vi.fn();
    render(
      <EntityContextMenu actions={actions(onEdit)}>
        <div data-testid="row">Row</div>
      </EntityContextMenu>,
    );
    fireEvent.contextMenu(screen.getByTestId('row'), { clientX: 10, clientY: 10 });
    const menu = await screen.findByRole('menu');
    fireEvent.keyDown(menu, { key: 'e' });
    await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1));
  });

  it('leaves the native menu alone inside inputs', () => {
    render(
      <EntityContextMenu actions={actions()}>
        <div>
          <input data-testid="field" />
        </div>
      </EntityContextMenu>,
    );
    const event = fireEvent.contextMenu(screen.getByTestId('field'));
    expect(event).toBe(true); // not default-prevented
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('innermost wrapper wins when nested', async () => {
    render(
      <EntityContextMenu actions={[{ id: 'outer', label: 'Outer action', run: vi.fn() }]}>
        <div>
          <EntityContextMenu actions={[{ id: 'inner', label: 'Inner action', run: vi.fn() }]}>
            <span data-testid="inner">inner</span>
          </EntityContextMenu>
        </div>
      </EntityContextMenu>,
    );
    fireEvent.contextMenu(screen.getByTestId('inner'), { clientX: 5, clientY: 5 });
    expect(await screen.findByText('Inner action')).toBeInTheDocument();
    expect(screen.queryByText('Outer action')).not.toBeInTheDocument();
  });

  it('opens a touch action sheet on long-press', async () => {
    vi.useFakeTimers();
    try {
      render(
        <EntityContextMenu actions={actions()} label="Task actions">
          <div data-testid="row">Row</div>
        </EntityContextMenu>,
      );
      fireEvent.pointerDown(screen.getByTestId('row'), {
        pointerType: 'touch',
        clientX: 20,
        clientY: 20,
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Task actions')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not open when disabled', () => {
    render(
      <EntityContextMenu actions={actions()} disabled>
        <div data-testid="row">Row</div>
      </EntityContextMenu>,
    );
    fireEvent.contextMenu(screen.getByTestId('row'), { clientX: 5, clientY: 5 });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('ActionDropdownMenu', () => {
  it('renders the same actions behind a trigger', async () => {
    render(
      <ActionDropdownMenu
        actions={[
          { id: 'edit', label: 'Edit', run: vi.fn() },
          {
            id: 'more',
            label: 'Status',
            children: [{ id: 'done', label: 'Done', checked: true, run: vi.fn() }],
          },
        ]}
        trigger={<button type="button">More</button>}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'More' });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
    expect(await screen.findByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Status/ })).toBeInTheDocument();
  });
});
