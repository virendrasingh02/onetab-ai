import type { ReactNode } from 'react';
import { DesktopTitleBar } from './desktop-title-bar.js';
import { DesktopUpdateBanner } from './desktop-update-banner.js';

/**
 * The frame the app renders inside: title bar and update strip above, routed
 * content filling what is left.
 *
 * The wrapper is present in the browser too, even though both bars render
 * `null` there. Making it conditional would mean screens had to size themselves
 * differently per platform — this way every screen can simply fill its parent,
 * and adding a bar shrinks the content area instead of pushing it off-screen.
 */
export function DesktopChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <DesktopTitleBar />
      <DesktopUpdateBanner />
      {/*
        `min-h-0` is what lets this shrink below its content's intrinsic height;
        without it a flex child refuses to shrink and the bars get pushed out.
      */}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
