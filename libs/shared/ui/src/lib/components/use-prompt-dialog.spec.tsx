import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu.js';
import { usePromptDialog } from './use-prompt-dialog.js';

/** Mirrors the real call sites: the rename item lives inside a dropdown menu. */
function RenameFromMenu({ onRename }: { onRename: (value: string) => void }) {
  const prompts = usePromptDialog();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() => {
              void prompts
                .promptText({
                  title: 'Rename document',
                  label: 'Title',
                  defaultValue: 'Old title',
                  confirmLabel: 'Rename',
                })
                .then((title) => {
                  if (title) onRename(title);
                });
            }}
          >
            Rename
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {prompts.dialog}
    </>
  );
}

/** The sidebar's exact shape: `onSelect` (Radix's own event) driving an async fn. */
function RenameViaOnSelect({
  onRename,
}: {
  onRename: (value: string) => void;
}) {
  const prompts = usePromptDialog();
  const rename = async () => {
    const name = await prompts.promptText({
      title: 'Rename project',
      label: 'Project name',
      defaultValue: 'Old project',
      confirmLabel: 'Rename',
    });
    if (!name) return;
    onRename(name);
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => void rename()}>
            Rename
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {prompts.dialog}
    </>
  );
}

describe('usePromptDialog opened from a dropdown menu', () => {
  it('stays open when triggered via onSelect', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<RenameViaOnSelect onRename={onRename} />);

    await user.click(screen.getByText('Open menu'));
    await user.click(await screen.findByText('Rename'));

    const field = await screen.findByLabelText('Project name');
    await waitFor(() => expect(field).toHaveFocus());

    await user.clear(field);
    await user.type(field, 'Renamed');
    await user.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() => expect(onRename).toHaveBeenCalledWith('Renamed'));
  });

  it('stays open and accepts typed input after the menu closes', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<RenameFromMenu onRename={onRename} />);

    await user.click(screen.getByText('Open menu'));
    await user.click(await screen.findByText('Rename'));

    const field = await screen.findByLabelText('Title');
    await waitFor(() => expect(field).toHaveFocus());

    await user.clear(field);
    await user.type(field, 'New title');
    await user.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() => expect(onRename).toHaveBeenCalledWith('New title'));
  });

  it('resolves true when a destructive confirm is accepted', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    function DeleteFromMenu() {
      const prompts = usePromptDialog();
      return (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onSelect={() => {
                  void prompts
                    .confirmAction({
                      title: 'Delete “Notes”?',
                      description: 'This cannot be undone.',
                      confirmLabel: 'Delete',
                      destructive: true,
                    })
                    .then((confirmed) => {
                      if (confirmed) onDelete();
                    });
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {prompts.dialog}
        </>
      );
    }

    render(<DeleteFromMenu />);
    await user.click(screen.getByText('Open menu'));
    await user.click(await screen.findByText('Delete'));

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it('leaves the page interactive after the dialog closes', async () => {
    const user = userEvent.setup();
    render(<RenameFromMenu onRename={vi.fn()} />);

    await user.click(screen.getByText('Open menu'));
    await user.click(await screen.findByText('Rename'));
    await screen.findByLabelText('Title');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByLabelText('Title')).not.toBeInTheDocument(),
    );
    /* Radix modal layers set `pointer-events: none` on the body. If the menu and
       the dialog unwind out of order it is never restored and the whole app
       stops responding to the mouse. */
    await waitFor(() =>
      expect(document.body.style.pointerEvents).not.toBe('none'),
    );
  });
});
