import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, queryKeys } from '@org/api-client';
import type { AdminEmailDelivery, EmailDeliveryStatus } from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Page,
  PageHeader,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import { formatDateTime, formatRelative } from '@org/utils';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  MousePointerClick,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';

const ALL_VALUES = 'all';

function getStatusBadge(status: EmailDeliveryStatus) {
  switch (status) {
    case 'DELIVERED':
      return (
        <Badge variant="success" className="gap-1 font-mono">
          <CheckCircle2 className="size-3" />
          DELIVERED
        </Badge>
      );
    case 'SENT':
      return (
        <Badge variant="primary" className="gap-1 font-mono">
          <CheckCircle2 className="size-3" />
          SENT
        </Badge>
      );
    case 'OPENED':
      return (
        <Badge variant="success" className="gap-1 font-mono">
          <Eye className="size-3" />
          OPENED
        </Badge>
      );
    case 'CLICKED':
      return (
        <Badge variant="success" className="gap-1 font-mono">
          <MousePointerClick className="size-3" />
          CLICKED
        </Badge>
      );
    case 'FAILED':
    case 'BOUNCED':
    case 'COMPLAINED':
      return (
        <Badge variant="destructive" className="gap-1 font-mono">
          <XCircle className="size-3" />
          {status}
        </Badge>
      );
    case 'QUEUED':
    case 'SENDING':
      return (
        <Badge variant="warning" className="gap-1 font-mono">
          <Clock className="size-3" />
          {status}
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral" className="gap-1 font-mono">
          {status}
        </Badge>
      );
  }
}

