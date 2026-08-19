import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@org/ui';
import { Keyboard } from 'lucide-react';
import React from 'react';

export interface LinearShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation & Views',
    items: [
      { key: '⌘ K / Ctrl+K', label: 'Open Command Palette' },
      { key: 'F', label: 'Toggle Filter Menu' },
      { key: 'V', label: 'Switch View (Board/List/Timeline)' },
      { key: '?', label: 'Open Keyboard Shortcuts' },
      { key: 'Esc', label: 'Close Modal / Dropdown' },
    ],
  },
  {
    title: 'Issue Actions',
    items: [
      { key: 'C', label: 'Create new issue' },
      { key: 'P then S', label: 'Change Status (1-5)' },
      { key: 'P then P', label: 'Change Priority (0-4)' },
      { key: 'P then A', label: 'Assign member (0 for No Lead)' },
      { key: 'P then L', label: 'Add or toggle Labels' },
      { key: 'Enter', label: 'Open selected card details' },
      { key: 'Space', label: 'Quick preview / peek issue' },
    ],
  },
  {
    title: 'Board & Card Editing',
    items: [
      { key: '1 - 5', label: 'Select option in active menu' },
      { key: 'Backspace / Del', label: 'Delete card' },
      { key: '⌘ C / Ctrl+C', label: 'Copy task or link' },
      { key: 'Tab', label: 'Navigate next element' },
    ],
  },
];

export function LinearShortcutsDialog({
  isOpen,
  onClose,
}: LinearShortcutsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-6 max-w-2xl overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Keyboard className="size-4 text-primary" />
            <span>Linear Keyboard Shortcuts</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h4>
              <div className="space-y-1.5 text-xs">
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-surface-muted/50 border border-border/40"
                  >
                    <span className="text-foreground/90 font-medium">
                      {item.label}
                    </span>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-surface text-[10.5px] font-mono font-semibold text-foreground">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
