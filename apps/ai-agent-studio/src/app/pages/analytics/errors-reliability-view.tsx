import { useState } from 'react';
import {
  Badge,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import type { ErrorAnalyticsGroup } from '@org/types';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  ShieldAlert,
  Wrench,
  XCircle,
} from 'lucide-react';

interface ErrorsReliabilityViewProps {
  errors: ErrorAnalyticsGroup[];
}

export function ErrorsReliabilityView({ errors }: ErrorsReliabilityViewProps) {
  const [selectedError, setSelectedError] = useState<ErrorAnalyticsGroup | null>(null);
  const errorList = errors || [];

  const totalOccurrences = errorList.reduce((acc, e) => acc + (e.occurrenceCount || 0), 0);

  const getCategoryBadgeVariant = (category: string) => {
    switch (category) {
      case 'RATE_LIMIT':
        return 'warning';
      case 'MODEL_PROVIDER':
      case 'AUTHENTICATION_PERMISSION':
        return 'destructive';
      case 'TIMEOUT':
        return 'warning';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Total Logged Faults</span>
            <AlertCircle className="size-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {totalOccurrences}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Across {errorList.length} distinct error signatures
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Rate-Limit Incidents</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {errorList
              .filter((e) => e.category === 'RATE_LIMIT')
              .reduce((acc, e) => acc + (e.occurrenceCount || 0), 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Provider throughput throttles
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Auth & Connector Faults</span>
            <ShieldAlert className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {errorList
              .filter(
                (e) =>
                  e.category === 'AUTHENTICATION_PERMISSION' ||
                  e.category === 'CONNECTOR',
              )
              .reduce((acc, e) => acc + (e.occurrenceCount || 0), 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Token expiry or secret issues
          </div>
        </Card>
      </div>

      {/* ERRORS TABLE */}
      <Card className="p-5 shadow-2xs">
        <div className="text-xs font-semibold text-foreground mb-4">
          Fingerprinted Error Groups & Incident Analysis
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-raised/50 text-[11px]">
                <TableHead>Category</TableHead>
                <TableHead>Error Message / Fingerprint</TableHead>
                <TableHead>Occurrences</TableHead>
                <TableHead>Affected Runs</TableHead>
                <TableHead>First Seen</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errorList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-emerald-500">
                    Zero errors logged in this timeframe. All systems operating cleanly.
                  </TableCell>
                </TableRow>
              ) : (
                errorList.map((item) => (
                  <TableRow
                    key={item.fingerprint}
                    className="hover:bg-surface-raised/50 cursor-pointer text-xs"
                    onClick={() => setSelectedError(item)}
                  >
                    <TableCell>
                      <Badge
                        variant={getCategoryBadgeVariant(item.category)}
                        className="text-[10px] font-mono"
                      >
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-foreground font-medium max-w-sm truncate">
                      {item.title}
                    </TableCell>
                    <TableCell className="font-bold tabular-nums text-rose-500">
                      {item.occurrenceCount}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {item.affectedExecutionsCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px]">
                      {new Date(item.firstSeenAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px]">
                      {new Date(item.lastSeenAt).toLocaleTimeString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* SELECTED ERROR DIAGNOSTIC REMEDIATION */}
      {selectedError && (
        <Card className="p-5 shadow-2xs border-rose-500/40 space-y-3">
          <div className="flex items-center gap-2">
            <Wrench className="size-4 text-rose-500" />
            <h4 className="font-bold text-sm text-foreground">
              Diagnostic & Remediation Playbook: {selectedError.category}
            </h4>
          </div>

          <div className="p-3 rounded-lg bg-surface-raised border border-border text-xs font-mono break-all text-destructive">
            {selectedError.sampleMessage}
          </div>

          <div className="space-y-1.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Recommended Actions:</span>
            <p>{selectedError.recommendedAction}</p>
            {selectedError.possibleCause && (
              <p>
                <span className="font-semibold text-foreground">Likely cause:</span>{' '}
                {selectedError.possibleCause}
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
