import type { ReactNode } from 'react';
import { DesktopTitleBar } from './desktop-title-bar.js';

/**
 * The frame the app renders inside: title bar above, routed content filling
 * what is left.
 *
 * There used to be an update banner here too. It claimed a full-width row on
 * every screen for something that is background information the rest of the
 * time; `DesktopUpdateIndicator` now surfaces the same status compactly next
 * to the profile menu in `AppHeader` instead, so an update no longer costs
 * vertical space it isn't using.
 *
 * The wrapper is present in the browser too, even though the title bar renders
 * `null` there. Making it conditional would mean screens had to size themselves
 * differently per platform — this way every screen can simply fill its parent,
 * and adding a bar shrinks the content area instead of pushing it off-screen.
 */
export function DesktopChrome({ children }: { children: ReactNode }) {
  return (
    /*
      `pt-safe`/`px-safe` keep the frame clear of a phone's notch and rounded
      corners on the web build (insets are `0px` on desktop and in Electron's
      normal window state, so this is inert there). `h-dvh` with border-box means
      the padding is carved out of the dynamic viewport height, not added to it.
    */
    <div className="flex h-dvh flex-col overflow-hidden bg-background pt-safe px-safe">
      <DesktopTitleBar />
      {/*
        `min-h-0` is what lets this shrink below its content's intrinsic height;
        without it a flex child refuses to shrink and the bars get pushed out.
      */}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
