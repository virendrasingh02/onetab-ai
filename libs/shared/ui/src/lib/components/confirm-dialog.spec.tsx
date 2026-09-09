import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { confirm, ConfirmRoot, useConfirm } from './confirm-dialog.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu.js';

/** Mirrors the real call sites: a Delete item inside a dropdown menu. */
function DeleteFromMenu({ onDelete }: { onDelete: () => void }) {
  const ask = useConfirm();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onSelect={() => {
              void ask({
                title: 'Delete “Notes”?',
                description: 'This cannot be undone.',
                confirmLabel: 'Delete',
                destructive: true,
              }).then((ok) => {
                if (ok) onDelete();
              });
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmRoot />
    </>
  );
}

describe('confirm()', () => {
  it('resolves true when the confirm button is pressed', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<DeleteFromMenu onDelete={onDelete} />);

    await user.click(screen.getByText('Open menu'));
    await user.click(await screen.findByText('Delete'));

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it('resolves false when cancelled', async () => {
    const user = userEvent.setup();
    let result: boolean | null = null;

    function Harness() {
      return (
        <>
          <button
            onClick={() => {
              void confirm({ title: 'Delete this?', destructive: true }).then(
                (ok) => {
                  result = ok;
                },
              );
            }}
          >
            trigger
          </button>
          <ConfirmRoot />
        </>
      );
    }

    render(<Harness />);
    await user.click(screen.getByText('trigger'));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(result).toBe(false));
  });

  it('resolves false on Escape / dismissal', async () => {
    const user = userEvent.setup();
    let result: boolean | null = null;

    function Harness() {
      return (
        <>
          <button
            onClick={() => {
              void confirm({ title: 'Remove member?' }).then((ok) => {
                result = ok;
              });
            }}
          >
            trigger
          </button>
          <ConfirmRoot />
        </>
      );
    }

    render(<Harness />);
    await user.click(screen.getByText('trigger'));
    await screen.findByText('Remove member?');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(result).toBe(false));
  });

  it('gates the confirm button behind type-to-confirm text', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    function Harness() {
      return (
        <>
          <button
            onClick={() => {
              void confirm({
                title: 'Delete workspace?',
                destructive: true,
                confirmLabel: 'Delete workspace',
                requireText: 'Acme Inc',
              }).then((ok) => {
                if (ok) onDelete();
              });
            }}
          >
            trigger
          </button>
          <ConfirmRoot />
        </>
      );
    }

    render(<Harness />);
    await user.click(screen.getByText('trigger'));

    const confirmButton = await screen.findByRole('button', {
      name: 'Delete workspace',
    });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByRole('textbox'), 'Acme Inc');
    await waitFor(() => expect(confirmButton).toBeEnabled());

    await user.click(confirmButton);
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it('settles a superseded request as false', async () => {
    const user = userEvent.setup();
    const results: boolean[] = [];

    function Harness() {
      return (
        <>
          <button
            onClick={() => {
              void confirm({ title: 'First?' }).then((ok) => results.push(ok));
              void confirm({ title: 'Second?' }).then((ok) => results.push(ok));
            }}
          >
            trigger
          </button>
          <ConfirmRoot />
        </>
      );
    }

    render(<Harness />);
    await user.click(screen.getByText('trigger'));

    // The first promise settles false immediately; the second dialog is shown.
    await waitFor(() => expect(results).toEqual([false]));
    await screen.findByText('Second?');
  });
});
