import { aiEntitiesApi } from '@org/api-client';
import {
  Badge,
  Button,
  ErrorState,
  Hint,
  LoadingState,
  PageBar,
  PageTabBar,
  Tabs,
  TabsContent,
  TabsTrigger,
} from '@org/ui';
import { AIEntityAvatar, AIEntityRunsList } from '@org/web-agents';
import { useCanManageAIResource, useCurrentWorkspace } from '@org/web-workspace';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowLeft, MessageSquare, UserCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CoworkerCreateDialog } from '../CoworkerCreateDialog.js';
import { CoworkerProfileDetails } from '../CoworkerProfilePanel.js';
import { useCoworker } from '../use-coworkers.js';

function aiPath(slug: string | undefined, ...rest: string[]) {
  return [`/w/${slug ?? ''}/ai`, ...rest].join('/');
}

/**
 * `/w/:slug/ai/agents/:agentId` — a coworker opens its profile here, where its
 * persona, model, tools and delegate agents are edited. Agents (and "new") are
 * built in the standalone AI Agent Studio, so `agentFallback` renders for them.
 */
export function AIEntityEditorRoute({ agentFallback }: { agentFallback: ReactNode }) {
  const { agentId } = useParams<{ agentId: string }>();
  const { workspaceId, slug } = useCurrentWorkspace();
  const isNew = !agentId || agentId === 'new';

  const entity = useQuery({
    queryKey: ['ai-entities', workspaceId, 'detail', agentId],
    queryFn: () => aiEntitiesApi.get(workspaceId as string, agentId as string),
    enabled: Boolean(workspaceId && !isNew),
  });

  if (isNew) return <>{agentFallback}</>;
  if (entity.isLoading) return <LoadingState fullPage label="Opening…" />;
  if (entity.isError || !entity.data) {
    return (
      <div className="grid flex-1 place-items-center p-6">
        <ErrorState
          title="Not found"
          description="This agent or coworker may have been deleted, or it belongs to another workspace."
          action={
            <Button asChild variant="outline">
              <Link to={aiPath(slug, 'agents')}>Back to agents</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return entity.data.type === 'coworker' ? (
    <CoworkerEditorView coworkerId={entity.data.id} />
  ) : (
    <>{agentFallback}</>
  );
}

function CoworkerEditorView({ coworkerId }: { coworkerId: string }) {
  const navigate = useNavigate();
  const { workspaceId, slug } = useCurrentWorkspace();
  const canManage = useCanManageAIResource();
  const coworker = useCoworker(workspaceId, coworkerId);
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState('profile');

  if (coworker.isLoading) return <LoadingState fullPage label="Opening coworker…" />;
  if (!coworker.data) {
    return (
      <div className="grid flex-1 place-items-center p-6">
        <ErrorState title="Coworker not found" />
      </div>
    );
  }
  const data = coworker.data;
  const editable = canManage(data.creatorId);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <PageBar
        hasTabs
        icon={
          <span className="flex items-center gap-2">
            <Hint label="Back to agents">
              <Button variant="ghost" size="icon-sm" asChild aria-label="Back to agents">
                <Link to={aiPath(slug, 'agents')}>
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
            </Hint>
            <AIEntityAvatar name={data.name} type="coworker" avatarUrl={data.avatarUrl} size="sm" />
          </span>
        }
        title={data.name}
        meta={
          <>
            {data.role ? (
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                {data.role}
              </span>
            ) : null}
            <Badge variant="outline" className="shrink-0 text-[10px]">
              Coworker
            </Badge>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" leadingIcon={<MessageSquare />} asChild>
              <Link to={`/w/${slug ?? ''}/coworkers/${data.id}`}>Chat</Link>
            </Button>
            {editable ? (
              <Button size="sm" leadingIcon={<UserCheck />} onClick={() => setEditOpen(true)}>
                Edit coworker
              </Button>
            ) : null}
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <PageTabBar>
          <TabsTrigger value="profile" icon={<UserCheck className="size-4" aria-hidden />}>
            Profile
          </TabsTrigger>
          <TabsTrigger value="runs" icon={<Activity className="size-4" aria-hidden />}>
            Runs
          </TabsTrigger>
        </PageTabBar>
        <TabsContent value="profile" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <CoworkerProfileDetails
            coworker={data}
            workspaceId={workspaceId as string}
            onEdit={editable ? () => setEditOpen(true) : undefined}
            onStartChat={() => navigate(`/w/${slug ?? ''}/coworkers/${data.id}`)}
          />
        </TabsContent>
        <TabsContent value="runs" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <AIEntityRunsList workspaceId={workspaceId} slug={slug} entityId={data.id} />
        </TabsContent>
      </Tabs>

      {workspaceId ? (
        <CoworkerCreateDialog open={editOpen} onOpenChange={setEditOpen} workspaceId={workspaceId} coworker={data} />
      ) : null}
    </div>
  );
}
