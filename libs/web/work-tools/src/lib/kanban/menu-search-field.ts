import { useRef, type KeyboardEvent } from 'react';

/**
 * Wires a search box into a Radix dropdown menu.
 *
 * `autoFocus` alone loses: the menu takes focus for itself once it opens, and
 * its typeahead claims printable keys, so typing would land nowhere. Spread
 * `contentProps` on the menu content and `inputProps` on the input. Arrows,
 * Enter and Escape still reach the menu, so keyboard picking keeps working.
 */
export function useMenuSearchField() {
  const inputRef = useRef<HTMLInputElement>(null);

  return {
    contentProps: {
      onOpenAutoFocus: (event: Event) => {
        if (!inputRef.current) return;
        event.preventDefault();
        inputRef.current.focus();
      },
    },
    inputProps: {
      ref: inputRef,
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key.length === 1) event.stopPropagation();
      },
    },
  };
}
