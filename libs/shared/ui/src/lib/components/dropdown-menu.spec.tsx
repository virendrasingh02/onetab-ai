import { render, screen, fireEvent } from '@testing-library/react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from './dropdown-menu.js';
import { useState } from 'react';

function openDropdown(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
  fireEvent.click(trigger);
}

describe('DropdownMenu Component', () => {
  it('renders trigger and opens menu upon click or pointer down', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem variant="destructive">Logout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const trigger = screen.getByRole('button', { name: 'Open Menu' });
    expect(screen.queryByText('Profile')).not.toBeInTheDocument();

    openDropdown(trigger);

    expect(await screen.findByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('triggers item onClick handler', async () => {
    const onClick = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button>Actions</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onClick}>Copy Link</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    openDropdown(screen.getByRole('button', { name: 'Actions' }));
    const item = await screen.findByText('Copy Link');
    fireEvent.click(item);

    expect(onClick).toHaveBeenCalled();
  });

  it('supports DropdownMenuCheckboxItem and DropdownMenuRadioGroup', async () => {
    function TestDropdown() {
      const [checked, setChecked] = useState(true);
      const [radioVal, setRadioVal] = useState('grid');

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button>Settings</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem
              checked={checked}
              onCheckedChange={setChecked}
            >
              Show Bookmarks
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={radioVal} onValueChange={setRadioVal}>
              <DropdownMenuRadioItem value="grid">Grid View</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="list">List View</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    render(<TestDropdown />);
    openDropdown(screen.getByRole('button', { name: 'Settings' }));

    const checkbox = await screen.findByRole('menuitemcheckbox');
    expect(checkbox).toHaveAttribute('aria-checked', 'true');

    const gridRadio = screen.getByRole('menuitemradio', { name: 'Grid View' });
    expect(gridRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('renders shortcuts cleanly with DropdownMenuShortcut', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button>File</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            <span>Save</span>
            <DropdownMenuShortcut keys={['mod', 'S']} />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    openDropdown(screen.getByRole('button', { name: 'File' }));
    expect(await screen.findByText('Save')).toBeInTheDocument();
  });
});
