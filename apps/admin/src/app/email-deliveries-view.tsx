import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, queryKeys } from '@org/api-client';
import type { AdminEmailDelivery, EmailDeliveryStatus } from '@org/types';
import {
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
  ChevronLeft,
  ChevronRight,
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
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
          <CheckCircle2 className="size-3" />
          DELIVERED
        </span>
      );
    case 'SENT':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/15 text-blue-400 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
          <CheckCircle2 className="size-3" />
          SENT
        </span>
      );
    case 'OPENED':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/25 bg-teal-500/15 text-teal-400 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
          <Eye className="size-3" />
          OPENED
        </span>
      );
    case 'CLICKED':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/25 bg-cyan-500/15 text-cyan-400 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
          <MousePointerClick className="size-3" />
          CLICKED
        </span>
      );
    case 'FAILED':
    case 'BOUNCED':
    case 'COMPLAINED':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/25 bg-rose-500/15 text-rose-400 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
          <XCircle className="size-3" />
          {status}
        </span>
      );
    case 'QUEUED':
    case 'SENDING':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/15 text-amber-400 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
          <Clock className="size-3" />
          {status}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/60 text-muted-foreground px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
          {status}
        </span>
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
        {/* Deliveries Table Card Container */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-2xs overflow-hidden">
          {/* Header Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 sm:px-5 sm:py-3.5 border-b border-border/40">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
                Transactional Deliveries
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Delivery logs, recipient states, and provider telemetry
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <form onSubmit={handleRecipientSubmit} className="relative w-64">
                <Input
                  type="text"
                  placeholder="Search recipient email…"
                  value={recipientFilter}
                  onChange={(e) => setRecipientFilter(e.target.value)}
                  className="h-8 rounded-full border border-border/60 bg-background/50 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus-visible:border-ring focus-visible:ring-1"
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
                <SelectTrigger className="h-8 w-36 rounded-full border border-border/60 bg-background/50 text-xs px-3" aria-label="Filter by status">
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
                <SelectTrigger className="h-8 w-44 rounded-full border border-border/60 bg-background/50 text-xs px-3" aria-label="Filter by email type">
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
          </div>

          {/* Table / State */}
          {isLoading ? (
            <div className="py-12">
              <LoadingState label="Loading email delivery records…" />
            </div>
          ) : isError ? (
            <div className="p-6">
              <ErrorState
                title="Could not load email delivery logs"
                description="Failed to fetch transactional email deliveries. Verify the API service is accessible and you have SUPERADMIN privileges."
              />
            </div>
          ) : emails.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Mail />}
                title="No transactional email deliveries found"
                description={
                  statusFilter !== ALL_VALUES || typeFilter !== ALL_VALUES || debouncedRecipient
                    ? 'No email records match the selected filters.'
                    : 'Transactional emails sent via Resend or log transport will be displayed here.'
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/40 hover:bg-transparent">
                    <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">Status</TableHead>
                    <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">Recipient</TableHead>
                    <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">Type</TableHead>
                    <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">Workspace</TableHead>
                    <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">Provider</TableHead>
                    <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">Created</TableHead>
                    <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.map((email) => (
                    <TableRow
                      key={email.id}
                      className="cursor-pointer hover:bg-muted/30 border-b border-border/40 transition-colors"
                      onClick={() => setSelectedEmail(email)}
                    >
                      <TableCell className="py-3.5 px-5">{getStatusBadge(email.status)}</TableCell>
                      <TableCell className="py-3.5 px-5 font-mono text-xs font-medium text-foreground">
                        {email.recipient}
                      </TableCell>
                      <TableCell className="py-3.5 px-5">
                        <span className="inline-flex items-center rounded-full border border-border/80 bg-muted/60 px-2.5 py-0.5 text-[10px] font-mono uppercase text-foreground">
                          {email.type}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 px-5 text-xs text-muted-foreground">
                        {email.workspace?.name ?? '— (System)'}
                      </TableCell>
                      <TableCell className="py-3.5 px-5 text-xs font-mono text-muted-foreground">
                        <span className="capitalize text-foreground font-medium">{email.provider}</span>
                        {email.providerMessageId && (
                          <span className="text-[10px] block opacity-75">
                            {email.providerMessageId}
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className="py-3.5 px-5 text-xs text-muted-foreground"
                        title={formatDateTime(email.createdAt)}
                      >
                        {formatRelative(email.createdAt)}
                      </TableCell>
                      <TableCell className="py-3.5 px-5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2.5 rounded-lg border border-border/60 hover:bg-muted/50"
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
            </div>
          )}

          {/* Reference Image Footer Pagination */}
          <div className="border-t border-border/40 px-5 py-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing{' '}
              <span className="font-semibold text-foreground">
                {total === 0 ? 0 : (page - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-foreground">
                {Math.min(page * pageSize, total)}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-foreground">{total}</span> entries
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="size-7 rounded-lg border border-border/60 bg-background/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <span className="px-1 font-medium text-foreground">
                Page {page} of {Math.max(1, lastPage)}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
                disabled={page >= lastPage}
                aria-label="Next page"
                className="size-7 rounded-lg border border-border/60 bg-background/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
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
