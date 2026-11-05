import { adminSafetyApi, queryKeys } from '@org/api-client';
import type { ContentReportDto } from '@org/types';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Page,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@org/ui';
import { formatDateTime } from '@org/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const FILTERS = ['OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED'] as const;

/**
 * The queue behind every in-app "Report". App Store 1.2 requires a timely
 * response to reports, which needs someone to actually see them.
 */
export function SafetyReportsView() {
  const [status, setStatus] = useState<(typeof FILTERS)[number]>('OPEN');
  const queryClient = useQueryClient();

  const reports = useQuery({
    queryKey: queryKeys.safety.reports(status),
    queryFn: () => adminSafetyApi.reports(status),
  });

  const resolve = useMutation({
    mutationFn: (input: { id: string; status: (typeof FILTERS)[number] }) =>
      adminSafetyApi.resolve(input.id, { status: input.status }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['safety', 'reports'] }),
    onError: () => toast.error('Could not update the report.'),
  });

  const person = (who: ContentReportDto['reporter']) =>
    who ? `${who.name} (${who.email})` : 'Unknown';

  return (
    <Page>
      <PageHeader
        title="Safety reports"
        description="Content and people reported from the apps."
      />
      <div className="mb-4 gap-2 flex">
        {FILTERS.map((filter) => (
          <Button
            key={filter}
            size="sm"
            variant={filter === status ? 'default' : 'outline'}
            onClick={() => setStatus(filter)}
          >
            {filter}
          </Button>
        ))}
      </div>

      {reports.isPending ? <LoadingState /> : null}
      {reports.isError ? (
        <ErrorState onRetry={() => void reports.refetch()} />
      ) : null}
      {reports.data?.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description="No reports in this state."
        />
      ) : null}
      {reports.data?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reported</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Against</TableHead>
              <TableHead>By</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.data.map((report) => (
              <TableRow key={report.id}>
                <TableCell>{formatDateTime(report.createdAt)}</TableCell>
                <TableCell>{report.targetType}</TableCell>
                <TableCell>{report.reason}</TableCell>
                <TableCell className="max-w-md whitespace-pre-wrap">
                  {report.excerpt ?? report.details ?? report.targetId}
                </TableCell>
                <TableCell>{person(report.targetUser)}</TableCell>
                <TableCell>{person(report.reporter)}</TableCell>
                <TableCell>
                  <div className="gap-2 flex">
                    {(['ACTIONED', 'DISMISSED'] as const).map((next) => (
                      <Button
                        key={next}
                        size="sm"
                        variant="outline"
                        disabled={report.status === next || resolve.isPending}
                        onClick={() =>
                          resolve.mutate({ id: report.id, status: next })
                        }
                      >
                        {next === 'ACTIONED' ? 'Actioned' : 'Dismiss'}
                      </Button>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </Page>
  );
}
