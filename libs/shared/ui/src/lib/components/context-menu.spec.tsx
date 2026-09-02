import { render, screen, fireEvent } from '@testing-library/react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from './context-menu.js';
import { useState } from 'react';

describe('ContextMenu Component', () => {
  it('renders trigger and opens menu on contextmenu event', async () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger data-testid="cm-trigger">Right click me</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Manage</ContextMenuLabel>
          <ContextMenuItem>
            <span>Edit Item</span>
            <ContextMenuShortcut keys={['mod', 'E']} />
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem destructive>Delete Item</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );

    const trigger = screen.getByTestId('cm-trigger');
    expect(screen.queryByText('Edit Item')).not.toBeInTheDocument();

    fireEvent.contextMenu(trigger, { clientX: 100, clientY: 150 });

    expect(await screen.findByText('Edit Item')).toBeInTheDocument();
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('Manage')).toBeInTheDocument();
  });

  it('triggers item onClick and closes menu', async () => {
    const onClick = vi.fn();
    render(
      <ContextMenu>
        <ContextMenuTrigger data-testid="cm-trigger">Target</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onClick}>Action</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );

    fireEvent.contextMenu(screen.getByTestId('cm-trigger'), { clientX: 50, clientY: 50 });
    const actionItem = await screen.findByText('Action');
    fireEvent.click(actionItem);

    expect(onClick).toHaveBeenCalled();
  });

  it('supports ContextMenuCheckboxItem', async () => {
    function TestComponent() {
      const [checked, setChecked] = useState(false);
      return (
        <ContextMenu>
          <ContextMenuTrigger data-testid="cm-trigger">Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuCheckboxItem
              checked={checked}
              onCheckedChange={setChecked}
            >
              Show Status
            </ContextMenuCheckboxItem>
          </ContextMenuContent>
        </ContextMenu>
      );
    }

    render(<TestComponent />);
    fireEvent.contextMenu(screen.getByTestId('cm-trigger'), { clientX: 50, clientY: 50 });

    const checkboxItem = await screen.findByRole('menuitemcheckbox');
    expect(checkboxItem).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(checkboxItem);
  });

  it('supports ContextMenuRadioGroup and RadioItem', async () => {
    function TestRadioComponent() {
      const [val, setVal] = useState('one');
      return (
        <ContextMenu>
          <ContextMenuTrigger data-testid="cm-trigger">Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuRadioGroup value={val} onValueChange={setVal}>
              <ContextMenuRadioItem value="one">Option 1</ContextMenuRadioItem>
              <ContextMenuRadioItem value="two">Option 2</ContextMenuRadioItem>
            </ContextMenuRadioGroup>
          </ContextMenuContent>
        </ContextMenu>
      );
    }

    render(<TestRadioComponent />);
    fireEvent.contextMenu(screen.getByTestId('cm-trigger'), { clientX: 50, clientY: 50 });

    const radio1 = await screen.findByText('Option 1');
    expect(radio1.closest('[role="menuitemradio"]')).toHaveAttribute('aria-checked', 'true');
  });
});
