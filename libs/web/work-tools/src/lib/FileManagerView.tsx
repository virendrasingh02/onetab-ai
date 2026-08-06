import {
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
  EmptyState,
  Hint,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileText,
  HardDrive,
  List,
  MoreVertical,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  Star,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

export interface FileCollaborator {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface FileEntry {
  id: string;
  name: string;
  type: 'doc' | 'word' | 'pdf' | 'spreadsheet' | 'site' | string;
  author: string;
  isOwner?: boolean;
  lastViewed: string;
  readTime?: string;
  unread?: boolean;
  starred: boolean;
  collaborators?: FileCollaborator[];
  actionIcon?: 'download' | 'eye';
  size?: string;
}

const sampleFiles: FileEntry[] = [
  {
    id: '1',
    name: 'ASCENT - Theme Design Consistency Reference (Updates by JJ)',
    type: 'doc',
    author: 'Virendra Singh (you)',
    isOwner: true,
    lastViewed: 'Last viewed today',
    readTime: '1 min read',
    starred: true,
    collaborators: [
      { id: 'u1', name: 'JJ' },
      { id: 'u2', name: 'Virendra Singh' },
    ],
    actionIcon: 'download',
  },
  {
    id: '2',
    name: 'RC Theme Migration PostMortem',
    type: 'word',
    author: 'JJ',
    isOwner: false,
    lastViewed: 'Last viewed on July 31st',
    starred: false,
    collaborators: [],
    actionIcon: 'download',
  },
  {
    id: '3',
    name: 'Virendra June Salary.pdf',
    type: 'pdf',
    author: 'Virendra Singh (you)',
    isOwner: true,
    lastViewed: 'Last viewed on July 16th',
    starred: false,
    collaborators: [],
    actionIcon: 'download',
  },
  {
    id: '4',
    name: 'ASCENT Speed Report - Report_ 09 June 2026.csv',
    type: 'spreadsheet',
    author: 'Zeeshan Khan',
    isOwner: false,
    lastViewed: 'Last viewed on June 9th',
    starred: false,
    collaborators: [],
    actionIcon: 'download',
  },
  {
    id: '5',
    name: 'NEW RC THEME: TO-DO LIST',
    type: 'doc',
    unread: true,
    author: 'Zeeshan Khan',
    isOwner: false,
    lastViewed: 'Last viewed on June 5th',
    readTime: '6 min read',
    starred: false,
    collaborators: [
      { id: 'u3', name: 'Zeeshan Khan' },
      { id: 'u2', name: 'Virendra Singh' },
    ],
    actionIcon: 'download',
  },
  {
    id: '6',
    name: 'RC_UAT_Plan.pdf',
    type: 'pdf',
    author: 'JJ',
    isOwner: false,
    lastViewed: 'Last viewed on June 5th',
    starred: false,
    collaborators: [],
    actionIcon: 'download',
  },
  {
    id: '7',
    name: 'Site Migration Running Agenda (2).pdf',
    type: 'pdf',
    author: 'Caroline Homlish',
    isOwner: false,
    lastViewed: 'Last viewed on April 23rd',
    starred: false,
    collaborators: [],
    actionIcon: 'download',
  },
  {
    id: '8',
    name: 'Designer internal Task',
    type: 'doc',
    author: 'Pallav Vyas',
    isOwner: false,
    lastViewed: 'Last viewed on March 13th',
    readTime: '1 min read',
    starred: false,
    collaborators: [
      { id: 'u4', name: 'Pallav Vyas' },
      { id: 'u2', name: 'Virendra Singh' },
    ],
    actionIcon: 'download',
  },
  {
    id: '9',
    name: 'Untitled',
    type: 'doc',
    author: 'Virendra Singh (you)',
    isOwner: true,
    lastViewed: 'Last viewed on February 5th',
    starred: false,
    collaborators: [
      { id: 'u2', name: 'Virendra Singh' },
    ],
    actionIcon: 'download',
  },
  {
    id: '10',
    name: 'New RC Site Development',
    type: 'site',
    author: 'Zeeshan Khan',
    isOwner: false,
    lastViewed: 'Last viewed on December 10th, 2025',
    starred: false,
    collaborators: [],
    actionIcon: 'eye',
  },
];

function FileTypeBadge({ type, unread }: { type: string; unread?: boolean }) {
  if (type === 'word') {
    return (
      <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-[13px] font-bold text-white shadow-2xs select-none">
        W
      </div>
    );
  }

  if (type === 'pdf') {
    return (
      <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-500 dark:text-rose-400 select-none">
        <span className="text-[13px] font-bold tracking-tighter">PDF</span>
      </div>
    );
  }

  if (type === 'spreadsheet') {
    return (
      <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 select-none font-bold text-sm">
        X
      </div>
    );
  }

  if (type === 'site') {
    return (
      <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-500 dark:text-blue-400 select-none">
        <List className="size-4" />
      </div>
    );
  }

  // Default 'doc' type (Soft sky blue background with document text icon)
  return (
    <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-500 dark:text-sky-400 select-none">
      {unread ? (
        <span className="absolute -top-0.5 -left-0.5 size-2.5 rounded-full bg-sky-400 ring-2 ring-background" />
      ) : null}
      <FileText className="size-4" />
    </div>
  );
}

export function FileManagerView() {
  const [files, setFiles] = useState<FileEntry[]>(sampleFiles);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'created' | 'shared'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState('doc');

  const toggleStar = (id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, starred: !f.starred } : f)),
    );
  };

  const deleteFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleCreateFile = () => {
    if (!newFileName.trim()) return;
    const newEntry: FileEntry = {
      id: `f-${Date.now()}`,
      name: newFileName.trim(),
      type: newFileType,
      author: 'Virendra Singh (you)',
      isOwner: true,
      lastViewed: 'Last viewed just now',
      starred: false,
      collaborators: [],
      actionIcon: 'download',
    };
    setFiles((prev) => [newEntry, ...prev]);
    setNewFileName('');
    setIsUploadOpen(false);
  };

  // Filter logic
  const filteredFiles = files.filter((file) => {
    // Search query
    if (searchQuery.trim() && !file.name.toLowerCase().includes(searchQuery.toLowerCase().trim())) {
      return false;
    }
    // Filter tab
    if (activeTab === 'created' && !file.isOwner) {
      return false;
    }
    if (activeTab === 'shared' && file.isOwner) {
      return false;
    }
    // Type filter
    if (selectedType !== 'all' && file.type !== selectedType) {
      return false;
    }
    return true;
  });

  return (
    <div className="max-w-6xl space-y-4 mx-auto p-4 sm:p-6 font-sans text-foreground">
      {/* 1. Header Row */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">All files</h1>
        <Button
          onClick={() => setIsUploadOpen(true)}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs gap-1.5 px-3 rounded-md shadow-xs"
        >
          <Plus className="size-4" />
          <span>New</span>
        </Button>
      </div>

      {/* 2. Full Width Search Input Bar */}
      <div className="relative w-full">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files"
          aria-label="Search files"
          className="w-full pl-9 pr-4 py-2 bg-surface/80 border border-border rounded-input text-xs sm:text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors"
        />
      </div>

      {/* 3. Segmented Filter Pills & Control Dropdowns */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Left Segmented Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors select-none',
              activeTab === 'all'
                ? 'bg-sky-500/20 text-sky-500 dark:text-sky-400 border border-sky-500/30 font-semibold'
                : 'border border-border text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('created')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors select-none',
              activeTab === 'created'
                ? 'bg-sky-500/20 text-sky-500 dark:text-sky-400 border border-sky-500/30 font-semibold'
                : 'border border-border text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            Created by you
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors select-none',
              activeTab === 'shared'
                ? 'bg-sky-500/20 text-sky-500 dark:text-sky-400 border border-sky-500/30 font-semibold'
                : 'border border-border text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            Shared with you
          </button>
        </div>

        {/* Right Dropdowns & View Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* File Types Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface text-xs font-medium text-foreground hover:bg-accent transition-colors"
                aria-label="Filter file types"
              >
                <SlidersHorizontal className="size-3.5 text-sky-500" />
                <span>
                  {selectedType === 'all'
                    ? '5 Types'
                    : selectedType === 'doc'
                    ? 'Docs'
                    : selectedType === 'word'
                    ? 'Word'
                    : selectedType === 'pdf'
                    ? 'PDFs'
                    : selectedType === 'spreadsheet'
                    ? 'Spreadsheets'
                    : 'Sites & Code'}
                </span>
                <ChevronDown className="size-3 text-subtle" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 text-xs">
              <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSelectedType('all')}>
                <span>All 5 Types</span>
                {selectedType === 'all' ? <Check className="ml-auto size-3.5 text-primary" /> : null}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSelectedType('doc')}>
                <span>Docs</span>
                {selectedType === 'doc' ? <Check className="ml-auto size-3.5 text-primary" /> : null}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSelectedType('word')}>
                <span>Word Documents</span>
                {selectedType === 'word' ? <Check className="ml-auto size-3.5 text-primary" /> : null}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSelectedType('pdf')}>
                <span>PDF Documents</span>
                {selectedType === 'pdf' ? <Check className="ml-auto size-3.5 text-primary" /> : null}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSelectedType('spreadsheet')}>
                <span>Spreadsheets (CSV/XLS)</span>
                {selectedType === 'spreadsheet' ? <Check className="ml-auto size-3.5 text-primary" /> : null}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSelectedType('site')}>
                <span>Sites &amp; Links</span>
                {selectedType === 'site' ? <Check className="ml-auto size-3.5 text-primary" /> : null}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface text-xs font-medium text-foreground hover:bg-accent transition-colors"
                aria-label="Sort options"
              >
                <span>
                  {sortBy === 'recent'
                    ? 'Recently viewed'
                    : sortBy === 'name'
                    ? 'Name (A-Z)'
                    : 'Date modified'}
                </span>
                <ChevronDown className="size-3 text-subtle" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 text-xs">
              <DropdownMenuItem onSelect={() => setSortBy('recent')}>
                <span>Recently viewed</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSortBy('name')}>
                <span>Name (A-Z)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSortBy('date')}>
                <span>Date modified</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter options icon button */}
          <Hint label="View options">
            <button
              className="flex size-7 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="View options"
            >
              <SlidersHorizontal className="size-3.5" />
            </button>
          </Hint>
        </div>
      </div>

      {/* 4. Main Files List Container */}
      <div className="rounded-card border border-border bg-surface/60 overflow-hidden shadow-2xs divide-y divide-border/60">
        {filteredFiles.length === 0 ? (
          <div className="p-8 text-center">
            <EmptyState
              size="sm"
              icon={<HardDrive />}
              title="No files match your search"
              description="Try adjusting your filter pills or search query."
              action={
                <Button size="sm" variant="outline" onClick={() => { setSearchQuery(''); setActiveTab('all'); setSelectedType('all'); }}>
                  Reset filters
                </Button>
              }
            />
          </div>
        ) : (
          filteredFiles.map((file) => (
            <div
              key={file.id}
              className="group flex items-center justify-between gap-3 p-3 sm:px-4 hover:bg-accent/40 transition-colors"
            >
              {/* Left File Badge & Meta Info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FileTypeBadge type={file.type} unread={file.unread} />

                <div className="min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {file.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate mt-0.5">
                    <span className="truncate">{file.author}</span>
                    <span>·</span>
                    <span className="truncate">{file.lastViewed}</span>
                    {file.readTime ? (
                      <>
                        <span>·</span>
                        <span>{file.readTime}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Right Side Actions & Collaborators */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {/* Overlapping Collaborator Avatars */}
                {file.collaborators && file.collaborators.length > 0 ? (
                  <div className="hidden sm:flex items-center -space-x-2 overflow-hidden">
                    {file.collaborators.map((c) => (
                      <UserAvatar
                        key={c.id}
                        name={c.name}
                        src={c.avatarUrl}
                        seed={c.id}
                        size="xs"
                        className="ring-2 ring-background"
                      />
                    ))}
                  </div>
                ) : null}

                {/* Star Button */}
                <Hint label={file.starred ? 'Starred' : 'Star file'}>
                  <button
                    onClick={() => toggleStar(file.id)}
                    aria-label={file.starred ? 'Unstar file' : 'Star file'}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-md transition-colors',
                      file.starred
                        ? 'text-amber-400 bg-amber-400/10'
                        : 'text-subtle hover:text-amber-400 hover:bg-accent',
                    )}
                  >
                    <Star className={cn('size-3.5', file.starred && 'fill-amber-400')} />
                  </button>
                </Hint>

                {/* Action Icon (Download or View) */}
                <Hint label={file.actionIcon === 'eye' ? 'Preview file' : 'Download file'}>
                  <button
                    aria-label={file.actionIcon === 'eye' ? 'Preview file' : 'Download file'}
                    className="flex size-7 items-center justify-center rounded-md text-subtle hover:text-foreground hover:bg-accent transition-colors"
                  >
                    {file.actionIcon === 'eye' ? (
                      <Eye className="size-3.5" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                  </button>
                </Hint>

                {/* Context Dropdown Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex size-7 items-center justify-center rounded-md text-subtle hover:text-foreground hover:bg-accent transition-colors"
                      aria-label="More options"
                    >
                      <MoreVertical className="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44 text-xs">
                    <DropdownMenuItem onSelect={() => toggleStar(file.id)}>
                      <Star className="size-3.5 mr-2 text-amber-400" />
                      <span>{file.starred ? 'Remove star' : 'Star file'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Download className="size-3.5 mr-2" />
                      <span>Download</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Share2 className="size-3.5 mr-2" />
                      <span>Share with team</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy className="size-3.5 mr-2" />
                      <span>Copy link</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => deleteFile(file.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-3.5 mr-2" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New File Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-md text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Create or Upload File</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                File Title
              </label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="e.g. Q3 Design System Spec.pdf"
                className="w-full px-3 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                File Type
              </label>
              <select
                value={newFileType}
                onChange={(e) => setNewFileType(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="doc">Doc / Note</option>
                <option value="word">Word Document (.docx)</option>
                <option value="pdf">PDF Document (.pdf)</option>
                <option value="spreadsheet">Spreadsheet (.csv / .xlsx)</option>
                <option value="site">Site / Project Link</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateFile} disabled={!newFileName.trim()}>
              Create File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
