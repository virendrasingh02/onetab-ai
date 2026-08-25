import type { WorkspaceSummary } from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ScrollArea,
  SearchInput,
  WorkspaceAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Building2,
  Check,
  Plus,
  Search,
  Settings,
  UserCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface ManageAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaces: WorkspaceSummary[];
  currentWorkspace: WorkspaceSummary;
  userEmail?: string;
  onAddAccount?: () => void;
  onSwitchWorkspace?: (workspace: WorkspaceSummary) => void;
}

export function ManageAccountsDialog({
  open,
  onOpenChange,
  workspaces,
  currentWorkspace,
  userEmail,
  onAddAccount,
  onSwitchWorkspace,
}: ManageAccountsDialogProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return workspaces;
    return workspaces.filter((w) => {
      const email = (w.email || userEmail || '').toLowerCase();
      const name = w.name.toLowerCase();
      const slug = w.slug.toLowerCase();
      return (
        name.includes(term) || email.includes(term) || slug.includes(term)
      );
    });
  }, [workspaces, query, userEmail]);

  const handleSelectWorkspace = (workspace: WorkspaceSummary) => {
    onOpenChange(false);
    if (onSwitchWorkspace) {
      onSwitchWorkspace(workspace);
    } else {
      navigate(`/w/${workspace.slug}`);
    }
  };

  const handleOpenSettings = (workspace: WorkspaceSummary) => {
    onOpenChange(false);
    navigate(`/w/${workspace.slug}/settings`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden bg-background border border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-4 border-b border-border bg-surface-raised/40">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                <Building2 className="size-5 text-primary" />
                <span>Manage Workspaces & Accounts</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                View and manage your connected workspaces, associated identities, and settings.
              </DialogDescription>
            </div>
          </div>

          <div className="mt-3">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search workspaces by name or email…"
              className="h-8 text-xs bg-background"
              wrapperClassName="w-full"
            />
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[380px] p-3">
          {filtered.length === 0 ? (
            <div className="py-8">
              <EmptyState
                icon={<Search className="size-6 text-muted-foreground" />}
                title="No workspaces found"
                description={
                  query
                    ? `No workspaces match "${query}".`
                    : 'You are not a member of any workspaces yet.'
                }
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((workspace) => {
                const isSelected = workspace.id === currentWorkspace.id;
                const associatedEmail =
                  workspace.email || userEmail || 'No email associated';
                const role = workspace.role;

                return (
                  <div
                    key={workspace.id}
                    className={cn(
                      'group/card p-3 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3',
                      isSelected
                        ? 'border-primary/40 bg-primary/5 shadow-xs'
                        : 'border-border/70 hover:border-border hover:bg-accent/40 bg-card/60',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <WorkspaceAvatar
                          name={workspace.name}
                          src={workspace.avatarUrl}
                          icon={workspace.icon}
                          iconColor={workspace.iconColor}
                          seed={workspace.id}
                          size="md"
                          className="rounded-xl ring-1 ring-border/50"
                        />
                        {isSelected ? (
                          <span
                            className="absolute -bottom-1 -right-1 size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-2 ring-background"
                            title="Active workspace"
                          >
                            <Check className="size-2.5 stroke-[3]" />
                          </span>
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground truncate">
                            {workspace.name}
                          </span>
                          {role && (
                            <Badge
                              variant={
                                role === 'OWNER'
                                  ? 'primary'
                                  : role === 'ADMIN'
                                  ? 'secondary'
                                  : 'neutral'
                              }
                              className="text-[10px] px-1.5 py-0 h-4 font-medium uppercase"
                            >
                              {role}
                            </Badge>
                          )}
                          {workspace.status === 'ARCHIVED' && (
                            <Badge
                              variant="destructive"
                              className="text-[10px] px-1.5 py-0 h-4"
                            >
                              Archived
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span className="truncate font-medium text-foreground/80">
                            {associatedEmail}
                          </span>
                          <span>•</span>
                          <span className="shrink-0">
                            {workspace.memberCount} member
                            {workspace.memberCount === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected ? (
                        <Badge
                          variant="outline"
                          className="gap-1 text-xs border-primary/40 text-primary bg-primary/10 font-medium px-2 py-0.5"
                        >
                          <UserCheck className="size-3.5" />
                          <span>Active</span>
                        </Badge>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSelectWorkspace(workspace)}
                          className="h-7 text-xs font-medium px-2.5"
                        >
                          Switch
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleOpenSettings(workspace)}
                        title="Workspace Settings"
                        aria-label={`Settings for ${workspace.name}`}
                        className="size-7 p-0 text-muted-foreground hover:text-foreground"
                      >
                        <Settings className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-3.5 bg-surface-raised/50 border-t border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onAddAccount ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onAddAccount();
                }}
                className="h-8 text-xs gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>Add another account</span>
              </Button>
            ) : null}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate('/workspaces/new');
              }}
              className="h-8 text-xs gap-1.5"
            >
              <Building2 className="size-3.5" />
              <span>Create workspace</span>
            </Button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs px-4"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
