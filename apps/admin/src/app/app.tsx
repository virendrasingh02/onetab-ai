import { ThemeProvider, useTheme } from '@org/design-system';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  TooltipProvider,
} from '@org/ui';
import { LayoutDashboard, Monitor, Moon, Sun } from 'lucide-react';
import { Route, Routes } from 'react-router-dom';

/**
 * Admin console shell.
 *
 * Phase 2 delivers the themed shell and shared-component wiring; the
 * operational screens (tenants, audit log, feature flags) land in a later
 * phase alongside the platform-admin API surface.
 */
function AdminHome() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-dvh">
      <header className="h-14 gap-3 px-6 flex items-center border-b">
        <span className="size-7 text-xs font-semibold flex items-center justify-center rounded-md bg-primary text-primary-foreground">
          O
        </span>
        <div className="flex-1">
          <h1 className="text-sm font-semibold">OneTab AI — Admin</h1>
        </div>
        <Badge variant="warning">Internal</Badge>
        <div className="gap-1 flex items-center">
          <Button
            variant={theme === 'light' ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label="Light theme"
            onClick={() => setTheme('light')}
          >
            <Sun />
          </Button>
          <Button
            variant={theme === 'dark' ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label="Dark theme"
            onClick={() => setTheme('dark')}
          >
            <Moon />
          </Button>
          <Button
            variant={theme === 'system' ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label="System theme"
            onClick={() => setTheme('system')}
          >
            <Monitor />
          </Button>
        </div>
      </header>

      <main className="max-w-3xl p-6 mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Admin console</CardTitle>
            <CardDescription>
              Shares the design system, theme and component library with the
              main application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={<LayoutDashboard />}
              title="No admin modules yet"
              description="Tenant management, audit logs and feature flags arrive with the platform-admin API."
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <TooltipProvider>
        <Routes>
          <Route path="/" element={<AdminHome />} />
        </Routes>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
