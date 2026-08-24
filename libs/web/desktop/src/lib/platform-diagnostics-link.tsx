import { Bug } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * The only thing in the whole app that points at `/dev/platform-diagnostics`.
 *
 * `import.meta.env.PROD` is true for both a real web production deploy and a
 * packaged desktop build (it serves the same `vite build` output — see
 * docs/desktop-app.md) and false for both `nx serve @org/web` and Electron
 * pointed at that dev server, so this one check is what keeps the diagnostics
 * screen out of every shipped build without a second flag to keep in sync.
 */
export function PlatformDiagnosticsLink() {
  if (import.meta.env.PROD) return null;

  return (
    <Link
      to="/dev/platform-diagnostics"
      className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
    >
      <Bug className="size-3.5" />
      Developer diagnostics (platform &amp; features)
    </Link>
  );
}
