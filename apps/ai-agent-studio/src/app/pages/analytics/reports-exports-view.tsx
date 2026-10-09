import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  toast,
} from '@org/ui';
import type { ReportType } from '@org/types';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Sparkles,
} from 'lucide-react';
import { analyticsService } from '../../services/analyticsService.js';
import { useStudioSession } from '../../session-guard.js';

const AVAILABLE_REPORTS: { type: ReportType; title: string; description: string }[] = [
  {
    type: 'AI_OVERVIEW',
    title: 'AI Operations Overview',
    description: 'Headline run volume, success rate, latency, token and cost KPIs for the window',
  },
  {
    type: 'AI_EXECUTION_HISTORY',
    title: 'Workflow & Agent Executions',
    description: 'Complete record of runs, durations, statuses, tokens, and initiation triggers',
  },
  {
    type: 'AI_TOKEN_COST',
    title: 'Cost & Token Consumption',
    description: 'Detailed spend breakdown by agent, workflow, and model',
  },
  {
    type: 'AI_AGENT_PERFORMANCE',
    title: 'Agent Performance & Latencies',
    description: 'Per-agent execution volume, success rates, p95 latencies, and tool frequencies',
  },
  {
    type: 'AI_WORKFLOW_RELIABILITY',
    title: 'Workflow Reliability',
    description: 'Per-workflow success rates, failure hotspots, and slowest nodes',
  },
  {
    type: 'AI_ERROR_ANALYSIS',
    title: 'Errors & Reliability Incident Log',
    description: 'Fingerprinted error signatures, affected executions, and provider rate-limit counts',
  },
  {
    type: 'AI_CONNECTOR_PERFORMANCE',
    title: 'Tool & App Connector Reliability',
    description: 'Integration health, external API call latencies, and tool invocation counts',
  },
  {
    type: 'AI_VERSION_COMPARISON',
    title: 'Version Comparison',
    description: 'Run metrics across published versions of each agent and workflow',
  },
  {
    type: 'AI_EVALUATIONS',
    title: 'Evaluations & Feedback',
    description: 'Ratings, reported issues, and human approval turnaround',
  },
];

export function ReportsExportsView({ dateRange }: { dateRange: string }) {
  const { activeWorkspace } = useStudioSession();
  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  const handleExport = async (reportType: ReportType, format: 'csv' | 'json') => {
    setDownloadingType(`${reportType}-${format}`);
    try {
      if (format === 'csv') {
        const csvContent = await analyticsService.exportReportCsv(
          activeWorkspace.id,
          reportType,
          dateRange,
        );
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${reportType}-${dateRange}-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast(`Downloaded ${reportType}.csv`);
      } else {
        const jsonContent = await analyticsService.generateReport(
          activeWorkspace.id,
          reportType,
          dateRange,
        );
        const blob = new Blob([JSON.stringify(jsonContent, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${reportType}-${dateRange}-${Date.now()}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast(`Downloaded ${reportType}.json`);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to export report');
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-foreground">
          Analytics Reports & Telemetry Data Exports
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Export full real-time telemetry datasets in CSV or JSON format for business intelligence, audits, and compliance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AVAILABLE_REPORTS.map((rep) => {
          const isDownloadingCsv = downloadingType === `${rep.type}-csv`;
          const isDownloadingJson = downloadingType === `${rep.type}-json`;

          return (
            <Card
              key={rep.type}
              className="p-5 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-2xs space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-foreground text-sm">{rep.title}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {rep.type}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {rep.description}
                </p>
              </div>

              <div className="flex items-center gap-2 border-t border-border pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(rep.type, 'csv')}
                  loading={isDownloadingCsv}
                  className="flex-1 text-xs h-8 gap-1.5"
                >
                  <FileSpreadsheet className="size-3.5 text-emerald-500" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(rep.type, 'json')}
                  loading={isDownloadingJson}
                  className="flex-1 text-xs h-8 gap-1.5"
                >
                  <FileText className="size-3.5 text-primary" />
                  JSON
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
