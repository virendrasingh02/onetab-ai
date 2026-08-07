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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  ChevronDown,
  ClipboardList,
  Kanban,
  LayoutDashboard,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Timeline,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { ProjectDashboardView } from './asana/ProjectDashboardView.js';
import { ProjectListView } from './asana/ProjectListView.js';
import { ProjectTimelineView } from './asana/ProjectTimelineView.js';
import { boardReducer, type BoardAction } from './kanban/board-state.js';
import { CardDetailsDialog } from './kanban/CardDetailsDialog.js';
import {
  useProjectBoards,
  type ProjectCategory,
  type ProjectColor,
} from './kanban/project-boards-hook.js';
import { KanbanBoard } from './KanbanBoard.js';

export type AsanaViewMode = 'list' | 'board' | 'timeline' | 'dashboard';

export function AsanaProjectManager() {
  const {
    projects,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    updateActiveBoardState,
    updateProjectIcon,
    updateProject,
    createProject,
    deleteProject,
  } = useProjectBoards();

  const [viewMode, setViewMode] = useState<AsanaViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

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
      <header className="flex flex-col border-b border-border/50 bg-card/60 px-6 pt-4 pb-0 gap-3">
        {/* Project Selector & Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
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

            <h1 className="text-xl font-bold tracking-tight text-foreground">Projects</h1>

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

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8 bg-muted/40"
              />
            </div>

            {/* Quick Add Task Button */}
            <Button size="sm" onClick={handleQuickAddTask} className="gap-1.5 font-semibold text-xs">
              <Plus className="w-4 h-4" />
              Add Task
            </Button>
          </div>
        </div>

        {/* View Navigation Tabs (Asana Style) */}
        <div className="flex items-center gap-1 border-t border-border/30 pt-1 -mb-px overflow-x-auto">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
              viewMode === 'list'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <ClipboardList className="w-4 h-4" />
            List
          </button>

          <button
            type="button"
            onClick={() => setViewMode('board')}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
              viewMode === 'board'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Kanban className="w-4 h-4" />
            Board
          </button>

          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
              viewMode === 'timeline'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Timeline className="w-4 h-4" />
            Timeline
          </button>

          <button
            type="button"
            onClick={() => setViewMode('dashboard')}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
              viewMode === 'dashboard'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
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
            searchQuery={searchQuery}
          />
        )}

        {viewMode === 'board' && (
          <KanbanBoard />
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
    </div>
  );
}
