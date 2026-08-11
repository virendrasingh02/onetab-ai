import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconPickerPopover,
  IconRenderer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Check,
  Copy,
  Filter,
  Globe,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProjectDashboardView } from './asana/ProjectDashboardView.js';
import { ProjectListView } from './asana/ProjectListView.js';
import { ProjectTimelineView } from './asana/ProjectTimelineView.js';
import { boardReducer, type BoardAction } from './kanban/board-state.js';
import {
  countActiveFilters,
  EMPTY_FILTER,
  type BoardFilter,
} from './kanban/card-meta.js';
import { CardDetailsDialog } from './kanban/CardDetailsDialog.js';
import { LinearFilterMenu } from './kanban/LinearFilterMenu.js';
import {
  useProjectBoards,
  type ProjectCategory,
  type ProjectColor,
} from './kanban/project-boards-hook.js';
import {
  ViewDisplayMenu,
  type DisplayPropertiesState,
} from './kanban/ViewDisplayMenu.js';
import { KanbanBoard } from './KanbanBoard.js';

export type AsanaViewMode = 'list' | 'board' | 'timeline' | 'dashboard';


export function AsanaProjectManager() {
  const [searchParams] = useSearchParams();
  const {
    projects,
    activeProject,
    setActiveProjectId,
    updateActiveBoardState,
    updateProjectIcon,
    updateProject,
    createProject,
    deleteProject,
  } = useProjectBoards();

  // Sync project selection from URL search params
  useEffect(() => {
    const projParam = searchParams.get('project');
    if (projParam && projects.some((p) => p.id === projParam)) {
      setActiveProjectId(projParam);
    }
  }, [searchParams, projects, setActiveProjectId]);

  const [viewMode, setViewMode] = useState<AsanaViewMode>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Board Filter & Menu State (Moved to top header next to Display button)
  const [filter, setFilter] = useState<BoardFilter>(EMPTY_FILTER);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [showAIFilterInput, setShowAIFilterInput] = useState(false);
  const filterCount = countActiveFilters(filter);

  // View Display Options Popover State (Ref matching Linear style)
  const [isViewDisplayOpen, setIsViewDisplayOpen] = useState(false);
  const [grouping, setGrouping] = useState('no_grouping');
  const [ordering, setOrdering] = useState('manual');
  const [showClosed, setShowClosed] = useState('all');
  const [displayProps, setDisplayProps] = useState<DisplayPropertiesState>({
    milestones: true,
    summary: true,
    priority: true,
    status: true,
    health: true,
    teams: false,
    lead: true,
    members: true,
    dependencies: false,
    startDate: false,
    targetDate: true,
    issues: true,
    created: true,
    updated: true,
    completed: true,
    labels: true,
  });

  // New Project Dialog State
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState<ProjectCategory>('Product');
  const [newProjectColor, setNewProjectColor] = useState<ProjectColor>('violet');
  const [newProjectIcon, setNewProjectIcon] = useState('Rocket');
  const [newProjectIconColor, setNewProjectIconColor] = useState('#8b5cf6');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  // Edit Project Dialog State
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectCategory, setEditProjectCategory] = useState<ProjectCategory>('Product');
  const [editProjectColor, setEditProjectColor] = useState<ProjectColor>('violet');
  const [editProjectIcon, setEditProjectIcon] = useState('Folder');
  const [editProjectIconColor, setEditProjectIconColor] = useState('#8b5cf6');
  const [editProjectDescription, setEditProjectDescription] = useState('');

  // Share & Board Access Controls State
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [invitedMembers, setInvitedMembers] = useState([
    { id: 'm1', name: 'Virendra Singh', email: 'virendra@onetab.ai', role: 'Owner' },
    { id: 'm2', name: 'Alex Morgan', email: 'alex@onetab.ai', role: 'Editor' },
    { id: 'm3', name: 'Aisha Khan', email: 'aisha@onetab.ai', role: 'Viewer' },
  ]);
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [inviteRoleInput, setInviteRoleInput] = useState<'Editor' | 'Viewer' | 'Admin'>('Editor');
  const [accessScope, setAccessScope] = useState<'private' | 'workspace'>('private');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleAddInvite = () => {
    const trimmed = inviteEmailInput.trim().toLowerCase();
    if (!trimmed) return;
    const namePart = trimmed.split('@')[0];
    const formattedName = namePart
      .split(/[\._-]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    setInvitedMembers((prev) => [
      ...prev,
      {
        id: `m_${Date.now()}`,
        name: formattedName,
        email: trimmed,
        role: inviteRoleInput,
      },
    ]);
    setInviteEmailInput('');
  };

  const handleRemoveInvite = (id: string) => {
    setInvitedMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleCopyShareLink = () => {
    const url = `https://onetab.ai/board/${activeProject?.id || 'kanban'}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenEditProject = () => {
    if (activeProject) {
      setEditProjectName(activeProject.name);
      setEditProjectCategory(activeProject.category);
      setEditProjectColor(activeProject.color);
      setEditProjectIcon(activeProject.icon || 'Folder');
      setEditProjectIconColor(activeProject.iconColor || '#8b5cf6');
      setEditProjectDescription(activeProject.description || '');
      setIsEditProjectOpen(true);
    }
  };

  const handleEditProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeProject && editProjectName.trim()) {
      updateProject(activeProject.id, {
        name: editProjectName.trim(),
        category: editProjectCategory,
        color: editProjectColor,
        icon: editProjectIcon,
        iconColor: editProjectIconColor,
        description: editProjectDescription.trim(),
      });
      setIsEditProjectOpen(false);
    }
  };

  const board = activeProject?.board;

  // Dispatch action to current active board state
  const dispatchBoardAction = useCallback(
    (action: BoardAction) => {
      if (!board) return;
      const nextBoard = boardReducer(board, action);
      updateActiveBoardState(nextBoard);
    },
    [board, updateActiveBoardState]
  );

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      const newId = createProject({
        name: newProjectName.trim(),
        category: newProjectCategory,
        color: newProjectColor,
        description: newProjectDescription.trim(),
      });
      if (newProjectIcon) {
        updateProjectIcon(newId, newProjectIcon, newProjectIconColor);
      }
      setActiveProjectId(newId);
      setIsNewProjectOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
    }
  };

  const handleQuickAddTask = () => {
    if (board && board.lists.length > 0) {
      const firstListId = board.lists[0].id;
      const newTitle = 'New Task';
      dispatchBoardAction({ type: 'card/add', listId: firstListId, title: newTitle, edge: 'bottom' });
    }
  };

  if (!activeProject || !board) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading project workspace...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground overflow-hidden">
      {/* Top Header */}
      <header className="relative flex flex-wrap items-center justify-between border-b border-border/50 bg-card/60 px-6 py-3.5 gap-4">
        {/* Project Icon & Title */}
        <div className="flex items-center gap-2.5">
          <IconPickerPopover
            icon={activeProject.icon}
            iconColor={activeProject.iconColor}
            onSelectIcon={(newIcon: string, newColor?: string) =>
              updateProjectIcon(activeProject.id, newIcon, newColor)
            }
            onRemoveIcon={() =>
              updateProjectIcon(activeProject.id, 'Folder', undefined)
            }
            trigger={
              <button
                type="button"
                className="size-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center hover:scale-105 transition-all cursor-pointer shadow-sm"
                title="Click to update project icon & color"
              >
                <IconRenderer
                  icon={activeProject.icon}
                  iconColor={activeProject.iconColor}
                  fallbackEmoji="📁"
                  sizeClassName="size-4"
                />
              </button>
            }
          />

          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {activeProject.name}
          </h1>

          {/* Project Options Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Project Options"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={handleOpenEditProject} className="text-xs gap-2">
                <Pencil className="size-3.5 text-primary" />
                Edit Project Details
              </DropdownMenuItem>
              {projects.length > 1 && (
                <DropdownMenuItem
                  onClick={() => deleteProject(activeProject.id)}
                  className="text-xs gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete Project
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search / Filter Cards Input */}
          <div className="relative w-36 sm:w-52">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Filter cards..."
              value={filter.query || searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                setFilter((prev) => ({ ...prev, query: val }));
              }}
              className="pl-8 text-xs h-8 bg-muted/40"
            />
          </div>

          {/* Share & Invite People Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsShareDialogOpen(true)}
            className="gap-1.5 text-xs h-8 border-[#5865f2]/40 text-[#5865f2] hover:bg-[#5865f2]/10 font-semibold cursor-pointer"
          >
            <UserPlus className="size-3.5 text-[#5865f2] shrink-0" />
            <span className="hidden sm:inline">Share</span>
            <Badge variant="neutral" className="bg-[#5865f2]/15 text-[#5865f2] text-[10px] px-1.5 py-0 font-bold">
              {invitedMembers.length}
            </Badge>
          </Button>

          {/* Filter Menu Trigger Button (Linear Style) */}
          <div className="relative">
            <Button
              variant={isFilterMenuOpen || filterCount > 0 ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              className="gap-1.5 text-xs h-8 font-medium cursor-pointer"
            >
              <Filter className="size-3.5 text-muted-foreground" />
              <span>Filter</span>
              {filterCount > 0 ? (
                <Badge variant="count" className="bg-primary/20 text-primary">
                  {filterCount}
                </Badge>
              ) : null}
            </Button>

            {/* Linear Filter Menu Popover */}
            <LinearFilterMenu
              filter={filter}
              setFilter={setFilter}
              labels={board.labels}
              members={board.members}
              lists={board.lists}
              isOpen={isFilterMenuOpen}
              onClose={() => setIsFilterMenuOpen(false)}
              onActivateAIFilter={() => setShowAIFilterInput(true)}
            />
          </div>

          {/* Display & View Options Button (Linear Ref Popover) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsViewDisplayOpen(!isViewDisplayOpen)}
              className={cn(
                'flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium border border-border/60 hover:bg-accent transition-colors cursor-pointer',
                isViewDisplayOpen && 'bg-accent border-primary/50 text-foreground font-semibold'
              )}
              title="Display properties & View options"
            >
              <SlidersHorizontal className="size-3.5 text-muted-foreground" />
              <span>Display</span>
            </button>

            {/* View Display Menu Popover */}
            <ViewDisplayMenu
              isOpen={isViewDisplayOpen}
              onClose={() => setIsViewDisplayOpen(false)}
              viewMode={viewMode}
              onViewModeChange={(m) => setViewMode(m)}
              grouping={grouping}
              onGroupingChange={setGrouping}
              ordering={ordering}
              onOrderingChange={setOrdering}
              showClosed={showClosed}
              onShowClosedChange={setShowClosed}
              displayProps={displayProps}
              onToggleDisplayProp={(key) =>
                setDisplayProps((prev) => ({ ...prev, [key]: !prev[key] }))
              }
            />
          </div>

          {/* Quick Add Task Button */}
          <Button size="sm" onClick={handleQuickAddTask} className="gap-1.5 font-semibold text-xs h-8">
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto bg-background/50 p-2">
        {viewMode === 'list' && (
          <ProjectListView
            board={board}
            onUpdateCard={(listId, cardId, patch) =>
              dispatchBoardAction({ type: 'card/update', cardId, patch })
            }
            onMoveCard={(cardId, sourceListId, targetListId, newIndex) =>
              dispatchBoardAction({ type: 'card/move', cardId, toListId: targetListId, toIndex: newIndex })
            }
            onDeleteCard={(listId, cardId) =>
              dispatchBoardAction({ type: 'card/remove', cardId })
            }
            onAddCard={(listId, title) =>
              dispatchBoardAction({ type: 'card/add', listId, title, edge: 'bottom' })
            }
            onSelectCard={(card) => setSelectedCardId(card.id)}
            searchQuery={filter.query || searchQuery}
          />
        )}

        {viewMode === 'board' && (
          <KanbanBoard
            filter={filter}
            setFilter={setFilter}
            isFilterMenuOpen={isFilterMenuOpen}
            setIsFilterMenuOpen={setIsFilterMenuOpen}
            showAIFilterInput={showAIFilterInput}
            setShowAIFilterInput={setShowAIFilterInput}
          />
        )}

        {viewMode === 'timeline' && (
          <ProjectTimelineView
            board={board}
            onSelectCard={(card) => setSelectedCardId(card.id)}
            searchQuery={searchQuery}
          />
        )}

        {viewMode === 'dashboard' && (
          <ProjectDashboardView
            board={board}
            onSelectCard={(card) => setSelectedCardId(card.id)}
          />
        )}
      </main>

      {/* Card Details Modal Dialog */}
      {selectedCardId && (
        <CardDetailsDialog
          board={board}
          cardId={selectedCardId}
          dispatch={dispatchBoardAction}
          onClose={() => setSelectedCardId(null)}
        />
      )}

      {/* Create New Project Dialog */}
      <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateProjectSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Sparkles className="w-4 h-4 text-primary" />
                Create New Asana Project
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold">Project Icon & Color</label>
                  <IconPickerPopover
                    icon={newProjectIcon}
                    iconColor={newProjectIconColor}
                    onSelectIcon={(ic: string, col?: string) => {
                      setNewProjectIcon(ic);
                      if (col) setNewProjectIconColor(col);
                    }}
                    onRemoveIcon={() => {
                      setNewProjectIcon('Folder');
                      setNewProjectIconColor('#8b5cf6');
                    }}
                    trigger={
                      <button
                        type="button"
                        className="size-10 rounded-xl bg-surface-raised border border-border flex items-center justify-center hover:scale-105 transition-all cursor-pointer shadow-sm"
                        title="Choose Icon"
                      >
                        <IconRenderer
                          icon={newProjectIcon}
                          iconColor={newProjectIconColor}
                          fallbackEmoji="📁"
                          sizeClassName="size-5"
                        />
                      </button>
                    }
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold">Project Name</label>
                  <Input
                    required
                    placeholder="e.g. Q4 Mobile App Launch"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Category</label>
                <Select
                  value={newProjectCategory}
                  onValueChange={(val) => setNewProjectCategory(val as ProjectCategory)}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Product">Product</SelectItem>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                    <SelectItem value="Design">Design</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Color Accent</label>
                <Select
                  value={newProjectColor}
                  onValueChange={(val) => setNewProjectColor(val as ProjectColor)}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Color" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="violet">Violet</SelectItem>
                    <SelectItem value="blue">Blue</SelectItem>
                    <SelectItem value="emerald">Emerald</SelectItem>
                    <SelectItem value="amber">Amber</SelectItem>
                    <SelectItem value="rose">Rose</SelectItem>
                    <SelectItem value="cyan">Cyan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Description</label>
                <Input
                  placeholder="Brief description of goals..."
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsNewProjectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Create Project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={isEditProjectOpen} onOpenChange={setIsEditProjectOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleEditProjectSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Pencil className="w-4 h-4 text-primary" />
                Edit Project Details
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold">Project Icon & Color</label>
                  <IconPickerPopover
                    icon={editProjectIcon}
                    iconColor={editProjectIconColor}
                    onSelectIcon={(ic: string, col?: string) => {
                      setEditProjectIcon(ic);
                      if (col) setEditProjectIconColor(col);
                    }}
                    onRemoveIcon={() => {
                      setEditProjectIcon('Folder');
                      setEditProjectIconColor('#8b5cf6');
                    }}
                    trigger={
                      <button
                        type="button"
                        className="size-10 rounded-xl bg-surface-raised border border-border flex items-center justify-center hover:scale-105 transition-all cursor-pointer shadow-sm"
                        title="Choose Icon"
                      >
                        <IconRenderer
                          icon={editProjectIcon}
                          iconColor={editProjectIconColor}
                          fallbackEmoji="📁"
                          sizeClassName="size-5"
                        />
                      </button>
                    }
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold">Project Name</label>
                  <Input
                    required
                    placeholder="e.g. Q4 Mobile App Launch"
                    value={editProjectName}
                    onChange={(e) => setEditProjectName(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Category</label>
                <Select
                  value={editProjectCategory}
                  onValueChange={(val) => setEditProjectCategory(val as ProjectCategory)}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Product">Product</SelectItem>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                    <SelectItem value="Design">Design</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Color Accent</label>
                <Select
                  value={editProjectColor}
                  onValueChange={(val) => setEditProjectColor(val as ProjectColor)}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Color" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="violet">Violet</SelectItem>
                    <SelectItem value="blue">Blue</SelectItem>
                    <SelectItem value="emerald">Emerald</SelectItem>
                    <SelectItem value="amber">Amber</SelectItem>
                    <SelectItem value="rose">Rose</SelectItem>
                    <SelectItem value="cyan">Cyan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Description</label>
                <Input
                  placeholder="Brief description of goals..."
                  value={editProjectDescription}
                  onChange={(e) => setEditProjectDescription(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditProjectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Share & Access Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-lg border-[#3f4147] bg-[#1e1f22] text-[#dbdee1] p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-white flex items-center gap-2">
              <UserPlus className="size-5 text-[#5865f2]" />
              Share "{activeProject.name}"
            </DialogTitle>
            <p className="text-xs text-[#949ba4] mt-1">
              Invite people or manage member access permissions for this board.
            </p>
          </DialogHeader>

          <div className="space-y-5 py-3">
            {/* Invite Input Row */}
            <div className="flex items-center gap-2">
              <Input
                value={inviteEmailInput}
                onChange={(e) => setInviteEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddInvite();
                  }
                }}
                placeholder="Enter email or username..."
                className="bg-[#2b2d31] border-[#3f4147] text-white text-xs placeholder:text-[#80848e] focus-visible:ring-[#5865f2] flex-1"
              />

              <Select
                value={inviteRoleInput}
                onValueChange={(val) => setInviteRoleInput(val as any)}
              >
                <SelectTrigger className="w-28 h-9 text-xs bg-[#2b2d31] border-[#3f4147] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1e1f22] border-[#3f4147] text-white text-xs">
                  <SelectItem value="Editor">Editor</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={handleAddInvite}
                size="sm"
                className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold px-4"
              >
                Invite
              </Button>
            </div>

            {/* Access Level Selector */}
            <div className="rounded-xl border border-[#3f4147] bg-[#2b2d31] p-3 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4] flex items-center justify-between">
                <span>General Access</span>
                {accessScope === 'private' ? (
                  <Badge variant="neutral" className="bg-[#ed4245]/20 text-[#ed4245] text-[10px] border-[#ed4245]/40">
                    Restricted Access
                  </Badge>
                ) : (
                  <Badge variant="neutral" className="bg-[#23a55a]/20 text-[#23a55a] text-[10px] border-[#23a55a]/40">
                    Workspace Access
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAccessScope('private')}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs font-semibold transition-all',
                    accessScope === 'private'
                      ? 'border-[#5865f2] bg-[#5865f2]/15 text-white'
                      : 'border-[#3f4147] bg-[#1e1f22] text-[#949ba4] hover:bg-[#35373c]',
                  )}
                >
                  <Lock className="size-4 shrink-0 text-[#5865f2]" />
                  <div>
                    <span className="block font-bold">Only invited people</span>
                    <span className="block text-[10px] text-[#949ba4]">Must be added to access</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAccessScope('workspace')}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs font-semibold transition-all',
                    accessScope === 'workspace'
                      ? 'border-[#23a55a] bg-[#23a55a]/15 text-white'
                      : 'border-[#3f4147] bg-[#1e1f22] text-[#949ba4] hover:bg-[#35373c]',
                  )}
                >
                  <Globe className="size-4 shrink-0 text-[#23a55a]" />
                  <div>
                    <span className="block font-bold">Workspace members</span>
                    <span className="block text-[10px] text-[#949ba4]">Anyone in team can view</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Invited Members List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#949ba4]">
                <span>People with access ({invitedMembers.length})</span>
              </div>

              <div className="max-h-48 overflow-y-auto scrollbar-subtle space-y-1.5 rounded-xl border border-[#3f4147] bg-[#2b2d31] p-2">
                {invitedMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#1e1f22] border border-[#35373c]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-7 rounded-full bg-[#5865f2] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {member.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{member.name}</p>
                        <p className="text-[10px] font-mono text-[#949ba4] truncate">{member.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-semibold text-[#5865f2] px-2 py-0.5 rounded bg-[#5865f2]/10 border border-[#5865f2]/20">
                        {member.role}
                      </span>
                      {member.role !== 'Owner' ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveInvite(member.id)}
                          className="p-1 text-[#949ba4] hover:text-[#ed4245] transition-colors"
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between border-t border-[#3f4147] pt-4 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyShareLink}
              className="border-[#3f4147] bg-[#2b2d31] text-white hover:bg-[#35373c] text-xs font-semibold"
            >
              {copiedLink ? <Check className="size-3.5 mr-1 text-[#23a55a]" /> : <Copy className="size-3.5 mr-1" />}
              {copiedLink ? 'Link Copied!' : 'Copy Private Link'}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setIsShareDialogOpen(false)}
              className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold px-5"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