export function EmailDeliveriesView() {
  const [statusFilter, setStatusFilter] = useState(ALL_VALUES);
  const [typeFilter, setTypeFilter] = useState(ALL_VALUES);
  const [recipientFilter, setRecipientFilter] = useState('');
  const [debouncedRecipient, setDebouncedRecipient] = useState('');
  const [page, setPage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<AdminEmailDelivery | null>(
    null,
  );

  const queryParams = {
    status: statusFilter === ALL_VALUES ? undefined : statusFilter,
    type: typeFilter === ALL_VALUES ? undefined : typeFilter,
    recipient: debouncedRecipient.trim() || undefined,
    page,
    pageSize: 25,
  };

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.admin.emails(queryParams),
    queryFn: () => adminApi.emails(queryParams),
    refetchInterval: 15_000,
  });

  const emails: AdminEmailDelivery[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const handleRecipientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedRecipient(recipientFilter);
    setPage(1);
  };

  return (
    <Page>
      <PageHeader
        title="Email Deliveries"
        description="Monitor system transactional emails, delivery statuses, bounce/error tracking, and Resend message telemetry."
        icon={<Mail />}
        accent="blue"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleRecipientSubmit} className="relative w-64">
            <Input
              type="text"
              placeholder="Search recipient email…"
              value={recipientFilter}
              onChange={(e) => setRecipientFilter(e.target.value)}
              className="pl-8 text-xs"
            />
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </form>

          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44 text-xs" aria-label="Filter by status">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUES}>All Statuses</SelectItem>
              <SelectItem value="SENT">SENT</SelectItem>
              <SelectItem value="DELIVERED">DELIVERED</SelectItem>
              <SelectItem value="OPENED">OPENED</SelectItem>
              <SelectItem value="CLICKED">CLICKED</SelectItem>
              <SelectItem value="FAILED">FAILED</SelectItem>
              <SelectItem value="BOUNCED">BOUNCED</SelectItem>
              <SelectItem value="COMPLAINED">COMPLAINED</SelectItem>
              <SelectItem value="QUEUED">QUEUED</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={typeFilter}
            onValueChange={(val) => {
              setTypeFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-56 text-xs" aria-label="Filter by email type">
              <SelectValue placeholder="All Email Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUES}>All Email Types</SelectItem>
              <SelectItem value="WORKSPACE_INVITATION">Workspace Invitation</SelectItem>
              <SelectItem value="MAGIC_SIGN_IN">Magic Sign-In</SelectItem>
              <SelectItem value="PASSWORD_RESET">Password Reset</SelectItem>
              <SelectItem value="EMAIL_VERIFICATION">Email Verification</SelectItem>
              <SelectItem value="WELCOME">Welcome</SelectItem>
              <SelectItem value="PASSWORD_CHANGED">Password Changed</SelectItem>
              <SelectItem value="SECURITY_ALERT">Security Alert</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Deliveries Table */}
        <Panel flush>
          {isLoading ? (
            <LoadingState label="Loading email delivery records…" />
          ) : isError ? (
            <ErrorState
              title="Could not load email delivery logs"
              description="Failed to fetch transactional email deliveries. Verify the API service is accessible and you have SUPERADMIN privileges."
            />
          ) : emails.length === 0 ? (
            <EmptyState
              icon={<Mail />}
              title="No transactional email deliveries found"
              description={
                statusFilter !== ALL_VALUES || typeFilter !== ALL_VALUES || debouncedRecipient
                  ? 'No email records match the selected filters.'
                  : 'Transactional emails sent via Resend or log transport will be displayed here.'
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Status</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((email) => (
                  <TableRow
                    key={email.id}
                    className="cursor-pointer hover:bg-surface-raised/50"
                    onClick={() => setSelectedEmail(email)}
                  >
                    <TableCell>{getStatusBadge(email.status)}</TableCell>
                    <TableCell className="font-mono text-xs font-medium">
                      {email.recipient}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {email.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {email.workspace?.name ?? '— (System)'}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      <span className="capitalize">{email.provider}</span>
                      {email.providerMessageId && (
                        <span className="text-[10px] block opacity-75">
                          {email.providerMessageId}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-xs text-muted-foreground"
                      title={formatDateTime(email.createdAt)}
                    >
                      {formatRelative(email.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEmail(email);
                        }}
                      >
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        {/* Pagination */}
        {total > pageSize ? (
          <div className="gap-3 flex items-center justify-end">
            <p className="text-xs text-muted-foreground tabular-nums">
              Page {page} of {lastPage} · {total} deliveries recorded
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>

      {/* Details Dialog */}
      <Dialog
        open={Boolean(selectedEmail)}
        onOpenChange={(open) => {
          if (!open) setSelectedEmail(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              Delivery Details
            </DialogTitle>
          </DialogHeader>

          {selectedEmail && (
            <DialogBody className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-muted-foreground">Current Status</span>
                <div>{getStatusBadge(selectedEmail.status)}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-b pb-3">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Recipient</span>
                  <span className="font-mono font-medium">{selectedEmail.recipient}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Template Type</span>
                  <span className="font-mono font-medium">{selectedEmail.type}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Provider</span>
                  <span className="font-medium capitalize">{selectedEmail.provider}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Provider ID</span>
                  <span className="font-mono text-muted-foreground">
                    {selectedEmail.providerMessageId ?? 'None'}
                  </span>
                </div>
              </div>

              {selectedEmail.errorMessage && (
                <div className="bg-destructive/10 border border-destructive/20 rounded p-3 text-destructive space-y-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertCircle className="size-3.5" />
                    <span>Error Code: {selectedEmail.errorCode ?? 'UNKNOWN'}</span>
                  </div>
                  <p className="font-mono text-[11px] whitespace-pre-wrap">
                    {selectedEmail.errorMessage}
                  </p>
                </div>
              )}

              <div className="space-y-1.5 border-b pb-3">
                <span className="font-medium text-foreground block mb-1">
                  Telemetry Timeline
                </span>
                <div className="space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span className="font-mono text-foreground">
                      {formatDateTime(selectedEmail.createdAt)}
                    </span>
                  </div>
                  {selectedEmail.sentAt && (
                    <div className="flex justify-between">
                      <span>Sent:</span>
                      <span className="font-mono text-foreground">
                        {formatDateTime(selectedEmail.sentAt)}
                      </span>
                    </div>
                  )}
                  {selectedEmail.deliveredAt && (
                    <div className="flex justify-between text-success">
                      <span>Delivered:</span>
                      <span className="font-mono font-medium">
                        {formatDateTime(selectedEmail.deliveredAt)}
                      </span>
                    </div>
                  )}
                  {selectedEmail.openedAt && (
                    <div className="flex justify-between text-success">
                      <span>Opened:</span>
                      <span className="font-mono font-medium">
                        {formatDateTime(selectedEmail.openedAt)}
                      </span>
                    </div>
                  )}
                  {selectedEmail.clickedAt && (
                    <div className="flex justify-between text-success">
                      <span>Clicked:</span>
                      <span className="font-mono font-medium">
                        {formatDateTime(selectedEmail.clickedAt)}
                      </span>
                    </div>
                  )}
                  {selectedEmail.bouncedAt && (
                    <div className="flex justify-between text-destructive">
                      <span>Bounced:</span>
                      <span className="font-mono font-medium">
                        {formatDateTime(selectedEmail.bouncedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[10px] text-muted-foreground font-mono">
                Delivery ID: {selectedEmail.id}
              </div>
            </DialogBody>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
