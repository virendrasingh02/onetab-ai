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
import type { EvaluationsAnalyticsOverview } from '@org/types';
import {
  CheckCircle2,
  Clock,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  XCircle,
} from 'lucide-react';

interface EvaluationsQualityViewProps {
  evaluations: EvaluationsAnalyticsOverview;
}

export function EvaluationsQualityView({ evaluations }: EvaluationsQualityViewProps) {
  const averageRating = evaluations.ratingAverage;
  const totalRatings = evaluations.totalFeedbackCount;
  const positiveRatings = evaluations.positiveFeedbackCount;
  const negativeRatings = evaluations.negativeFeedbackCount;
  const satisfactionScore = totalRatings > 0 ? (positiveRatings / totalRatings) * 100 : 0;
  const topReportedIssues = evaluations.topIssues;
  const { humanApprovals } = evaluations;
  const decided = humanApprovals.approved + humanApprovals.rejected;
  const approvalRate = decided > 0 ? (humanApprovals.approved / decided) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* SUMMARY RATINGS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Average Agent Rating</span>
            <Star className="size-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {averageRating > 0 ? `${averageRating.toFixed(1)} / 5.0` : 'No ratings'}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Based on {totalRatings} user reviews
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>User Satisfaction</span>
            <Sparkles className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-500">
            {satisfactionScore.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Positive sentiment ratio
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Human Approvals</span>
            <UserCheck className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {approvalRate.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {humanApprovals.approved} of {humanApprovals.totalRequests} approved
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Approval Turnaround</span>
            <Clock className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {humanApprovals.avgResponseTimeMinutes.toFixed(1)}m
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Average operator response time
          </div>
        </Card>
      </div>

      {/* FEEDBACK DISTRIBUTION & ISSUES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Feedback Breakdown */}
        <Card className="p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-semibold text-foreground">
            Sentiment & Feedback Breakdown
          </h3>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center justify-center gap-1.5 text-emerald-500 font-semibold text-xs">
                <ThumbsUp className="size-4" />
                Positive
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {positiveRatings}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <div className="flex items-center justify-center gap-1.5 text-rose-500 font-semibold text-xs">
                <ThumbsDown className="size-4" />
                Negative
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {negativeRatings}
              </div>
            </div>
          </div>
        </Card>

        {/* Reported Issues */}
        <Card className="p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-semibold text-foreground">
            Reported Quality & Hallucination Categories
          </h3>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-raised/50 text-[11px]">
                  <TableHead>Issue Category</TableHead>
                  <TableHead className="text-right">Report Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topReportedIssues.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-6 text-xs text-muted-foreground">
                      No quality issue tags reported by users.
                    </TableCell>
                  </TableRow>
                ) : (
                  topReportedIssues.map((issue) => (
                    <TableRow key={issue.category} className="hover:bg-surface-raised/50 text-xs">
                      <TableCell className="font-medium text-foreground">
                        {issue.category}
                      </TableCell>
                      <TableCell className="tabular-nums font-bold text-right text-rose-500">
                        {issue.count}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
