import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  SearchInput,
  Spinner,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ChevronRight,
  File as FileIcon,
  Folder,
  HardDrive,
  RefreshCw,
  Share2,
  Upload,
  Users,
} from 'lucide-react';
import { useRef, useState } from 'react';
import {
  useIntegrationActionQuery,
  useExecuteIntegrationAction,
  useIntegrationMutations,
} from './use-integrations.js';

interface GDriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  size?: string;
  owners?: Array<{ displayName?: string; emailAddress?: string }>;
  shared?: boolean;
}

interface GoogleDriveModalProps {
  workspaceId: string;
  integrationId: string;
  accountEmail?: string;
  isOpen: boolean;
  onClose: () => void;
}

type DriveTab = 'all' | 'recent' | 'shared';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

function formatBytes(size?: string) {
  if (!size) return '';
  const n = Number(size);
  if (!Number.isFinite(n) || n === 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = n;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function GoogleDriveModal({
  workspaceId,
  integrationId,
  accountEmail,
  isOpen,
  onClose,
}: GoogleDriveModalProps) {
  const [tab, setTab] = useState<DriveTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [folderTrail, setFolderTrail] = useState<Array<{ id: string; name: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFolderId = folderTrail[folderTrail.length - 1]?.id;
  const isSearching = searchQuery.trim().length > 0;

  const actionId = isSearching ? 'search_files' : tab === 'recent' ? 'list_recent' : tab === 'shared' ? 'list_shared_with_me' : 'list_files';
  const actionInput = isSearching
    ? { query: searchQuery.trim() }
    : tab === 'all'
      ? { folderId: currentFolderId }
      : {};

  const filesQuery = useIntegrationActionQuery<{ files: GDriveFile[] }>(
    workspaceId,
    integrationId,
    actionId,
    actionInput,
    { enabled: isOpen },
  );

  const { sync } = useIntegrationMutations(workspaceId);
  const runAction = useExecuteIntegrationAction(workspaceId);
  const [isUploading, setIsUploading] = useState(false);

  const openItem = (file: GDriveFile) => {
    if (file.mimeType === FOLDER_MIME) {
      setFolderTrail((trail) => [...trail, { id: file.id, name: file.name }]);
      setSearchQuery('');
      return;
    }
    if (file.webViewLink) window.open(file.webViewLink, '_blank', 'noopener,noreferrer');
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsUploading(true);
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const result = await runAction.mutateAsync({
        integrationId,
        actionId: 'upload_file',
        input: {
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64,
          folderId: currentFolderId,
        },
      });
      if (!result.success) throw new Error(result.message);
      toast.success(`Uploaded "${file.name}".`);
      filesQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const tabs: Array<{ id: DriveTab; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: 'My Drive', icon: <HardDrive className="size-3.5" /> },
    { id: 'recent', label: 'Recent', icon: <RefreshCw className="size-3.5" /> },
    { id: 'shared', label: 'Shared with me', icon: <Users className="size-3.5" /> },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="truncate text-sm">
              Google Drive{accountEmail ? ` — ${accountEmail}` : ''}
            </DialogTitle>
            <div className="gap-1.5 flex items-center">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
              <Button size="sm" variant="outline" disabled={isUploading} onClick={handleUploadClick}>
                {isUploading ? <Spinner className="size-3.5" /> : <Upload className="size-3.5" />} Upload
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Sync now"
                disabled={sync.isPending}
                onClick={() => sync.mutate(integrationId, { onSuccess: () => filesQuery.refetch() })}
              >
                <RefreshCw className={cn('size-3.5', sync.isPending && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="px-5 py-2.5 border-b border-border gap-2 flex items-center shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setFolderTrail([]);
                setSearchQuery('');
              }}
              className={cn(
                'px-2.5 py-1 gap-1.5 text-xs font-semibold flex items-center rounded-lg transition-colors',
                tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {t.icon} {t.label}
            </button>
          ))}
          <div className="ml-auto w-48">
            <SearchInput value={searchQuery} onValueChange={setSearchQuery} placeholder="Search Drive…" className="h-7 text-xs" />
          </div>
        </div>

        {tab === 'all' && !isSearching && folderTrail.length > 0 ? (
          <div className="px-5 py-2 border-b border-border gap-1 flex items-center text-xs text-muted-foreground shrink-0 overflow-x-auto">
            <button type="button" onClick={() => setFolderTrail([])} className="shrink-0 font-medium hover:text-foreground">
              My Drive
            </button>
            {folderTrail.map((crumb, idx) => (
              <span key={crumb.id} className="gap-1 flex items-center shrink-0">
                <ChevronRight className="size-3" />
                <button
                  type="button"
                  onClick={() => setFolderTrail((trail) => trail.slice(0, idx + 1))}
                  className="font-medium hover:text-foreground"
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filesQuery.isLoading ? (
            <div className="p-8 flex justify-center">
              <Spinner label="Loading files…" />
            </div>
          ) : filesQuery.isError ? (
            <ErrorState
              title="Couldn't load Drive"
              description={filesQuery.error instanceof Error ? filesQuery.error.message : 'Please try again.'}
              onRetry={() => filesQuery.refetch()}
            />
          ) : (filesQuery.data?.files?.length ?? 0) === 0 ? (
            <EmptyState title="Nothing here" description={isSearching ? 'No files match your search.' : 'This folder is empty.'} />
          ) : (
            <div className="divide-y divide-border">
              {(filesQuery.data?.files ?? []).map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => openItem(file)}
                  className="w-full px-5 py-2.5 gap-3 flex items-center text-left transition-colors hover:bg-surface-inset"
                >
                  {file.mimeType === FOLDER_MIME ? (
                    <Folder className="size-4 shrink-0 text-accent-cyan" />
                  ) : file.iconLink ? (
                    <img src={file.iconLink} alt="" className="size-4 shrink-0" />
                  ) : (
                    <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{file.name}</span>
                    <span className="gap-1.5 flex items-center text-[11px] text-muted-foreground">
                      {file.owners?.[0]?.displayName ? <span>{file.owners[0].displayName}</span> : null}
                      {file.modifiedTime ? <span>· {new Date(file.modifiedTime).toLocaleDateString()}</span> : null}
                      {file.size ? <span>· {formatBytes(file.size)}</span> : null}
                    </span>
                  </span>
                  {file.shared ? <Share2 className="size-3.5 shrink-0 text-muted-foreground" /> : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
