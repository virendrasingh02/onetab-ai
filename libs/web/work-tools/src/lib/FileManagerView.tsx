import {
  Button,
  EmptyState,
  Page,
  PageHeader,
  Panel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import { Download, File, HardDrive, Trash2, UploadCloud } from 'lucide-react';
import { useState } from 'react';

export interface FileEntry {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
}

const sampleFiles: FileEntry[] = [
  {
    id: '1',
    name: 'onetab-architecture-spec.pdf',
    size: '2.4 MB',
    type: 'PDF document',
    uploadedAt: 'Today 2:30 PM',
  },
  {
    id: '2',
    name: 'qdrant-vector-schema.json',
    size: '142 KB',
    type: 'JSON',
    uploadedAt: 'Yesterday',
  },
  {
    id: '3',
    name: 'system-diagram-v2.png',
    size: '4.1 MB',
    type: 'PNG image',
    uploadedAt: 'Aug 3, 2026',
  },
];

export function FileManagerView() {
  const [files, setFiles] = useState<FileEntry[]>(sampleFiles);

  return (
    <Page>
      <PageHeader
        title="Files"
        description="Object storage for everything attached to this workspace."
        icon={<HardDrive />}
        accent="cyan"
        actions={<Button leadingIcon={<UploadCloud />}>Upload file</Button>}
      />

      <Panel flush>
        {files.length === 0 ? (
          <EmptyState
            icon={<HardDrive />}
            title="No files yet"
            description="Upload a file and it will appear here."
            action={<Button leadingIcon={<UploadCloud />}>Upload file</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium">
                    <span className="gap-2 flex items-center">
                      <File
                        className="size-4 shrink-0 text-accent-cyan"
                        aria-hidden
                      />
                      {file.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {file.type}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {file.size}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {file.uploadedAt}
                  </TableCell>
                  <TableCell>
                    <div className="gap-1 flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Download ${file.name}`}
                      >
                        <Download />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="hover:text-destructive"
                        aria-label={`Delete ${file.name}`}
                        onClick={() =>
                          setFiles((prev) =>
                            prev.filter((entry) => entry.id !== file.id),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </Page>
  );
}
