import { CallSummaryView } from '@org/web-chat';
import { Button, EmptyState, Spinner } from '@org/ui';
import { PhoneCall } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCurrentWorkspace } from './use-work-tools.js';

/**
 * Standalone deep-link target for a single call session — reached from search
 * results and "call summary ready" / "shared with you" notifications, which
 * only ever know a call id, not a channel or meeting to route through.
 */
export function CallDetailPage() {
  const { workspaceId, slug, isLoading } = useCurrentWorkspace();
  const [params] = useSearchParams();
  const callId = params.get('callId');

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!workspaceId || !callId) {
    return (
      <div className="p-6 flex h-full items-center justify-center">
        <EmptyState
          icon={<PhoneCall className="size-8 text-muted-foreground" />}
          title="No call selected"
          description="This link is missing a call to open. Past calls and their summaries are listed under Meetings."
          action={
            slug ? (
              <Button asChild size="sm">
                <Link to={`/w/${slug}/meetings`}>Go to Meetings</Link>
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="h-full">
      <CallSummaryView workspaceId={workspaceId} callId={callId} />
    </div>
  );
}
